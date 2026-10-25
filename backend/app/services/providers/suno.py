import httpx
from typing import Tuple, Optional
from backend.app.core.config import settings
from backend.app.services.providers.base import BaseMusicProvider, ProviderCapabilities, GenerationRequestParams

class SunoMusicProvider(BaseMusicProvider):
    """
    Suno API Adapter Provider.
    Enables generation of vocal and instrumental tracks via authenticated Suno cloud endpoints.
    """
    provider_id = "suno"
    name = "Suno Music API"

    def validate_configuration(self) -> Tuple[bool, Optional[str]]:
        if settings.SUNO_API_KEY and settings.SUNO_API_URL:
            return (True, f"Configured via Suno endpoint: {settings.SUNO_API_URL}")
        return (False, "SUNO_API_KEY and SUNO_API_URL must be provided in environment variables.")

    def get_capabilities(self) -> ProviderCapabilities:
        is_ready, msg = self.validate_configuration()
        return ProviderCapabilities(
            provider_id=self.provider_id,
            display_name=self.name,
            supports_text_to_audio=True,
            supports_audio_to_audio=True,
            supports_stems=True,
            supports_lyrics=True,
            max_duration_seconds=240,
            models_available=["suno-v3.5", "suno-v3.0", "suno-v2.5"],
            is_configured=is_ready,
            configuration_message=msg,
            commercial_grade=True
        )

    async def generate_audio(self, params: GenerationRequestParams) -> bytes:
        is_ready, error_msg = self.validate_configuration()
        if not is_ready:
            raise ValueError(
                f"Cannot generate with '{self.name}'. {error_msg}. "
                "Configure valid SUNO_API_KEY / SUNO_API_URL or select 'fombo_procedural'."
            )

        headers = {
            "Authorization": f"Bearer {settings.SUNO_API_KEY}",
            "Content-Type": "application/json"
        }
        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(
                f"{settings.SUNO_API_URL}/generate",
                headers=headers,
                json={
                    "prompt": params.prompt,
                    "tags": ", ".join(params.style_tags),
                    "title": f"{params.genre} Composition",
                    "make_instrumental": not bool(params.prompt)
                }
            )
            if resp.status_code != 200:
                raise RuntimeError(f"Suno API returned error {resp.status_code}: {resp.text}")
            data = resp.json()
            audio_url = data.get("audio_url")
            if not audio_url:
                raise RuntimeError("Suno API response did not include audio_url")
            audio_download = await client.get(audio_url)
            return audio_download.content
