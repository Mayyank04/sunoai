"""Adapter for Fombo's separate, authenticated ACE-Step 1.5 CUDA worker."""
import asyncio
import io
import time
import uuid
import wave
from typing import Any, Dict, Optional, Tuple

import httpx
from backend.app.core.config import settings
from backend.app.services.providers.base import (
    MusicGenerationProvider, ProviderCapabilities, GenerationRequestParams,
    GenerationResult, GenerationStatus, CostEstimate, LicenseMetadata,
)

MODEL = "acestep-v15-turbo"
CHECKPOINT_REVISION = "19671f406d603126926c1b7e2adc169acbcade22"


class ProviderFailure(RuntimeError):
    def __init__(self, code: str, message: str):
        self.error_code = code
        super().__init__(message)


class ACEStepMusicProvider(MusicGenerationProvider):
    provider_id = "ace_step_1_5"
    name = "ACE-Step 1.5"

    def __init__(self):
        self._jobs: Dict[str, str] = {}

    def _get_auth_headers(self):
        return {"Authorization": f"Bearer {settings.ACE_STEP_API_TOKEN}"} if settings.ACE_STEP_API_TOKEN else {}

    def _endpoint(self):
        if settings.ACE_STEP_NATIVE_PORT is not None:
            return f"http://127.0.0.1:{settings.ACE_STEP_NATIVE_PORT}"
        return (settings.ACE_STEP_SERVICE_URL or "").rstrip("/")

    @staticmethod
    def _verified(data):
        return (
            data.get("ready") is True
            and data.get("model_loaded") is True
            and data.get("runtime") == "ace_step_1_5"
            and data.get("model_name") == MODEL
            and data.get("model_revision") == CHECKPOINT_REVISION
            and data.get("license") == "MIT"
            and data.get("supports_vocals") is True
            and data.get("supports_lyrics") is True
            and str(data.get("device", "")).startswith(("cuda", "mps"))
        )

    def validate_configuration(self) -> Tuple[bool, Optional[str]]:
        if not self._endpoint():
            return False, "ACE-Step GPU worker is not configured. Set ACE_STEP_SERVICE_URL and ACE_STEP_API_TOKEN."
        if not settings.ACE_STEP_API_TOKEN:
            return False, "ACE_STEP_API_TOKEN is missing; configure the same token on the API and GPU worker."
        try:
            with httpx.Client(timeout=3.0) as client:
                resp = client.get(f"{self._endpoint()}/ready", headers=self._get_auth_headers())
            data = resp.json()
            if resp.status_code == 200 and self._verified(data):
                return True, "ACE-Step 1.5 GPU model and pinned MIT checkpoint are loaded."
            return False, data.get("error_message") or data.get("message") or "Worker is not running the verified ACE-Step GPU checkpoint."
        except Exception:
            return False, "ACE-Step GPU worker is unreachable or returned an invalid readiness response."

    def get_capabilities(self):
        ready, message = self.validate_configuration()
        return ProviderCapabilities(
            provider_id=self.provider_id, display_name=self.name,
            description="Lyrics-conditioned singing and accompaniment using the official MIT-licensed ACE-Step 1.5 checkpoint on a separate GPU worker.",
            supports_lyrics=True, supports_vocals=True, supports_audio_to_audio=False,
            supports_instrument_selection=False, supports_dual_variants=True, min_duration_seconds=10, max_duration_seconds=240,
            supported_audio_formats=["wav"], models_available=[MODEL],
            is_configured=ready, configuration_message=message, provider_type="self_hosted",
            commercial_grade=True, attribution_required=True,
            status_label="Ready" if ready else "GPU worker unavailable",
            health_status="healthy" if ready else "unconfigured" if not self._endpoint() else "offline",
            model_revision=CHECKPOINT_REVISION,
        )

    async def check_readiness(self):
        ready, message = await asyncio.to_thread(self.validate_configuration)
        return {"provider_id": self.provider_id, "ready": ready, "status": "ready" if ready else "not_ready", "message": message}

    async def check_health(self):
        result = await self.check_readiness()
        return {**result, "is_configured": result["ready"], "status": "healthy" if result["ready"] else "offline"}

    async def generate(self, params):
        return await self.generate_with_progress(params, f"direct_{uuid.uuid4().hex}", None)

    async def generate_with_progress(self, params, job_id, on_progress=None):
        if params.model_name != MODEL:
            raise ProviderFailure("UNSUPPORTED_MODEL", f"ACE-Step supports {MODEL}.")
        if not params.make_instrumental and not (params.lyrics or "").strip():
            raise ProviderFailure("LYRICS_REQUIRED", "Add lyrics to generate singing.")
        readiness = await self.check_readiness()
        if not readiness["ready"]:
            raise ProviderFailure("WORKER_NOT_READY", readiness["message"])
        payload = {
            "client_job_id": job_id, "prompt": params.prompt, "lyrics": params.lyrics,
            "make_instrumental": params.make_instrumental, "genre": params.genre,
            "mood": params.mood, "instruments": params.instruments,
            "style_tags": params.style_tags, "bpm": params.bpm,
            "musical_key": params.musical_key, "duration": params.duration_seconds,
            "seed": params.seed, "model": MODEL,
            "generate_two_variants": params.generate_two_variants,
        }
        deadline = time.monotonic() + settings.GENERATION_TIMEOUT_SECONDS
        async with httpx.AsyncClient(timeout=30.0, headers=self._get_auth_headers()) as client:
            response = await client.post(f"{self._endpoint()}/jobs", json=payload)
            if response.status_code not in (200, 202):
                self._raise_worker_error(response)
            state = response.json()
            worker_id = state["id"]
            self._jobs[job_id] = worker_id
            try:
                while True:
                    if on_progress:
                        await on_progress(
                            min(85, max(10, int(state.get("progress_percentage", 0) * .75) + 10)),
                            state.get("current_stage", "Generating singing and accompaniment"),
                            {"provider_job_id": worker_id},
                        )
                    if state["status"] == "succeeded":
                        break
                    if state["status"] in ("failed", "cancelled"):
                        raise ProviderFailure(state.get("error_code") or "INFERENCE_FAILED", state.get("error_message") or "GPU generation did not complete.")
                    if time.monotonic() >= deadline:
                        await client.post(f"{self._endpoint()}/jobs/{worker_id}/cancel")
                        raise ProviderFailure("INFERENCE_TIMEOUT", "GPU generation exceeded its time limit; reserved credits were refunded.")
                    await asyncio.sleep(settings.ACE_STEP_POLL_INTERVAL_SECONDS)
                    response = await client.get(f"{self._endpoint()}/jobs/{worker_id}")
                    if response.status_code != 200:
                        self._raise_worker_error(response)
                    state = response.json()
                metadata = state.get("metadata") or {}
                if metadata.get("runtime") != "ace_step_1_5" or metadata.get("model_revision") != CHECKPOINT_REVISION:
                    raise ProviderFailure("INVALID_MODEL_OUTPUT", "Worker output has no verified checkpoint provenance.")
                async def download(variant):
                    audio = await client.get(f"{self._endpoint()}/jobs/{worker_id}/audio", params={"variant": variant})
                    if audio.status_code != 200:
                        self._raise_worker_error(audio)
                    try:
                        with wave.open(io.BytesIO(audio.content), "rb") as wav:
                            if wav.getnframes() <= 0 or wav.getsampwidth() != 2:
                                raise ValueError("No PCM audio frames")
                            frames = wav.readframes(wav.getnframes())
                            if len(frames) != wav.getnframes() * wav.getnchannels() * 2:
                                raise ValueError("Truncated PCM recording")
                            info = (wav.getnframes() / wav.getframerate(), wav.getframerate(), wav.getnchannels())
                    except Exception as exc:
                        raise ProviderFailure("INVALID_AUDIO", "Worker did not return a decodable PCM WAV recording.") from exc
                    return audio.content, info
                primary, (duration, rate, channels) = await download(0)
                secondary = (await download(1))[0] if params.generate_two_variants else None
                return GenerationResult(
                    audio_bytes=primary, second_variant_bytes=secondary,
                    duration_seconds=duration, sample_rate=rate, channels=channels,
                    provider_job_id=worker_id, seed_used=params.seed if params.seed is not None else 0,
                    metadata=metadata,
                )
            except Exception:
                try:
                    await client.post(f"{self._endpoint()}/jobs/{worker_id}/cancel")
                except Exception:
                    pass
                raise
            finally:
                self._jobs.pop(job_id, None)

    @staticmethod
    def _raise_worker_error(response):
        try:
            detail = response.json().get("detail", response.json())
            message = detail.get("message") or detail.get("error_message") if isinstance(detail, dict) else str(detail)
            code = detail.get("error_code", "WORKER_ERROR") if isinstance(detail, dict) else "WORKER_ERROR"
        except Exception:
            code, message = "WORKER_ERROR", f"GPU worker returned HTTP {response.status_code}."
        raise ProviderFailure(code, message or f"GPU worker returned HTTP {response.status_code}.")

    async def get_status(self, job_id):
        async with httpx.AsyncClient(timeout=5, headers=self._get_auth_headers()) as client:
            response = await client.get(f"{self._endpoint()}/jobs/{self._jobs.get(job_id, job_id)}")
            if response.status_code != 200:
                self._raise_worker_error(response)
            data = response.json()
            return GenerationStatus(job_id=job_id, **{k:v for k,v in data.items() if k in GenerationStatus.model_fields and k != "job_id"})

    async def cancel(self, job_id):
        if not self._endpoint():
            return False
        async with httpx.AsyncClient(timeout=5, headers=self._get_auth_headers()) as client:
            response = await client.post(f"{self._endpoint()}/jobs/{self._jobs.get(job_id, job_id)}/cancel")
            return response.status_code == 200

    def estimate_cost(self, params):
        count = 2 if params.generate_two_variants else 1
        return CostEstimate(credits_required=max(5, (params.duration_seconds + 9) // 10 * 3) * count, estimated_duration_seconds=float(params.duration_seconds) * count)

    def get_license_metadata(self, tier="creator"):
        return LicenseMetadata(
            license_type="MIT (ACE-Step 1.5 official checkpoint)",
            commercial_use_allowed=True, monetization_allowed=True, attribution_required=True,
            warranty_terms="MIT permits commercial use of the model; preserve its copyright and license notices when distributing model/software. Output rights depend on your lyrics and other inputs. No copyright or infringement warranty.",
            c2pa_manifest_conforming=False,
        )
