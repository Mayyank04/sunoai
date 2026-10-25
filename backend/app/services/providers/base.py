from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Tuple
from pydantic import BaseModel

class ProviderCapabilities(BaseModel):
    provider_id: str
    display_name: str
    supports_text_to_audio: bool = True
    supports_audio_to_audio: bool = False
    supports_stems: bool = False
    supports_lyrics: bool = False
    max_duration_seconds: int = 180
    models_available: List[str]
    is_configured: bool = False
    configuration_message: Optional[str] = None
    commercial_grade: bool = False

class GenerationRequestParams(BaseModel):
    provider_id: str = "fombo_procedural"
    prompt: str
    negative_prompt: Optional[str] = None
    genre: Optional[str] = "Electronic"
    style_tags: List[str] = []
    bpm: int = 120
    musical_key: str = "C Major"
    duration_seconds: int = 30
    seed: int = 42
    temperature: float = 1.0
    model_name: str
    reference_audio_url: Optional[str] = None

class BaseMusicProvider(ABC):
    """Abstract base class for all AI audio generation providers."""

    provider_id: str
    name: str

    @abstractmethod
    def validate_configuration(self) -> Tuple[bool, Optional[str]]:
        """Checks if required API keys, endpoints, or local model binaries are accessible."""
        pass

    @abstractmethod
    def get_capabilities(self) -> ProviderCapabilities:
        """Returns capabilities and active configuration state."""
        pass

    @abstractmethod
    async def generate_audio(self, params: GenerationRequestParams) -> bytes:
        """
        Executes real audio generation and returns raw WAV bytes.
        Never returns fake or mock audio.
        Must raise ValueError with clear configuration details if unconfigured.
        """
        pass
