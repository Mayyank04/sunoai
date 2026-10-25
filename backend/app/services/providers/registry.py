from typing import Dict, List, Optional
from backend.app.services.providers.base import MusicGenerationProvider, ProviderCapabilities
from backend.app.services.providers.procedural import ProceduralMusicProvider
from backend.app.services.providers.audiocraft import AudiocraftMusicProvider
from backend.app.services.providers.suno import SunoMusicProvider
from backend.app.services.providers.stability import StabilityAudioProvider
from backend.app.services.providers.ace_step import ACEStepMusicProvider
from backend.app.services.providers.heartmula import HeartMuLaMusicProvider

class ProviderRegistry:
    def __init__(self):
        self._providers: Dict[str, MusicGenerationProvider] = {}
        # Open-weight default and alternative providers
        self.register(ACEStepMusicProvider())
        self.register(HeartMuLaMusicProvider())
        # Local offline procedural synth fallback (zero external dependencies)
        self.register(ProceduralMusicProvider())
        # Local/remote GPU models & cloud proxies
        self.register(AudiocraftMusicProvider())
        self.register(SunoMusicProvider())
        self.register(StabilityAudioProvider())

    def register(self, provider: MusicGenerationProvider) -> None:
        self._providers[provider.provider_id] = provider

    def get(self, provider_id: str) -> Optional[MusicGenerationProvider]:
        return self._providers.get(provider_id)

    def get_provider(self, provider_id: str) -> Optional[MusicGenerationProvider]:
        return self.get(provider_id)

    def list_all(self) -> List[ProviderCapabilities]:
        return [p.get_capabilities() for p in self._providers.values()]

    def list_providers(self) -> List[ProviderCapabilities]:
        return self.list_all()

provider_registry = ProviderRegistry()
