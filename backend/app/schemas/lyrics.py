from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class LyricLine(BaseModel):
    text: str
    syllables: int
    rhyme_tag: str

class LyricSection(BaseModel):
    section_name: str
    lines: List[LyricLine]

class LyricsGenerateRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=500)
    theme: Optional[str] = "Love & Longing"
    tone: Optional[str] = "Emotional"
    rhyme_scheme: Optional[str] = "AABB"
    language: str = Field(default="en", description="'en', 'hi', 'hinglish', 'pa', 'es'")
    structure: Optional[List[str]] = None
    genre: Optional[str] = "Bollywood Pop"
    mood: Optional[str] = "Romantic"
    bpm: Optional[int] = Field(default=120, ge=40, le=240)
    musical_key: Optional[str] = "C Major"
    time_signature: Optional[str] = "4/4"
    instrument_preferences: Optional[List[str]] = Field(default_factory=list)
    vocal_style: Optional[str] = "Melodic Female"
    negative_prompt: Optional[str] = None
    persona: Optional[str] = "Contemporary Indie Songwriter"

class LyricsResponse(BaseModel):
    title: str
    topic: str
    theme: Optional[str] = None
    tone: Optional[str] = None
    genre: str
    mood: str
    language: str
    rhyme_scheme: str
    raw_text: str
    sections: List[LyricSection]
    arrangement: Dict[str, Any] = Field(default_factory=dict)

class LyricsRewriteLineRequest(BaseModel):
    line: str = Field(min_length=1, max_length=500)
    instruction: str = Field(default="punchier", description="'punchier', 'poetic', 'simpler', 'rhyme'")
    language: str = Field(default="en")
    target_rhyme: Optional[str] = None
    context_topic: Optional[str] = None

class LyricsRewriteLineResponse(BaseModel):
    original_line: str
    rewritten_line: str
    instruction: str
    syllables: int
    rhyme_tag: str

class LyricsRewriteSectionRequest(BaseModel):
    section_name: str
    section_lines: List[str]
    instruction: str = Field(default="more energetic", description="Creative rewrite directive")
    language: str = "en"
    topic: Optional[str] = None
    genre: Optional[str] = None
    mood: Optional[str] = None

class LyricsRewriteSectionResponse(BaseModel):
    section_name: str
    lines: List[LyricLine]
    raw_section: str

class LyricsTranslateRequest(BaseModel):
    content: str
    target_language: str = Field(..., description="'hi', 'en', 'hinglish', 'pa', 'es'")
    source_language: Optional[str] = "auto"

class LyricsTranslateResponse(BaseModel):
    source_language: str
    target_language: str
    translated_content: str
    sections: List[LyricSection]

class LyricsRegenerateHookRequest(BaseModel):
    topic: str
    genre: str = "Pop"
    mood: str = "Catchy"
    language: str = "en"
    tone: str = "Anthemic"

class LyricsRegenerateHookResponse(BaseModel):
    topic: str
    language: str
    hooks: List[Dict[str, Any]]  # List of alternative hook objects with lines and syllables

class SyllableLineItem(BaseModel):
    line_number: int
    text: str
    syllables: int
    meter_description: str

class LyricsAnalyzeSyllablesRequest(BaseModel):
    text: str
    language: str = "en"

class LyricsAnalyzeSyllablesResponse(BaseModel):
    total_lines: int
    total_syllables: int
    average_syllables_per_line: float
    lines: List[SyllableLineItem]
    rhythm_symmetry_score: int  # 0-100

class LyricsModerationRequest(BaseModel):
    text: str

class LyricsModerationResponse(BaseModel):
    is_approved: bool
    flagged_categories: List[str]
    flagged_words: List[str]
    explanation: str

class LyricDraftCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    language: str = Field(default="en")
    topic: Optional[str] = None
    theme: Optional[str] = None
    tone: Optional[str] = None
    rhyme_scheme: Optional[str] = "AABB"
    genre: Optional[str] = "Pop"
    bpm: Optional[int] = 120
    musical_key: Optional[str] = "C Major"
    time_signature: Optional[str] = "4/4"
    vocal_style: Optional[str] = None
    instrument_preferences: Optional[List[str]] = Field(default_factory=list)
    negative_prompt: Optional[str] = None
    persona: Optional[str] = None
    track_id: Optional[str] = None

class LyricDraftUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    language: Optional[str] = None
    topic: Optional[str] = None
    theme: Optional[str] = None
    tone: Optional[str] = None
    rhyme_scheme: Optional[str] = None
    genre: Optional[str] = None
    bpm: Optional[int] = None
    musical_key: Optional[str] = None
    time_signature: Optional[str] = None
    vocal_style: Optional[str] = None
    instrument_preferences: Optional[List[str]] = None
    negative_prompt: Optional[str] = None
    persona: Optional[str] = None
    create_version_snapshot: bool = Field(default=True)
    change_summary: Optional[str] = "Manual lyrics edit"

class LyricVersionResponse(BaseModel):
    id: str
    lyric_id: str
    version_number: int
    title: str
    content: str
    language: str
    change_summary: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class LyricDraftResponse(BaseModel):
    id: str
    user_id: str
    track_id: Optional[str]
    title: str
    content: str
    language: str
    topic: Optional[str]
    theme: Optional[str]
    tone: Optional[str]
    rhyme_scheme: Optional[str]
    genre: Optional[str]
    bpm: Optional[int]
    musical_key: Optional[str]
    time_signature: Optional[str]
    vocal_style: Optional[str]
    instrument_preferences: Optional[List[str]]
    negative_prompt: Optional[str]
    persona: Optional[str]
    versions_count: int = 1
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class LyricsToMusicRequest(BaseModel):
    lyric_id: Optional[str] = None
    title: str = Field(min_length=1, max_length=255)
    lyrics: str = Field(min_length=1)
    provider: str = Field(default="suno")
    model_name: Optional[str] = "suno-v3.5"
    genre: str = "Bollywood Pop"
    mood: str = "Romantic"
    bpm: int = 120
    musical_key: str = "F Minor"
    time_signature: str = "4/4"
    duration_seconds: int = 30
    vocal_style: Optional[str] = "Melodic Female"
