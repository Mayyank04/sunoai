import io
import os
import wave
import struct
import tempfile
import time
import pytest
from httpx import AsyncClient

from backend.app.services.audio_processor import ProceduralAudioSynthesizer, AudioProcessor
from backend.app.services.audio_editing import audio_editing_service
from backend.app.services.providers.demucs import DemucsStemProvider
from backend.app.services.storage import storage_service

@pytest.mark.asyncio
class TestAudioEditingDSP:
    """Verifies low-level DSP operations, boundary micro-fades, durations, and audio integrity."""

    def test_verify_audio_integrity_valid_and_invalid(self):
        # 1. Valid 16-bit 44.1kHz audio
        valid_wav = ProceduralAudioSynthesizer.synthesize_composition(
            bpm=120, musical_key="C Major", duration_seconds=3.0, genre="Lo-Fi"
        )
        is_valid, meta = audio_editing_service.verify_audio_integrity(valid_wav)
        assert is_valid is True
        assert meta["sample_rate"] == 44100
        assert meta["sample_width"] == 2
        assert meta["channels"] in (1, 2)
        assert abs(meta["duration_seconds"] - 3.0) < 0.1
        assert meta["frame_count"] > 0

        # 2. Corrupt / empty bytes
        is_valid, err = audio_editing_service.verify_audio_integrity(b"")
        assert is_valid is False
        assert "too small" in err["error"]

        # 3. Truncated header
        is_valid, err = audio_editing_service.verify_audio_integrity(b"RIFF\x00\x00\x00\x00WAVEfmt ")
        assert is_valid is False

        # 4. Non-WAV junk
        is_valid, err = audio_editing_service.verify_audio_integrity(b"THIS_IS_NOT_A_VALID_RIFF_CONTAINER" * 5)
        assert is_valid is False
        assert "Invalid RIFF/WAVE header" in err["error"]

    def test_crop_or_trim_duration_and_micro_fades(self):
        source_wav = ProceduralAudioSynthesizer.synthesize_composition(
            bpm=128, musical_key="A Minor", duration_seconds=6.0, genre="Synthwave"
        )
        # Trim from 1.0s to 4.5s (expected duration 3.5s)
        trimmed = audio_editing_service.crop_or_trim(source_wav, start_sec=1.0, end_sec=4.5, fade_ms=20.0)
        is_valid, meta = audio_editing_service.verify_audio_integrity(trimmed)
        assert is_valid is True
        assert abs(meta["duration_seconds"] - 3.5) < 0.05
        assert meta["sample_rate"] == 44100
        assert meta["sample_width"] == 2

        # Verify invalid crop ranges raise ValueError
        with pytest.raises(ValueError, match="Invalid crop bounds"):
            audio_editing_service.crop_or_trim(source_wav, start_sec=5.0, end_sec=2.0)

        with pytest.raises(ValueError, match="Invalid crop bounds"):
            audio_editing_service.crop_or_trim(source_wav, start_sec=3.0, end_sec=3.0)

    def test_apply_fades_duration_and_gain(self):
        source_wav = ProceduralAudioSynthesizer.synthesize_composition(
            bpm=120, musical_key="G Major", duration_seconds=5.0, genre="Ambient"
        )
        faded = audio_editing_service.apply_fades(source_wav, fade_in_sec=1.0, fade_out_sec=1.0)
        is_valid, meta = audio_editing_service.verify_audio_integrity(faded)
        assert is_valid is True
        assert abs(meta["duration_seconds"] - 5.0) < 0.05

        # Check that beginning sample amplitude is scaled down near zero
        with wave.open(io.BytesIO(faded), "rb") as wf:
            first_frame = wf.readframes(1)
            samp = struct.unpack("<h", first_frame[:2])[0]
            assert abs(samp) < 500  # Faded to silence

    def test_replace_section_crossfade_and_duration(self):
        base_wav = ProceduralAudioSynthesizer.synthesize_composition(
            bpm=120, musical_key="D Minor", duration_seconds=6.0, genre="Electronic"
        )
        replacement_wav = ProceduralAudioSynthesizer.synthesize_composition(
            bpm=120, musical_key="D Minor", duration_seconds=2.0, genre="Cyberpunk"
        )
        # Replace section from 2.0s to 4.0s
        inpainted = audio_editing_service.replace_section(
            original_wav_bytes=base_wav,
            start_sec=2.0,
            end_sec=4.0,
            replacement_wav_bytes=replacement_wav,
            crossfade_ms=25.0,
        )
        is_valid, meta = audio_editing_service.verify_audio_integrity(inpainted)
        assert is_valid is True
        assert abs(meta["duration_seconds"] - 6.0) < 0.1

    def test_extend_audio_dsp_duration(self):
        source_wav = ProceduralAudioSynthesizer.synthesize_composition(
            bpm=120, musical_key="E Minor", duration_seconds=4.0, genre="Lo-Fi"
        )
        extended = audio_editing_service.extend_audio_dsp(
            source_wav, additional_seconds=3.0, loop_segment_len=2.0
        )
        is_valid, meta = audio_editing_service.verify_audio_integrity(extended)
        assert is_valid is True
        assert abs(meta["duration_seconds"] - 7.0) < 0.15

    def test_remix_effects_speed_and_eq(self):
        source_wav = ProceduralAudioSynthesizer.synthesize_composition(
            bpm=120, musical_key="C Major", duration_seconds=4.0, genre="Synthwave"
        )
        # Accelerate by 1.33x with bass boost
        remixed = audio_editing_service.apply_remix_effects(
            source_wav, speed_factor=1.33, bass_boost_gain=1.5, treble_gain=0.9
        )
        is_valid, meta = audio_editing_service.verify_audio_integrity(remixed)
        assert is_valid is True
        expected_dur = 4.0 / 1.33
        assert abs(meta["duration_seconds"] - expected_dur) < 0.2

    def test_storage_cleanup_orphaned_files(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            old_file = os.path.join(tmp_dir, "temp_old_render.wav")
            fresh_file = os.path.join(tmp_dir, "temp_fresh_render.wav")

            with open(old_file, "wb") as f:
                f.write(b"RIFFdummy" * 10)
            with open(fresh_file, "wb") as f:
                f.write(b"RIFFdummy" * 10)

            # Set old_file mtime to 48 hours ago
            two_days_ago = time.time() - (48 * 3600)
            os.utime(old_file, (two_days_ago, two_days_ago))

            # Run cleanup with 24 hour threshold
            cleaned = audio_editing_service.clean_orphaned_audio_files(tmp_dir, max_age_hours=24)
            assert cleaned == 1
            assert not os.path.exists(old_file)
            assert os.path.exists(fresh_file)


@pytest.mark.asyncio
class TestStemSeparationAlignment:
    """Verifies Demucs stem separation, exact timestamp synchronization, and master preservation."""

    async def test_stem_separation_sample_accurate_alignment(self):
        master_audio = ProceduralAudioSynthesizer.synthesize_composition(
            bpm=120, musical_key="F Major", duration_seconds=4.0, genre="Synthwave"
        )
        is_valid_master, master_meta = audio_editing_service.verify_audio_integrity(master_audio)
        assert is_valid_master is True

        stems = await DemucsStemProvider.separate_stems(master_audio)
        assert set(stems.keys()) == {"vocals", "drums", "bass", "other"}

        for stem_name, stem_bytes in stems.items():
            is_valid_stem, stem_meta = audio_editing_service.verify_audio_integrity(stem_bytes)
            assert is_valid_stem is True, f"Stem {stem_name} failed audio verification"
            # Synchronization requirement: Stems must match master duration and frame rate
            assert stem_meta["sample_rate"] == master_meta["sample_rate"], (
                f"Stem {stem_name} sample rate mismatch"
            )
            assert abs(stem_meta["duration_seconds"] - master_meta["duration_seconds"]) < 0.05, (
                f"Stem {stem_name} timestamp drifted from master duration"
            )
            assert stem_meta["channels"] == master_meta["channels"], (
                f"Stem {stem_name} channel configuration drifted"
            )


@pytest.mark.asyncio
class TestEditorAPI:
    """Verifies end-to-end Editor API endpoints, capability governance, and non-destructive versions."""

    async def test_recording_upload_and_audio_lifecycle(
        self, client: AsyncClient, auth_headers: dict
    ):
        # 1. Synthesize genuine 4-second WAV recording
        rec_bytes = ProceduralAudioSynthesizer.synthesize_composition(
            bpm=120, musical_key="C Major", duration_seconds=4.0, genre="Vocal"
        )

        files = {"file": ("microphone_take1.wav", io.BytesIO(rec_bytes), "audio/wav")}
        data = {"title": "Acoustic Take 1", "genre": "Indie Acoustic", "bpm": "115", "musical_key": "E Minor"}

        res = await client.post("/api/v1/editor/upload-recording", files=files, data=data, headers=auth_headers)
        assert res.status_code == 201, res.text
        rec_data = res.json()
        track_id = rec_data["track_id"]
        assert rec_data["title"] == "Acoustic Take 1"
        assert abs(rec_data["duration_seconds"] - 4.0) < 0.1
        assert len(rec_data["waveform_data"]) > 0

        # Verify initial SongVersion exists
        v_res = await client.get(f"/api/v1/editor/{track_id}/versions")
        assert v_res.status_code == 200
        versions = v_res.json()
        assert len(versions) == 1
        assert versions[0]["version_number"] == 1
        assert "Original" in versions[0]["title"]
        original_audio_url = versions[0]["edited_audio_url"]

        # 2. Perform Non-Destructive Trim (0.5s to 3.0s)
        trim_res = await client.post(
            "/api/v1/editor/trim",
            json={
                "track_id": track_id,
                "start_seconds": 0.5,
                "end_seconds": 3.0,
                "fade_in_seconds": 0.2,
                "fade_out_seconds": 0.2,
                "title": "Tight Verse Cut",
            },
            headers=auth_headers,
        )
        assert trim_res.status_code == 200, trim_res.text
        trim_data = trim_res.json()
        assert trim_data["version_number"] == 2
        assert abs(trim_data["duration_seconds"] - 2.5) < 0.1
        assert trim_data["original_audio_url"] == original_audio_url
        assert trim_data["edited_audio_url"] != original_audio_url

        # Check that original master file in storage is still intact
        orig_key = original_audio_url.replace("/api/v1/storage/file/", "")
        orig_storage_bytes = storage_service.get_file_bytes(orig_key)
        assert orig_storage_bytes is not None
        assert len(orig_storage_bytes) == len(rec_bytes)

        # 3. Apply Fades
        fade_res = await client.post(
            "/api/v1/editor/fade",
            json={
                "track_id": track_id,
                "fade_in_seconds": 0.5,
                "fade_out_seconds": 0.5,
            },
            headers=auth_headers,
        )
        assert fade_res.status_code == 200
        fade_data = fade_res.json()
        assert fade_data["version_number"] == 3

        # 4. Strict Capability Governance: AI Extend
        # Case 4A: Reject AI conditioning on provider without audio-to-audio capability
        extend_fail = await client.post(
            "/api/v1/editor/extend",
            json={
                "track_id": track_id,
                "additional_seconds": 15,
                "provider": "fombo_procedural",
                "use_ai_conditioning": True,
            },
            headers=auth_headers,
        )
        assert extend_fail.status_code == 422
        assert extend_fail.json()["detail"]["error_code"] == "AUDIO_CONDITIONING_UNSUPPORTED"

        # Case 4B: DSP Cadence Extension (use_ai_conditioning=False) succeeds
        extend_dsp = await client.post(
            "/api/v1/editor/extend",
            json={
                "track_id": track_id,
                "additional_seconds": 5,
                "provider": "fombo_procedural",
                "use_ai_conditioning": False,
            },
            headers=auth_headers,
        )
        assert extend_dsp.status_code == 200
        assert extend_dsp.json()["version_number"] == 4
        assert extend_dsp.json()["duration_seconds"] > 7.0

        # Case 4C: Supported audio conditioning provider (suno) succeeds capability check
        extend_suno = await client.post(
            "/api/v1/editor/extend",
            json={
                "track_id": track_id,
                "additional_seconds": 10,
                "provider": "suno",
                "use_ai_conditioning": True,
            },
            headers=auth_headers,
        )
        assert extend_suno.status_code == 200
        assert extend_suno.json()["version_number"] == 5

        # 5. Strict Capability Governance: Inpaint / Replace Section
        inpaint_fail = await client.post(
            "/api/v1/editor/inpaint-section",
            json={
                "track_id": track_id,
                "start_seconds": 1.0,
                "end_seconds": 3.0,
                "prompt": "Guitar solo fill",
                "provider": "fombo_procedural",
                "use_ai_conditioning": True,
            },
            headers=auth_headers,
        )
        assert inpaint_fail.status_code == 422
        assert inpaint_fail.json()["detail"]["error_code"] == "AUDIO_CONDITIONING_UNSUPPORTED"

        # Inpaint with conditioning disabled or supported provider
        inpaint_ok = await client.post(
            "/api/v1/editor/inpaint-section",
            json={
                "track_id": track_id,
                "start_seconds": 1.0,
                "end_seconds": 3.0,
                "prompt": "Electric piano bridge",
                "provider": "audiocraft",
                "use_ai_conditioning": True,
            },
            headers=auth_headers,
        )
        assert inpaint_ok.status_code == 200
        assert inpaint_ok.json()["version_number"] == 6

        # 6. Acoustic Remix
        remix_res = await client.post(
            "/api/v1/editor/remix",
            json={
                "track_id": track_id,
                "target_genre": "Cyberpunk",
                "speed_factor": 1.2,
                "bass_boost": 1.4,
                "treble_boost": 1.1,
            },
            headers=auth_headers,
        )
        assert remix_res.status_code == 200
        assert remix_res.json()["version_number"] == 7

        # 7. Authorized Cover Creation
        # Unconsented cover rejected
        cover_unconsented = await client.post(
            "/api/v1/editor/authorized-cover",
            json={
                "original_track_id": track_id,
                "cover_title": "Unauthorized Bootleg",
                "is_consented": False,
            },
            headers=auth_headers,
        )
        assert cover_unconsented.status_code == 422

        # Consented cover approved with mechanical licensing attestation
        cover_ok = await client.post(
            "/api/v1/editor/authorized-cover",
            json={
                "original_track_id": track_id,
                "cover_title": "Acoustic Tribute Cover",
                "vocalist_name": "Maya Sound",
                "genre": "Acoustic Pop",
                "is_consented": True,
            },
            headers=auth_headers,
        )
        assert cover_ok.status_code == 200
        assert cover_ok.json()["version_number"] == 8

        # 8. Version Listing & Undo History Stack
        versions_list = await client.get(f"/api/v1/editor/{track_id}/versions")
        assert versions_list.status_code == 200
        all_v = versions_list.json()
        assert len(all_v) == 8
        assert all_v[0]["version_number"] == 8  # Newest first

        # Perform Undo
        undo_res = await client.post(f"/api/v1/editor/{track_id}/undo", headers=auth_headers)
        assert undo_res.status_code == 200
        assert undo_res.json()["version_number"] == 7
        assert "Undid to Version 7" in undo_res.json()["operation_summary"]
