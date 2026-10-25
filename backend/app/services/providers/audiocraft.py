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

class AudiocraftMusicProvider(MusicGenerationProvider):
    """
    Audiocraft / MusicGen High-Fidelity Transformer Audio Provider.
    Interfaces with self-hosted GPU inference servers or Replicate hosted endpoints.
    Does not support singing vocals or lyrics.
    """
    provider_id = "audiocraft"
    name = "Meta Audiocraft / MusicGen"

    def validate_configuration(self) -> Tuple[bool, Optional[str]]:
        if settings.AUDIOCRAFT_SERVICE_URL:
            return (True, f"Configured via GPU worker endpoint: {settings.AUDIOCRAFT_SERVICE_URL}")
        if settings.REPLICATE_API_TOKEN:
            return (True, "Configured via Replicate API token in environment.")
        return (False, "AUDIOCRAFT_SERVICE_URL or REPLICATE_API_TOKEN must be configured in environment.")

    def get_capabilities(self) -> ProviderCapabilities:
        is_ready, msg = self.validate_configuration()
        return ProviderCapabilities(
            provider_id=self.provider_id,
            display_name=self.name,
            description="Transformer-based acoustic diffusion model generating rich orchestral and electronic soundscapes.",
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
            max_duration_seconds=300,
            models_available=["musicgen-small", "musicgen-medium", "musicgen-large", "musicgen-melody"],
            is_configured=is_ready,
            configuration_message=msg,
            commercial_grade=False,
            attribution_required=True,
            provider_type="self_hosted",
            status_label="Ready" if is_ready else "Worker Offline",
            health_status="healthy" if is_ready else "offline",
            model_revision="musicgen-medium",
        )

    async def generate(self, params: GenerationRequestParams) -> GenerationResult:
        is_ready, error_msg = self.validate_configuration()
        if not is_ready:
            raise ValueError(
                f"Cannot generate with '{self.name}'. {error_msg}. "
                "Please configure inference endpoints or select 'fombo_procedural'."
            )

        if settings.AUDIOCRAFT_SERVICE_URL:
            async with httpx.AsyncClient(timeout=180.0) as client:
                resp = await client.post(
                    f"{settings.AUDIOCRAFT_SERVICE_URL}/generate",
                    json=params.model_dump(),
                )
                if resp.status_code != 200:
                    raise RuntimeError(f"Audiocraft GPU worker failed with HTTP {resp.status_code}: {resp.text}")
                return GenerationResult(
                    audio_bytes=resp.content,
                    duration_seconds=float(params.duration_seconds),
                    sample_rate=32000,
                    bit_depth=16,
                    channels=2,
                    format="wav",
                )

        if settings.REPLICATE_API_TOKEN:
            headers = {"Authorization": f"Bearer {settings.REPLICATE_API_TOKEN}"}
            async with httpx.AsyncClient(timeout=180.0) as client:
                resp = await client.post(
                    "https://api.replicate.com/v1/predictions",
                    headers=headers,
                    json={
                        "version": "b05b1dff1d8c6dc63d14b0cdb42135378dcb87f6373b0d3d341ede46e5de30b3",
                        "input": {
                            "prompt": params.prompt,
                            "duration": params.duration_seconds,
                            "model_version": params.model_name or "large",
                        },
                    },
                )
                if resp.status_code not in (200, 201):
                    raise RuntimeError(f"Replicate API error {resp.status_code}: {resp.text}")
                data = resp.json()
                output_url = data.get("output")
                if not output_url:
                    raise RuntimeError("Inference did not return an immediate audio stream.")
                audio_dl = await client.get(output_url)
                return GenerationResult(
                    audio_bytes=audio_dl.content,
                    duration_seconds=float(params.duration_seconds),
                    sample_rate=32000,
                    bit_depth=16,
                    channels=2,
                    format="wav",
                )

        raise RuntimeError("No active AudioCraft provider route available.")

    async def get_status(self, job_id: str) -> GenerationStatus:
        return GenerationStatus(
            job_id=job_id,
            status="running",
            progress_percentage=50,
            current_stage="Diffusion processing on GPU worker",
        )

    async def cancel(self, job_id: str) -> bool:
        return True

    def estimate_cost(self, params: GenerationRequestParams) -> CostEstimate:
        return CostEstimate(
            credits_required=10,
            estimated_duration_seconds=12.0,
            cost_cents=25,
        )

    def get_license_metadata(self, tier: str = "creator") -> LicenseMetadata:
        return LicenseMetadata(
            license_type="CC-BY-NC-4.0 (MusicGen weights)",
            commercial_use_allowed=False,
            monetization_allowed=False,
            attribution_required=True,
            warranty_terms="MusicGen checkpoints are noncommercial unless separately licensed. Synthesized via Meta AudioCraft. Requires model architecture attribution on commercial distribution.",
            c2pa_manifest_conforming=True,
        )
