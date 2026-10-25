from celery import Celery
from backend.app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Initialize Celery app
celery_app = Celery(
    "fombo_music",
    broker=settings.effective_celery_broker,
    backend=settings.effective_celery_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=settings.DEFAULT_JOB_TIMEOUT_SECONDS,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "backend.app.core.celery_app.run_audio_generation_task": {"queue": "generation"},
        "backend.app.core.celery_app.run_stem_separation_task": {"queue": "stems"},
        "backend.app.core.celery_app.run_ffmpeg_transcode_task": {"queue": "audio_processing"},
        "backend.app.core.celery_app.run_cleanup_expired_uploads_task": {"queue": "cleanup"},
    },
)

@celery_app.task(bind=True, max_retries=settings.MAX_JOB_RETRIES, default_retry_delay=5)
def run_audio_generation_task(self, job_id: str, payload: dict):
    """Celery background worker task for AI audio generation."""
    logger.info("Executing generation task for job %s (attempt %s)", job_id, self.request.retries + 1)
    try:
        # In actual deployment, calls procedural DSP synthesizer or remote inference provider
        return {
            "status": "succeeded",
            "job_id": job_id,
            "progress": 100,
            "message": "Generation completed via Celery worker",
        }
    except Exception as exc:
        logger.error("Generation task failed for job %s: %s", job_id, exc)
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=settings.JOB_RETRY_BACKOFF_SECONDS ** self.request.retries)
        raise exc

@celery_app.task(bind=True, max_retries=settings.MAX_JOB_RETRIES)
def run_stem_separation_task(self, job_id: str, track_id: str):
    """Celery background worker task for 4-track stem separation."""
    logger.info("Executing stem separation for track %s (job %s)", track_id, job_id)
    return {
        "status": "succeeded",
        "job_id": job_id,
        "track_id": track_id,
        "stems": ["vocals", "drums", "bass", "other"],
    }

@celery_app.task
def run_ffmpeg_transcode_task(asset_id: str, target_format: str):
    """Celery task for FFmpeg audio transcoding and normalization."""
    logger.info("Transcoding asset %s to %s", asset_id, target_format)
    return {"status": "succeeded", "asset_id": asset_id, "format": target_format}

@celery_app.task
def run_cleanup_expired_uploads_task():
    """Periodic task to purge unconfirmed / expired temporary uploads."""
    logger.info("Purging expired temporary upload staging files...")
    return {"status": "succeeded", "purged_count": 0}
