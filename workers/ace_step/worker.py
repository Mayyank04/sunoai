"""Authenticated, durable job API for a separate ACE-Step 1.5 GPU worker.

No DSP, TTS or instrumental fallback. Run one uvicorn process per GPU.
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
import hashlib
import hmac
import json
import logging
import os
from pathlib import Path
import re
import sqlite3
import threading
import time
import uuid
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field, model_validator

from .runtime import ACEStepRuntime, CHECKPOINT_REVISION, CODE_REVISION, MODEL_LICENSE, MODEL_NAME, RuntimeUnavailable

logger = logging.getLogger(__name__)
TERMINAL = {"succeeded", "failed", "cancelled"}


class GenerateRequest(BaseModel):
    client_job_id: str = Field(min_length=1, max_length=128)
    prompt: str = Field(min_length=1, max_length=512)
    lyrics: Optional[str] = Field(default=None, max_length=4096)
    make_instrumental: bool = False
    genre: Optional[str] = Field(default=None, max_length=64)
    mood: Optional[str] = Field(default=None, max_length=64)
    instruments: list[str] = Field(default_factory=list, max_length=20)
    style_tags: list[str] = Field(default_factory=list, max_length=20)
    bpm: Optional[int] = Field(default=None, ge=30, le=300)
    musical_key: Optional[str] = Field(default=None, max_length=32)
    vocal_language: str = Field(default="unknown", max_length=12)
    duration: float = Field(default=30, ge=10, le=240, allow_inf_nan=False)
    seed: Optional[int] = Field(default=None, ge=0, le=2147483646)
    model: str = MODEL_NAME
    generate_two_variants: bool = False

    @model_validator(mode="after")
    def validate_conditioning(self):
        if self.model != MODEL_NAME:
            raise ValueError(f"Only the loaded model {MODEL_NAME} is supported.")
        if not self.make_instrumental and not re.sub(r"\[[^]]*\]|\s", "", self.lyrics or ""):
            raise ValueError("A vocal song requires actual lyrics, beyond section tags.")
        caption = "; ".join(str(value) for value in [self.prompt, self.genre, self.mood, ", ".join(self.instruments), ", ".join(self.style_tags)] if value)
        if len(caption) > 512:
            raise ValueError("Combined prompt, genre, mood, instruments and tags exceed ACE-Step's 512 character limit.")
        return self


class JobStore:
    def __init__(self, root):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.path = self.root / "jobs.sqlite3"
        self.lock = threading.RLock()
        with self.connect() as db:
            db.execute("CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, client_id TEXT UNIQUE, request_hash TEXT, data TEXT NOT NULL)")
            for (raw,) in db.execute("SELECT data FROM jobs").fetchall():
                item = json.loads(raw)
                if item["status"] not in TERMINAL:
                    item.update(status="failed", error_code="WORKER_RESTARTED", error_message="GPU worker restarted during generation.", current_stage="Failed")
                    db.execute("UPDATE jobs SET data=? WHERE id=?", (json.dumps(item), item["id"]))

    def connect(self):
        return sqlite3.connect(self.path)

    def get(self, job_id):
        with self.lock, self.connect() as db:
            row = db.execute("SELECT data FROM jobs WHERE id=?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Worker job not found.")
        return json.loads(row[0])

    def update(self, job_id, **fields):
        with self.lock, self.connect() as db:
            item = self.get(job_id)
            item.update(fields, updated_at=time.time())
            db.execute("UPDATE jobs SET data=? WHERE id=?", (json.dumps(item), job_id))
        return item

    def existing(self, request):
        with self.lock, self.connect() as db:
            row = db.execute("SELECT request_hash,data FROM jobs WHERE client_id=?", (request.client_job_id,)).fetchone()
        if row:
            if row[0] != hashlib.sha256(request.model_dump_json().encode()).hexdigest():
                raise HTTPException(409, "This client job id already belongs to another generation request.")
            return json.loads(row[1])
        return None

    def create(self, request):
        serialized = request.model_dump_json()
        fingerprint = hashlib.sha256(serialized.encode()).hexdigest()
        with self.lock, self.connect() as db:
            existing = db.execute("SELECT request_hash,data FROM jobs WHERE client_id=?", (request.client_job_id,)).fetchone()
            if existing:
                if existing[0] != fingerprint:
                    raise HTTPException(409, "This client job id already belongs to another generation request.")
                return json.loads(existing[1]), False
            active = sum(json.loads(row[0])["status"] not in TERMINAL for row in db.execute("SELECT data FROM jobs"))
            if active >= int(os.environ.get("ACE_STEP_MAX_PENDING_JOBS", "8")):
                raise HTTPException(429, {"error_code": "WORKER_BUSY", "message": "GPU worker queue is full. Try again later."})
            item = {"id": str(uuid.uuid4()), "status": "queued", "progress_percentage": 0, "current_stage": "Queued for GPU",
                    "error_code": None, "error_message": None, "metadata": {}, "created_at": time.time(), "cancel_requested": False,
                    "_request": request.model_dump(), "_audio_paths": []}
            db.execute("INSERT INTO jobs VALUES (?,?,?,?)", (item["id"], request.client_job_id, fingerprint, json.dumps(item)))
            return item, True


def public_job(item):
    return {key: value for key, value in item.items() if not key.startswith("_")}


def service_auth(x_service_token: Optional[str] = Header(None, alias="X-Service-Token"), authorization: Optional[str] = Header(None)):
    expected = os.environ.get("ACE_STEP_API_TOKEN", "")
    if len(expected) < 24:
        raise HTTPException(503, {"error_code": "WORKER_AUTH_UNCONFIGURED", "message": "Configure a random ACE_STEP_API_TOKEN of at least 24 characters on the worker and backend."})
    supplied = x_service_token or (authorization[7:] if authorization and authorization.lower().startswith("bearer ") else "")
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(401, "Invalid worker service token.")


def create_app(runtime=None, data_dir=None):
    engine = runtime or ACEStepRuntime()

    @asynccontextmanager
    async def lifespan(app):
        app.state.store = JobStore(data_dir or os.environ.get("ACE_STEP_JOB_DIR", "./storage_data/ace_step_jobs"))
        app.state.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="ace-gpu")
        if len(os.environ.get("ACE_STEP_API_TOKEN", "")) >= 24:
            # Keep health endpoints responsive throughout model initialization.
            app.state.load_task = asyncio.get_running_loop().run_in_executor(app.state.executor, engine.initialize)
        yield
        app.state.executor.shutdown(wait=False, cancel_futures=True)

    app = FastAPI(title="Fombo ACE-Step GPU Worker", version="2.0.0", lifespan=lifespan)
    app.state.engine = engine

    def readiness():
        return {"runtime": "ace_step_1_5", "ready": engine.ready, "is_ready": engine.ready, "model_loaded": engine.ready,
                "status": "ready" if engine.ready else "unavailable", "model_name": MODEL_NAME,
                "model_revision": CHECKPOINT_REVISION, "checkpoint_revision": CHECKPOINT_REVISION, "code_revision": CODE_REVISION,
                "license": MODEL_LICENSE, "device": engine.device, "supports_lyrics": True, "supports_vocals": True,
                "error_code": engine.error_code, "error_message": engine.error_message, "message": engine.error_message}

    @app.get("/health", dependencies=[Depends(service_auth)])
    def health():
        return {"status": "healthy", **readiness()}

    @app.get("/ready", dependencies=[Depends(service_auth)])
    def ready():
        return JSONResponse(readiness(), status_code=200 if engine.ready else 503)

    @app.get("/capabilities", dependencies=[Depends(service_auth)])
    def capabilities():
        return {**readiness(), "provider_id": "ace_step_1_5", "display_name": "ACE-Step 1.5 (GPU)",
                "supports_text_to_audio": True, "supports_audio_to_audio": False, "supports_stems": False,
                "supports_instrumental_toggle": True, "supports_bpm_control": True, "supports_key_control": True,
                "supports_instrument_selection": False, "supports_dual_variants": True,
                "models_available": [MODEL_NAME], "min_duration_seconds": 10, "max_duration_seconds": 240,
                "commercial_use_allowed": True, "attribution_required": True,
                "capability_note": "Lyrics condition neural music generation. Audibility and lyric fidelity require listening to each result."}

    def run_job(job_id):
        store = app.state.store
        with store.lock:
            item = store.get(job_id)
            if item["status"] == "cancelled":
                return
            store.update(job_id, status="running", current_stage="Generating music on GPU")
        output = store.root / job_id
        output.mkdir(exist_ok=True)

        def progress(value, desc=None, **kwargs):
            with store.lock:
                item = store.get(job_id)
                if item.get("cancel_requested"):
                    raise RuntimeUnavailable("GENERATION_CANCELLED", "Generation cancelled.")
                # Only update from actual model callbacks, never elapsed-time animation.
                fraction = value[0] / value[1] if isinstance(value, tuple) and value[1] else value
                percentage = max(0, min(95, round(float(fraction) * 100))) if isinstance(fraction, (float, int)) else item["progress_percentage"]
                store.update(job_id, progress_percentage=max(percentage, item["progress_percentage"]), current_stage=str(desc or "Generating music on GPU"))
        try:
            paths, measured = engine.generate(GenerateRequest(**item["_request"]), output, progress)
            with store.lock:
                if store.get(job_id).get("cancel_requested"):
                    store.update(job_id, status="cancelled", current_stage="Cancelled")
                    for path in paths:
                        Path(path).unlink(missing_ok=True)
                else:
                    store.update(job_id, status="succeeded", current_stage="Complete", progress_percentage=100, _audio_paths=paths, **measured)
        except Exception as exc:
            logger.exception("ACE-Step inference job failed: %s", job_id)
            with store.lock:
                if store.get(job_id).get("cancel_requested"):
                    store.update(job_id, status="cancelled", current_stage="Cancelled", error_code="GENERATION_CANCELLED", error_message="Generation cancelled.")
                else:
                    store.update(job_id, status="failed", current_stage="Failed", error_code=getattr(exc, "code", "INFERENCE_FAILED"), error_message=str(exc))

    @app.post("/jobs", dependencies=[Depends(service_auth)], status_code=202)
    def submit(request: GenerateRequest):
        # Retries can retrieve a durable result even after a GPU outage/restart.
        existing = app.state.store.existing(request)
        if existing:
            return public_job(existing)
        if not engine.ready:
            raise HTTPException(503, {"error_code": engine.error_code, "message": engine.error_message})
        item, created = app.state.store.create(request)
        if created:
            app.state.executor.submit(run_job, item["id"])
        return public_job(item)

    @app.get("/jobs/{job_id}", dependencies=[Depends(service_auth)])
    def get_job(job_id: str):
        return public_job(app.state.store.get(job_id))

    @app.post("/jobs/{job_id}/cancel", dependencies=[Depends(service_auth)])
    def cancel(job_id: str):
        with app.state.store.lock:
            item = app.state.store.get(job_id)
            if item["status"] not in TERMINAL:
                item = app.state.store.update(job_id, cancel_requested=True,
                    status="cancelled" if item["status"] == "queued" else item["status"], current_stage="Cancelled" if item["status"] == "queued" else "Cancellation requested")
        return public_job(item)

    @app.get("/jobs/{job_id}/audio", dependencies=[Depends(service_auth)])
    def audio(job_id: str, variant: int = Query(default=0, ge=0, le=1)):
        item = app.state.store.get(job_id)
        if item["status"] != "succeeded":
            raise HTTPException(409, "Audio is only available for successful generation jobs.")
        paths = item["_audio_paths"]
        if variant >= len(paths) or not Path(paths[variant]).is_file():
            raise HTTPException(404, "Generated audio variant is unavailable.")
        return FileResponse(paths[variant], media_type="audio/wav", filename=f"{job_id}-{variant + 1}.wav")

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.environ.get("ACE_STEP_WORKER_HOST", "127.0.0.1"), port=int(os.environ.get("ACE_STEP_WORKER_PORT", "8001")), workers=1)
