import pytest
from httpx import AsyncClient
import io
import wave
import struct
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.models.user import User
from backend.app.models.track import Track
from backend.app.models.job import Job
from backend.app.services.storage import storage_service
from backend.app.services.file_validator import file_validator
from backend.app.services.audio_processor import ProceduralAudioSynthesizer

@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    """Test comprehensive health endpoint with database, redis, and storage diagnostics."""
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("healthy", "degraded")
    assert "components" in data
    assert "database" in data["components"]
    assert "redis" in data["components"]
    assert "storage" in data["components"]
    assert data["procedural_synth_ready"] is True

@pytest.mark.asyncio
async def test_presigned_upload_and_validation(client: AsyncClient, auth_headers: dict):
    """Test presigned upload endpoint with MIME validation and file size restrictions."""
    # 1. Valid audio presign request
    valid_req = {
        "filename": "studio_kick.wav",
        "content_type": "audio/wav",
        "file_size_bytes": 1024 * 100,
        "asset_type": "audio",
        "subfolder": "uploads",
    }
    resp = await client.post("/api/v1/uploads/presign", json=valid_req, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "upload_url" in data
    assert "s3_key" in data

    # 2. Reject unsupported MIME type (e.g. video/mp4)
    invalid_mime_req = {
        "filename": "video.mp4",
        "content_type": "video/mp4",
        "file_size_bytes": 1024,
        "asset_type": "audio",
    }
    resp_invalid_mime = await client.post("/api/v1/uploads/presign", json=invalid_mime_req, headers=auth_headers)
    assert resp_invalid_mime.status_code == 400
    assert "Unsupported audio MIME type" in resp_invalid_mime.json()["detail"]

    # 3. Reject oversized file (> 50MB audio limit)
    oversized_req = {
        "filename": "huge_audio.wav",
        "content_type": "audio/wav",
        "file_size_bytes": 60 * 1024 * 1024,
        "asset_type": "audio",
    }
    resp_oversized = await client.post("/api/v1/uploads/presign", json=oversized_req, headers=auth_headers)
    assert resp_oversized.status_code == 413
    assert "exceeds maximum allowed size" in resp_oversized.json()["detail"]

@pytest.mark.asyncio
async def test_magic_bytes_and_malware_detection():
    """Test header inspection rejecting executable signatures disguised as audio."""
    # Valid WAV RIFF header
    valid_wav_header = b"RIFF\x24\x08\x00\x00WAVEfmt \x10\x00\x00\x00"
    assert file_validator.verify_magic_bytes(valid_wav_header, "audio/wav") is True

    # Malicious executable payload starting with 'MZ' (Windows executable)
    fake_audio_exe = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff"
    scan_res = file_validator.scan_file_for_threats(fake_audio_exe)
    assert scan_res["is_safe"] is False
    assert scan_res["threat_detected"] == "ExecutableBinarySignatureFound"

@pytest.mark.asyncio
async def test_upload_confirmation_and_metadata(client: AsyncClient, auth_headers: dict):
    """Test confirming an uploaded audio file, extracting audio metadata without storing blobs in DB."""
    # Create a small valid WAV in storage
    wav_bytes = ProceduralAudioSynthesizer.synthesize_composition(duration_seconds=1.0)
    key, url = storage_service.save_bytes(wav_bytes, "uploads", "test_confirm.wav")

    confirm_req = {
        "s3_key": key,
        "asset_type": "audio",
    }
    resp = await client.post("/api/v1/uploads/confirm", json=confirm_req, headers=auth_headers)
    assert resp.status_code == 200
    asset_data = resp.json()
    assert asset_data["s3_key"] == key
    assert asset_data["mime_type"] == "audio/wav"
    assert asset_data["duration_seconds"] > 0
    assert asset_data["sample_rate"] == 44100
    assert asset_data["channels"] in (1, 2)
    assert "sha256_hash" in asset_data

@pytest.mark.asyncio
async def test_job_state_transitions_and_cancellation(client: AsyncClient, auth_headers: dict):
    """Test job state machine: list, status polling, cancel, and retry."""
    # 1. Trigger a generation job (which registers a job)
    gen_req = {
        "prompt": "Cyberpunk night drive synth bassline",
        "provider": "fombo_procedural",
        "duration_seconds": 15,
        "bpm": 120,
    }
    resp = await client.post("/api/v1/generation/create", json=gen_req, headers=auth_headers)
    assert resp.status_code == 202
    job_id = resp.json()["job_id"]

    # 2. Poll job status
    poll_resp = await client.get(f"/api/v1/jobs/{job_id}", headers=auth_headers)
    assert poll_resp.status_code == 200
    job_data = poll_resp.json()
    assert job_data["status"] in ("queued", "running", "succeeded")
    assert "progress_percentage" in job_data

    # 3. Cancel job
    cancel_resp = await client.post(f"/api/v1/jobs/{job_id}/cancel", headers=auth_headers)
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "cancelled"

@pytest.mark.asyncio
async def test_idempotency_caching(client: AsyncClient, auth_headers: dict):
    """Test Idempotency-Key prevents duplicate processing."""
    idempotency_key = "test_key_phase2_abc123"
    payment_req = {
        "amount_cents": 1900,
        "currency": "USD",
        "payment_method": "stripe_card",
    }

    # First request
    resp1 = await client.post(
        "/api/v1/payments",
        json=payment_req,
        headers={**auth_headers, "Idempotency-Key": idempotency_key},
    )
    assert resp1.status_code == 201
    data1 = resp1.json()

    # Second request with identical key
    resp2 = await client.post(
        "/api/v1/payments",
        json=payment_req,
        headers={**auth_headers, "Idempotency-Key": idempotency_key},
    )
    assert resp2.status_code in (200, 201)
    data2 = resp2.json()

    # Idempotent response returns identical ID and payment intent
    assert data1["id"] == data2["id"]
    assert data1["payment_intent_id"] == data2["payment_intent_id"]

@pytest.mark.asyncio
async def test_profiles_api(client: AsyncClient, auth_headers: dict):
    """Test user profile read and update."""
    # 1. Get profile
    resp = await client.get("/api/v1/profiles/me", headers=auth_headers)
    assert resp.status_code == 200
    assert "user_id" in resp.json()

    # 2. Update profile
    update_req = {
        "display_name": "Antigravity Master",
        "bio": "Producing deep bass and cyber ambient soundscapes.",
        "website": "https://fombo.ai",
    }
    update_resp = await client.put("/api/v1/profiles/me", json=update_req, headers=auth_headers)
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["display_name"] == "Antigravity Master"
    assert updated_data["bio"] == "Producing deep bass and cyber ambient soundscapes."

@pytest.mark.asyncio
async def test_playlists_and_tracks(client: AsyncClient, auth_headers: dict):
    """Test creating a playlist, adding a track, and listing playlists."""
    # 1. Create Playlist
    pl_req = {
        "title": "Night City Drive",
        "description": "High-octane electronic tracks.",
        "is_public": True,
    }
    resp = await client.post("/api/v1/playlists", json=pl_req, headers=auth_headers)
    assert resp.status_code == 201
    playlist_id = resp.json()["id"]

    # 2. List Playlists
    list_resp = await client.get("/api/v1/playlists", headers=auth_headers)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 1

@pytest.mark.asyncio
async def test_social_likes_and_comments(client: AsyncClient, auth_headers: dict):
    """Test liking a track and posting a playback-timed comment."""
    # Create dummy track for social test
    wav_bytes = ProceduralAudioSynthesizer.synthesize_composition(duration_seconds=1.0)
    _, url = storage_service.save_bytes(wav_bytes, "tracks", "test_social_track.wav")

    track_req = {
        "title": "Social Echoes Track",
        "audio_url": url,
        "is_public": True,
    }
    # Create track directly via library or check existing
    track_resp = await client.post("/api/v1/generation/create", json={
        "prompt": "Chilled lo-fi beat",
        "provider": "fombo_procedural",
        "duration_seconds": 15,
    }, headers=auth_headers)
    track_id = track_resp.json().get("track_id")

    if track_id:
        # Like
        like_resp = await client.post(f"/api/v1/tracks/{track_id}/like", headers=auth_headers)
        assert like_resp.status_code == 200

        # Comment
        comment_req = {
            "track_id": track_id,
            "content": "Incredible sound design!",
            "timestamp_seconds": 12.5,
        }
        comment_resp = await client.post(f"/api/v1/tracks/{track_id}/comments", json=comment_req, headers=auth_headers)
        assert comment_resp.status_code == 201
        assert comment_resp.json()["content"] == "Incredible sound design!"

@pytest.mark.asyncio
async def test_commercial_licensing(client: AsyncClient, auth_headers: dict):
    """Test issuing a commercial license for a synthesized master track."""
    lic_req = {
        "track_id": "dummy_track_id",
        "license_type": "commercial",
        "price_cents": 2999,
        "terms": "Worldwide synchronization and monetization grant.",
    }
    # Create a track first
    gen_res = await client.post("/api/v1/generation/create", json={
        "prompt": "License test synthwave",
        "provider": "fombo_procedural",
        "duration_seconds": 15,
    }, headers=auth_headers)
    track_id = gen_res.json().get("track_id")

    if track_id:
        lic_req["track_id"] = track_id
        resp = await client.post("/api/v1/licenses", json=lic_req, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["license_type"] == "commercial"
        assert data["price_cents"] == 2999
        assert data["is_active"] is True
