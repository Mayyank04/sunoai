import httpx
from typing import Tuple, Optional
from backend.app.core.config import settings
from backend.app.services.providers.base import BaseMusicProvider, ProviderCapabilities, GenerationRequestParams

class StabilityAudioProvider(BaseMusicProvider):
    """
    Stability Audio Generation API Adapter.
    Generates stereo soundscapes and musical passages up to 3 minutes.
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
            supports_text_to_audio=True,
            supports_audio_to_audio=True,
            supports_stems=False,
            supports_lyrics=False,
            max_duration_seconds=180,
            models_available=["stable-audio-open-1.0", "stable-audio-2.0"],
            is_configured=is_ready,
            configuration_message=msg,
            commercial_grade=True
        )

    async def generate_audio(self, params: GenerationRequestParams) -> bytes:
        is_ready, error_msg = self.validate_configuration()
        if not is_ready:
            raise ValueError(
                f"Cannot generate with '{self.name}'. {error_msg}. "
                "Configure STABILITY_API_KEY or select 'fombo_procedural'."
            )

        headers = {
            "Authorization": f"Bearer {settings.STABILITY_API_KEY}",
            "Accept": "audio/*"
        }
        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(
                "https://api.stability.ai/v2beta/stable-audio/generate",
                headers=headers,
                data={
                    "prompt": params.prompt,
                    "seconds_total": params.duration_seconds
                }
            )
            if resp.status_code != 200:
                raise RuntimeError(f"Stability Audio API returned error {resp.status_code}: {resp.text}")
            return resp.content
