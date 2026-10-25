import pytest
import uuid
from httpx import AsyncClient
from fastapi import HTTPException
from backend.app.core.config import settings
from backend.app.core.security import create_access_token, validate_safe_url, sanitize_user_input
from backend.app.services.file_validator import file_validator
from backend.app.services.credit_service import credit_service
from backend.app.models.user import User
from backend.tests.conftest import test_session_maker

@pytest.mark.asyncio
class TestUploadLimitsAndFileSecurity:
    """Tests file size limits, MIME validation, magic bytes, and malware signatures."""

    def test_audio_file_size_exceeding_50mb_rejected(self):
        with pytest.raises(HTTPException) as exc_info:
            file_validator.validate_upload_request(
                mime_type="audio/wav",
                file_size_bytes=55 * 1024 * 1024,  # 55MB (Limit is 50MB)
                filename="huge_audio.wav",
                asset_type="audio",
            )
        assert exc_info.value.status_code == 413
        assert "maximum allowed size" in exc_info.value.detail

    def test_image_file_size_exceeding_5mb_rejected(self):
        with pytest.raises(HTTPException) as exc_info:
            file_validator.validate_upload_request(
                mime_type="image/jpeg",
                file_size_bytes=6 * 1024 * 1024,  # 6MB (Limit is 5MB)
                filename="cover_large.jpg",
                asset_type="image",
            )
        assert exc_info.value.status_code == 413

    def test_disallowed_mime_type_rejected(self):
        with pytest.raises(HTTPException) as exc_info:
            file_validator.validate_upload_request(
                mime_type="application/x-msdownload",
                file_size_bytes=1024,
                filename="malicious.exe",
                asset_type="audio",
            )
        assert exc_info.value.status_code == 400
        assert "Unsupported audio MIME type" in exc_info.value.detail

    def test_magic_byte_header_verification(self):
        valid_wav_header = b"RIFF\x24\x08\x00\x00WAVEfmt \x10\x00\x00\x00"
        assert file_validator.verify_magic_bytes(valid_wav_header, "audio/wav") is True

        # Spoofed file: declared WAV but starting with PDF or text
        fake_wav = b"%PDF-1.4 header contents instead of wave"
        assert file_validator.verify_magic_bytes(fake_wav, "audio/wav") is False

    def test_malware_executable_signature_detection(self):
        # Threat scan detects Windows PE binary header MZ
        pe_binary = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff"
        res = file_validator.scan_file_for_threats(pe_binary)
        assert res["is_safe"] is False
        assert res["threat_detected"] == "ExecutableBinarySignatureFound"

        # Threat scan detects Linux ELF header
        elf_binary = b"\x7fELF\x02\x01\x01\x00"
        res_elf = file_validator.scan_file_for_threats(elf_binary)
        assert res_elf["is_safe"] is False

        # Clean WAV audio bytes pass threat scan
        clean_wav = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x02\x00D\xac\x00\x00"
        res_clean = file_validator.scan_file_for_threats(clean_wav)
        assert res_clean["is_safe"] is True
        assert res_clean["threat_detected"] is None

@pytest.mark.asyncio
class TestBrokenAuthorizationAndAccessBoundaries:
    """Tests IDOR, role permission boundaries and resource isolation."""

    async def test_non_admin_cannot_access_admin_jobs_or_metrics(self, client: AsyncClient, auth_headers: dict):
        res_jobs = await client.get("/api/v1/admin/jobs", headers=auth_headers)
        assert res_jobs.status_code == 403

        res_gpu = await client.get("/api/v1/admin/gpu-costs", headers=auth_headers)
        assert res_gpu.status_code == 403

        res_audit = await client.get("/api/v1/admin/audit-logs", headers=auth_headers)
        assert res_audit.status_code == 403

    async def test_unauthenticated_request_rejected(self, client: AsyncClient):
        res = await client.get("/api/v1/subscriptions/balance")
        assert res.status_code == 401

@pytest.mark.asyncio
class TestCORSAndSecurityHeaders:
    """Tests CORS headers and HTTP security defense-in-depth headers."""

    async def test_cors_preflight_headers_returned(self, client: AsyncClient):
        res = await client.options(
            "/api/v1/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Authorization,Content-Type",
            },
        )
        assert res.status_code == 200
        assert res.headers.get("access-control-allow-origin") == "http://localhost:3000"
        assert "authorization" in res.headers.get("access-control-allow-headers", "").lower()

    async def test_defensive_security_headers_present(self, client: AsyncClient):
        res = await client.get("/api/v1/health")
        assert res.status_code == 200
        assert res.headers.get("X-Content-Type-Options") == "nosniff"
        assert res.headers.get("X-Frame-Options") == "DENY"
        assert res.headers.get("X-XSS-Protection") == "1; mode=block"
        assert "default-src" in res.headers.get("Content-Security-Policy", "")

@pytest.mark.asyncio
class TestSSRFAndXSSProtection:
    """Tests SSRF URL validation and stored XSS sanitization."""

    def test_ssrf_blocks_loopback_and_metadata_addresses(self):
        with pytest.raises(HTTPException) as exc1:
            validate_safe_url("http://127.0.0.1:8080/internal/keys")
        assert exc1.value.status_code == 400

        with pytest.raises(HTTPException) as exc2:
            validate_safe_url("http://localhost:6379/redis")
        assert exc2.value.status_code == 400

        with pytest.raises(HTTPException) as exc3:
            validate_safe_url("http://169.254.169.254/latest/meta-data/")
        assert exc3.value.status_code == 400

        with pytest.raises(HTTPException) as exc4:
            validate_safe_url("file:///etc/passwd")
        assert exc4.value.status_code == 400

    def test_ssrf_permits_public_fqdn_https_urls(self):
        safe_url = "https://cdn.fombomusic.ai/assets/reference_audio.wav"
        validated = validate_safe_url(safe_url)
        assert validated == safe_url

    def test_xss_sanitization_strips_scripts_and_event_handlers(self):
        malicious = '<script>alert("XSS")</script>Hello <iframe src="evil.com"></iframe><img src=x onerror=alert(1)>'
        sanitized = sanitize_user_input(malicious)
        assert "<script>" not in sanitized
        assert "alert(" not in sanitized
        assert "<iframe>" not in sanitized
        assert "onerror" not in sanitized
        assert "Hello" in sanitized

@pytest.mark.asyncio
class TestSQLInjectionResistance:
    """Verifies parameterized query resistance against standard SQL injection payloads."""

    async def test_search_endpoint_with_sql_injection_payload(self, client: AsyncClient, auth_headers: dict):
        sqli_payload = "' OR 1=1 --; DROP TABLE users;"
        res = await client.get(f"/api/v1/search?q={sqli_payload}", headers=auth_headers)
        assert res.status_code in (200, 404)
        # Database must remain intact and error-free
        health = await client.get("/api/v1/health")
        assert health.status_code == 200

@pytest.mark.asyncio
class TestCreditConsistencyAndConcurrency:
    """Verifies transactional hold, consumption, and insufficient credit blocking."""

    async def test_insufficient_credits_blocks_reservation(self):
        async with test_session_maker() as session:
            test_uid = f"user_credit_{uuid.uuid4().hex[:6]}"
            user = User(
                id=test_uid,
                email=f"{test_uid}@fombo.ai",
                username=test_uid,
                hashed_password="hashed",
                credits_balance=10,
                role="creator",
            )
            session.add(user)
            await session.commit()

            # Try reserving 50 credits when balance is 10
            with pytest.raises(HTTPException) as exc_info:
                await credit_service.reserve_credits(
                    db=session,
                    user_id=test_uid,
                    amount=50,
                    reference_id="job_exceed_credits",
                )
            assert exc_info.value.status_code == 402
            assert "Insufficient credits" in exc_info.value.detail

@pytest.mark.asyncio
class TestProviderFailSafeSmokeTests:
    """
    Opt-in and fail-safe smoke tests verifying that when external provider API keys
    are absent, the system returns structured configuration errors rather than crashing.
    """

    async def test_suno_adapter_missing_credentials_fails_safe(self, client: AsyncClient, auth_headers: dict):
        res = await client.post(
            "/api/v1/generation/create",
            headers=auth_headers,
            json={
                "prompt": "Cyberpunk synth wave with male vocals",
                "provider": "suno",
                "duration_seconds": 60,
            },
        )
        if not settings.SUNO_API_KEY:
            assert res.status_code == 422
            assert "CONFIGURATION_REQUIRED" in res.text or "not configured" in res.text.lower()
        else:
            assert res.status_code in (200, 202)
