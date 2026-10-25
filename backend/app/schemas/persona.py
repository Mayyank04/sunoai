from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class MusicPersonaCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    description: Optional[str] = None
    genre_preferences: List[str] = Field(default_factory=lambda: ["Synthwave", "Cyberpunk"])
    vocal_style: str = "Warm Vocoder"
    style_prompt_template: Optional[str] = "Pumping sidechain compression, 80s analog bass, arpeggiated synths"
    negative_prompt: Optional[str] = "acoustic guitar, muddy mix, distortion"
    bpm_default: int = Field(default=120, ge=40, le=240)
    key_default: str = "A Minor"
    system_instructions: Optional[str] = "Prioritize punchy bass, pristine high-end shimmer, and dramatic risers."
    is_public: bool = False

class MusicPersonaUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    genre_preferences: Optional[List[str]] = None
    vocal_style: Optional[str] = None
    style_prompt_template: Optional[str] = None
    negative_prompt: Optional[str] = None
    bpm_default: Optional[int] = None
    key_default: Optional[str] = None
    system_instructions: Optional[str] = None
    is_public: Optional[bool] = None

class MusicPersonaResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    genre_preferences: List[str]
    vocal_style: str
    style_prompt_template: Optional[str] = None
    negative_prompt: Optional[str] = None
    bpm_default: int
    key_default: str
    system_instructions: Optional[str] = None
    is_public: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
