import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
class TestAiProducerChat:
    """Verifies AI Producer conversational reasoning, tool mapping, and destructiveness flags."""

    async def test_add_track_instruction(self, client: AsyncClient, auth_headers: dict):
        payload = {
            "message": "Add a new synth lead track with neon styling",
            "project_state": {
                "bpm": 128,
                "tracks": [{"id": "tr_1", "name": "Drums", "volume": 0.85}],
            },
        }
        res = await client.post("/api/v1/producer/chat", json=payload, headers=auth_headers)
        assert res.status_code == 200, res.text
        data = res.json()
        assert len(data["planned_operations"]) >= 1
        op = data["planned_operations"][0]
        assert op["operation_type"] == "addTrack"
        assert op["parameters"]["track_type"] == "synth"
        assert op["is_destructive"] is False
        assert op["requires_confirmation"] is False

    async def test_gain_and_panning_instruction(self, client: AsyncClient, auth_headers: dict):
        payload = {
            "message": "Turn down volume on track 1 and pan left",
            "project_state": {
                "bpm": 120,
                "tracks": [{"id": "tr_1", "name": "Drums", "volume": 0.9, "pan": 0.0}],
            },
        }
        res = await client.post("/api/v1/producer/chat", json=payload, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        op = data["planned_operations"][0]
        assert op["operation_type"] == "changeGain"
        assert op["parameters"]["track_id"] == "tr_1"
        assert op["parameters"]["volume"] < 0.9
        assert op["parameters"]["pan"] < 0.0

    async def test_destructive_replace_section_requires_confirmation(
        self, client: AsyncClient, auth_headers: dict
    ):
        payload = {
            "message": "Replace section between 4s and 8s with an expressive guitar riff",
            "project_state": {
                "bpm": 120,
                "tracks": [{"id": "tr_1", "name": "Vocal Master", "volume": 0.85}],
            },
        }
        res = await client.post("/api/v1/producer/chat", json=payload, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        op = data["planned_operations"][0]
        assert op["operation_type"] == "replaceSection"
        assert op["is_destructive"] is True
        assert op["requires_confirmation"] is True

    async def test_clip_operations_in_producer(self, client: AsyncClient, auth_headers: dict):
        payload = {
            "message": "Move clip to beat 16 and duplicate clip",
            "project_state": {
                "bpm": 124,
                "tracks": [
                    {
                        "id": "tr_1",
                        "name": "Drums",
                        "clips": [{"id": "c_drum", "name": "4-Bar Kick", "startBeat": 0, "durationBeats": 8}],
                    }
                ],
            },
        }
        res = await client.post("/api/v1/producer/chat", json=payload, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert len(data["planned_operations"]) >= 1
        assert data["planned_operations"][0]["operation_type"] in ["moveClip", "duplicateClip"]

    async def test_destructive_delete_track_requires_confirmation(
        self, client: AsyncClient, auth_headers: dict
    ):
        payload = {
            "message": "Delete track 1",
            "project_state": {
                "bpm": 120,
                "tracks": [{"id": "tr_1", "name": "Old Scratch Take"}],
            },
        }
        res = await client.post("/api/v1/producer/chat", json=payload, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        op = data["planned_operations"][0]
        assert op["operation_type"] == "deleteTrack"
        assert op["is_destructive"] is True
        assert op["requires_confirmation"] is True


@pytest.mark.asyncio
class TestMusicPersonasApi:
    """Verifies CRUD operations for reusable music creation personas."""

    async def test_persona_lifecycle(self, client: AsyncClient, auth_headers: dict):
        # 1. List (pre-populates curated personas)
        list_res = await client.get("/api/v1/personas", headers=auth_headers)
        assert list_res.status_code == 200
        personas = list_res.json()
        assert len(personas) >= 3

        # 2. Create custom persona
        create_payload = {
            "name": "Custom Industrial Synth Guru",
            "description": "Distorted sub, metallic clangs, dark industrial rhythms",
            "genre_preferences": ["Industrial", "Darksynth"],
            "vocal_style": "Distorted Robot",
            "style_prompt_template": "Heavy distortion, 909 kicks, harsh mechanical noise",
            "bpm_default": 138,
            "key_default": "F Minor",
        }
        res = await client.post("/api/v1/personas", json=create_payload, headers=auth_headers)
        assert res.status_code == 201
        created = res.json()
        persona_id = created["id"]
        assert created["name"] == "Custom Industrial Synth Guru"

        # 3. Update
        update_res = await client.put(
            f"/api/v1/personas/{persona_id}",
            json={"bpm_default": 140, "vocal_style": "Vocoder Drone"},
            headers=auth_headers,
        )
        assert update_res.status_code == 200
        assert update_res.json()["bpm_default"] == 140

        # 4. Use in AI Producer chat
        chat_payload = {
            "message": "Give me arrangement ideas",
            "project_state": {"bpm": 140, "tracks": []},
            "persona_id": persona_id,
        }
        chat_res = await client.post("/api/v1/producer/chat", json=chat_payload, headers=auth_headers)
        assert chat_res.status_code == 200
        assert chat_res.json()["persona_used"] == "Custom Industrial Synth Guru"

        # 5. Delete
        del_res = await client.delete(f"/api/v1/personas/{persona_id}", headers=auth_headers)
        assert del_res.status_code == 204


@pytest.mark.asyncio
class TestVoiceModelConsentAndEthics:
    """Verifies ethical voice cloning: anti-impersonation, ownership attestation, capability checks, and audit logs."""

    async def test_unauthorized_celebrity_impersonation_blocked(
        self, client: AsyncClient, auth_headers: dict
    ):
        payload = {
            "name": "Taylor Swift AI Voice Model",
            "description": "Cloned pop vocals",
            "voice_type": "singing_voice",
            "supports_singing": True,
            "reference_audio_url": "/api/v1/storage/file/sample.wav",
            "ownership_attestation_confirmed": True,
            "challenge_id": "chall_123",
        }
        res = await client.post("/api/v1/voice-models/enroll", json=payload, headers=auth_headers)
        assert res.status_code == 400
        assert res.json()["detail"]["error_code"] == "IMPERSONATION_BLOCKED"

    async def test_ownership_attestation_required(
        self, client: AsyncClient, auth_headers: dict
    ):
        payload = {
            "name": "Maya Studio Voice",
            "voice_type": "singing_voice",
            "supports_singing": True,
            "reference_audio_url": "/api/v1/storage/file/sample.wav",
            "ownership_attestation_confirmed": False,  # Missing attestation
            "challenge_id": "chall_123",
        }
        res = await client.post("/api/v1/voice-models/enroll", json=payload, headers=auth_headers)
        assert res.status_code == 422
        assert res.json()["detail"]["error_code"] == "OWNERSHIP_ATTESTATION_REQUIRED"

    async def test_spoken_tts_cannot_claim_singing_capability(
        self, client: AsyncClient, auth_headers: dict
    ):
        payload = {
            "name": "Reader Speech Voice",
            "voice_type": "spoken_tts",
            "supports_singing": True,  # Fraudulent / mismatch!
            "reference_audio_url": "/api/v1/storage/file/sample.wav",
            "ownership_attestation_confirmed": True,
            "challenge_id": "chall_123",
        }
        res = await client.post("/api/v1/voice-models/enroll", json=payload, headers=auth_headers)
        assert res.status_code == 422
        assert res.json()["detail"]["error_code"] == "TTS_SINGING_MISMATCH"

    async def test_valid_voice_enrollment_revocation_and_audit_trail(
        self, client: AsyncClient, auth_headers: dict
    ):
        # 1. Valid enrollment
        payload = {
            "name": "Elena Vance Lyric Soprano",
            "description": "Ethically enrolled studio vocalist",
            "voice_type": "singing_voice",
            "supports_singing": True,
            "reference_audio_url": "/api/v1/storage/file/elena_take.wav",
            "ownership_attestation_confirmed": True,
            "challenge_id": "chall_verified_99",
            "pitch_range": "D3 - A5",
            "timbre_description": "Bright lyrical resonance",
        }
        enroll_res = await client.post("/api/v1/voice-models/enroll", json=payload, headers=auth_headers)
        assert enroll_res.status_code == 201, enroll_res.text
        model = enroll_res.json()
        model_id = model["id"]
        assert model["enrollment_status"] == "enrolled"
        assert model["supports_singing"] is True

        # 2. Check Audit Logs
        audit_res = await client.get(f"/api/v1/voice-models/{model_id}/audit-logs", headers=auth_headers)
        assert audit_res.status_code == 200
        logs = audit_res.json()
        assert len(logs) >= 1
        assert logs[0]["action"] == "enrolled"

        # 3. Revoke Consent
        revoke_res = await client.post(f"/api/v1/voice-models/{model_id}/revoke", headers=auth_headers)
        assert revoke_res.status_code == 200
        revoke_data = revoke_res.json()
        assert revoke_data["enrollment_status"] == "revoked"

        # Verify audit log updated with revocation
        audit_res2 = await client.get(f"/api/v1/voice-models/{model_id}/audit-logs", headers=auth_headers)
        assert audit_res2.status_code == 200
        logs2 = audit_res2.json()
        assert any(l["action"] == "consent_revoked" for l in logs2)

        # 4. Delete Model
        del_res = await client.delete(f"/api/v1/voice-models/{model_id}", headers=auth_headers)
        assert del_res.status_code == 204
