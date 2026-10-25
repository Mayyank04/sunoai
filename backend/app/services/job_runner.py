import asyncio
import json
import time
from typing import Dict, Any, AsyncGenerator, Optional
from backend.app.core.database import async_session_maker
from backend.app.models.generation import Generation
from backend.app.models.track import Track
from backend.app.models.provenance import Provenance
from backend.app.models.user import User
from backend.app.models.subscription import CreditLedger
from backend.app.services.providers.registry import provider_registry
from backend.app.services.providers.base import GenerationRequestParams
from backend.app.services.storage import storage_service
from backend.app.services.audio_processor import AudioProcessor
from backend.app.services.provenance import provenance_service
from sqlalchemy import select

class JobRunner:
    """Manages asynchronous music generation jobs with real-time SSE progress telemetry."""

    def __init__(self):
        self._event_queues: Dict[str, asyncio.Queue] = {}
        self._job_cache: Dict[str, Dict[str, Any]] = {}

    def get_or_create_queue(self, job_id: str) -> asyncio.Queue:
        if job_id not in self._event_queues:
            self._event_queues[job_id] = asyncio.Queue()
        return self._event_queues[job_id]

    async def emit_progress(self, job_id: str, phase: str, progress: int, data: Optional[Dict[str, Any]] = None):
        payload = {
            "job_id": job_id,
            "phase": phase,
            "progress_percentage": progress,
            "timestamp": time.time(),
            **(data or {})
        }
        self._job_cache[job_id] = payload
        if job_id in self._event_queues:
            await self._event_queues[job_id].put(payload)

    async def stream_job_events(self, job_id: str) -> AsyncGenerator[str, None]:
        queue = self.get_or_create_queue(job_id)
        # Emit initial cached state if present
        if job_id in self._job_cache:
            initial = self._job_cache[job_id]
            yield f"event: progress\ndata: {json.dumps(initial)}\n\n"
            if initial.get("phase") in ("completed", "failed"):
                return

        while True:
            try:
                # Wait for next event with a timeout for keepalive
                payload = await asyncio.wait_for(queue.get(), timeout=20.0)
                phase = payload.get("phase")
                event_name = "complete" if phase == "completed" else ("error" if phase == "failed" else "progress")
                yield f"event: {event_name}\ndata: {json.dumps(payload)}\n\n"

                if phase in ("completed", "failed"):
                    break
            except asyncio.TimeoutError:
                yield f": keepalive {time.time()}\n\n"

    async def execute_generation_job(
        self,
        job_id: str,
        user_id: str,
        params: GenerationRequestParams,
        credits_cost: int = 5
    ):
        """Asynchronous worker pipeline executed in background."""
        await self.emit_progress(job_id, "initializing", 5)

        provider = provider_registry.get(params.provider_id if hasattr(params, 'provider_id') else "fombo_procedural")
        if not provider:
            provider = provider_registry.get("fombo_procedural")

        try:
            # 1. Validation & Credential verification
            is_valid, msg = provider.validate_configuration()
            if not is_valid:
                raise ValueError(f"Provider '{provider.name}' is unconfigured: {msg}")

            await self.emit_progress(job_id, "synthesizing_audio", 25)

            # 2. Render actual WAV audio
            wav_bytes = await provider.generate_audio(params)
            duration_actual = AudioProcessor.get_audio_duration(wav_bytes)

            await self.emit_progress(job_id, "analyzing_waveform_and_peaks", 60)

            # 3. Waveform Peak Extraction
            peaks = AudioProcessor.extract_waveform_peaks(wav_bytes, num_peaks=120)

            await self.emit_progress(job_id, "storing_master_assets", 80)

            # 4. Save to Storage
            track_filename = f"{job_id}.wav"
            storage_key, audio_url = storage_service.save_bytes(wav_bytes, "tracks", track_filename)

            # 5. Compute SHA256 & Provenance
            audio_sha256 = provenance_service.compute_sha256(wav_bytes)

            # 6. Database record updates
            async with async_session_maker() as session:
                async with session.begin():
                    # Fetch user for tier info
                    u_res = await session.execute(select(User).where(User.id == user_id))
                    user = u_res.scalar_one()

                    # Create Track
                    track = Track(
                        user_id=user_id,
                        title=f"{params.genre or 'Ambient'} Opus {params.musical_key}",
                        genre=params.genre,
                        style_tags=params.style_tags,
                        bpm=params.bpm,
                        musical_key=params.musical_key,
                        duration_seconds=duration_actual or float(params.duration_seconds),
                        audio_url=audio_url,
                        waveform_data=peaks,
                        is_public=True,
                        commercial_rights_status="commercial_granted" if user.role in ("pro_producer", "studio") else "non_commercial_personal"
                    )
                    session.add(track)
                    await session.flush()

                    # Create C2PA Provenance
                    c2pa_doc = provenance_service.create_c2pa_manifest(
                        track_id=track.id,
                        creator_id=user.id,
                        creator_username=user.username,
                        audio_sha256=audio_sha256,
                        prompt=params.prompt,
                        seed=params.seed,
                        model_provider=provider.provider_id,
                        model_name=params.model_name,
                        bpm=params.bpm,
                        musical_key=params.musical_key,
                        user_tier="pro" if user.role in ("pro_producer", "studio") else "free"
                    )

                    commercial_ok, lic_name, discl = provenance_service.evaluate_commercial_rights(
                        provider.provider_id,
                        "pro" if user.role in ("pro_producer", "studio") else "free"
                    )

                    prov = Provenance(
                        track_id=track.id,
                        creator_id=user.id,
                        model_provider=provider.provider_id,
                        model_checkpoint_hash=None,
                        generation_seed=params.seed,
                        input_prompt_hash=provenance_service.compute_prompt_hash(params.prompt),
                        output_audio_sha256=audio_sha256,
                        c2pa_manifest=c2pa_doc,
                        license_type=lic_name,
                        commercial_eligibility=commercial_ok,
                        disclaimer=discl
                    )
                    session.add(prov)

                    # Update Generation record
                    g_res = await session.execute(select(Generation).where(Generation.job_id == job_id))
                    generation = g_res.scalar_one_or_none()
                    if generation:
                        generation.track_id = track.id
                        generation.status = "completed"
                        generation.progress_percentage = 100
                        generation.completed_at = asyncio.get_event_loop().time()

            await self.emit_progress(job_id, "completed", 100, {
                "track_id": track.id,
                "audio_url": audio_url,
                "duration_seconds": duration_actual or float(params.duration_seconds),
                "waveform": peaks[:20]
            })

        except Exception as e:
            # Failure handling & Credit refund
            async with async_session_maker() as session:
                async with session.begin():
                    # Refund user credits
                    u_res = await session.execute(select(User).where(User.id == user_id))
                    user = u_res.scalar_one_or_none()
                    if user:
                        user.credits_balance += credits_cost
                        ledger = CreditLedger(
                            user_id=user.id,
                            amount=credits_cost,
                            balance_after=user.credits_balance,
                            transaction_type="refund",
                            reference_id=job_id,
                            notes=f"Auto-refund for failed generation: {str(e)}"
                        )
                        session.add(ledger)

                    # Update generation record
                    g_res = await session.execute(select(Generation).where(Generation.job_id == job_id))
                    generation = g_res.scalar_one_or_none()
                    if generation:
                        generation.status = "failed"
                        generation.error_code = "GENERATION_ERROR"
                        generation.error_message = str(e)

            await self.emit_progress(job_id, "failed", 0, {
                "error_code": "GENERATION_ERROR",
                "error_message": str(e)
            })

job_runner = JobRunner()
