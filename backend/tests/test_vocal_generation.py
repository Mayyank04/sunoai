"""Generation contract and credit safety tests; these are not singing-audio proof."""
import asyncio
import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from backend.app.core import database as core_db
from backend.app.models.job import Job
from backend.app.models.subscription import CreditLedger
from backend.app.models.user import User
from backend.app.services.generation_credits import (
    reserve_generation_credits,
    settle_generation_credits,
)
from backend.app.services.providers.base import ProviderCapabilities
from backend.app.services.providers.registry import provider_registry


async def _owner(client, headers):
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    return response.json()["id"]


async def _balance(user_id):
    async with core_db.async_session_maker() as db:
        return (await db.execute(
            select(User.credits_balance).where(User.id == user_id)
        )).scalar_one()


@pytest.mark.asyncio
async def test_generation_refund_requires_actual_reservation(client, auth_headers):
    owner = await _owner(client, auth_headers)
    before = await _balance(owner)
    async with core_db.async_session_maker() as db:
        async with db.begin():
            changed = await settle_generation_credits(db, f"missing_{uuid.uuid4().hex}", refund=True)
            assert changed is False
    assert await _balance(owner) == before


@pytest.mark.asyncio
async def test_generation_duplicate_refund_restores_owner_once(client, auth_headers):
    owner = await _owner(client, auth_headers)
    before = await _balance(owner)
    job_id = f"refund_{uuid.uuid4().hex}"
    async with core_db.async_session_maker() as db:
        async with db.begin():
            await reserve_generation_credits(db, owner, 13, job_id)
    assert await _balance(owner) == before - 13
    async with core_db.async_session_maker() as db:
        async with db.begin():
            assert await settle_generation_credits(db, job_id, refund=True, reason="GPU unavailable") is True
    async with core_db.async_session_maker() as db:
        async with db.begin():
            assert await settle_generation_credits(db, job_id, refund=True, reason="late duplicate failure") is False
    assert await _balance(owner) == before
    async with core_db.async_session_maker() as db:
        refunds = (await db.execute(select(CreditLedger).where(
            CreditLedger.reference_id == job_id,
            CreditLedger.transaction_type == "refund",
        ))).scalars().all()
        assert len(refunds) == 1
        assert refunds[0].user_id == owner
        assert refunds[0].amount == 13
        assert refunds[0].parent_ledger_id


@pytest.mark.asyncio
async def test_successful_generation_cannot_receive_late_refund(client, auth_headers):
    owner = await _owner(client, auth_headers)
    before = await _balance(owner)
    job_id = f"consume_{uuid.uuid4().hex}"
    async with core_db.async_session_maker() as db:
        async with db.begin():
            await reserve_generation_credits(db, owner, 9, job_id)
            assert await settle_generation_credits(db, job_id) is True
    async with core_db.async_session_maker() as db:
        async with db.begin():
            assert await settle_generation_credits(db, job_id, refund=True) is False
    assert await _balance(owner) == before - 9


@pytest.mark.asyncio
async def test_generation_reservation_is_part_of_callers_transaction(client, auth_headers):
    owner = await _owner(client, auth_headers)
    before = await _balance(owner)
    job_id = f"rollback_{uuid.uuid4().hex}"
    async with core_db.async_session_maker() as db:
        await reserve_generation_credits(db, owner, 17, job_id)
        await db.rollback()
    assert await _balance(owner) == before
    async with core_db.async_session_maker() as db:
        assert (await db.execute(select(CreditLedger.id).where(
            CreditLedger.reference_id == job_id
        ))).scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_concurrent_generation_reservations_cannot_overspend(client, auth_headers):
    owner = await _owner(client, auth_headers)
    before = await _balance(owner)
    amount = before - 5

    async def reserve_one():
        async with core_db.async_session_maker() as db:
            try:
                async with db.begin():
                    await reserve_generation_credits(db, owner, amount, f"parallel_{uuid.uuid4().hex}")
                return True
            except HTTPException as error:
                assert error.status_code == 402
                return False

    results = await asyncio.gather(reserve_one(), reserve_one())
    assert sorted(results) == [False, True]
    assert await _balance(owner) == 5


class OfflineVocalProvider:
    provider_id = "test_vocal_offline"
    name = "Offline lyrics-conditioned singing worker"

    def validate_configuration(self):
        return False, "CUDA checkpoint unavailable"

    def get_capabilities(self):
        return ProviderCapabilities(
            provider_id=self.provider_id,
            display_name=self.name,
            supports_vocals=True,
            supports_lyrics=True,
            models_available=["test-vocal-model"],
            is_configured=False,
            configuration_message="CUDA checkpoint unavailable",
        )

    async def check_readiness(self):
        return {"ready": False, "status": "checkpoint_unavailable", "message": "CUDA checkpoint unavailable"}


@pytest.mark.asyncio
async def test_unavailable_singing_worker_rejects_real_lyrics_before_charging(client, auth_headers, monkeypatch):
    owner = await _owner(client, auth_headers)
    before = await _balance(owner)
    provider = OfflineVocalProvider()
    monkeypatch.setitem(provider_registry._providers, provider.provider_id, provider)
    response = await client.post("/api/v1/generation/create", headers=auth_headers, json={
        "provider": provider.provider_id,
        "model_name": "test-vocal-model",
        "prompt": "Warm acoustic pop with clear melodic lead singing",
        "lyrics": "[Verse]\nMorning sunlight fills the room\nI can hear a hopeful tune\n[Chorus]\nCarry me into the day\nLet the music lead the way",
        "make_instrumental": False,
        "duration_seconds": 30,
    })
    assert response.status_code == 422
    assert "unavailable" in str(response.json()).lower()
    assert await _balance(owner) == before
    async with core_db.async_session_maker() as db:
        assert not (await db.execute(select(Job.id).where(Job.user_id == owner))).scalars().all()


class ReadyVocalProvider(OfflineVocalProvider):
    provider_id = "test_vocal_ready"
    name = "Test singing worker contract"

    def validate_configuration(self):
        return True, "Test contract ready"

    def get_capabilities(self):
        caps = super().get_capabilities()
        caps.is_configured = True
        caps.supports_dual_variants = True
        return caps

    async def check_readiness(self):
        return {"ready": True, "status": "ready"}

    def estimate_cost(self, params):
        from backend.app.services.providers.base import CostEstimate
        return CostEstimate(credits_required=5, estimated_duration_seconds=30)

    async def cancel(self, job_id):
        return True


def _vocal_payload(provider):
    return {
        "provider": provider.provider_id,
        "model_name": "test-vocal-model",
        "prompt": "Warm acoustic pop with clear melodic lead singing",
        "lyrics": "[Verse]\nMorning sunlight fills the room\nI can hear a hopeful tune\n[Chorus]\nCarry me into the day\nLet the music lead the way",
        "make_instrumental": False,
        "duration_seconds": 30,
        "bpm": 98,
        "musical_key": "D Major",
        "seed": 123,
        "style_tags": ["acoustic", "hopeful"],
        "generate_two_variants": True,
    }


@pytest.mark.asyncio
async def test_idempotency_returns_exact_job_after_another_job_exists(client, auth_headers, monkeypatch):
    from backend.app.services.job_runner import job_runner
    provider = ReadyVocalProvider()
    monkeypatch.setitem(provider_registry._providers, provider.provider_id, provider)
    dispatched = []
    monkeypatch.setattr(job_runner, "dispatch", lambda *args: dispatched.append(args))
    payload = _vocal_payload(provider)
    headers = {**auth_headers, "Idempotency-Key": uuid.uuid4().hex}
    first = await client.post("/api/v1/generation/create", headers=headers, json=payload)
    assert first.status_code == 202
    other = await client.post("/api/v1/generation/create", headers=auth_headers, json={**payload, "prompt": "A second different acoustic song"})
    assert other.status_code == 202
    duplicate = await client.post("/api/v1/generation/create", headers=headers, json=payload)
    assert duplicate.status_code == 202
    assert duplicate.json()["job_id"] == first.json()["job_id"]
    assert duplicate.json()["job_id"] != other.json()["job_id"]
    assert len(dispatched) == 2
    assert duplicate.json()["remaining_balance"] == 40


@pytest.mark.asyncio
async def test_idempotency_rejects_changed_generation_controls(client, auth_headers, monkeypatch):
    from backend.app.services.job_runner import job_runner
    provider = ReadyVocalProvider()
    monkeypatch.setitem(provider_registry._providers, provider.provider_id, provider)
    monkeypatch.setattr(job_runner, "dispatch", lambda *args: None)
    payload = _vocal_payload(provider)
    headers = {**auth_headers, "Idempotency-Key": uuid.uuid4().hex}
    first = await client.post("/api/v1/generation/create", headers=headers, json=payload)
    assert first.status_code == 202
    changed = await client.post("/api/v1/generation/create", headers=headers, json={**payload, "bpm": 140, "seed": 456})
    assert changed.status_code == 409


@pytest.mark.parametrize("endpoint", ["generation", "jobs"])
@pytest.mark.asyncio
async def test_retry_retains_original_lyrics_and_vocal_conditioning(client, auth_headers, monkeypatch, endpoint):
    from backend.app.models.generation import Generation
    from backend.app.services.job_runner import job_runner
    provider = ReadyVocalProvider()
    monkeypatch.setitem(provider_registry._providers, provider.provider_id, provider)
    dispatched = []
    monkeypatch.setattr(job_runner, "dispatch", lambda *args: dispatched.append(args))
    payload = _vocal_payload(provider)
    created = await client.post("/api/v1/generation/create", headers=auth_headers, json=payload)
    assert created.status_code == 202
    job_id = created.json()["job_id"]
    async with core_db.async_session_maker() as db:
        async with db.begin():
            job = await db.get(Job, job_id)
            job.status = "failed"
            gen = (await db.execute(select(Generation).where(Generation.job_id == job_id))).scalar_one()
            gen.status = "failed"
            assert await settle_generation_credits(db, job_id, refund=True, reason="Test retry")
    retried = await client.post(f"/api/v1/{endpoint}/{job_id}/retry", headers=auth_headers)
    assert retried.status_code == 200
    assert len(dispatched) == 2
    original, retried_params = dispatched[0][2], dispatched[1][2]
    assert retried_params.model_dump() == original.model_dump()
    assert retried_params.lyrics == payload["lyrics"]
    assert retried_params.make_instrumental is False
    assert await _balance(dispatched[1][1]) == 45


@pytest.mark.asyncio
async def test_generation_status_and_telemetry_require_owner(client, auth_headers, monkeypatch):
    from backend.app.services.job_runner import job_runner
    provider = ReadyVocalProvider()
    monkeypatch.setitem(provider_registry._providers, provider.provider_id, provider)
    monkeypatch.setattr(job_runner, "dispatch", lambda *args: None)
    created = await client.post("/api/v1/generation/create", headers=auth_headers, json=_vocal_payload(provider))
    assert created.status_code == 202
    job_id = created.json()["job_id"]
    cancelled = await client.post(f"/api/v1/generation/{job_id}/cancel", headers=auth_headers)
    assert cancelled.status_code == 200
    uid = uuid.uuid4().hex
    other = await client.post("/api/v1/auth/register", json={"email": f"other_{uid}@example.com", "username": f"other_{uid[:10]}", "password": "Password123!"})
    assert other.status_code == 201
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}
    for path in (f"/api/v1/generation/{job_id}/status", f"/api/v1/jobs/{job_id}", f"/api/v1/jobs/{job_id}/stream"):
        assert (await client.get(path)).status_code == 401
        assert (await client.get(path, headers=other_headers)).status_code == 404
        assert (await client.get(path, headers=auth_headers)).status_code == 200


@pytest.mark.parametrize("endpoint", ["generation", "jobs"])
@pytest.mark.asyncio
async def test_cancel_refunds_once_and_late_worker_result_cannot_create_track(client, auth_headers, monkeypatch, endpoint):
    import io
    import wave
    from backend.app.models.track import Track
    from backend.app.services.job_runner import job_runner
    from backend.app.services.providers.base import GenerationResult

    # A valid fixture recording exercises completion handling only; no singing
    # quality assertion is made and this recording is never saved after cancel.
    recording = io.BytesIO()
    with wave.open(recording, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(8000)
        wav.writeframes(b"\x01\x00" * 8000)
    provider = ReadyVocalProvider()
    started, release = asyncio.Event(), asyncio.Event()

    async def delayed_result(params, remote_id, progress):
        started.set()
        await release.wait()
        return GenerationResult(audio_bytes=recording.getvalue(), duration_seconds=1, sample_rate=8000, channels=1)

    provider.generate_with_progress = delayed_result
    monkeypatch.setitem(provider_registry._providers, provider.provider_id, provider)
    owner = await _owner(client, auth_headers)
    before = await _balance(owner)
    created = await client.post("/api/v1/generation/create", headers=auth_headers, json=_vocal_payload(provider))
    assert created.status_code == 202
    job_id = created.json()["job_id"]
    try:
        await asyncio.wait_for(started.wait(), timeout=5)
        cancelled = await client.post(f"/api/v1/{endpoint}/{job_id}/cancel", headers=auth_headers)
        assert cancelled.status_code == 200
        assert cancelled.json()["status"] == "cancelled"
        release.set()
        task = job_runner._tasks.get(job_id)
        if task:
            await asyncio.wait_for(asyncio.shield(task), timeout=5)
        assert (await client.post(f"/api/v1/{endpoint}/{job_id}/cancel", headers=auth_headers)).status_code == 400
        state = await client.get(f"/api/v1/generation/{job_id}/status", headers=auth_headers)
        assert state.json()["status"] == "cancelled"
        assert state.json()["track_id"] is None
        assert await _balance(owner) == before
        async with core_db.async_session_maker() as db:
            assert not (await db.execute(select(Track.id).where(Track.user_id == owner))).scalars().all()
            refunds = (await db.execute(select(CreditLedger.id).where(CreditLedger.reference_id == job_id, CreditLedger.transaction_type == "refund"))).scalars().all()
            assert len(refunds) == 1
    finally:
        release.set()
