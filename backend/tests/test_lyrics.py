import pytest
from httpx import AsyncClient
from backend.app.services.lyrics_service import LyricsService

# ==============================================================================
# 1. UNIT TESTS: SYLLABLE METRICS, MULTILINGUAL & REWRITE ENGINE
# ==============================================================================

def test_syllable_counting_english():
    assert LyricsService.count_syllables("beat", language="en") == 1
    assert LyricsService.count_syllables("music", language="en") == 2
    assert LyricsService.count_syllables("synthesizer", language="en") == 4
    assert LyricsService.count_syllables("harmonize", language="en") == 3

def test_syllable_counting_multilingual():
    # Hindi Devanagari
    assert LyricsService.count_syllables("दिल", language="hi") >= 1
    assert LyricsService.count_syllables("मोहब्बत", language="hi") >= 3

    # Punjabi Gurmukhi
    assert LyricsService.count_syllables("ਪਿਆਰ", language="pa") >= 2

    # Hinglish
    assert LyricsService.count_syllables("dhadkan", language="hinglish") >= 2
    assert LyricsService.count_syllables("chandni", language="hinglish") >= 2

def test_line_syllables():
    line = "Neon reflections dancing in the street"
    syllables = LyricsService.line_syllables(line, language="en")
    assert syllables > 8

def test_multilingual_lyrics_generation():
    # Hindi
    hi_res = LyricsService.generate_lyrics(
        topic="चांदनी रात",
        language="hi",
        genre="Bollywood Pop",
    )
    assert "sections" in hi_res
    assert hi_res["language"] == "hi"
    assert len(hi_res["sections"]) > 0

    # Hinglish
    hinglish_res = LyricsService.generate_lyrics(
        topic="Late night drive",
        language="hinglish",
        genre="Desi Hip Hop",
    )
    assert hinglish_res["language"] == "hinglish"
    assert len(hinglish_res["sections"]) > 0

    # Punjabi
    pa_res = LyricsService.generate_lyrics(
        topic="ਨਾਚ ਦਾ ਮੇਲਾ",
        language="pa",
        genre="Bhangra",
    )
    assert pa_res["language"] == "pa"

def test_interactive_line_and_section_rewrite():
    orig_line = "The stars are glowing softly in the dark"
    res_punch = LyricsService.rewrite_line(orig_line, instruction="punchier", language="en")
    assert res_punch["rewritten_line"] != orig_line

    res_poetic = LyricsService.rewrite_line(orig_line, instruction="poetic", language="en")
    assert "Gleaming" in res_poetic["rewritten_line"] or "stardust" in res_poetic["rewritten_line"]

    sec_res = LyricsService.rewrite_section(
        section_name="Chorus",
        section_lines=[orig_line, "Walking slowly through the quiet park"],
        instruction="more energetic",
        language="en",
    )
    assert len(sec_res["lines"]) == 2

def test_lyrics_translation():
    content = "[Verse 1]\nThe night is on fire with deep love\n[Chorus]\nEchoes in the heart"
    tr = LyricsService.translate_lyrics(content, target_language="hi", source_language="en")
    assert tr["target_language"] == "hi"
    assert len(tr["sections"]) >= 1

def test_hook_regeneration():
    hooks = LyricsService.regenerate_hook(topic="Neon Lights", genre="Pop", language="en")
    assert len(hooks) == 3
    assert all("lines" in h for h in hooks)

def test_moderation_engine():
    # Clean lyrics
    clean_mod = LyricsService.moderate_lyrics("The stars shine brightly over the mountains")
    assert clean_mod["is_approved"] is True

    # Banned artist anti-impersonation
    artist_mod = LyricsService.moderate_lyrics("Singing just like Taylor Swift in the stadium")
    assert artist_mod["is_approved"] is False
    assert "anti_impersonation" in artist_mod["flagged_categories"]

    # Hate speech
    hate_mod = LyricsService.moderate_lyrics("Inciting violence and death to everyone")
    assert hate_mod["is_approved"] is False
    assert "hate_speech" in hate_mod["flagged_categories"]

def test_export_formats():
    title = "Electric Night"
    content = "[Verse 1]\nLine one here\nLine two here\n[Chorus]\nHook line here"
    arr = {"bpm": 128, "musical_key": "F Minor", "genre": "Synthwave"}

    txt_out = LyricsService.export_lyrics(title, content, format_type="txt", arrangement=arr)
    assert title in txt_out

    lrc_out = LyricsService.export_lyrics(title, content, format_type="lrc", arrangement=arr)
    assert "[ti:Electric Night]" in lrc_out
    assert "[00:10.00]" in lrc_out

    lead_out = LyricsService.export_lyrics(title, content, format_type="leadsheet", arrangement=arr)
    assert "TEMPO: 128 BPM" in lead_out
    assert "KEY: F Minor" in lead_out


# ==============================================================================
# 2. INTEGRATION TESTS: FASTAPI ENDPOINTS, DRAFTS, VERSIONS & GOVERNANCE
# ==============================================================================

@pytest.mark.asyncio
async def test_api_generate_lyrics_multilingual(client: AsyncClient, auth_headers: dict):
    payload = {
        "topic": "Chandni Raat",
        "language": "hinglish",
        "genre": "Bollywood Pop",
        "mood": "Romantic",
        "bpm": 118,
        "musical_key": "D Minor",
        "time_signature": "4/4",
        "vocal_style": "Melodic Female",
    }
    resp = await client.post("/api/v1/lyrics/generate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["language"] == "hinglish"
    assert len(data["sections"]) >= 4

@pytest.mark.asyncio
async def test_api_banned_artist_moderation_rejection(client: AsyncClient):
    payload = {
        "topic": "A song in the direct voice and melody of Drake singing rap",
        "language": "en",
    }
    resp = await client.post("/api/v1/lyrics/generate", json=payload)
    assert resp.status_code == 422
    assert "anti_impersonation" in resp.json()["detail"].lower() or "flagged" in resp.json()["detail"].lower()

@pytest.mark.asyncio
async def test_api_draft_crud_and_version_history(client: AsyncClient, auth_headers: dict):
    # 1. Create Draft
    create_payload = {
        "title": "Raat Ka Safar",
        "content": "[Verse 1]\nNeon streetlights चमकती हैं\nDil mein yaadein महकती हैं\n[Chorus]\nBaby chal mere saath tonight",
        "language": "hinglish",
        "genre": "Desi Hip Hop",
        "bpm": 125,
        "musical_key": "G Minor",
    }
    res_create = await client.post("/api/v1/lyrics/drafts", json=create_payload, headers=auth_headers)
    assert res_create.status_code == 201
    draft_data = res_create.json()
    draft_id = draft_data["id"]
    assert draft_data["title"] == "Raat Ka Safar"
    assert draft_data["versions_count"] == 1

    # 2. Update Draft (creates version 2)
    update_payload = {
        "content": "[Verse 1]\nUpdated first verse with deeper rhythm\nDil mein yaadein महकती हैं\n[Chorus]\nBaby chal mere saath tonight",
        "change_summary": "Revised verse 1 meter",
        "create_version_snapshot": True,
    }
    res_update = await client.put(f"/api/v1/lyrics/drafts/{draft_id}", json=update_payload, headers=auth_headers)
    assert res_update.status_code == 200
    assert res_update.json()["versions_count"] == 2

    # 3. List Versions
    res_versions = await client.get(f"/api/v1/lyrics/drafts/{draft_id}/versions", headers=auth_headers)
    assert res_versions.status_code == 200
    versions = res_versions.json()
    assert len(versions) == 2
    assert versions[0]["version_number"] == 2
    assert versions[1]["version_number"] == 1

    # 4. Revert to Version 1
    res_revert = await client.post(f"/api/v1/lyrics/drafts/{draft_id}/revert/1", headers=auth_headers)
    assert res_revert.status_code == 200
    assert "Neon streetlights चमकती हैं" in res_revert.json()["content"]
    assert res_revert.json()["versions_count"] == 3

    # 5. Export Draft
    res_export = await client.get(f"/api/v1/lyrics/drafts/{draft_id}/export?format=txt", headers=auth_headers)
    assert res_export.status_code == 200
    assert "Raat Ka Safar" in res_export.text

    # 6. Delete Draft
    res_del = await client.delete(f"/api/v1/lyrics/drafts/{draft_id}", headers=auth_headers)
    assert res_del.status_code == 204

@pytest.mark.asyncio
async def test_capability_governance_send_to_music(client: AsyncClient, auth_headers: dict):
    """Connecting lyrics to an instrumental-only provider must return clear capability error."""
    # 1. Procedural provider does NOT support lyrics -> Must return 422
    payload_procedural = {
        "title": "Test Lyrics Track",
        "lyrics": "[Verse 1]\nLine of lyrics to be rejected by procedural synthesizer",
        "provider": "fombo_procedural",
        "genre": "Synthwave",
        "duration_seconds": 30,
    }
    resp_proc = await client.post("/api/v1/lyrics/send-to-music", json=payload_procedural, headers=auth_headers)
    assert resp_proc.status_code == 422
    err_detail = resp_proc.json()["detail"]
    assert "does not support lyrics" in err_detail["message"].lower()
    assert err_detail["error_code"] == "LYRICS_UNSUPPORTED"

    # 2. Suno provider DOES support lyrics -> Succeeds with status ready_for_generation
    payload_suno = {
        "title": "Test Lyrics Track",
        "lyrics": "[Verse 1]\nLine of lyrics accepted by vocal model",
        "provider": "suno",
        "genre": "Pop",
        "duration_seconds": 30,
    }
    resp_suno = await client.post("/api/v1/lyrics/send-to-music", json=payload_suno, headers=auth_headers)
    assert resp_suno.status_code == 200
    assert resp_suno.json()["status"] == "ready_for_generation"

    # 3. ACE-Step 1.5 provider DOES support lyrics & vocals -> Succeeds with status ready_for_generation
    payload_acestep = {
        "title": "ACE-Step Vocal Track",
        "lyrics": "[Chorus]\nSinging clearly through the open-weight model",
        "provider": "ace_step_1_5",
        "genre": "Synthwave",
        "duration_seconds": 30,
        "vocal_style": "Melodic Female",
    }
    resp_ace = await client.post("/api/v1/lyrics/send-to-music", json=payload_acestep, headers=auth_headers)
    assert resp_ace.status_code == 200
    assert resp_ace.json()["status"] == "ready_for_generation"
    assert resp_ace.json()["provider"] == "ace_step_1_5"

@pytest.mark.asyncio
async def test_api_unversioned_lyrics_generate_and_continue(client: AsyncClient, auth_headers: dict):
    """Verifies POST /api/lyrics/generate and POST /api/lyrics/continue endpoints."""
    # 1. Hindi generation with custom structure & length
    payload_hi = {
        "topic": "सफर और उम्मीद",
        "language": "hi",
        "genre": "Bollywood Pop",
        "mood": "Soulful",
        "song_structure": ["Verse 1", "Chorus", "Outro"],
        "rhyme_style": "AABB",
        "stylistic_guidance": "Deep emotional metaphors of nature and rain",
        "desired_length": "short",
    }
    resp_hi = await client.post("/api/lyrics/generate", json=payload_hi)
    assert resp_hi.status_code == 200
    data_hi = resp_hi.json()
    assert data_hi["language"] == "hi"
    assert len(data_hi["sections"]) == 3
    assert data_hi["sections"][0]["section_name"] == "Verse 1"
    assert data_hi["sections"][1]["section_name"] == "Chorus"
    assert data_hi["sections"][2]["section_name"] == "Outro"

    # 2. Punjabi generation with desired length long
    payload_pa = {
        "topic": "ਪੰਜਾਬੀ ਸ਼ਾਨ",
        "language": "pa",
        "genre": "Bhangra",
        "mood": "High Energy",
        "desired_length": "long",
        "rhyme_style": "AABB",
    }
    resp_pa = await client.post("/api/lyrics/generate", json=payload_pa)
    assert resp_pa.status_code == 200
    data_pa = resp_pa.json()
    assert data_pa["language"] == "pa"
    assert len(data_pa["sections"]) >= 5

    # 3. Continue Lyrics
    continue_payload = {
        "existing_lyrics": data_hi["raw_text"],
        "topic": "सफर और उम्मीद",
        "language": "hi",
        "target_section": "Bridge",
        "rhyme_style": "AABB",
    }
    resp_cont = await client.post("/api/lyrics/continue", json=continue_payload)
    assert resp_cont.status_code == 200
    data_cont = resp_cont.json()
    assert "[Bridge]" in data_cont["continued_lyrics"]
    assert data_cont["added_section_name"] == "Bridge"
    assert len(data_cont["added_lines"]) > 0

    # 4. Regenerate Lyrics
    resp_regen = await client.post("/api/lyrics/regenerate", json=payload_hi)
    assert resp_regen.status_code == 200
    assert resp_regen.json()["language"] == "hi"

    # 5. Rewrite Verse and Rewrite Chorus
    verse_rewrite_payload = {
        "section_name": "Verse 1",
        "section_lines": [l["text"] for l in data_hi["sections"][0]["lines"]],
        "instruction": "more poetic and soulful",
        "language": "hi",
    }
    resp_rw_v = await client.post("/api/lyrics/rewrite-verse", json=verse_rewrite_payload)
    assert resp_rw_v.status_code == 200
    assert len(resp_rw_v.json()["lines"]) == len(verse_rewrite_payload["section_lines"])

    chorus_rewrite_payload = {
        "section_name": "Chorus",
        "section_lines": [l["text"] for l in data_hi["sections"][1]["lines"]],
        "instruction": "anthemic stadium hook",
        "language": "hi",
    }
    resp_rw_c = await client.post("/api/lyrics/rewrite-chorus", json=chorus_rewrite_payload)
    assert resp_rw_c.status_code == 200
    assert len(resp_rw_c.json()["lines"]) == len(chorus_rewrite_payload["section_lines"])

