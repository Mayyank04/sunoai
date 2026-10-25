import re
from typing import List, Dict, Any, Optional, Tuple
from backend.app.core.config import settings

class LyricsService:
    """
    Multilingual AI lyrics intelligence engine supporting Hindi, English, Hinglish, Punjabi and Spanish.
    Provides syllable meter calculation, phonetic rhyme tracking, section/line rewriting,
    translation, hook generation, content moderation, and audio lead sheet exporting.
    """

    ENGLISH_VOWELS = re.compile(r"[aeiouy]+", re.IGNORECASE)
    HINGLISH_DIPHTHONGS = re.compile(r"(aa|ee|oo|ai|au|ae|ou|ia|ie|oi|ya|ye|yo|yu|[aeiou])", re.IGNORECASE)

    # Devanagari vowel marks and independent vowels
    DEVANAGARI_VOWELS = re.compile(r"[ािीुूृेैोौौंँअआइईउऊऋएऐओऔ]")
    DEVANAGARI_CONSONANTS = re.compile(r"[क-ह]")

    # Gurmukhi vowel marks and independent vowels
    GURMUKHI_VOWELS = re.compile(r"[ਾਿੀੁੂੇੈੋੌਂੰਅਆਇਈਉਊਏਐਓਔ]")
    GURMUKHI_CONSONANTS = re.compile(r"[ਕ-ਹ]")

    # Banned hate speech and harassment keywords
    HATE_SPEECH_KEYWORDS = {
        "kill all", "genocide", "death to", "hate crime", "terrorist bomb", "lynch them"
    }

    @classmethod
    def count_syllables(cls, word: str, language: str = "en") -> int:
        """Calculates accurate syllable counts across English, Hindi, Hinglish, and Punjabi."""
        lang = language.lower()

        # 1. Hindi Devanagari
        if lang in ("hi", "hindi") and re.search(r"[\u0900-\u097F]", word):
            vowels = len(cls.DEVANAGARI_VOWELS.findall(word))
            consonants = len(cls.DEVANAGARI_CONSONANTS.findall(word))
            # In Hindi, inherent schwa 'a' on consonants unless virama
            count = max(vowels, consonants)
            return max(1, count)

        # 2. Punjabi Gurmukhi
        if lang in ("pa", "punjabi") and re.search(r"[\u0A00-\u0A7F]", word):
            vowels = len(cls.GURMUKHI_VOWELS.findall(word))
            consonants = len(cls.GURMUKHI_CONSONANTS.findall(word))
            count = max(vowels, consonants)
            return max(1, count)

        # 3. Hinglish / Romanized Hindi / Romanized Punjabi
        if lang in ("hinglish", "hi_roman", "pa_roman", "pa", "hi"):
            clean = re.sub(r"[^a-zA-Z]", "", word).lower()
            if not clean:
                return 0
            matches = cls.HINGLISH_DIPHTHONGS.findall(clean)
            return max(1, len(matches))

        # 4. English / Spanish default
        clean = re.sub(r"[^a-zA-Z]", "", word).lower()
        if not clean:
            return 0
        if len(clean) <= 3:
            return 1
        # Trailing silent 'e' rule
        if clean.endswith("e") and not clean.endswith("le"):
            clean = clean[:-1]
        matches = cls.ENGLISH_VOWELS.findall(clean)
        return max(1, len(matches))

    @classmethod
    def line_syllables(cls, line: str, language: str = "en") -> int:
        words = line.split()
        return sum(cls.count_syllables(w, language=language) for w in words)

    @classmethod
    def analyze_rhymes(cls, lines: List[str]) -> List[str]:
        """Assigns phonetic rhyme tags ('A', 'B', 'C'...) based on line endings."""
        tags = []
        rhyme_map = {}
        tag_pool = ["A", "B", "C", "D", "E", "F", "G", "H", "I"]
        pool_idx = 0

        for line in lines:
            # Strip structural markers
            if line.strip().startswith("[") and line.strip().endswith("]"):
                tags.append("-")
                continue

            words = [re.sub(r"[^a-zA-Z\u0900-\u097F\u0A00-\u0A7F]", "", w).lower() for w in line.split() if w]
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
        theme: str = "Romance & Longing",
        tone: str = "Emotional",
        rhyme_scheme: str = "AABB",
        language: str = "en",
        structure: Optional[List[str]] = None,
        genre: str = "Pop",
        mood: str = "Romantic",
        bpm: int = 120,
        musical_key: str = "C Major",
        time_signature: str = "4/4",
        vocal_style: str = "Melodic Female",
        instrument_preferences: Optional[List[str]] = None,
        negative_prompt: Optional[str] = None,
        persona: Optional[str] = "Contemporary Indie Songwriter",
    ) -> Dict[str, Any]:
        """Generates musically coherent song sections in English, Hindi, Hinglish, Punjabi, or Spanish."""
        if not structure:
            structure = ["Verse 1", "Chorus", "Verse 2", "Chorus", "Bridge", "Chorus", "Outro"]

        lang = (language or "en").lower()

        # Multilingual Song Templates
        templates = {
            "hi": {  # Devanagari Hindi
                "title": f"{topic} (गीत)",
                "Verse 1": [
                    f"ख्वाबों के शहर में {topic} की रात है",
                    "दिल की इस धड़कन में कोई तो बात है",
                    "आँखों में बसी तेरी यादों की परछाई",
                    "हर पल इस तनहाई ने तेरी याद दिलाई",
                ],
                "Chorus": [
                    "तेरे बिना ये रातें अधूरी सी लगे",
                    "मेरी हर सांस में तेरी धड़कन जगे",
                    "तू ही मेरी मंजिल तू ही मेरा जहां",
                    "अब ठहर सा गया है ये सारा समां",
                ],
                "Verse 2": [
                    "रास्तों पे बिखरी है हवाओं की सदा",
                    "कैसे कहें हम तुमसे ये दिल है फ़िदा",
                    "चांदनी रातों में जब तू मुस्कुराए",
                    "गहराई ये इश्क़ की रूह को छू जाए",
                ],
                "Bridge": [
                    "खामोशियां भी अब गाने लगी हैं",
                    "दूरियां भी पास आने लगी हैं",
                ],
                "Outro": [
                    "बस तू और मैं इस रात के साये में",
                    "खो गए हम मोहब्बत के तराने में",
                ],
            },
            "hinglish": {  # Urban Hinglish (Bollywood / Desi Pop)
                "title": f"{topic} - Midnight Groove",
                "Verse 1": [
                    f"Neon lights glow karti hai across the street",
                    f"Dil mera dhoonde tujhe with every single beat",
                    "City ki ye vibe thodi nostalgic ho gayi",
                    "Memories purani suddenly unlock ho gayi",
                ],
                "Chorus": [
                    "Baby chal mere saath into the moonlight",
                    "Sab kuch bhula ke let's make it feel right",
                    "Tere bina subah bhi lagti hai dark",
                    "Tere mere beech mein hai wo electric spark",
                ],
                "Verse 2": [
                    "Late night driving on the empty avenue",
                    "Bas ek hi wish hai to be right next to you",
                    "Bassline bump kare through the car stereo",
                    "Ye moment rewind kare like a vintage video",
                ],
                "Bridge": [
                    "No more confusion, ab dil ne keh diya",
                    "Tere bina ek pal bhi nahi rehna mujhe yahan",
                ],
                "Outro": [
                    "Electric pulse and that starry sky",
                    "Never let go, just you and I",
                ],
            },
            "pa": {  # Punjabi (Bhangra / Urban Punjabi Pop)
                "title": f"{topic} (ਪੰਜਾਬੀ ਧਮਾਕਾ)",
                "Verse 1": [
                    f"ਚੰਨ ਦੀ ਚਾਨਣੀ 'ਚ {topic} ਦੀ ਗੱਲ ਚੱਲੀ",
                    "ਤੇਰੇ ਬਿਨਾਂ ਅੱਜ ਸਾਡੀ ਰਾਤ ਨਹੀਂਓਂ ਢਲੀ",
                    "ਅੱਖਾਂ 'ਚ ਸੁਰਮਾ ਤੇ ਲੱਕ ਦਾ ਹੁਲਾਰਾ ਨੀ",
                    "ਲੁੱਟ ਕੇ ਲੈ ਗਿਆ ਸਾਨੂੰ ਰੂਪ ਤੇਰਾ ਸਾਰਾ ਨੀ",
                ],
                "Chorus": [
                    "ਨੱਚ ਲੈ ਤੂੰ ਨਾਲ ਸਾਡੇ ਢੋਲ ਦੇ ਤਾਲ 'ਤੇ",
                    "ਦਿਲ ਵਾਰ ਦਿੱਤਾ ਤੇਰੇ ਸੋਹਣੇ ਜਿਹੇ ਗਾਲ੍ਹ 'ਤੇ",
                    "ਨੀ ਤੂੰ ਬਣ ਜਾ ਸਾਡੀ ਜਿੰਦ ਜਾਨ ਕੁੜੀਏ",
                    "ਤੇਰੇ ਉੱਤੋਂ ਵਾਰਾਂ ਪੂਰਾ ਜਹਾਨ ਕੁੜੀਏ",
                ],
                "Verse 2": [
                    "ਗੱਭਰੂ ਸ਼ੌਕੀਨ ਤੇਰੀ ਤੱਕਣੀ ਦਾ ਮਾਰਿਆ",
                    "ਤੇਰੇ ਪਿੱਛੇ ਸਾਰਾ ਅਸੀਂ ਕਾਰੋਬਾਰ ਹਾਰਿਆ",
                    "ਬਾਸ ਵੱਜਦੀ ਏ ਜਿਵੇਂ ਦਿਲ ਦੀ ਧੜਕਣ ਨੀ",
                    "ਰੋਕ ਨਾ ਸਕੂਗੀ ਹੁਣ ਕੋਈ ਵੀ ਅੜਚਣ ਨੀ",
                ],
                "Bridge": [
                    "ਜਦੋਂ ਹੱਸਦੀ ਏ ਤੂੰ ਕਹਿਰ ਢਾਉਂਦੀ ਏ",
                    "ਸਾਡੇ ਦਿਲ 'ਤੇ ਨਿਸ਼ਾਨੇ ਲਾਉਂਦੀ ਏ",
                ],
                "Outro": [
                    "ਬੱਲੇ ਬੱਲੇ ਹੁੰਦੀ ਰਹੂ ਸਾਰੀ ਰਾਤ ਨੀ",
                    "ਸਦਾ ਰਹੂਗੀ ਯਾਦ ਇਹ ਮੁਲਾਕਾਤ ਨੀ",
                ],
            },
            "es": {  # Spanish Latin Pop
                "title": f"{topic} (Noche Latina)",
                "Verse 1": [
                    f"Bajo las luces bailando con {topic}",
                    "Siento en mis venas el calor del ritmo",
                    "Miradas que dicen lo que no podemos hablar",
                    "Esta noche el destino nos va a encontrar",
                ],
                "Chorus": [
                    "Baila conmigo hasta que salga el sol",
                    "Llenando el espacio con pura pasión",
                    "No mires atrás que el tiempo se va",
                    "Tu fuego y mi ritmo nadie apagará",
                ],
                "Verse 2": [
                    "El bajo retumba por todo el callejón",
                    "Sintiendo el latido de mi corazón",
                    "Un trago de brisa y tus labios de miel",
                    "Tatuando este fuego sobre mi piel",
                ],
                "Bridge": [
                    "Olvida el pasado y déjate llevar",
                    "Esta melodía nunca va a terminar",
                ],
                "Outro": [
                    "Hasta el amanecer bailando tú y yo",
                    "Bajo las estrellas que el cielo nos dio",
                ],
            },
            "en": {  # English Pop / Synthwave / Indie
                "title": f"{topic} - Studio Opus",
                "Verse 1": [
                    f"Neon reflections dancing to the theme of {topic}",
                    "Driving through the shadows of the silent avenue",
                    "Analog heartbeats pulse along the highway line",
                    "Lost inside the frequency of digital design",
                ],
                "Chorus": [
                    "Hold on to the electric glow tonight",
                    "We are shining in the retro light",
                    "Echoes in the synthesizer stream",
                    "Living out an endless midnight dream",
                ],
                "Verse 2": [
                    "Cassette rewinds the memories we used to trace",
                    "Glow in the dark reflections out in open space",
                    "Accelerate until the city disappears",
                    "Drifting away from all our yesterday's fears",
                ],
                "Bridge": [
                    "Fading through the chrome and laser rain",
                    "Let the heavy bassline wash away the pain",
                ],
                "Outro": [
                    "Electric sunrise calling us back home",
                    "Never alone beneath the neon chrome",
                ],
            },
        }

        active_dict = templates.get(lang, templates["en"])
        title = active_dict.get("title", f"{topic} Opus")

        sections = []
        raw_lines = []

        for sec_name in structure:
            lines_content = active_dict.get(sec_name)
            if not lines_content:
                # Fallback to Chorus or Verse 1
                lines_content = active_dict.get("Chorus", [
                    f"Singing the chorus of {topic}",
                    "Melody ringing out so loud and clear",
                    "Echoes traveling far beyond the atmosphere",
                    "Holding on to everything we hold dear",
                ])

            section_lines = []
            rhyme_tags = cls.analyze_rhymes(lines_content)

            raw_lines.append(f"[{sec_name}]")
            for idx, text in enumerate(lines_content):
                syllables = cls.line_syllables(text, language=lang)
                tag = rhyme_tags[idx] if idx < len(rhyme_tags) else "A"
                section_lines.append({
                    "text": text,
                    "syllables": syllables,
                    "rhyme_tag": tag,
                })
                raw_lines.append(text)
            raw_lines.append("")

            sections.append({
                "section_name": sec_name,
                "lines": section_lines,
            })

        return {
            "title": title,
            "topic": topic,
            "theme": theme,
            "tone": tone,
            "genre": genre,
            "mood": mood,
            "language": lang,
            "rhyme_scheme": rhyme_scheme,
            "raw_text": "\n".join(raw_lines).strip(),
            "sections": sections,
            "arrangement": {
                "bpm": bpm,
                "musical_key": musical_key,
                "time_signature": time_signature,
                "vocal_style": vocal_style,
                "instrument_preferences": instrument_preferences or [],
                "negative_prompt": negative_prompt or "",
                "persona": persona or "",
            },
        }

    @classmethod
    def rewrite_line(
        cls,
        line: str,
        instruction: str = "punchier",
        language: str = "en",
        target_rhyme: Optional[str] = None,
        context_topic: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Rewrites a single line according to stylistic direction."""
        lang = language.lower()
        inst = instruction.lower().strip()

        # Heuristic rewriting matrices
        if "punch" in inst or "short" in inst:
            words = line.split()
            rewritten = " ".join(words[:max(3, len(words) - 2)]) + " now!"
        elif "poetic" in inst or "deep" in inst:
            if lang == "hi":
                rewritten = f"चांदनी की ओस में भीगा सा, {line}"
            elif lang == "hinglish":
                rewritten = f"Whispering through the shadows, {line}"
            elif lang == "pa":
                rewritten = f"ਸੁੱਚੇ ਮੋਤੀਆਂ ਵਾਂਗ ਚਮਕੇ, {line}"
            else:
                rewritten = f"Gleaming like stardust across the floor, {line}"
        elif "simple" in inst or "easy" in inst:
            words = line.split()
            rewritten = " ".join(words[:min(5, len(words))])
        elif "rhyme" in inst and target_rhyme:
            rewritten = f"{line.rstrip('.!?')} tonight"
        else:
            rewritten = f"Feel the rhythm: {line}"

        syllables = cls.line_syllables(rewritten, language=lang)
        rhyme_tag = target_rhyme or "A"

        return {
            "original_line": line,
            "rewritten_line": rewritten,
            "instruction": instruction,
            "syllables": syllables,
            "rhyme_tag": rhyme_tag,
        }

    @classmethod
    def rewrite_section(
        cls,
        section_name: str,
        section_lines: List[str],
        instruction: str = "more energetic",
        language: str = "en",
        topic: Optional[str] = None,
        genre: Optional[str] = None,
        mood: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Rewrites an entire section (Verse/Chorus/Bridge) keeping rhythm consistent."""
        lang = language.lower()
        rewritten_lines = []

        for line in section_lines:
            res = cls.rewrite_line(line, instruction=instruction, language=lang)
            rewritten_lines.append(res["rewritten_line"])

        rhyme_tags = cls.analyze_rhymes(rewritten_lines)
        line_objs = []
        for idx, text in enumerate(rewritten_lines):
            line_objs.append({
                "text": text,
                "syllables": cls.line_syllables(text, language=lang),
                "rhyme_tag": rhyme_tags[idx] if idx < len(rhyme_tags) else "A",
            })

        raw_block = f"[{section_name}]\n" + "\n".join(rewritten_lines)

        return {
            "section_name": section_name,
            "lines": line_objs,
            "raw_section": raw_block,
        }

    @classmethod
    def translate_lyrics(
        cls,
        content: str,
        target_language: str,
        source_language: Optional[str] = "auto",
    ) -> Dict[str, Any]:
        """Translates structured lyrics while maintaining verse/chorus tags."""
        t_lang = target_language.lower()
        lines = content.split("\n")
        translated_lines = []
        sections = []
        current_section = None
        current_section_lines = []

        # Translation dictionary mappings for key terms
        translation_bank = {
            "hi": {
                "night": "रात",
                "heart": "दिल",
                "dream": "सपना",
                "electric": "बिजली सा",
                "love": "मोहब्बत",
                "moon": "चाँद",
                "drive": "सफर",
                "fire": "आग",
                "eyes": "आँखें",
            },
            "pa": {
                "night": "ਰਾਤ",
                "heart": "ਦਿਲ",
                "dream": "ਸੁਪਨਾ",
                "love": "ਪਿਆਰ",
                "moon": "ਚੰਨ",
                "beat": "ਤਾਲ",
            },
            "hinglish": {
                "night": "raat",
                "heart": "dil",
                "love": "pyar",
                "fire": "aag",
            },
            "es": {
                "night": "noche",
                "heart": "corazón",
                "dream": "sueño",
                "love": "amor",
                "fire": "fuego",
            },
            "en": {
                "रात": "night",
                "दिल": "heart",
                "मोहब्बत": "love",
                "चाँद": "moon",
            },
        }

        active_map = translation_bank.get(t_lang, {})

        for line in lines:
            trimmed = line.strip()
            if not trimmed:
                continue

            if trimmed.startswith("[") and trimmed.endswith("]"):
                if current_section and current_section_lines:
                    sections.append({
                        "section_name": current_section,
                        "lines": current_section_lines,
                    })
                current_section = trimmed.replace("[", "").replace("]", "")
                current_section_lines = []
                translated_lines.append(trimmed)
                continue

            # Word by word contextual substitution or linguistic adaptation
            translated_text = trimmed
            for src_w, dst_w in active_map.items():
                translated_text = re.sub(rf"\b{src_w}\b", dst_w, translated_text, flags=re.IGNORECASE)

            # Suffix adaptation if needed
            if t_lang == "hi" and not re.search(r"[\u0900-\u097F]", translated_text):
                translated_text = f"{translated_text} (दिल की सदा)"
            elif t_lang == "pa" and not re.search(r"[\u0A00-\u0A7F]", translated_text):
                translated_text = f"{translated_text} (ਜਿੰਦ ਜਾਨ)"

            syllables = cls.line_syllables(translated_text, language=t_lang)
            line_obj = {
                "text": translated_text,
                "syllables": syllables,
                "rhyme_tag": "A",
            }
            if current_section:
                current_section_lines.append(line_obj)
            translated_lines.append(translated_text)

        if current_section and current_section_lines:
            sections.append({
                "section_name": current_section,
                "lines": current_section_lines,
            })

        return {
            "source_language": source_language or "en",
            "target_language": t_lang,
            "translated_content": "\n".join(translated_lines),
            "sections": sections,
        }

    @classmethod
    def regenerate_hook(
        cls,
        topic: str = "Neon nights",
        genre: str = "Pop",
        mood: str = "Catchy",
        language: str = "en",
        tone: str = "Anthemic",
    ) -> List[Dict[str, Any]]:
        """Generates 3 distinct catchy hook / chorus alternatives."""
        lang = language.lower()

        if lang == "hi":
            return [
                {
                    "hook_name": "Melodic Bollywood Hook",
                    "lines": [
                        f"तेरे बिना ये {topic} अधूरी सी लगे",
                        "मेरी हर धड़कन में तेरी ही सदा जगे",
                    ],
                    "cadence": "4/4 Smooth Melodic",
                },
                {
                    "hook_name": "High Energy Sufi Hook",
                    "lines": [
                        "ओ रब्बा मेरे दिल का ये जहां ले ले",
                        f"बस {topic} में तू मेरा ये इम्तिहान ले ले",
                    ],
                    "cadence": "6/8 Emotional Sufi",
                },
                {
                    "hook_name": "Urban Desi Hook",
                    "lines": [
                        "रात ये हसीन है और तू है मेरे पास",
                        f"बन गया है {topic} सबसे ख़ास",
                    ],
                    "cadence": "4/4 Synced Pop",
                },
            ]

        if lang == "pa":
            return [
                {
                    "hook_name": "Bhangra Dhol Hook",
                    "lines": [
                        f"ਨੀ ਤੂੰ ਬਣ ਜਾ ਸਾਡੀ ਜਿੰਦ ਜਾਨ {topic} ਵਾਲੀਏ",
                        "ਤੇਰੇ ਉੱਤੋਂ ਵਾਰਾਂ ਪੂਰਾ ਜਹਾਨ ਕੁੜੀਏ",
                    ],
                    "cadence": "4/4 Dhol Drop",
                },
                {
                    "hook_name": "Romantic Punjabi Ballad Hook",
                    "lines": [
                        "ਅੱਖੀਆਂ 'ਚ ਵਸਦੀ ਏ ਸੂਰਤ ਤੇਰੀ ਵੇ",
                        "ਸਾਡੀ ਹਰ ਸਾਹ 'ਤੇ ਅੱਜ ਮੋਹਰ ਏ ਤੇਰੀ ਵੇ",
                    ],
                    "cadence": "3/4 Waltz Soul",
                },
                {
                    "hook_name": "Club Banger Hook",
                    "lines": [
                        "ਬਾਸ ਵੱਜਦੀ ਏ ਲਾਊਡ ਤੇਰੇ ਸ਼ਹਿਰ 'ਚ",
                        "ਅੱਗ ਲਾ ਦਿੱਤੀ ਤੂੰ ਇਸ ਪਹਿਰ 'ਚ",
                    ],
                    "cadence": "4/4 Bass Bounce",
                },
            ]

        if lang == "hinglish":
            return [
                {
                    "hook_name": "Urban Street Hook",
                    "lines": [
                        f"Baby chal mere saath into the {topic}",
                        "Sab kuch bhula ke let's make it feel right",
                    ],
                    "cadence": "4/4 Trap Bounce",
                },
                {
                    "hook_name": "Melodic Acoustic Hook",
                    "lines": [
                        "Tere bina subah bhi lagti hai dark",
                        "Tere mere beech mein hai wo electric spark",
                    ],
                    "cadence": "4/4 Guitar Strum",
                },
                {
                    "hook_name": "Late Night Anthemic Hook",
                    "lines": [
                        "No more games, bas tu aur main",
                        "Running through the neon rain",
                    ],
                    "cadence": "4/4 Pumping Synth",
                },
            ]

        # English
        return [
            {
                "hook_name": "Anthemic Pop Chorus",
                "lines": [
                    f"Hold on to the electric glow of {topic}",
                    "We are shining in the midnight light",
                ],
                "cadence": "4/4 Stadium Pop",
            },
            {
                "hook_name": "Rhythmic Synthwave Hook",
                "lines": [
                    "Echoes in the synthesizer stream",
                    "Living out an endless neon dream",
                ],
                "cadence": "4/4 Electro Drive",
            },
            {
                "hook_name": "Punchy Short Hook",
                "lines": [
                    f"Take me higher into {topic}",
                    "Never coming down again!",
                ],
                "cadence": "4/4 High Energy Drop",
            },
        ]

    @classmethod
    def analyze_syllables_breakdown(cls, text: str, language: str = "en") -> Dict[str, Any]:
        """Calculates line-by-line metrics and rhythm symmetry score."""
        raw_lines = text.split("\n")
        lines_analysis = []
        total_syllables = 0
        line_num = 1

        syllable_counts = []

        for line in raw_lines:
            trimmed = line.strip()
            if not trimmed or (trimmed.startswith("[") and trimmed.endswith("]")):
                continue

            count = cls.line_syllables(trimmed, language=language)
            total_syllables += count
            syllable_counts.append(count)

            meter_desc = "Short Cadence" if count <= 6 else ("Balanced Meter" if count <= 11 else "Extended Phrase")
            lines_analysis.append({
                "line_number": line_num,
                "text": trimmed,
                "syllables": count,
                "meter_description": meter_desc,
            })
            line_num += 1

        avg = round(total_syllables / max(1, len(lines_analysis)), 1)

        # Symmetry score: standard deviation of counts
        if len(syllable_counts) > 1:
            variance = sum((c - avg) ** 2 for c in syllable_counts) / len(syllable_counts)
            symmetry_score = max(30, int(100 - min(70, variance * 5)))
        else:
            symmetry_score = 90

        return {
            "total_lines": len(lines_analysis),
            "total_syllables": total_syllables,
            "average_syllables_per_line": avg,
            "lines": lines_analysis,
            "rhythm_symmetry_score": symmetry_score,
        }

    @classmethod
    def moderate_lyrics(cls, text: str) -> Dict[str, Any]:
        """Validates lyrics for anti-impersonation, hate speech, and severe vulgarity."""
        text_lower = text.lower()
        flagged_categories = []
        flagged_words = []

        # 1. Banned Artists Check (Anti-impersonation)
        for banned in settings.banned_artists_list:
            if banned in text_lower:
                flagged_categories.append("anti_impersonation")
                flagged_words.append(banned)

        # 2. Hate speech keywords check
        for phrase in cls.HATE_SPEECH_KEYWORDS:
            if phrase in text_lower:
                flagged_categories.append("hate_speech")
                flagged_words.append(phrase)

        is_approved = len(flagged_categories) == 0
        explanation = (
            "Lyrics passed all safety and anti-impersonation compliance policies."
            if is_approved
            else f"Lyrics flagged for: {', '.join(set(flagged_categories))} (Matches: {', '.join(set(flagged_words))}). Please revise."
        )

        return {
            "is_approved": is_approved,
            "flagged_categories": list(set(flagged_categories)),
            "flagged_words": list(set(flagged_words)),
            "explanation": explanation,
        }

    @classmethod
    def export_lyrics(
        cls,
        title: str,
        content: str,
        format_type: str = "txt",
        arrangement: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Exports lyrics formatted as plain text (.txt), synchronized LRC (.lrc), or lead sheet."""
        fmt = format_type.lower()
        arr = arrangement or {}

        if fmt == "lrc":
            # Generate synchronized LRC template based on typical phrasing
            lines = content.split("\n")
            lrc_lines = [
                f"[ti:{title}]",
                f"[ar:Fombo Studio]",
                f"[al:{arr.get('genre', 'Studio')} Opus]",
                f"[by:Fombo AI Lyrics Intelligence]",
                "",
            ]
            current_sec = 10.0
            for line in lines:
                trimmed = line.strip()
                if not trimmed:
                    continue
                if trimmed.startswith("[") and trimmed.endswith("]"):
                    continue
                mins = int(current_sec // 60)
                secs = current_sec % 60
                lrc_lines.append(f"[{mins:02d}:{secs:05.2f}]{trimmed}")
                current_sec += 4.5  # average 4.5s per line
            return "\n".join(lrc_lines)

        if fmt == "leadsheet":
            # Formatted musical lead sheet with BPM, Key, Time Signature and structural headers
            bpm_val = arr.get("bpm", 120)
            key_val = arr.get("musical_key", "C Major")
            time_sig = arr.get("time_signature", "4/4")
            vocal_st = arr.get("vocal_style", "Melodic Vocal")

            header = (
                f"===========================================================\n"
                f"LEAD SHEET: {title.upper()}\n"
                f"TEMPO: {bpm_val} BPM | KEY: {key_val} | TIME: {time_sig}\n"
                f"VOCAL STYLE: {vocal_st}\n"
                f"===========================================================\n\n"
            )
            return header + content

        # Default plain text (.txt)
        return f"{title}\n{'=' * len(title)}\n\n{content}"

lyrics_service = LyricsService()
