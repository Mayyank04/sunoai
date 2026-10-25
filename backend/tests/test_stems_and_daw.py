import pytest
from httpx import AsyncClient
from backend.app.services.audio_processor import ProceduralAudioSynthesizer
from backend.app.services.storage import storage_service
from backend.tests.conftest import test_session_maker
from backend.app.models.track import Track
from backend.app.models.user import User
from sqlalchemy import select

@pytest.mark.asyncio
async def test_stem_separation_pipeline(client: AsyncClient, auth_headers: dict):
    # 1. Synthesize real audio and save to storage as a track
    audio_bytes = ProceduralAudioSynthesizer.synthesize_composition(duration_seconds=2.0)
    key, url = storage_service.save_bytes(audio_bytes, "tracks", "test_track_for_stems.wav")

    track_id = None
    async with test_session_maker() as session:
        async with session.begin():
            u_res = await session.execute(select(User).limit(1))
            user = u_res.scalar_one()

            t = Track(
                user_id=user.id,
                title="Stem Test Song",
                genre="Electronic",
                duration_seconds=2.0,
                audio_url=url,
                is_public=True
            )
            session.add(t)
            await session.flush()
            track_id = t.id

    # 2. Call /stems/separate
    resp = await client.post(
        "/api/v1/stems/separate",
        json={"track_id": track_id, "stem_model": "htdemucs_v4"},
        headers=auth_headers
    )
    assert resp.status_code == 202
    data = resp.json()
    assert "stems" in data
    # Must separate into 4 stems: bass, vocals, drums, other
    stem_types = [s["stem_type"] for s in data["stems"]]
    assert "vocals" in stem_types
    assert "drums" in stem_types
    assert "bass" in stem_types
    assert "other" in stem_types

@pytest.mark.asyncio
async def test_daw_projects_crud(client: AsyncClient, auth_headers: dict):
    # 1. Create project
    proj_payload = {
        "title": "Neon Horizons DAW Session",
        "bpm": 128,
        "time_signature": "4/4",
        "master_volume": 0.9,
        "project_state": {
            "tracks": [
                {"id": "tr_1", "name": "Synthesizer Lead", "volume": 0.8, "pan": -0.2, "muted": False},
                {"id": "tr_2", "name": "Bassline", "volume": 0.9, "pan": 0.0, "muted": False}
            ]
        }
    }
    create_resp = await client.post("/api/v1/daw/projects", json=proj_payload, headers=auth_headers)
    assert create_resp.status_code == 201
    proj_data = create_resp.json()
    assert proj_data["title"] == "Neon Horizons DAW Session"
    proj_id = proj_data["id"]

    # 2. List projects
    list_resp = await client.get("/api/v1/daw/projects", headers=auth_headers)
    assert list_resp.status_code == 200
    projects = list_resp.json()
    assert any(p["id"] == proj_id for p in projects)

    # 3. Get single project
    get_resp = await client.get(f"/api/v1/daw/projects/{proj_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["bpm"] == 128
