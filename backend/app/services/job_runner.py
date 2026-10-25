import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Dict, Any, AsyncGenerator, Optional
from sqlalchemy import select
from backend.app.core import database as core_db
from backend.app.models.generation import Generation
from backend.app.models.job import Job
from backend.app.models.track import Track
from backend.app.models.asset import Asset
from backend.app.models.version import SongVersion
from backend.app.models.provenance import Provenance
from backend.app.models.user import User
from backend.app.models.subscription import CreditLedger
from backend.app.services.providers.registry import provider_registry
from backend.app.services.providers.base import GenerationRequestParams, GenerationResult
from backend.app.services.storage import storage_service
from backend.app.services.audio_processor import AudioProcessor
from backend.app.services.provenance import provenance_service

class JobRunner:
    """Manages asynchronous music generation jobs with real-time SSE progress telemetry and dual-variant handling."""

    def __init__(self):
        self._event_queues: Dict[str, asyncio.Queue] = {}
        self._job_cache: Dict[str, Dict[str, Any]] = {}
        self._cancelled_jobs: set[str] = set()

    def get_or_create_queue(self, job_id: str) -> asyncio.Queue:
        if job_id not in self._event_queues:
            self._event_queues[job_id] = asyncio.Queue()
        return self._event_queues[job_id]

    def mark_cancelled(self, job_id: str) -> None:
        self._cancelled_jobs.add(job_id)

    def is_cancelled(self, job_id: str) -> bool:
        return job_id in self._cancelled_jobs

    async def emit_progress(self, job_id: str, phase: str, progress: int, data: Optional[Dict[str, Any]] = None):
        payload = {
            "job_id": job_id,
            "phase": phase,
            "progress_percentage": progress,
            "timestamp": time.time(),
            **(data or {}),
        }
        self._job_cache[job_id] = payload
        if job_id in self._event_queues:
            await self._event_queues[job_id].put(payload)

    async def stream_job_events(self, job_id: str) -> AsyncGenerator[str, None]:
        queue = self.get_or_create_queue(job_id)
        if job_id in self._job_cache:
            initial = self._job_cache[job_id]
            yield f"event: progress\ndata: {json.dumps(initial)}\n\n"
            if initial.get("phase") in ("completed", "failed", "cancelled"):
                return

        while True:
            try:
                payload = await asyncio.wait_for(queue.get(), timeout=20.0)
                phase = payload.get("phase")
                event_name = "complete" if phase == "completed" else ("error" if phase == "failed" else "progress")
                yield f"event: {event_name}\ndata: {json.dumps(payload)}\n\n"

                if phase in ("completed", "failed", "cancelled"):
                    break
            except asyncio.TimeoutError:
                yield f": keepalive {time.time()}\n\n"

    async def execute_generation_job(
        self,
        job_id: str,
        user_id: str,
        params: GenerationRequestParams,
        credits_cost: int = 5,
    ):
        """Asynchronous worker pipeline executed in background."""
        if self.is_cancelled(job_id):
            await self.emit_progress(job_id, "cancelled", 0, {"message": "Job cancelled prior to execution"})
            return

        await self.emit_progress(job_id, "initializing", 10, {"current_stage": "Validating provider constraints"})

        provider = provider_registry.get(params.provider_id if hasattr(params, "provider_id") else "fombo_procedural")
        if not provider:
            provider = provider_registry.get("fombo_procedural")

        # Update Job model to running
        async with core_db.async_session_maker() as session:
            async with session.begin():
                j_res = await session.execute(select(Job).where(Job.id == job_id))
                db_job = j_res.scalar_one_or_none()
                if db_job:
                    db_job.status = "running"
                    db_job.progress_percentage = 15
                    db_job.current_stage = "Synthesizing audio harmonics"
                    db_job.started_at = datetime.now(timezone.utc)

        try:
            # 1. Validation & Credential verification
            is_valid, msg = provider.validate_configuration()
            if not is_valid:
                raise ValueError(f"Provider '{provider.name}' is unconfigured: {msg}")

            if self.is_cancelled(job_id):
                raise asyncio.CancelledError("Job cancelled by user")

            await self.emit_progress(job_id, "synthesizing_audio", 35, {"current_stage": "Rendering additive & FM harmonics"})

            # 2. Render actual audio
            gen_result: GenerationResult = await provider.generate(params)
            wav_bytes = gen_result.audio_bytes
            duration_actual = gen_result.duration_seconds or AudioProcessor.get_audio_duration(wav_bytes)

            if self.is_cancelled(job_id):
                raise asyncio.CancelledError("Job cancelled by user")

            await self.emit_progress(job_id, "analyzing_waveform_and_peaks", 65, {"current_stage": "Extracting peak amplitudes"})

            # 3. Waveform Peak Extraction
            peaks = AudioProcessor.extract_waveform_peaks(wav_bytes, num_peaks=120)

            await self.emit_progress(job_id, "storing_master_assets", 80, {"current_stage": "Packaging audio assets to storage"})

            # 4. Save Primary Variant to Storage
            track_filename = f"{job_id}_variant_a.wav"
            storage_key, audio_url = storage_service.save_bytes(wav_bytes, "tracks", track_filename)
            audio_sha256 = provenance_service.compute_sha256(wav_bytes)

            # 5. Save Second Variant if generated
            second_audio_url = None
            second_peaks = None
            if gen_result.second_variant_bytes:
                second_filename = f"{job_id}_variant_b.wav"
                _, second_audio_url = storage_service.save_bytes(
                    gen_result.second_variant_bytes, "tracks", second_filename
                )
                second_peaks = AudioProcessor.extract_waveform_peaks(gen_result.second_variant_bytes, num_peaks=120)

            # 6. Database record updates
            async with core_db.async_session_maker() as session:
                async with session.begin():
                    # Fetch user for tier info
                    u_res = await session.execute(select(User).where(User.id == user_id))
                    user = u_res.scalar_one()

                    # Create Primary Track (Variant 1)
                    track_title = f"{params.genre or 'Ambient'} Opus {params.musical_key}"
                    track = Track(
                        user_id=user_id,
                        title=track_title,
                        description=f"AI synthesized master via {provider.name}.",
                        genre=params.genre,
                        style_tags=params.style_tags or [params.genre or "Electronic"],
                        bpm=params.bpm,
                        musical_key=params.musical_key,
                        duration_seconds=duration_actual or float(params.duration_seconds),
                        audio_url=audio_url,
                        waveform_data=peaks,
                        lyrics=params.lyrics,
                        is_public=True,
                        commercial_rights_status="commercial_granted" if user.role in ("pro_producer", "studio") else "non_commercial_personal",
                    )
                    session.add(track)
                    await session.flush()

                    # Save Asset for Primary Variant (Never storing binary blobs in DB)
                    asset_a = Asset(
                        user_id=user_id,
                        track_id=track.id,
                        asset_type="audio",
                        s3_key=storage_key,
                        s3_bucket=storage_service.bucket,
                        storage_url=audio_url,
                        mime_type="audio/wav",
                        file_size_bytes=len(wav_bytes),
                        sha256_hash=audio_sha256,
                        duration_seconds=duration_actual or float(params.duration_seconds),
                        sample_rate=gen_result.sample_rate,
                        bit_depth=gen_result.bit_depth,
                        channels=gen_result.channels,
                        metadata_json=gen_result.metadata,
                    )
                    session.add(asset_a)

                    # Save Variant 2 if present
                    if second_audio_url and gen_result.second_variant_bytes:
                        version_b = SongVersion(
                            track_id=track.id,
                            version_number=2,
                            title=f"{track_title} (Take 2)",
                            changelog="Alternate acoustic harmonic variant",
                            audio_url=second_audio_url,
                            duration_seconds=duration_actual or float(params.duration_seconds),
                            waveform_data=second_peaks,
                            created_by=user_id,
                        )
                        session.add(version_b)

                    # Create C2PA Provenance Assertion
                    c2pa_doc = provenance_service.create_c2pa_manifest(
                        track_id=track.id,
                        creator_id=user.id,
                        creator_username=user.username,
                        audio_sha256=audio_sha256,
                        prompt=params.prompt,
                        seed=gen_result.seed_used,
                        model_provider=provider.provider_id,
                        model_name=params.model_name,
                        bpm=params.bpm,
                        musical_key=params.musical_key,
                        user_tier="pro" if user.role in ("pro_producer", "studio") else "free",
                    )

                    commercial_ok, lic_name, discl = provenance_service.evaluate_commercial_rights(
                        provider.provider_id,
                        "pro" if user.role in ("pro_producer", "studio") else "free",
                    )

                    prov = Provenance(
                        track_id=track.id,
                        creator_id=user.id,
                        model_provider=provider.provider_id,
                        model_checkpoint_hash=None,
                        generation_seed=gen_result.seed_used,
                        input_prompt_hash=provenance_service.compute_prompt_hash(params.prompt),
                        output_audio_sha256=audio_sha256,
                        c2pa_manifest=c2pa_doc,
                        license_type=lic_name,
                        commercial_eligibility=commercial_ok,
                        disclaimer=discl,
                    )
                    session.add(prov)

                    # Update Generation record
                    g_res = await session.execute(select(Generation).where(Generation.job_id == job_id))
                    generation = g_res.scalar_one_or_none()
                    if generation:
                        generation.track_id = track.id
                        generation.status = "completed"
                        generation.progress_percentage = 100
                        generation.completed_at = datetime.now(timezone.utc)

                    # Update Job record
                    j_res = await session.execute(select(Job).where(Job.id == job_id))
                    db_job = j_res.scalar_one_or_none()
                    if db_job:
                        db_job.status = "succeeded"
                        db_job.progress_percentage = 100
                        db_job.current_stage = "Complete"
                        db_job.result = {
                            "track_id": track.id,
                            "audio_url": audio_url,
                            "second_audio_url": second_audio_url,
                            "duration_seconds": duration_actual or float(params.duration_seconds),
                        }
                        db_job.completed_at = datetime.now(timezone.utc)

            await self.emit_progress(job_id, "completed", 100, {
                "track_id": track.id,
                "audio_url": audio_url,
                "second_audio_url": second_audio_url,
                "duration_seconds": duration_actual or float(params.duration_seconds),
                "waveform": peaks[:20],
                "current_stage": "Complete",
            })

        except Exception as e:
            # Failure handling & Credit auto-refund
            async with core_db.async_session_maker() as session:
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
                            notes=f"Auto-refund for failed generation: {str(e)}",
                        )
                        session.add(ledger)

                    # Update generation record
                    g_res = await session.execute(select(Generation).where(Generation.job_id == job_id))
                    generation = g_res.scalar_one_or_none()
                    if generation:
                        generation.status = "failed"
                        generation.error_code = "GENERATION_ERROR"
                        generation.error_message = str(e)

                    # Update Job record
                    j_res = await session.execute(select(Job).where(Job.id == job_id))
                    db_job = j_res.scalar_one_or_none()
                    if db_job:
                        db_job.status = "failed"
                        db_job.error_code = "GENERATION_ERROR"
                        db_job.error_message = str(e)
                        db_job.current_stage = f"Failed: {str(e)}"
                        db_job.completed_at = datetime.now(timezone.utc)

            await self.emit_progress(job_id, "failed", 0, {
                "error_code": "GENERATION_ERROR",
                "error_message": str(e),
                "current_stage": f"Error: {str(e)}",
            })

job_runner = JobRunner()
