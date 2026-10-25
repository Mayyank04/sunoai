from typing import Dict, List, Optional
from backend.app.services.providers.base import BaseMusicProvider, ProviderCapabilities
from backend.app.services.providers.procedural import ProceduralMusicProvider
from backend.app.services.providers.audiocraft import AudiocraftMusicProvider
from backend.app.services.providers.suno import SunoMusicProvider
from backend.app.services.providers.stability import StabilityAudioProvider

class ProviderRegistry:
    def __init__(self):
        self._providers: Dict[str, BaseMusicProvider] = {}
        self.register(ProceduralMusicProvider())
        self.register(AudiocraftMusicProvider())
        self.register(SunoMusicProvider())
        self.register(StabilityAudioProvider())

    def register(self, provider: BaseMusicProvider) -> None:
        self._providers[provider.provider_id] = provider

    def get(self, provider_id: str) -> Optional[BaseMusicProvider]:
        return self._providers.get(provider_id)

    def list_all(self) -> List[ProviderCapabilities]:
        return [p.get_capabilities() for p in self._providers.values()]

provider_registry = ProviderRegistry()
