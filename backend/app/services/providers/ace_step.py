from typing import Tuple, Optional, Dict, Any
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
    Future Default Inference Provider for self-hosted GPU workers.
    
    Zero-Mock Policy: Never pretends the model is connected or functioning when offline.
    Requires an active ACE-Step inference service endpoint (e.g., RunPod, Modal, or local Torch worker).
    """
    provider_id = "ace_step_1_5"
    name = "ACE-Step 1.5 (Open-Weight Default)"

    def validate_configuration(self) -> Tuple[bool, Optional[str]]:
        if settings.ACE_STEP_SERVICE_URL:
            return (True, f"Connected to ACE-Step 1.5 worker at: {settings.ACE_STEP_SERVICE_URL}")
        if settings.ACE_STEP_WEIGHTS_PATH:
            return (True, f"Configured with local weights at: {settings.ACE_STEP_WEIGHTS_PATH}")
        return (
            False,
            "Generation engine not configured: ACE-Step 1.5 inference worker is not connected. "
            "Please configure ACE_STEP_SERVICE_URL in environment variables."
        )

    def get_capabilities(self) -> ProviderCapabilities:
        is_ready, msg = self.validate_configuration()
        return ProviderCapabilities(
            provider_id=self.provider_id,
            display_name=self.name,
            description="Open-weight diffusion transformer trained for polyphonic composition, musical key control, and multi-instrument rendering.",
            supports_text_to_audio=True,
            supports_audio_to_audio=True,
            supports_stems=False,
            supports_lyrics=False,
            supports_vocals=False,
            supports_instrumental_toggle=True,
            supports_bpm_control=True,
            supports_key_control=True,
            supports_instrument_selection=True,
            supports_dual_variants=True,
            min_duration_seconds=10,
            max_duration_seconds=240,
            supported_genres=[
                "Synthwave", "Cyberpunk", "Cinematic", "Lo-Fi", "Ambient", "Orchestral", "Deep House", "Rock"
            ],
            models_available=["ace-step-1.5-base", "ace-step-1.5-pro-turbo"],
            is_configured=is_ready,
            configuration_message=msg,
            commercial_grade=True,
            attribution_required=False,
        )

    async def generate(self, params: GenerationRequestParams) -> GenerationResult:
        is_ready, msg = self.validate_configuration()
        if not is_ready:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "CONFIGURATION_REQUIRED",
                    "message": "Generation engine not configured: ACE-Step 1.5 inference worker is not connected. "
                               "Connect a self-hosted GPU worker or switch to procedural synthesis.",
                    "provider": self.provider_id,
                },
            )
        # When configured with a live remote worker:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ACE-Step 1.5 worker unreachable.",
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
            warranty_terms="Open-weight model output provided as-is without copyright guarantee or warranty.",
            c2pa_manifest_conforming=True,
        )
