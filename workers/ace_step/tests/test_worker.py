"""Contract tests only: injected test runtime does not establish audible singing."""
import json
from pathlib import Path
import threading
import time
import wave

from fastapi.testclient import TestClient
import pytest

from workers.ace_step.worker import create_app, JobStore
from workers.ace_step.runtime import CHECKPOINT_REVISION, CODE_REVISION, COMPONENTS, RuntimeUnavailable, digest, verify_checkpoints, ACEStepRuntime

TOKEN = "contract-test-secret-at-least-24-characters"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
PAYLOAD = {"client_job_id": "test-lyrics-job", "prompt": "Indie song with melodic singing", "lyrics": "[Verse]\nCarry home the light", "make_instrumental": False, "duration": 10}


class TestRuntime:
    __test__ = False
    def __init__(self, block=False, fail=False):
        self.ready = False
        self.error_code = "INITIALIZING"
        self.error_message = "Initializing"
        self.device = "cuda:0 (contract test double)"
        self.started = threading.Event()
        self.release = threading.Event()
        self.block = block
        self.fail = fail
        self.calls = []

    def initialize(self):
        self.ready = True
        self.error_code = self.error_message = None

    def generate(self, request, output, progress):
        self.calls.append(request)
        self.started.set()
        if self.block:
            self.release.wait(3)
        if self.fail:
            raise RuntimeUnavailable("CUDA_OUT_OF_MEMORY", "GPU memory exhausted")
        progress(.6, desc="Actual test callback")
        path = output / "contract-only.wav"
        with wave.open(str(path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(8000)
            wav.writeframes(b"\0\0" * 800)
        return [str(path)], {"duration_seconds": .1, "sample_rate": 8000, "channels": 1, "bit_depth": 16, "metadata": {"runtime": "ace_step_1_5", "model_revision": CHECKPOINT_REVISION}}


def wait(client, job_id):
    for _ in range(200):
        job = client.get(f"/jobs/{job_id}", headers=HEADERS).json()
        if job["status"] in {"succeeded", "failed", "cancelled"}:
            return job
        time.sleep(.01)
    raise AssertionError("test job did not settle")


def ready(client):
    for _ in range(100):
        if client.get("/ready", headers=HEADERS).status_code == 200:
            return
        time.sleep(.01)
    raise AssertionError("test runtime did not initialize")


@pytest.fixture(autouse=True)
def token(monkeypatch):
    monkeypatch.setenv("ACE_STEP_API_TOKEN", TOKEN)


def test_auth_is_required_even_for_capabilities(tmp_path):
    with TestClient(create_app(TestRuntime(), tmp_path)) as client:
        assert client.get("/capabilities").status_code == 401
        assert client.post("/jobs", json=PAYLOAD).status_code == 401


def test_unconfigured_auth_fails_closed(monkeypatch, tmp_path):
    monkeypatch.delenv("ACE_STEP_API_TOKEN")
    engine = TestRuntime()
    with TestClient(create_app(engine, tmp_path)) as client:
        assert client.get("/ready", headers=HEADERS).status_code == 503
        assert not engine.ready


def test_real_runtime_never_claims_ready_without_gpu():
    engine = ACEStepRuntime()
    engine.initialize()
    assert not engine.ready
    assert engine.error_code in {"GPU_RUNTIME_UNAVAILABLE", "GPU_UNAVAILABLE", "SOURCE_UNAVAILABLE", "CHECKPOINT_UNAVAILABLE"}


def test_lyrics_job_idempotency_audio_and_progress(tmp_path):
    engine = TestRuntime()
    with TestClient(create_app(engine, tmp_path)) as client:
        ready(client)
        first = client.post("/jobs", headers=HEADERS, json=PAYLOAD)
        assert first.status_code == 202
        job_id = first.json()["id"]
        job = wait(client, job_id)
        assert job["status"] == "succeeded"
        assert job["progress_percentage"] == 100
        assert job["metadata"]["model_revision"] == CHECKPOINT_REVISION
        assert engine.calls[0].lyrics == PAYLOAD["lyrics"]
        assert engine.calls[0].make_instrumental is False
        assert "_audio_paths" not in job and "_request" not in job
        second = client.post("/jobs", headers=HEADERS, json=PAYLOAD)
        assert second.json()["id"] == job_id and len(engine.calls) == 1
        conflict = client.post("/jobs", headers=HEADERS, json={**PAYLOAD, "lyrics": "Different words"})
        assert conflict.status_code == 409
        audio = client.get(f"/jobs/{job_id}/audio", headers=HEADERS)
        assert audio.status_code == 200 and audio.content[:4] == b"RIFF"
        assert client.get(f"/jobs/{job_id}/audio", headers=HEADERS, params={"variant": 1}).status_code == 404


def test_unsupported_model_or_empty_lyrics_never_queues(tmp_path):
    with TestClient(create_app(TestRuntime(), tmp_path)) as client:
        ready(client)
        assert client.post("/jobs", headers=HEADERS, json={**PAYLOAD, "lyrics": "[Verse]\n[Chorus]"}).status_code == 422
        assert client.post("/jobs", headers=HEADERS, json={**PAYLOAD, "model": "made-up-pro-turbo"}).status_code == 422


def test_inference_failure_has_no_audio(tmp_path):
    with TestClient(create_app(TestRuntime(fail=True), tmp_path)) as client:
        ready(client)
        job = wait(client, client.post("/jobs", headers=HEADERS, json=PAYLOAD).json()["id"])
        assert job["status"] == "failed" and job["error_code"] == "CUDA_OUT_OF_MEMORY"
        assert client.get(f"/jobs/{job['id']}/audio", headers=HEADERS).status_code == 409


def test_cancel_running_and_queued_jobs(tmp_path):
    engine = TestRuntime(block=True)
    with TestClient(create_app(engine, tmp_path)) as client:
        ready(client)
        first = client.post("/jobs", headers=HEADERS, json=PAYLOAD).json()
        assert engine.started.wait(2)
        second = client.post("/jobs", headers=HEADERS, json={**PAYLOAD, "client_job_id": "queued-second"}).json()
        assert client.post(f"/jobs/{second['id']}/cancel", headers=HEADERS).json()["status"] == "cancelled"
        assert client.post(f"/jobs/{first['id']}/cancel", headers=HEADERS).json()["cancel_requested"]
        engine.release.set()
        assert wait(client, first["id"])["status"] == "cancelled"
        assert len(engine.calls) == 1
        assert client.get(f"/jobs/{first['id']}/audio", headers=HEADERS).status_code == 409


def test_restart_marks_incomplete_jobs_failed(tmp_path):
    store = JobStore(tmp_path)
    from workers.ace_step.worker import GenerateRequest
    item, _ = store.create(GenerateRequest(**PAYLOAD))
    reopened = JobStore(tmp_path).get(item["id"])
    assert reopened["status"] == "failed" and reopened["error_code"] == "WORKER_RESTARTED"


def test_checkpoint_integrity_detects_tampering(tmp_path):
    files = {}
    for component in COMPONENTS:
        path = tmp_path / component / "model.safetensors"
        path.parent.mkdir()
        path.write_bytes(b"contract fixture, not model weights")
        files[str(path.relative_to(tmp_path))] = digest(path)
    (tmp_path / "fombo-checkpoint-manifest.json").write_text(json.dumps({"repo_id": "ACE-Step/Ace-Step1.5", "revision": CHECKPOINT_REVISION, "code_revision": CODE_REVISION, "files": files}))
    verify_checkpoints(tmp_path)
    path.write_bytes(b"tampered")
    with pytest.raises(RuntimeUnavailable, match="verification"):
        verify_checkpoints(tmp_path)


def test_runtime_forwards_actual_lyrics_to_neural_api(tmp_path):
    from types import SimpleNamespace
    from workers.ace_step.worker import GenerateRequest
    captured = {}
    engine = ACEStepRuntime()
    engine.ready = True
    engine.params_type = lambda **kwargs: SimpleNamespace(**kwargs)
    engine.config_type = lambda **kwargs: SimpleNamespace(**kwargs)

    def neural_api(handler, lm, params, config, save_dir, progress):
        captured.update(params=params, config=config, lm=lm)
        path = Path(save_dir) / "contract.wav"
        with wave.open(str(path), "wb") as wav:
            wav.setnchannels(2)
            wav.setsampwidth(2)
            wav.setframerate(48000)
            wav.writeframes(b"\0\0\0\0" * 480)
        return SimpleNamespace(success=True, audios=[{"path": str(path), "params": {"seed": 42}}])

    engine.generate_music = neural_api
    _, metadata = engine.generate(GenerateRequest(**PAYLOAD, seed=42), tmp_path, lambda *_: None)
    assert captured["params"].lyrics == PAYLOAD["lyrics"]
    assert captured["params"].instrumental is False
    assert captured["params"].thinking is False
    assert captured["params"].task_type == "text2music"
    assert metadata["sample_rate"] == 48000 and metadata["duration_seconds"] == .01
    assert metadata["metadata"]["lyrics_conditioned"] is True
    assert metadata["metadata"]["singing_verified"] is False


def test_unavailable_gpu_returns_honest_readiness_and_no_job(tmp_path):
    engine = TestRuntime()
    def unavailable():
        engine.error_code = "GPU_UNAVAILABLE"
        engine.error_message = "No CUDA GPU on this host"
    engine.initialize = unavailable
    with TestClient(create_app(engine, tmp_path)) as client:
        for _ in range(100):
            state = client.get("/ready", headers=HEADERS)
            if state.json()["error_code"] == "GPU_UNAVAILABLE":
                break
            time.sleep(.01)
        assert state.status_code == 503
        assert state.json()["ready"] is False and state.json()["model_loaded"] is False
        assert state.json()["runtime"] == "ace_step_1_5"
        response = client.post("/jobs", headers=HEADERS, json=PAYLOAD)
        assert response.status_code == 503 and response.json()["detail"]["error_code"] == "GPU_UNAVAILABLE"
        assert engine.calls == []


def test_completed_idempotent_result_survives_later_gpu_failure(tmp_path):
    engine = TestRuntime()
    with TestClient(create_app(engine, tmp_path)) as client:
        ready(client)
        first = client.post("/jobs", headers=HEADERS, json=PAYLOAD).json()
        assert wait(client, first["id"])["status"] == "succeeded"
        engine.ready = False
        response = client.post("/jobs", headers=HEADERS, json=PAYLOAD)
        assert response.status_code == 202 and response.json()["id"] == first["id"]
        assert len(engine.calls) == 1
