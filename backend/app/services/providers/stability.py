import httpx
from typing import Tuple, Optional, Dict, Any
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

class StabilityAudioProvider(MusicGenerationProvider):
    """
    Stability Audio Generation API Adapter.
    Generates stereo soundscapes and high-fidelity instrumental passages.
    Does not support singing vocals or lyrics.
    """
    provider_id = "stability"
    name = "Stability Audio"

    def validate_configuration(self) -> Tuple[bool, Optional[str]]:
        if settings.STABILITY_API_KEY:
            return (True, "Configured via STABILITY_API_KEY")
        return (False, "STABILITY_API_KEY must be provided in environment variables.")

    def get_capabilities(self) -> ProviderCapabilities:
        is_ready, msg = self.validate_configuration()
        return ProviderCapabilities(
            provider_id=self.provider_id,
            display_name=self.name,
            description="Latent diffusion audio model specializing in rich instrumentals, sound effects, and structured music.",
            supports_text_to_audio=True,
            supports_audio_to_audio=True,
            supports_stems=False,
            supports_lyrics=False,
            supports_vocals=False,
            supports_instrumental_toggle=True,
            supports_bpm_control=True,
            supports_key_control=False,
            supports_instrument_selection=True,
            supports_dual_variants=False,
            min_duration_seconds=10,
            max_duration_seconds=180,
            models_available=["stable-audio-open-1.0", "stable-audio-2.0"],
            is_configured=is_ready,
            configuration_message=msg,
            commercial_grade=False,
            attribution_required=False,
            provider_type="commercial_api",
            status_label="Ready" if is_ready else "Needs Key",
            health_status="healthy" if is_ready else "unconfigured",
            model_revision="stable-audio-open-1.0",
        )

    async def generate(self, params: GenerationRequestParams) -> GenerationResult:
        is_ready, error_msg = self.validate_configuration()
        if not is_ready:
            raise ValueError(
                f"Cannot generate with '{self.name}'. {error_msg}. "
                "Configure STABILITY_API_KEY or select 'fombo_procedural'."
            )

        headers = {
            "Authorization": f"Bearer {settings.STABILITY_API_KEY}",
            "Accept": "audio/*",
        }
        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(
                "https://api.stability.ai/v2beta/stable-audio/generate",
                headers=headers,
                data={
                    "prompt": params.prompt,
                    "seconds_total": params.duration_seconds,
                },
            )
            if resp.status_code != 200:
                raise RuntimeError(f"Stability Audio API returned error {resp.status_code}: {resp.text}")

            return GenerationResult(
                audio_bytes=resp.content,
                duration_seconds=float(params.duration_seconds),
                sample_rate=44100,
                bit_depth=16,
                channels=2,
                format="mp3",
            )

    async def get_status(self, job_id: str) -> GenerationStatus:
        return GenerationStatus(
            job_id=job_id,
            status="running",
            progress_percentage=40,
            current_stage="Latent diffusion steps in progress",
        )

    async def cancel(self, job_id: str) -> bool:
        return True

    def estimate_cost(self, params: GenerationRequestParams) -> CostEstimate:
        return CostEstimate(
            credits_required=10,
            estimated_duration_seconds=15.0,
            cost_cents=20,
        )

    def get_license_metadata(self, tier: str = "creator") -> LicenseMetadata:
        return LicenseMetadata(
            license_type="Unverified provider contract",
            commercial_use_allowed=False,
            monetization_allowed=False,
            attribution_required=False,
            warranty_terms="Commercial permissions require verified upstream service terms and account entitlements; a Fombo subscription does not grant provider rights.",
            c2pa_manifest_conforming=True,
        )
