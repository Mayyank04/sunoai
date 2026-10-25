from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class GenerationCreateRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=1500)
    negative_prompt: Optional[str] = None
    make_instrumental: bool = Field(default=True)
    lyrics: Optional[str] = Field(default=None, max_length=5000)
    genre: Optional[str] = "Synthwave"
    mood: Optional[str] = "Nostalgic"
    instruments: List[str] = Field(default_factory=list)
    style_tags: List[str] = Field(default_factory=list)
    bpm: int = Field(default=120, ge=40, le=240)
    musical_key: str = Field(default="F Minor")
    duration_seconds: int = Field(default=30, ge=10, le=300)
    provider: str = Field(default="ace_step_1_5")
    model_name: Optional[str] = None
    seed: Optional[int] = None
    temperature: float = Field(default=1.0, ge=0.1, le=2.0)
    generate_two_variants: bool = Field(default=False)
    reference_audio_url: Optional[str] = None

class GenerationEstimateRequest(BaseModel):
    provider: str = Field(default="ace_step_1_5")
    model_name: Optional[str] = None
    duration_seconds: int = Field(default=30, ge=10, le=300)
    generate_two_variants: bool = Field(default=False)

class GenerationJobResponse(BaseModel):
    job_id: str
    status: str
    provider: str
    model_name: str
    credits_deducted: int
    remaining_balance: int
    stream_url: str
    variants_supported: bool = False
    created_at: datetime

class GenerationStatusResponse(BaseModel):
    job_id: str
    status: str
    progress_percentage: int
    current_stage: Optional[str] = None
    remaining_balance: Optional[int] = None
    track_id: Optional[str] = None
    audio_url: Optional[str] = None
    second_audio_url: Optional[str] = None
    duration_seconds: Optional[float] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


