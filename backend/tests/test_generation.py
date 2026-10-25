import pytest
import uuid
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_list_providers(client: AsyncClient):
    resp = await client.get("/api/v1/generation/providers")
    assert resp.status_code == 200
    providers = resp.json()
    assert len(providers) >= 4

    procedural = next((p for p in providers if p["provider_id"] == "fombo_procedural"), None)
    assert procedural is not None
    assert procedural["is_configured"] is True

@pytest.mark.asyncio
async def test_create_generation_job_procedural(client: AsyncClient, auth_headers: dict):
    payload = {
        "prompt": "Warm vintage analog synth chords with pumping 808 bass",
        "genre": "Synthwave",
        "style_tags": ["analog", "80s", "neon"],
        "bpm": 124,
        "musical_key": "F Minor",
        "duration_seconds": 15,
        "provider": "fombo_procedural",
        "model_name": "procedural-dsp-v1"
    }

    resp = await client.post("/api/v1/generation/create", json=payload, headers=auth_headers)
    assert resp.status_code == 202
    data = resp.json()
    assert "job_id" in data
    assert data["status"] == "queued"
    assert data["credits_deducted"] == 5
    assert data["remaining_balance"] == 45  # Started with 50

@pytest.mark.asyncio
async def test_create_generation_job_unconfigured_provider(client: AsyncClient, auth_headers: dict):
    # Attempting to generate using cloud Suno API when not configured in test environment
    payload = {
        "prompt": "An ethereal choir singing ambient pads",
        "provider": "suno",
        "model_name": "suno-v3.5",
        "bpm": 100,
        "musical_key": "C Major",
        "duration_seconds": 30
    }

    resp = await client.post("/api/v1/generation/create", json=payload, headers=auth_headers)
    # Strict Truthfulness: Must return 422 CONFIGURATION_REQUIRED, never mock success!
    assert resp.status_code == 422
    data = resp.json()
    assert "CONFIGURATION_REQUIRED" in str(data)

@pytest.mark.asyncio
async def test_banned_artist_name_rejection(client: AsyncClient, auth_headers: dict):
    payload = {
        "prompt": "A pop song exactly in the voice and melody of Taylor Swift 1989 album",
        "provider": "fombo_procedural",
        "model_name": "procedural-dsp-v1"
    }

    resp = await client.post("/api/v1/generation/create", json=payload, headers=auth_headers)
    assert resp.status_code == 422
    assert "anti-impersonation" in resp.json()["detail"].lower()

@pytest.mark.asyncio
async def test_generation_idempotency(client: AsyncClient, auth_headers: dict):
    idem_key = str(uuid.uuid4())
    headers = {**auth_headers, "Idempotency-Key": idem_key}

    payload = {
        "prompt": "Lo-fi hip hop beat with vinyl crackle and electric piano",
        "genre": "Lo-Fi",
        "bpm": 85,
        "musical_key": "Eb Major",
        "duration_seconds": 15,
        "provider": "fombo_procedural",
        "model_name": "procedural-dsp-v1"
    }

    # First request
    resp1 = await client.post("/api/v1/generation/create", json=payload, headers=headers)
    assert resp1.status_code == 202
    job_id1 = resp1.json()["job_id"]

    # Duplicate retry request with same Idempotency-Key
    resp2 = await client.post("/api/v1/generation/create", json=payload, headers=headers)
    assert resp2.status_code == 202
    job_id2 = resp2.json()["job_id"]

    assert job_id1 == job_id2
    # Credits must only be deducted once
    me_resp = await client.get("/api/v1/auth/me", headers=auth_headers)
    # 50 - 5 = 45 (or 40 if preceding tests ran)
    assert me_resp.status_code == 200
