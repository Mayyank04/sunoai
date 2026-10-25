import re
from typing import List, Dict, Any

class LyricsService:
    """Lyrics generator, syllable metric counter and rhyme scheme analyzer."""

    VOWEL_PATTERNS = re.compile(r"[aeiouy]+", re.IGNORECASE)

    @classmethod
    def count_syllables(cls, word: str) -> int:
        """Heuristic syllable counter for English lyric lines."""
        clean = re.sub(r"[^a-zA-Z]", "", word).lower()
        if not clean:
            return 0
        if len(clean) <= 3:
            return 1
        # Remove trailing silent 'e' unless it's 'le'
        if clean.endswith("e") and not clean.endswith("le"):
            clean = clean[:-1]
        matches = cls.VOWEL_PATTERNS.findall(clean)
        count = len(matches)
        return max(1, count)

    @classmethod
    def line_syllables(cls, line: str) -> int:
        words = line.split()
        return sum(cls.count_syllables(w) for w in words)

    @classmethod
    def analyze_rhymes(cls, lines: List[str]) -> List[str]:
        """Assigns simple phonetic rhyme tags ('A', 'B', 'C'...) based on ending syllables."""
        tags = []
        rhyme_map = {}
        tag_pool = ["A", "B", "C", "D", "E", "F", "G"]
        pool_idx = 0

        for line in lines:
            words = [re.sub(r"[^a-zA-Z]", "", w).lower() for w in line.split() if re.sub(r"[^a-zA-Z]", "", w)]
            if not words:
                tags.append("-")
                continue
            last_word = words[-1]
            suffix = last_word[-3:] if len(last_word) >= 3 else last_word

            if suffix not in rhyme_map:
                if pool_idx < len(tag_pool):
                    rhyme_map[suffix] = tag_pool[pool_idx]
                    pool_idx += 1
                else:
                    rhyme_map[suffix] = "X"

            tags.append(rhyme_map[suffix])

        return tags

    @classmethod
    def generate_lyrics(
        cls,
        topic: str = "Neon nights",
        genre: str = "Synthwave",
        mood: str = "Nostalgic",
        structure: List[str] = None
    ) -> Dict[str, Any]:
        """Generates musically coherent song sections with syllable metrics and rhyming."""
        if not structure:
            structure = ["Verse 1", "Chorus", "Verse 2", "Chorus", "Bridge", "Outro"]

        lyrics_templates = {
            "Synthwave": {
                "Verse 1": [
                    "Neon reflections paint the midnight avenue",
                    "Driving through the shadows in this quiet rendezvous",
                    "Analog heartbeats pulse along the highway line",
                    "Lost inside the frequency of digital design"
                ],
                "Chorus": [
                    "Hold on to the electric glow tonight",
                    "We are shining in the retro light",
                    "Echoes in the synthesizer stream",
                    "Living out an endless midnight dream"
                ],
                "Verse 2": [
                    "Cassette rewinds the memories we used to trace",
                    "Glow in the dark reflections in outer space",
                    "Accelerate until the city disappears",
                    "Drifting away from all our yesterday's fears"
                ],
                "Bridge": [
                    "Fading through the chrome and laser rain",
                    "Let the bassline wash away the pain"
                ],
                "Outro": [
                    "Electric sunrise calling us back home",
                    "Never alone in the neon chrome"
                ]
            },
            "Default": {
                "Verse 1": [
                    f"Waking up to the rhythm of {topic}",
                    "Searching for the answers in the air",
                    "Every step is a melody we make",
                    "With a feeling that we want to share"
                ],
                "Chorus": [
                    f"This is the sound of {topic} rising high",
                    "Touching every corner of the sky",
                    "Hear the harmonies begin to play",
                    "Carrying our worries far away"
                ],
                "Verse 2": [
                    "A brand new chapter written in the stars",
                    "No matter where we travel from our start",
                    "The beat continues through the darkest night",
                    "Guided by the music and the light"
                ],
                "Bridge": [
                    "Lift your voice and let it break the ceiling",
                    "Nothing can replace this sonic feeling"
                ],
                "Outro": [
                    f"Echoes of {topic} fading slow",
                    "Every rhythm lets the passion grow"
                ]
            }
        }

        genre_pack = lyrics_templates.get(genre, lyrics_templates["Default"])
        sections = []

        for sec in structure:
            lines = genre_pack.get(sec, [
                f"Music playing softly for {sec.lower()}",
                "Feel the groove as the measures roll",
                "Singing out the story from the heart",
                "Bringing pure resonance to the soul"
            ])
            rhyme_tags = cls.analyze_rhymes(lines)
            line_data = []
            for idx, text in enumerate(lines):
                line_data.append({
                    "text": text,
                    "syllables": cls.line_syllables(text),
                    "rhyme_tag": rhyme_tags[idx] if idx < len(rhyme_tags) else "A"
                })

            sections.append({
                "section_name": sec,
                "lines": line_data
            })

        return {
            "title": f"{genre} Anthem ({topic.title()})",
            "topic": topic,
            "genre": genre,
            "mood": mood,
            "sections": sections
        }

lyrics_service = LyricsService()
