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

class HeartMuLaMusicProvider(MusicGenerationProvider):
    """
    HeartMuLa Open-Weight Multimodal Music Generation Provider Adapter.
    Alternative Open-Weight Inference Provider for high-fidelity polyphonic arrangements.
    
    Zero-Mock Policy: Explicitly reports offline state unless an actual worker endpoint is configured.
    """
    provider_id = "heartmula"
    name = "HeartMuLa (Alternative Provider)"

    def validate_configuration(self) -> Tuple[bool, Optional[str]]:
        return False, "HeartMuLa integration is not implemented or verified. Use the ACE-Step GPU worker for singing."

    def get_capabilities(self) -> ProviderCapabilities:
        is_ready, msg = self.validate_configuration()
        return ProviderCapabilities(
            provider_id=self.provider_id,
            display_name=self.name,
            description="Open-weight musical language model architecture specializing in harmonic progression and orchestral arrangement.",
            supports_text_to_audio=True,
            supports_audio_to_audio=True,
            supports_stems=False,
            supports_lyrics=False,
            supports_vocals=False,
            supports_instrumental_toggle=True,
            supports_bpm_control=True,
            supports_key_control=True,
            supports_instrument_selection=True,
            supports_dual_variants=False,
            min_duration_seconds=15,
            max_duration_seconds=180,
            supported_genres=[
                "Neo-Classical", "Cinematic", "Ambient", "Deep House", "Synthwave", "Jazz"
            ],
            models_available=["heartmula-7b-preview"],
            is_configured=is_ready,
            configuration_message=msg,
            commercial_grade=False,
            attribution_required=False,
            provider_type="self_hosted",
            status_label="Ready" if is_ready else "Worker Offline",
            health_status="healthy" if is_ready else "offline",
            model_revision="heartmula-7b-preview (v1.0)",
            worker_endpoint=settings.HEARTMULA_SERVICE_URL,
        )

    async def generate(self, params: GenerationRequestParams) -> GenerationResult:
        is_ready, msg = self.validate_configuration()
        if not is_ready:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "CONFIGURATION_REQUIRED",
                    "message": "Generation engine not configured: HeartMuLa inference worker is not connected. "
                               "Connect a self-hosted GPU worker or select procedural synthesis.",
                    "provider": self.provider_id,
                },
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="HeartMuLa worker unreachable.",
        )

    async def get_status(self, job_id: str) -> GenerationStatus:
        return GenerationStatus(
            job_id=job_id,
            status="failed",
            current_stage="Error",
            error_code="CONFIGURATION_REQUIRED",
            error_message="HeartMuLa inference worker not connected.",
        )

    async def cancel(self, job_id: str) -> bool:
        return True

    def estimate_cost(self, params: GenerationRequestParams) -> CostEstimate:
        credits = max(10, int(params.duration_seconds / 3))
        return CostEstimate(
            credits_required=credits,
            estimated_duration_seconds=float(params.duration_seconds) * 0.5,
            cost_cents=0,
        )

    def get_license_metadata(self, tier: str = "creator") -> LicenseMetadata:
        return LicenseMetadata(
            license_type="Unverified checkpoint/license",
            commercial_use_allowed=False,
            monetization_allowed=False,
            attribution_required=False,
            warranty_terms="Open-weight model output provided as-is without copyright guarantee or warranty.",
            c2pa_manifest_conforming=True,
        )
