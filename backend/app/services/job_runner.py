"""Database-backed generation orchestration; GPU inference lives in a separate worker."""
import asyncio
import io
import json
import logging
import shutil
import subprocess
import time
import wave
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, AsyncGenerator, Optional
from sqlalchemy import select, update, or_
from backend.app.core import database as core_db
from backend.app.core.config import settings
from backend.app.models.generation import Generation
from backend.app.models.job import Job
from backend.app.models.track import Track
from backend.app.models.asset import Asset
from backend.app.models.version import SongVersion
from backend.app.models.provenance import Provenance
from backend.app.models.user import User
from backend.app.services.providers.registry import provider_registry
from backend.app.services.providers.base import GenerationRequestParams
from backend.app.services.generation_credits import settle_generation_credits
from backend.app.services.storage import storage_service
from backend.app.services.audio_processor import AudioProcessor
from backend.app.services.provenance import provenance_service

logger = logging.getLogger(__name__)

class UserCancelled(RuntimeError):
    pass


def _pcm_audio(data):
    """Decode actual audio; malformed provider responses must never become completed tracks."""
    try:
        with wave.open(io.BytesIO(data), "rb") as wav:
            if wav.getnframes() < 1 or wav.getsampwidth() != 2:
                raise ValueError("Unsupported or empty PCM WAV")
            frames = wav.readframes(wav.getnframes())
            if len(frames) != wav.getnframes() * wav.getnchannels() * 2:
                raise ValueError("Truncated PCM WAV")
            return data, wav.getnframes() / wav.getframerate(), wav.getframerate(), wav.getnchannels()
    except Exception:
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            raise ValueError("Provider returned invalid/non-PCM audio and FFmpeg is unavailable.")
        decoded = subprocess.run([ffmpeg, "-v", "error", "-i", "pipe:0", "-f", "wav", "-acodec", "pcm_s16le", "pipe:1"], input=data, capture_output=True, timeout=120)
        if decoded.returncode:
            raise ValueError("Provider returned audio that could not be decoded.")
        with wave.open(io.BytesIO(decoded.stdout), "rb") as wav:
            frames = wav.readframes(wav.getnframes())
            rate, channels = wav.getframerate(), wav.getnchannels()
            if not frames:
                raise ValueError("Provider returned empty audio.")
        # Repack a stream WAV so its header has the true frame count.
        out = io.BytesIO()
        with wave.open(out, "wb") as wav:
            wav.setnchannels(channels); wav.setsampwidth(2); wav.setframerate(rate); wav.writeframes(frames)
        return out.getvalue(), len(frames) / (rate * channels * 2), rate, channels


class JobRunner:
    def __init__(self):
        self._event_queues = {}
        self._job_cache = {}
        self._cancelled_jobs = set()
        self._tasks = {}
        self._scheduler = None

    def dispatch(self, job_id, user_id, params, credits_cost):
        if job_id in self._tasks and not self._tasks[job_id].done():
            return
        task = asyncio.create_task(self.execute_generation_job(job_id, user_id, params, credits_cost))
        self._tasks[job_id] = task
        def done(completed):
            self._tasks.pop(job_id, None)
            if not completed.cancelled() and completed.exception():
                logger.error("Generation orchestration failed for %s: %s", job_id, completed.exception())
        task.add_done_callback(done)

    async def start(self):
        self._scheduler = asyncio.create_task(self._recover_loop())

    async def stop(self):
        tasks = list(self._tasks.values()) + ([self._scheduler] if self._scheduler else [])
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _recover_loop(self):
        while True:
            try:
                async with core_db.async_session_maker() as session:
                    # A live worker refreshes this lease during provider polling. On
                    # restart stale jobs reattach using the same remote client id.
                    cutoff = datetime.now(timezone.utc) - timedelta(seconds=90)
                    await session.execute(update(Job).where(Job.job_type == "generation", Job.status == "running", or_(Job.heartbeat_at < cutoff, Job.heartbeat_at.is_(None))).values(status="queued"))
                    pending = (await session.execute(select(Job).where(Job.job_type == "generation", Job.status == "queued"))).scalars().all()
                    await session.commit()
                for job in pending:
                    if job.payload:
                        self.dispatch(job.id, job.user_id, GenerationRequestParams.model_validate(job.payload), 0)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Could not recover generation jobs")
            await asyncio.sleep(15)

    def mark_cancelled(self, job_id):
        self._cancelled_jobs.add(job_id)

    def clear_cancelled(self, job_id):
        self._cancelled_jobs.discard(job_id)

    def is_cancelled(self, job_id):
        return job_id in self._cancelled_jobs

    def get_or_create_queue(self, job_id):
        return self._event_queues.setdefault(job_id, asyncio.Queue(maxsize=100))

    async def emit_progress(self, job_id, phase, progress, data=None):
        payload = {"job_id": job_id, "phase": phase, "progress_percentage": progress, "timestamp": time.time(), **(data or {})}
        self._job_cache[job_id] = payload
        queue = self._event_queues.get(job_id)
        if queue:
            if queue.full():
                queue.get_nowait()
            queue.put_nowait(payload)

    async def stream_job_events(self, job_id) -> AsyncGenerator[str, None]:
        # Read durable state on every tick; works across API processes and restarts.
        while True:
            async with core_db.async_session_maker() as session:
                job = await session.get(Job, job_id)
                if not job:
                    return
                phase = {"succeeded":"completed", "running":"processing"}.get(job.status, job.status)
                payload = {"job_id":job.id, "phase":phase, "progress_percentage":job.progress_percentage,
                           "current_stage":job.current_stage, "error_code":job.error_code, "error_message":job.error_message, **(job.result or {})}
            event = "complete" if phase == "completed" else "error" if phase == "failed" else "progress"
            yield f"event: {event}\ndata: {json.dumps(payload)}\n\n"
            if phase in ("completed", "failed", "cancelled"):
                return
            await asyncio.sleep(2)

    async def _progress(self, job_id, progress, stage, details=None, lease_id=None):
        if self.is_cancelled(job_id):
            raise UserCancelled("Generation was cancelled.")
        async with core_db.async_session_maker() as session:
            job = await session.get(Job, job_id)
            if not job or job.status != "running" or (lease_id and (job.result or {}).get("lease_id") != lease_id):
                raise UserCancelled("Generation is no longer active.")
            # A conditional update prevents an in-flight progress poll undoing cancellation.
            result = {**(job.result or {}), **(details or {})}
            claimed = (await session.execute(update(Job).where(Job.id == job_id, Job.status == "running", Job.result["lease_id"].as_string() == lease_id)
                .values(progress_percentage=progress, current_stage=stage[:128], heartbeat_at=datetime.now(timezone.utc), result=result).returning(Job.id))).scalar_one_or_none()
            if not claimed:
                raise UserCancelled("Generation is no longer active.")
            await session.execute(update(Generation).where(Generation.job_id == job_id, Generation.status.in_(["queued", "processing"]))
                .values(status="processing", progress_percentage=progress))
            await session.commit()
        await self.emit_progress(job_id, "processing", progress, {"current_stage":stage, **(details or {})})

    async def execute_generation_job(self, job_id, user_id, params, credits_cost=5):
        # Single database claim prevents duplicate dispatch from API + recovery loop.
        lease_id = uuid.uuid4().hex
        heartbeat_task = None
        async with core_db.async_session_maker() as session:
            claimed = (await session.execute(update(Job).where(Job.id == job_id, Job.status == "queued")
                .values(status="running", result={"lease_id":lease_id}, progress_percentage=1, current_stage="Preparing generation", heartbeat_at=datetime.now(timezone.utc), started_at=datetime.now(timezone.utc)).returning(Job.retry_count))).scalar_one_or_none()
            if claimed is None:
                return
            attempt = claimed
            await session.execute(update(Generation).where(Generation.job_id == job_id).values(status="processing", started_at=datetime.now(timezone.utc)))
            await session.commit()
        async def heartbeat():
            while True:
                await asyncio.sleep(20)
                async with core_db.async_session_maker() as session:
                    await session.execute(update(Job).where(Job.id == job_id, Job.status == "running", Job.result["lease_id"].as_string() == lease_id)
                        .values(heartbeat_at=datetime.now(timezone.utc)))
                    await session.commit()
        heartbeat_task = asyncio.create_task(heartbeat())
        provider = provider_registry.get(params.provider_id)
        files = []
        try:
            if not provider:
                raise ValueError("The selected music provider is unavailable.")
            await self._progress(job_id, 5, "Contacting generation worker", lease_id=lease_id)
            async def progress(percent, stage, details=None):
                await self._progress(job_id, percent, stage, details, lease_id)
            result = await asyncio.wait_for(provider.generate_with_progress(params, f"{job_id}_attempt_{attempt}", progress), timeout=settings.GENERATION_TIMEOUT_SECONDS + 60)
            await self._progress(job_id, 88, "Validating generated recording", lease_id=lease_id)
            wav_bytes, duration, rate, channels = await asyncio.to_thread(_pcm_audio, result.audio_bytes)
            peaks = await asyncio.to_thread(AudioProcessor.extract_waveform_peaks, wav_bytes, 120)
            secondary = None
            second_peaks = None
            if result.second_variant_bytes:
                secondary, _, _, _ = await asyncio.to_thread(_pcm_audio, result.second_variant_bytes)
                second_peaks = await asyncio.to_thread(AudioProcessor.extract_waveform_peaks, secondary, 120)
            await self._progress(job_id, 94, "Saving recording to your library", lease_id=lease_id)
            storage_key, audio_url = await asyncio.to_thread(storage_service.save_bytes, wav_bytes, "tracks", f"{job_id}_{lease_id}_variant_a.wav")
            files.append(storage_key)
            second_url = None
            if secondary:
                second_key, second_url = await asyncio.to_thread(storage_service.save_bytes, secondary, "tracks", f"{job_id}_{lease_id}_variant_b.wav")
                files.append(second_key)
            license_meta = provider.get_license_metadata()
            async with core_db.async_session_maker() as session:
                async with session.begin():
                    # Cancellation and completion compete for one status transition;
                    # only the winning transaction can consume or refund credits.
                    won = (await session.execute(update(Job).where(Job.id == job_id, Job.status == "running", Job.result["lease_id"].as_string() == lease_id)
                        .values(status="succeeded", progress_percentage=100, current_stage="Complete", completed_at=datetime.now(timezone.utc)).returning(Job.id))).scalar_one_or_none()
                    if not won:
                        raise UserCancelled("Generation was cancelled before saving.")
                    user = await session.get(User, user_id)
                    track = Track(user_id=user_id, title=f"{params.genre or 'Song'} · {params.musical_key}",
                        description=f"Generated with {provider.name}.", genre=params.genre,
                        style_tags=params.style_tags, bpm=params.bpm, musical_key=params.musical_key,
                        duration_seconds=duration, audio_url=audio_url, waveform_data=peaks,
                        lyrics=params.lyrics, is_public=False,
                        commercial_rights_status="eligible_subject_to_input_rights" if license_meta.commercial_use_allowed else "unverified_or_restricted")
                    session.add(track)
                    await session.flush()
                    sha = provenance_service.compute_sha256(wav_bytes)
                    session.add(Asset(user_id=user_id, track_id=track.id, asset_type="audio", s3_key=storage_key,
                        s3_bucket=storage_service.bucket, storage_url=audio_url, mime_type="audio/wav",
                        file_size_bytes=len(wav_bytes), sha256_hash=sha, duration_seconds=duration,
                        sample_rate=rate, bit_depth=16, channels=channels, metadata_json=result.metadata))
                    if second_url:
                        session.add(SongVersion(track_id=track.id, version_number=2, title=f"{track.title} (Take 2)",
                            changelog="Second generated take", audio_url=second_url, duration_seconds=duration,
                            waveform_data=second_peaks, created_by=user_id))
                    manifest = {"format":"fombo-generation-provenance-v1", "signed":False,
                                "provider":provider.provider_id, "model":params.model_name,
                                "seed":result.seed_used, "output_sha256":sha, "model_metadata":result.metadata,
                                "license":license_meta.model_dump()}
                    session.add(Provenance(track_id=track.id, creator_id=user_id, model_provider=provider.provider_id,
                        model_version=params.model_name, model_checkpoint_hash=result.metadata.get("checkpoint_manifest_sha256"),
                        generation_seed=result.seed_used, input_prompt_hash=provenance_service.compute_prompt_hash(params.prompt),
                        output_audio_sha256=sha, c2pa_manifest=manifest, license_type=license_meta.license_type,
                        commercial_eligibility=license_meta.commercial_use_allowed,
                        commercial_use_eligibility="eligible_subject_to_input_rights" if license_meta.commercial_use_allowed else "restricted",
                        commercial_eligibility_reasons=[license_meta.warranty_terms], disclaimer=license_meta.warranty_terms, legal_disclaimer=license_meta.warranty_terms))
                    await settle_generation_credits(session, job_id)
                    await session.execute(update(Generation).where(Generation.job_id == job_id)
                        .values(track_id=track.id, status="completed", progress_percentage=100, completed_at=datetime.now(timezone.utc)))
                    saved_result = {"track_id":track.id, "audio_url":audio_url, "second_audio_url":second_url,
                                    "duration_seconds":duration, "provider_job_id":result.provider_job_id}
                    await session.execute(update(Job).where(Job.id == job_id).values(result=saved_result))
            files.clear()
            await self.emit_progress(job_id, "completed", 100, {**saved_result, "current_stage":"Complete"})
        except asyncio.CancelledError:
            # Process shutdown leaves a recoverable lease. The remote idempotent job
            # is reattached after restart, so no extra debit or inference is issued.
            raise
        except Exception as exc:
            code = getattr(exc, "error_code", "INFERENCE_TIMEOUT" if isinstance(exc, asyncio.TimeoutError) else "GENERATION_ERROR")
            message = str(exc) or "Generation exceeded its time limit."
            async with core_db.async_session_maker() as session:
                async with session.begin():
                    won = (await session.execute(update(Job).where(Job.id == job_id, Job.status == "running", Job.result["lease_id"].as_string() == lease_id)
                        .values(status="failed", error_code=code, error_message=message, current_stage="Generation failed", completed_at=datetime.now(timezone.utc)).returning(Job.id))).scalar_one_or_none()
                    if won:
                        await session.execute(update(Generation).where(Generation.job_id == job_id)
                            .values(status="failed", error_code=code, error_message=message, completed_at=datetime.now(timezone.utc)))
                        await settle_generation_credits(session, job_id, refund=True, reason=message)
            await self.emit_progress(job_id, "failed" if won else "cancelled", 0, {"error_code":code, "error_message":message})
        finally:
            if heartbeat_task:
                heartbeat_task.cancel()
                await asyncio.gather(heartbeat_task, return_exceptions=True)
            for key in files:
                await asyncio.to_thread(storage_service.delete_file, key)

job_runner = JobRunner()
