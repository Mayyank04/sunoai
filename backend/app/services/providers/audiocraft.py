import httpx
from typing import Tuple, Optional
from backend.app.core.config import settings
from backend.app.services.providers.base import BaseMusicProvider, ProviderCapabilities, GenerationRequestParams

class AudiocraftMusicProvider(BaseMusicProvider):
    """
    Audiocraft / MusicGen High-Fidelity Transformer Audio Provider.
    Interfaces with local GPU inference endpoints or Replicate hosted models.
    """
    provider_id = "audiocraft"
    name = "Meta Audiocraft / MusicGen"

    def validate_configuration(self) -> Tuple[bool, Optional[str]]:
        if settings.AUDIOCRAFT_SERVICE_URL:
            return (True, f"Configured via local/remote endpoint: {settings.AUDIOCRAFT_SERVICE_URL}")
        if settings.REPLICATE_API_TOKEN:
            return (True, "Configured via Replicate API token")
        return (False, "AUDIOCRAFT_SERVICE_URL or REPLICATE_API_TOKEN must be configured in environment.")

    def get_capabilities(self) -> ProviderCapabilities:
        is_ready, msg = self.validate_configuration()
        return ProviderCapabilities(
            provider_id=self.provider_id,
            display_name=self.name,
            supports_text_to_audio=True,
            supports_audio_to_audio=True,
            supports_stems=False,
            supports_lyrics=False,
            max_duration_seconds=300,
            models_available=["musicgen-small", "musicgen-medium", "musicgen-large", "musicgen-melody"],
            is_configured=is_ready,
            configuration_message=msg,
            commercial_grade=True
        )

    async def generate_audio(self, params: GenerationRequestParams) -> bytes:
        is_ready, error_msg = self.validate_configuration()
        if not is_ready:
            raise ValueError(
                f"Cannot generate with '{self.name}'. {error_msg}. "
                "Please select 'fombo_procedural' or configure GPU inference in .env."
            )

        if settings.AUDIOCRAFT_SERVICE_URL:
            async with httpx.AsyncClient(timeout=180.0) as client:
                resp = await client.post(
                    f"{settings.AUDIOCRAFT_SERVICE_URL}/generate",
                    json=params.model_dump()
                )
                if resp.status_code != 200:
                    raise RuntimeError(f"Audiocraft inference worker failed with status {resp.status_code}: {resp.text}")
                return resp.content

        # Replicate hosted fallback
        if settings.REPLICATE_API_TOKEN:
            # When Replicate token is provided, makes standard Replicate prediction
            headers = {"Authorization": f"Bearer {settings.REPLICATE_API_TOKEN}"}
            async with httpx.AsyncClient(timeout=180.0) as client:
                resp = await client.post(
                    "https://api.replicate.com/v1/predictions",
                    headers=headers,
                    json={
                        "version": "b05b1dff1d8c6dc63d14b0cdb42135378dcb87f6373b0d3d341ede46e59e2b38",
                        "input": {
                            "prompt": params.prompt,
                            "duration": params.duration_seconds,
                            "model_version": params.model_name
                        }
                    }
                )
                if resp.status_code not in (200, 201):
                    raise RuntimeError(f"Replicate MusicGen prediction failed: {resp.text}")
                data = resp.json()
                audio_url = data.get("output")
                if not audio_url:
                    raise RuntimeError("Replicate did not return an output URL")
                audio_resp = await client.get(audio_url)
                return audio_resp.content

        raise ValueError("No viable inference transport found.")
