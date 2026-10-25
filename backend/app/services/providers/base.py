from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Tuple
from pydantic import BaseModel, Field

class ProviderCapabilities(BaseModel):
    provider_id: str
    display_name: str
    description: str = ""
    supports_text_to_audio: bool = True
    supports_audio_to_audio: bool = False
    supports_stems: bool = False
    supports_lyrics: bool = False
    supports_vocals: bool = False
    supports_instrumental_toggle: bool = True
    supports_bpm_control: bool = True
    supports_key_control: bool = True
    supports_instrument_selection: bool = True
    supports_dual_variants: bool = False
    min_duration_seconds: int = 10
    max_duration_seconds: int = 180
    supported_genres: List[str] = [
        "Synthwave", "Cyberpunk", "Electronic", "Lo-Fi", "Ambient", "Orchestral", "Hip Hop", "Pop", "Rock"
    ]
    supported_audio_formats: List[str] = ["wav", "mp3"]
    models_available: List[str] = []
    is_configured: bool = False
    configuration_message: Optional[str] = None
    commercial_grade: bool = True
    attribution_required: bool = False
    provider_type: str = Field(default="built_in", description="built_in, self_hosted, or commercial_api")
    status_label: str = Field(default="Ready", description="Human-facing status: Ready, Worker Offline, Needs Key")
    health_status: Optional[str] = Field(default="healthy", description="healthy, offline, or unconfigured")
    model_revision: Optional[str] = None
    worker_endpoint: Optional[str] = None

class GenerationRequestParams(BaseModel):
    provider_id: str = "fombo_procedural"
    model_name: str = "procedural-dsp-v1"
    prompt: str
    lyrics: Optional[str] = None
    make_instrumental: bool = True
    genre: Optional[str] = "Synthwave"
    mood: Optional[str] = "Nostalgic"
    instruments: List[str] = Field(default_factory=list)
    style_tags: List[str] = Field(default_factory=list)
    bpm: int = Field(default=120, ge=40, le=240)
    musical_key: str = "C Major"
    duration_seconds: int = Field(default=30, ge=10, le=300)
    seed: Optional[int] = None
    temperature: float = Field(default=1.0, ge=0.1, le=2.0)
    generate_two_variants: bool = False
    reference_audio_url: Optional[str] = None

class GenerationResult(BaseModel):
    audio_bytes: bytes
    second_variant_bytes: Optional[bytes] = None
    duration_seconds: float
    sample_rate: int = 44100
    bit_depth: int = 16
    channels: int = 2
    format: str = "wav"
    provider_job_id: Optional[str] = None
    seed_used: int = 42
    metadata: Dict[str, Any] = Field(default_factory=dict)

class GenerationStatus(BaseModel):
    job_id: str
    status: str = Field(..., description="queued, running, succeeded, failed, cancelled")
    progress_percentage: int = 0
    current_stage: str = "Initialized"
    audio_url: Optional[str] = None
    second_audio_url: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None

class CostEstimate(BaseModel):
    credits_required: int
    estimated_duration_seconds: float
    cost_cents: int = 0
    tier_discount_applied: Optional[str] = None

class LicenseMetadata(BaseModel):
    license_type: str
    commercial_use_allowed: bool
    monetization_allowed: bool
    attribution_required: bool
    warranty_terms: str
    c2pa_manifest_conforming: bool = True

class MusicGenerationProvider(ABC):
    """
    Pluggable contract for all Fombo Music AI generation backends.
    All models must strictly declare capabilities and adhere to this interface.
    """

    provider_id: str
    name: str

    @abstractmethod
    def validate_configuration(self) -> Tuple[bool, Optional[str]]:
        """Checks if required API keys, remote endpoints, or local model weights are present."""
        pass

    @abstractmethod
    def get_capabilities(self) -> ProviderCapabilities:
        """Returns verified feature matrix and configuration state."""
        pass

    # CamelCase alias for interface compliance
    def getCapabilities(self) -> ProviderCapabilities:
        return self.get_capabilities()

    @abstractmethod
    async def generate(self, params: GenerationRequestParams) -> GenerationResult:
        """Executes real asynchronous audio generation returning authentic audio buffers."""
        pass

    @abstractmethod
    async def get_status(self, job_id: str) -> GenerationStatus:
        """Polls current provider-side task status."""
        pass

    # CamelCase alias
    async def getStatus(self, job_id: str) -> GenerationStatus:
        return await self.get_status(job_id)

    @abstractmethod
    async def cancel(self, job_id: str) -> bool:
        """Requests cancellation of an ongoing generation task."""
        pass

    @abstractmethod
    def estimate_cost(self, params: GenerationRequestParams) -> CostEstimate:
        """Calculates credit quota and time estimation for a proposed job."""
        pass

    # CamelCase alias
    def estimateCost(self, params: GenerationRequestParams) -> CostEstimate:
        return self.estimate_cost(params)

    @abstractmethod
    def get_license_metadata(self, tier: str = "creator") -> LicenseMetadata:
        """Returns commercial license terms and C2PA provenance rules for generated audio."""
        pass

    # CamelCase alias
    def getLicenseMetadata(self, tier: str = "creator") -> LicenseMetadata:
        return self.get_license_metadata(tier)

    async def check_health(self) -> Dict[str, Any]:
        """Checks runtime health of this provider backend."""
        is_ok, msg = self.validate_configuration()
        caps = self.get_capabilities()
        return {
            "provider_id": self.provider_id,
            "status": "healthy" if is_ok else "offline",
            "is_configured": is_ok,
            "provider_type": caps.provider_type,
            "status_label": caps.status_label,
            "message": msg,
        }

    async def check_readiness(self) -> Dict[str, Any]:
        """Checks if provider is ready to immediately accept audio generation requests."""
        is_ok, msg = self.validate_configuration()
        return {
            "provider_id": self.provider_id,
            "ready": is_ok,
            "status": "ready" if is_ok else "not_ready",
            "message": msg,
        }

    # Backward compatibility helper for legacy calls
    async def generate_audio(self, params: GenerationRequestParams) -> bytes:
        res = await self.generate(params)
        return res.audio_bytes

BaseMusicProvider = MusicGenerationProvider

