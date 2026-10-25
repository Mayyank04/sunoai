from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class LyricsGenerateRequest(BaseModel):
    topic: str
    genre: str = "Synthwave"
    mood: str = "Nostalgic"
    structure: Optional[List[str]] = None

class LyricLine(BaseModel):
    text: str
    syllables: int
    rhyme_tag: str

class LyricSection(BaseModel):
    section_name: str
    lines: List[LyricLine]

class LyricsResponse(BaseModel):
    title: str
    topic: str
    genre: str
    mood: str
    sections: List[LyricSection]

# Stems
class StemSeparationRequest(BaseModel):
    track_id: str
    stem_model: str = "htdemucs_v4"

class StemItem(BaseModel):
    stem_type: str
    audio_url: str
    duration_seconds: float
    waveform_data: Optional[List[int]] = None

class StemSeparationResponse(BaseModel):
    track_id: str
    stems: List[StemItem]

# Provenance
class ProvenanceResponse(BaseModel):
    track_id: str
    creator_id: str
    model_provider: str
    model_checkpoint_hash: Optional[str]
    generation_seed: int
    input_prompt_hash: str
    output_audio_sha256: str
    license_type: str
    commercial_eligibility: bool
    disclaimer: str
    c2pa_manifest: Dict[str, Any]
    verified_at: datetime

    class Config:
        from_attributes = True

# Voice Consent
class VoiceChallengeResponse(BaseModel):
    challenge_id: str
    phonetic_phrase: str
    instructions: str
    expires_in_seconds: int

class VoiceVerifyRequest(BaseModel):
    challenge_id: str
    voice_label: str
    audio_url: str
    consent_acknowledged: bool

class VoiceConsentResponse(BaseModel):
    id: str
    voice_label: str
    status: str
    signed_at: datetime

# DAW
class DawProjectCreateRequest(BaseModel):
    title: str = "Untitled Studio Project"
    bpm: int = 120
    time_signature: str = "4/4"
    master_volume: float = 1.0
    project_state: Dict[str, Any]

class DawProjectResponse(BaseModel):
    id: str
    user_id: str
    title: str
    bpm: int
    time_signature: str
    master_volume: float
    project_state: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
