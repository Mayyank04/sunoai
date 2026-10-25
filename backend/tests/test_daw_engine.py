import io
import wave
import struct
import pytest
from httpx import AsyncClient

from backend.app.services.daw_renderer import daw_renderer
from backend.app.services.audio_editing import audio_editing_service

@pytest.mark.asyncio
class TestDawRendererService:
    """Tests sample-accurate multitrack audio mixing, panning, volume, and limiting."""

    def test_multitrack_mixdown_basic(self):
        tracks = [
            {
                "id": "t1",
                "name": "Drums",
                "volume": 0.8,
                "pan": 0.0,
                "muted": False,
                "solo": False,
                "clips": [
                    {"id": "c1", "start_time": 0.0, "duration": 4.0, "source_offset": 0.0},
                    {"id": "c2", "start_time": 4.0, "duration": 4.0, "source_offset": 0.0},
                ],
            },
            {
                "id": "t2",
                "name": "Bass",
                "volume": 0.9,
                "pan": -0.2,
                "muted": False,
                "solo": False,
                "clips": [
                    {"id": "c3", "start_time": 2.0, "duration": 6.0, "source_offset": 0.0},
                ],
            },
        ]

        wav_bytes, dur, meta = daw_renderer.render_mixdown(tracks=tracks, bpm=120, master_volume=0.9)
        assert dur >= 8.0
        assert meta["channels"] == 2
        assert meta["sample_rate"] == 44100
        assert len(wav_bytes) > 44

        # Validate with wave.open
        with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
            assert wf.getnchannels() == 2
            assert wf.getsampwidth() == 2
            assert wf.getframerate() == 44100
            n_frames = wf.getnframes()
            assert n_frames == int(dur * 44100)

    def test_solo_and_mute_logic(self):
        # When t1 is solo, t2 must be excluded from mix
        tracks = [
            {
                "id": "t1",
                "name": "Soloed Synth",
                "volume": 1.0,
                "pan": 0.0,
                "muted": False,
                "solo": True,
                "clips": [{"id": "c1", "start_time": 0.0, "duration": 2.0}],
            },
            {
                "id": "t2",
                "name": "Muted Drums",
                "volume": 1.0,
                "pan": 0.0,
                "muted": False,
                "solo": False,
                "clips": [{"id": "c2", "start_time": 0.0, "duration": 2.0}],
            },
        ]

        wav_bytes, dur, _ = daw_renderer.render_mixdown(tracks=tracks, bpm=120)
        assert dur == 2.0
        is_valid, audio_meta = audio_editing_service.verify_audio_integrity(wav_bytes)
        assert is_valid is True

@pytest.mark.asyncio
class TestDawApiEndpoints:
    """Tests DAW Projects CRUD, autosaving, and offline rendering endpoints."""

    async def test_daw_project_lifecycle_and_autosave(
        self, client: AsyncClient, auth_headers: dict
    ):
        # 1. Create Project
        create_payload = {
            "title": "Cyber City Session 1",
            "bpm": 128,
            "time_signature": "4/4",
            "master_volume": 0.95,
            "project_state": {
                "tracks": [
                    {
                        "id": "tr_1",
                        "name": "Kick & Snare",
                        "volume": 0.85,
                        "pan": 0.0,
                        "muted": False,
                        "solo": False,
                        "clips": [
                            {"id": "cl_1", "start_time": 0.0, "duration": 4.0, "name": "Beat A"}
                        ],
                    }
                ]
            },
        }

        res = await client.post("/api/v1/daw/projects", json=create_payload, headers=auth_headers)
        assert res.status_code == 201, res.text
        proj = res.json()
        project_id = proj["id"]
        assert proj["title"] == "Cyber City Session 1"
        assert proj["bpm"] == 128

        # 2. Get Project
        get_res = await client.get(f"/api/v1/daw/projects/{project_id}", headers=auth_headers)
        assert get_res.status_code == 200
        assert get_res.json()["id"] == project_id

        # 3. Autosave / Update Project
        update_payload = {
            "title": "Cyber City Session 1 (Autosaved)",
            "bpm": 130,
            "project_state": {
                "tracks": [
                    {
                        "id": "tr_1",
                        "name": "Kick & Snare",
                        "volume": 0.9,
                        "pan": 0.0,
                        "muted": False,
                        "solo": False,
                        "clips": [
                            {"id": "cl_1", "start_time": 0.0, "duration": 4.0, "name": "Beat A"},
                            {"id": "cl_2", "start_time": 4.0, "duration": 4.0, "name": "Beat B"},
                        ],
                    }
                ]
            },
        }
        put_res = await client.put(f"/api/v1/daw/projects/{project_id}", json=update_payload, headers=auth_headers)
        assert put_res.status_code == 200
        updated = put_res.json()
        assert updated["title"] == "Cyber City Session 1 (Autosaved)"
        assert updated["bpm"] == 130
        assert len(updated["project_state"]["tracks"][0]["clips"]) == 2

        # 4. Render Project Mixdown
        render_res = await client.post(
            f"/api/v1/daw/projects/{project_id}/render", headers=auth_headers
        )
        assert render_res.status_code == 200, render_res.text
        render_data = render_res.json()
        assert render_data["audio_url"].startswith("/api/v1/storage/file/")
        assert render_data["duration_seconds"] >= 8.0
        assert render_data["channels"] == 2
        assert render_data["sample_rate"] == 44100
        assert len(render_data["waveform_data"]) > 0

        # 5. Direct Render Request without saved project
        direct_render_payload = {
            "title": "Ad-hoc Mix",
            "bpm": 120,
            "master_volume": 1.0,
            "tracks": [
                {
                    "id": "tr_synth",
                    "name": "Lead Synth",
                    "track_type": "audio",
                    "volume": 0.8,
                    "pan": 0.25,
                    "muted": False,
                    "solo": False,
                    "clips": [
                        {
                            "id": "c_lead",
                            "name": "Synth Riff",
                            "track_id": "tr_synth",
                            "start_time": 1.0,
                            "duration": 3.0,
                        }
                    ],
                }
            ],
        }
        direct_res = await client.post("/api/v1/daw/render", json=direct_render_payload, headers=auth_headers)
        assert direct_res.status_code == 200
        direct_data = direct_res.json()
        assert direct_data["duration_seconds"] >= 4.0
        assert direct_data["file_size_bytes"] > 1000

        # 6. Delete Project
        del_res = await client.delete(f"/api/v1/daw/projects/{project_id}", headers=auth_headers)
        assert del_res.status_code == 204

        # Confirm 404 after delete
        gone_res = await client.get(f"/api/v1/daw/projects/{project_id}", headers=auth_headers)
        assert gone_res.status_code == 404
