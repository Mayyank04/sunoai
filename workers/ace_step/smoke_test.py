"""Real GPU acceptance request. No substitutes and no automatic quality claim."""
import json
import os
from pathlib import Path
import time
import uuid
import wave

import httpx

from .runtime import MODEL_NAME, CHECKPOINT_REVISION

LYRICS = """[Verse]
Lanterns on the river shine
I hear your heartbeat next to mine
[Chorus]
Sing with me until the morning
We will carry home the light
"""


def main():
    endpoint = os.environ.get("ACE_STEP_SERVICE_URL", "http://127.0.0.1:8001").rstrip("/")
    token = os.environ.get("ACE_STEP_API_TOKEN", "")
    output = Path(os.environ.get("ACE_STEP_TEST_OUTPUT", "work/ace-step-vocal-check"))
    output.mkdir(parents=True, exist_ok=True)
    evidence = {"audible_singing_verified": False, "lyrics": LYRICS, "status": "blocked"}
    try:
        with httpx.Client(base_url=endpoint, headers={"Authorization": f"Bearer {token}"}, timeout=30) as client:
            response = client.get("/ready")
            evidence["readiness"] = response.json()
            response.raise_for_status()
            state = evidence["readiness"]
            if not (state.get("ready") and state.get("runtime") == "ace_step_1_5"
                    and state.get("model_revision") == CHECKPOINT_REVISION
                    and state.get("device", "").startswith(("cuda", "mps"))):
                raise RuntimeError("Reviewed ACE-Step GPU model is not ready; refusing substitutes.")
            response = client.post("/jobs", json={"client_job_id": f"vocal-acceptance-{uuid.uuid4()}",
                "prompt": "Warm indie pop song, expressive melodic lead singing, acoustic guitar, drums, clear English vocals",
                "lyrics": LYRICS, "vocal_language": "en", "make_instrumental": False, "duration": 30,
                "seed": 20261025, "model": MODEL_NAME, "generate_two_variants": False})
            response.raise_for_status()
            job = response.json()
            deadline = time.monotonic() + 1800
            while job["status"] not in {"succeeded", "failed", "cancelled"}:
                if time.monotonic() > deadline:
                    client.post(f"/jobs/{job['id']}/cancel")
                    raise RuntimeError("GPU test exceeded 30 minutes; cancellation requested.")
                time.sleep(2)
                response = client.get(f"/jobs/{job['id']}")
                response.raise_for_status()
                job = response.json()
                print(f"{job['status']}: {job['current_stage']} ({job['progress_percentage']}%)", flush=True)
            evidence["job"] = job
            if job["status"] != "succeeded":
                raise RuntimeError(job.get("error_message") or f"Job {job['status']}")
            response = client.get(f"/jobs/{job['id']}/audio", params={"variant": 0})
            response.raise_for_status()
            audio = output / "lyrics-conditioned-song.wav"
            audio.write_bytes(response.content)
            with wave.open(str(audio), "rb") as wav:
                evidence["audio"] = {"file": str(audio.resolve()), "duration_seconds": wav.getnframes() / wav.getframerate(), "sample_rate": wav.getframerate()}
            evidence["status"] = "generated_listening_required"
            print(f"Generated {audio}. Listen and verify melodic singing of the supplied lyrics before marking accepted.")
    except Exception as exc:
        evidence["blocker"] = str(exc)
        print(f"Real vocal generation blocked: {exc}")
    finally:
        (output / "evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
    if evidence["status"] == "blocked":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
