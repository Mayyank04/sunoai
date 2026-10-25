import pytest
from backend.app.services.lyrics_service import LyricsService

def test_syllable_counting():
    assert LyricsService.count_syllables("beat") == 1
    assert LyricsService.count_syllables("music") == 2
    assert LyricsService.count_syllables("synthesizer") == 4
    assert LyricsService.count_syllables("harmonize") == 3

def test_line_syllables():
    line = "Neon reflections dancing in the street"
    syllables = LyricsService.line_syllables(line)
    assert syllables > 8

def test_lyrics_generation_structure():
    result = LyricsService.generate_lyrics(
        topic="Electric Highways",
        genre="Synthwave",
        mood="Energetic",
        structure=["Verse 1", "Chorus", "Outro"]
    )

    assert "sections" in result
    assert len(result["sections"]) == 3
    assert result["sections"][0]["section_name"] == "Verse 1"
    assert len(result["sections"][0]["lines"]) > 0

    first_line = result["sections"][0]["lines"][0]
    assert "text" in first_line
    assert "syllables" in first_line
    assert "rhyme_tag" in first_line
