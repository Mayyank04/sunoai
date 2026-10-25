import os
import io
import wave
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from httpx import AsyncClient, Response
from backend.app.services.providers.registry import provider_registry
from backend.app.services.providers.base import (
    MusicGenerationProvider,
    ProviderCapabilities,
    GenerationRequestParams,
    GenerationResult,
    GenerationStatus,
    CostEstimate,
    LicenseMetadata,
)
from backend.app.services.providers.procedural import ProceduralMusicProvider
from backend.app.services.providers.audiocraft import AudiocraftMusicProvider
from backend.app.services.providers.suno import SunoMusicProvider
from backend.app.services.providers.stability import StabilityAudioProvider
from backend.app.services.job_runner import job_runner
from backend.app.core.database import async_session_maker
from backend.app.models.user import User
from backend.app.models.job import Job
from backend.app.models.generation import Generation
from backend.app.models.subscription import CreditLedger
from backend.app.models.track import Track
from backend.app.models.version import SongVersion
from backend.app.models.asset import Asset
from sqlalchemy import select

def _create_minimal_wav_bytes(duration_sec: float = 1.0, sample_rate: int = 44100) -> bytes:
    """Helper creating real valid WAV header and samples (no fake/empty mp3s)."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        num_frames = int(duration_sec * sample_rate)
        # 16-bit silence or low hum
        wf.writeframes(b"\x00\x00" * 2 * num_frames)
    return buf.getvalue()

# ==============================================================================
# 1. PROVIDER CONTRACT TESTS (Method Signatures, Types & Capabilities)
# ==============================================================================

class TestProviderContracts:
    """Verifies all registered providers strictly implement the MusicGenerationProvider interface."""

    @pytest.mark.parametrize("provider_cls", [
        ProceduralMusicProvider,
        AudiocraftMusicProvider,
        SunoMusicProvider,
        StabilityAudioProvider,
    ])
    def test_provider_contract_compliance(self, provider_cls):
        provider = provider_cls()
        assert isinstance(provider, MusicGenerationProvider)

        # 1. validate_configuration
        is_ready, msg = provider.validate_configuration()
        assert isinstance(is_ready, bool)
        assert msg is None or isinstance(msg, str)

        # 2. get_capabilities & getCapabilities alias
        caps = provider.get_capabilities()
        assert isinstance(caps, ProviderCapabilities)
        assert provider.getCapabilities() == caps
        assert isinstance(caps.provider_id, str)
        assert isinstance(caps.supports_lyrics, bool)
        assert isinstance(caps.supports_vocals, bool)
        assert isinstance(caps.supports_dual_variants, bool)
        assert caps.min_duration_seconds > 0
        assert caps.max_duration_seconds >= caps.min_duration_seconds

        # 3. estimate_cost & estimateCost alias
        dummy_params = GenerationRequestParams(
            provider_id=provider.provider_id,
            prompt="Test harmonic progression",
            duration_seconds=30,
            generate_two_variants=False,
        )
        cost = provider.estimate_cost(dummy_params)
        assert isinstance(cost, CostEstimate)
        assert provider.estimateCost(dummy_params) == cost
        assert cost.credits_required >= 5
        assert cost.estimated_duration_seconds > 0

        # 4. get_license_metadata & getLicenseMetadata alias
        lic = provider.get_license_metadata("creator")
        assert isinstance(lic, LicenseMetadata)
        assert provider.getLicenseMetadata("creator") == lic
        assert isinstance(lic.commercial_use_allowed, bool)
        assert lic.c2pa_manifest_conforming is True

    @pytest.mark.asyncio
    async def test_procedural_synthesizer_generates_authentic_wav(self):
        """Procedural provider must generate genuine polyphonic WAV audio with valid headers."""
        provider = ProceduralMusicProvider()
        params = GenerationRequestParams(
            provider_id="fombo_procedural",
            prompt="80s analog synth with pumping bassline",
            bpm=120,
            musical_key="F Minor",
            duration_seconds=10,
            generate_two_variants=True,
        )

        result = await provider.generate(params)
        assert isinstance(result, GenerationResult)
        assert len(result.audio_bytes) > 1000
        # Check RIFF/WAVE header
        assert result.audio_bytes[:4] == b"RIFF"
        assert result.audio_bytes[8:12] == b"WAVE"
        assert result.sample_rate == 44100
        assert result.channels == 2
        assert result.format == "wav"

        # Check Variant 2 was produced
        assert result.second_variant_bytes is not None
        assert len(result.second_variant_bytes) > 1000
        assert result.second_variant_bytes[:4] == b"RIFF"
        assert result.second_variant_bytes[8:12] == b"WAVE"

    @pytest.mark.asyncio
    async def test_audiocraft_provider_mock_generate(self):
        """Audiocraft provider mocked GPU worker contract test."""
        provider = AudiocraftMusicProvider()
        valid_wav = _create_minimal_wav_bytes(duration_sec=10.0, sample_rate=32000)

        params = GenerationRequestParams(
            provider_id="audiocraft",
            prompt="Cinematic strings and brass",
            duration_seconds=10,
            generate_two_variants=False,
        )

        with patch("backend.app.core.config.settings.AUDIOCRAFT_SERVICE_URL", "http://gpu-worker.internal:8000"):
            with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
                mock_resp = MagicMock()
                mock_resp.status_code = 200
                mock_resp.content = valid_wav
                mock_post.return_value = mock_resp

                res = await provider.generate(params)
                assert isinstance(res, GenerationResult)
                assert res.audio_bytes == valid_wav
                assert res.sample_rate == 32000
                assert res.second_variant_bytes is None  # Audiocraft does not support dual variants

    @pytest.mark.asyncio
    async def test_suno_provider_mock_dual_variant_generate(self):
        """Suno provider mocked API response returning both Variant A and Variant B."""
        provider = SunoMusicProvider()
        valid_wav_a = _create_minimal_wav_bytes(duration_sec=15.0)
        valid_wav_b = _create_minimal_wav_bytes(duration_sec=15.0)

        params = GenerationRequestParams(
            provider_id="suno",
            prompt="Cyberpunk anthem with robotic vocals",
            lyrics="Walking into neon light / Shadows dancing in the night",
            make_instrumental=False,
            duration_seconds=15,
            generate_two_variants=True,
        )

        with patch("backend.app.core.config.settings.SUNO_API_KEY", "mock-suno-key-123"):
            with patch("backend.app.core.config.settings.SUNO_API_URL", "https://api.suno.mock"):
                with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
                    mock_post_resp = MagicMock()
                    mock_post_resp.status_code = 200
                    mock_post_resp.json.return_value = {
                        "id": "suno_job_999",
                        "audio_url": "https://cdn.suno.mock/take1.mp3",
                        "second_audio_url": "https://cdn.suno.mock/take2.mp3",
                    }
                    mock_post.return_value = mock_post_resp

                    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
                        # Return take 1 then take 2
                        resp1 = MagicMock(content=valid_wav_a)
                        resp2 = MagicMock(content=valid_wav_b)
                        mock_get.side_effect = [resp1, resp2]

                        res = await provider.generate(params)
                        assert isinstance(res, GenerationResult)
                        assert res.audio_bytes == valid_wav_a
                        assert res.second_variant_bytes == valid_wav_b
                        assert res.provider_job_id == "suno_job_999"


# ==============================================================================
# 2. CAPABILITY VALIDATION & CONTROL REJECTION TESTS
# ==============================================================================

class TestCapabilityValidation:
    """Verifies that requested controls are strictly governed against provider capabilities."""

    @pytest.mark.asyncio
    async def test_lyrics_rejected_on_procedural_synthesizer(self, client: AsyncClient, auth_headers: dict):
        """fombo_procedural does not support lyrics -> Must return 422 with explanation."""
        payload = {
            "prompt": "Retro pop tune",
            "lyrics": "Here are my verse lines that should be rejected by procedural provider",
            "make_instrumental": False,
            "provider": "fombo_procedural",
            "model_name": "procedural-dsp-v1",
            "duration_seconds": 30,
        }

        resp = await client.post("/api/v1/generation/create", json=payload, headers=auth_headers)
        assert resp.status_code == 422
        assert "does not support lyrics" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_vocal_request_rejected_on_instrumental_only_provider(self, client: AsyncClient, auth_headers: dict):
        """fombo_procedural does not support singing vocals -> make_instrumental=False must return 422."""
        payload = {
            "prompt": "Rock anthem with female vocals",
            "make_instrumental": False,
            "provider": "fombo_procedural",
            "model_name": "procedural-dsp-v1",
            "duration_seconds": 30,
        }

        resp = await client.post("/api/v1/generation/create", json=payload, headers=auth_headers)
        assert resp.status_code == 422
        assert "does not support singing" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_duration_exceeding_provider_bounds_rejected(self, client: AsyncClient, auth_headers: dict):
        """Duration of 250s exceeds procedural max (180s) -> Must return 422."""
        payload = {
            "prompt": "Ambient meditation drone",
            "make_instrumental": True,
            "provider": "fombo_procedural",
            "model_name": "procedural-dsp-v1",
            "duration_seconds": 250,
        }

        resp = await client.post("/api/v1/generation/create", json=payload, headers=auth_headers)
        assert resp.status_code == 422
        assert "supported bounds" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_estimate_cost_endpoint(self, client: AsyncClient, auth_headers: dict):
        """POST /api/v1/generation/estimate returns accurate credits quota."""
        payload = {
            "provider": "fombo_procedural",
            "model_name": "procedural-dsp-v1",
            "duration_seconds": 90,
            "generate_two_variants": True,
        }

        resp = await client.post("/api/v1/generation/estimate", json=payload, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "credits_required" in data
        # 5 base + 3 (dual variants) + 2 (>60s) = 10
        assert data["credits_required"] == 10
        assert data["estimated_duration_seconds"] > 0

    @pytest.mark.asyncio
    async def test_get_license_terms_endpoint(self, client: AsyncClient, auth_headers: dict):
        """GET /api/v1/generation/license returns commercial rights metadata."""
        resp = await client.get("/api/v1/generation/license?provider_id=fombo_procedural&tier=pro", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["commercial_use_allowed"] is True
        assert data["c2pa_manifest_conforming"] is True


# ==============================================================================
# 3. DUAL VARIANTS & OBJECT STORAGE PERSISTENCE TESTS
# ==============================================================================

class TestDualVariantsAndStorage:
    """Verifies dual variant generation, object storage, and that audio blobs are never stored in DB."""

    @pytest.mark.asyncio
    async def test_dual_variant_generation_and_storage(self, client: AsyncClient, auth_headers: dict):
        """Procedural provider generates Variant A and Variant B; both saved to storage and DB models."""
        payload = {
            "prompt": "Futuristic cyberpunk synth with analog arpeggiator",
            "genre": "Cyberpunk",
            "bpm": 130,
            "musical_key": "D Minor",
            "duration_seconds": 10,
            "make_instrumental": True,
            "provider": "fombo_procedural",
            "model_name": "procedural-dsp-v1",
            "generate_two_variants": True,
        }

        create_resp = await client.post("/api/v1/generation/create", json=payload, headers=auth_headers)
        assert create_resp.status_code == 202
        job_id = create_resp.json()["job_id"]
        assert create_resp.json()["variants_supported"] is True

        # Wait for background execution to complete
        import asyncio
        for _ in range(50):
            await asyncio.sleep(0.1)
            st_resp = await client.get(f"/api/v1/generation/{job_id}/status", headers=auth_headers)
            if st_resp.status_code == 200 and st_resp.json()["status"] == "completed":
                break

        final_st = await client.get(f"/api/v1/generation/{job_id}/status", headers=auth_headers)
        assert final_st.status_code == 200
        st_data = final_st.json()
        assert st_data["status"] == "completed"
        assert st_data["audio_url"] is not None
        assert st_data["second_audio_url"] is not None
        assert st_data["audio_url"].endswith("_variant_a.wav")
        assert st_data["second_audio_url"].endswith("_variant_b.wav")

        # Verify DB records: Track, SongVersion (for Variant 2), and Asset
        from backend.app.core import database as core_db
        async with core_db.async_session_maker() as session:
            # 1. Track
            t_res = await session.execute(select(Track).where(Track.id == st_data["track_id"]))
            track = t_res.scalar_one_or_none()
            assert track is not None
            assert track.audio_url == st_data["audio_url"]
            assert len(track.waveform_data) > 0

            # 2. SongVersion (Take 2)
            v_res = await session.execute(
                select(SongVersion).where(SongVersion.track_id == track.id, SongVersion.version_number == 2)
            )
            version2 = v_res.scalar_one_or_none()
            assert version2 is not None
            assert version2.audio_url == st_data["second_audio_url"]
            assert "Take 2" in version2.title

            # 3. Asset (storage pointer, NOT a binary blob)
            a_res = await session.execute(select(Asset).where(Asset.track_id == track.id))
            asset = a_res.scalar_one_or_none()
            assert asset is not None
            assert asset.storage_url == track.audio_url
            assert asset.file_size_bytes > 1000
            # Ensure DB column does not store raw audio bytes
            assert not hasattr(asset, "audio_blob")


# ==============================================================================
# 4. CREDIT RESERVATION & AUTO-REFUND ON FAILURE TESTS
# ==============================================================================

class TestCreditSafetyAndRefund:
    """Verifies that credits are reserved transactionally and refunded automatically on failure."""

    @pytest.mark.asyncio
    async def test_failure_triggers_automatic_credit_refund(self, client: AsyncClient, auth_headers: dict):
        """Simulate an inference exception during execution: user credits must be refunded."""
        me_resp = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert me_resp.status_code == 200
        user_id = me_resp.json()["id"]
        initial_balance = me_resp.json()["credits_balance"]

        # We execute a job directly through job_runner with a failing provider
        mock_provider = MagicMock(spec=MusicGenerationProvider)
        mock_provider.name = "Failing Provider"
        mock_provider.validate_configuration.return_value = (True, "Ready")
        mock_provider.generate = AsyncMock(side_effect=RuntimeError("GPU cluster connection timed out"))

        test_job_id = "job_test_fail_123"
        params = GenerationRequestParams(
            provider_id="mock_failing",
            prompt="Will fail",
            duration_seconds=15,
        )

        with patch.object(provider_registry, "get", return_value=mock_provider):
            # Run job_runner execution
            await job_runner.execute_generation_job(
                job_id=test_job_id,
                user_id=user_id,
                params=params,
                credits_cost=5,
            )

        # Verify automatic credit refund in DB
        from backend.app.core import database as core_db
        async with core_db.async_session_maker() as session:
            u_after = await session.execute(select(User).where(User.id == user_id))
            refreshed_user = u_after.scalar_one()
            assert refreshed_user.credits_balance == initial_balance + 5

            # Verify refund CreditLedger entry exists
            ledgers = await session.execute(
                select(CreditLedger).where(
                    CreditLedger.user_id == user_id,
                    CreditLedger.reference_id == test_job_id,
                    CreditLedger.transaction_type == "refund",
                )
            )
            refund_entry = ledgers.scalar_one_or_none()
            assert refund_entry is not None
            assert refund_entry.amount == 5
            assert "Auto-refund" in refund_entry.notes

            # Verify Job and Generation status updated to failed
            g_res = await session.execute(select(Generation).where(Generation.job_id == test_job_id))
            gen = g_res.scalar_one_or_none()
            if gen:
                assert gen.status == "failed"
                assert "GPU cluster connection timed out" in gen.error_message


# ==============================================================================
# 5. OPT-IN REAL-PROVIDER SMOKE TEST (GATED)
# ==============================================================================

class TestRealProviderSmoke:
    """Separate opt-in live test suite for real third-party inference backends."""

    @pytest.mark.skipif(
        not os.getenv("RUN_REAL_PROVIDER_TESTS"),
        reason="Opt-in real provider smoke test requires RUN_REAL_PROVIDER_TESTS=1 with live external credentials."
    )
    @pytest.mark.asyncio
    async def test_live_suno_api_smoke(self):
        """Smoke test executing against a live Suno API endpoint if configured in environment."""
        suno_key = os.getenv("SUNO_API_KEY")
        suno_url = os.getenv("SUNO_API_URL")
        if not suno_key or not suno_url:
            pytest.skip("SUNO_API_KEY or SUNO_API_URL environment variable missing.")

        provider = SunoMusicProvider()
        is_ready, msg = provider.validate_configuration()
        assert is_ready, f"Suno provider configuration invalid: {msg}"

        params = GenerationRequestParams(
            provider_id="suno",
            prompt="Upbeat electro pop synth groove",
            lyrics="Feel the rhythm in the night / Everything is glowing bright",
            make_instrumental=False,
            duration_seconds=15,
            generate_two_variants=True,
        )

        res = await provider.generate(params)
        assert isinstance(res, GenerationResult)
        assert len(res.audio_bytes) > 5000
        assert res.format in ("mp3", "wav")

    @pytest.mark.skipif(
        not os.getenv("RUN_REAL_PROVIDER_TESTS"),
        reason="Opt-in real provider smoke test requires RUN_REAL_PROVIDER_TESTS=1 with live external credentials."
    )
    @pytest.mark.asyncio
    async def test_live_stability_audio_smoke(self):
        """Smoke test executing against a live Stability Audio API if configured in environment."""
        stability_key = os.getenv("STABILITY_API_KEY")
        if not stability_key:
            pytest.skip("STABILITY_API_KEY environment variable missing.")

        provider = StabilityAudioProvider()
        is_ready, msg = provider.validate_configuration()
        assert is_ready, f"Stability provider configuration invalid: {msg}"

        params = GenerationRequestParams(
            provider_id="stability",
            prompt="Deep atmospheric ambient pad with subtle chimes",
            duration_seconds=10,
        )

        res = await provider.generate(params)
        assert isinstance(res, GenerationResult)
        assert len(res.audio_bytes) > 5000
