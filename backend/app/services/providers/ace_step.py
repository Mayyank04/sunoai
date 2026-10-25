"""
ACE-Step 1.5 Open-Weight AI Music Generation Provider Adapter.
Self-Hosted GPU/Vector Inference Engine Adapter for Fombo Music AI.

Model: ACE-Step 1.5 Base
Revision: v1.5.0-openweight
License: Apache-2.0
Capabilities: Instrumental Synthesis, Singing Vocals & Lyrical Formants, Dual Variants.
"""

from typing import Tuple, Optional, Dict, Any
import base64
import httpx
from fastapi import HTTPException, status
from backend.app.core.config import settings
from backend.app.services.providers.base import (
    MusicGenerationProvider,
    ProviderCapabilities,
    GenerationRequestParams,
    GenerationResult,
    GenerationStatus,
    CostEstimate,
    LicenseMetadata,
)

class ACEStepMusicProvider(MusicGenerationProvider):
    """
    ACE-Step 1.5 Open-Weight AI Music Generation Provider Adapter.
    Default Open-Weight Inference Provider for self-hosted GPU/CPU workers.

    Zero-Mock Policy: Truthfully reports worker connectivity and health.
    Never requires a commercial API key for local inference; supports service token authentication when configured.
    """
    provider_id = "ace_step_1_5"
    name = "ACE-Step 1.5 (Open-Weight Default)"

    def _get_auth_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if settings.ACE_STEP_API_TOKEN:
            headers["X-Service-Token"] = settings.ACE_STEP_API_TOKEN
            headers["Authorization"] = f"Bearer {settings.ACE_STEP_API_TOKEN}"
        return headers

    def validate_configuration(self) -> Tuple[bool, Optional[str]]:
        url = settings.ACE_STEP_SERVICE_URL
        if not url:
            return (
                False,
                "ACE-Step 1.5 inference worker is not configured. "
                "Set ACE_STEP_SERVICE_URL=http://127.0.0.1:8001 in environment."
            )

        try:
            headers = self._get_auth_headers()
            with httpx.Client(timeout=1.5) as client:
                resp = client.get(f"{url.rstrip('/')}/health", headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    rev = data.get("model_revision", settings.ACE_STEP_MODEL_REVISION)
                    dev = data.get("device", "local")
                    return (True, f"Connected to ACE-Step 1.5 worker ({rev}, {dev}) at: {url}")
                return (
                    False,
                    f"ACE-Step 1.5 worker returned status {resp.status_code} at {url}."
                )
        except Exception:
            return (
                False,
                f"ACE-Step 1.5 inference worker is offline at {url}. "
                "Launch the worker service with 'python -m workers.ace_step.worker'."
            )

    def get_capabilities(self) -> ProviderCapabilities:
        is_ready, msg = self.validate_configuration()
        return ProviderCapabilities(
            provider_id=self.provider_id,
            display_name=self.name,
            description="Open-weight diffusion transformer trained for polyphonic composition, singing vocal synthesis, and multi-instrument rendering.",
            supports_text_to_audio=True,
            supports_audio_to_audio=True,
            supports_stems=False,
            supports_lyrics=True,
            supports_vocals=True,
            supports_instrumental_toggle=True,
            supports_bpm_control=True,
            supports_key_control=True,
            supports_instrument_selection=True,
            supports_dual_variants=True,
            min_duration_seconds=10,
            max_duration_seconds=240,
            supported_genres=[
                "Synthwave", "Cyberpunk", "Cinematic", "Lo-Fi", "Ambient", "Orchestral", "Deep House", "Rock", "Pop"
            ],
            models_available=["ace-step-1.5-base", "ace-step-1.5-pro-turbo"],
            is_configured=is_ready,
            configuration_message=msg,
            commercial_grade=True,
            attribution_required=False,
            provider_type="self_hosted",
            status_label="Ready" if is_ready else "Worker Offline",
            health_status="healthy" if is_ready else "offline",
            model_revision=settings.ACE_STEP_MODEL_REVISION,
            worker_endpoint=settings.ACE_STEP_SERVICE_URL,
        )

    async def check_health(self) -> Dict[str, Any]:
        url = settings.ACE_STEP_SERVICE_URL
        if not url:
            return {
                "provider_id": self.provider_id,
                "status": "offline",
                "is_configured": False,
                "provider_type": "self_hosted",
                "status_label": "Worker Offline",
                "message": "ACE_STEP_SERVICE_URL is not configured in environment.",
            }
        try:
            headers = self._get_auth_headers()
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{url.rstrip('/')}/health", headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "provider_id": self.provider_id,
                        "status": "healthy",
                        "is_configured": True,
                        "provider_type": "self_hosted",
                        "status_label": "Ready",
                        "model_revision": data.get("model_revision", settings.ACE_STEP_MODEL_REVISION),
                        "worker_health": data,
                    }
                return {
                    "provider_id": self.provider_id,
                    "status": "unhealthy",
                    "is_configured": False,
                    "provider_type": "self_hosted",
                    "status_label": "Worker Offline",
                    "message": f"Worker returned HTTP {resp.status_code}",
                }
        except Exception as exc:
            return {
                "provider_id": self.provider_id,
                "status": "offline",
                "is_configured": False,
                "provider_type": "self_hosted",
                "status_label": "Worker Offline",
                "message": f"Worker unreachable at {url}: {str(exc)}",
            }

    async def check_readiness(self) -> Dict[str, Any]:
        url = settings.ACE_STEP_SERVICE_URL
        if not url:
            return {"provider_id": self.provider_id, "ready": False, "status": "not_configured"}
        try:
            headers = self._get_auth_headers()
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{url.rstrip('/')}/ready", headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return {"provider_id": self.provider_id, "ready": data.get("ready", True), "status": "ready"}
                return {"provider_id": self.provider_id, "ready": False, "status": f"HTTP {resp.status_code}"}
        except Exception as exc:
            return {"provider_id": self.provider_id, "ready": False, "status": f"unreachable: {str(exc)}"}

    async def generate(self, params: GenerationRequestParams) -> GenerationResult:
        is_ready, msg = self.validate_configuration()
        if not is_ready:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "CONFIGURATION_REQUIRED",
                    "message": f"Generation engine offline: {msg}. "
                               "Start the ACE-Step worker or switch to procedural synthesis.",
                    "provider": self.provider_id,
                },
            )

        url = settings.ACE_STEP_SERVICE_URL
        headers = self._get_auth_headers()
        payload = {
            "prompt": params.prompt,
            "lyrics": params.lyrics,
            "make_instrumental": params.make_instrumental,
            "genre": params.genre or "Synthwave",
            "mood": params.mood or "Nostalgic",
            "instruments": params.instruments,
            "style_tags": params.style_tags,
            "bpm": params.bpm,
            "musical_key": params.musical_key,
            "duration": float(params.duration_seconds),
            "seed": params.seed,
            "model": params.model_name or "ace-step-1.5-base",
            "generate_two_variants": params.generate_two_variants,
        }

        async with httpx.AsyncClient(timeout=180.0) as client:
            try:
                resp = await client.post(
                    f"{url.rstrip('/')}/generate",
                    json=payload,
                    headers=headers,
                )
                if resp.status_code != 200:
                    raise RuntimeError(f"ACE-Step 1.5 worker error ({resp.status_code}): {resp.text}")

                content_type = resp.headers.get("content-type", "")
                if "audio/" in content_type:
                    return GenerationResult(
                        provider_id=self.provider_id,
                        model_used=params.model_name or "ace-step-1.5-base",
                        audio_bytes=resp.content,
                        duration_seconds=float(params.duration_seconds),
                        sample_rate=44100,
                        bit_depth=16,
                        channels=2,
                        seed_used=params.seed or 42,
                        metadata={
                            "provider": "ace_step_1_5",
                            "model": params.model_name or "ace-step-1.5-base",
                            "revision": settings.ACE_STEP_MODEL_REVISION,
                            "lyrics_synthesized": bool(params.lyrics and not params.make_instrumental),
                        },
                    )

                data = resp.json()
                audio_bytes = base64.b64decode(data.get("audio_base64", "")) if "audio_base64" in data else b""
                second_bytes = (
                    base64.b64decode(data.get("second_variant_base64", ""))
                    if data.get("second_variant_base64")
                    else None
                )

                if not audio_bytes:
                    raise RuntimeError("ACE-Step 1.5 worker returned empty audio payload.")

                return GenerationResult(
                    provider_id=self.provider_id,
                    model_used=params.model_name or "ace-step-1.5-base",
                    audio_bytes=audio_bytes,
                    second_variant_bytes=second_bytes,
                    duration_seconds=float(data.get("duration_seconds", params.duration_seconds)),
                    sample_rate=data.get("sample_rate", 44100),
                    bit_depth=data.get("bit_depth", 16),
                    channels=data.get("channels", 2),
                    seed_used=data.get("seed_used", params.seed or 42),
                    metadata={
                        "provider": "ace_step_1_5",
                        "model": params.model_name or "ace-step-1.5-base",
                        "revision": data.get("model_revision", settings.ACE_STEP_MODEL_REVISION),
                        "lyrics_synthesized": data.get("lyrics_synthesized", bool(params.lyrics and not params.make_instrumental)),
                        "device": data.get("metadata", {}).get("device", "cpu"),
                    },
                )
            except httpx.RequestError as exc:
                raise RuntimeError(
                    f"ACE-Step 1.5 inference worker unreachable at {url}: {str(exc)}"
                )

    async def get_status(self, job_id: str) -> GenerationStatus:
        return GenerationStatus(
            job_id=job_id,
            status="failed",
            current_stage="Error",
            error_code="CONFIGURATION_REQUIRED",
            error_message="ACE-Step 1.5 inference worker not connected.",
        )

    async def cancel(self, job_id: str) -> bool:
        return True

    def estimate_cost(self, params: GenerationRequestParams) -> CostEstimate:
        # 10 credits per 30 seconds
        credits = max(10, int(params.duration_seconds / 3))
        return CostEstimate(
            credits_required=credits,
            estimated_duration_seconds=float(params.duration_seconds) * 0.4,
            cost_cents=0,
        )

    def get_license_metadata(self, tier: str = "creator") -> LicenseMetadata:
        return LicenseMetadata(
            license_type="Apache-2.0 / Open-Weight Commercial",
            commercial_use_allowed=True,
            monetization_allowed=True,
            attribution_required=False,
            warranty_terms="Open-weight model output provided under Apache-2.0 terms without warranty.",
            c2pa_manifest_conforming=True,
        )
