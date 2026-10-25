import pytest
from backend.app.services.provenance import ProvenanceService

def test_provenance_sha256_computation():
    sample_data = b"RIFF-FOMBO-TEST-AUDIO-STREAM-DATA-2026"
    digest = ProvenanceService.compute_sha256(sample_data)
    assert len(digest) == 64
    assert digest == ProvenanceService.compute_sha256(sample_data)

def test_commercial_rights_evaluation_free_tier():
    commercial_ok, license_name, disclaimer = ProvenanceService.evaluate_commercial_rights(
        model_provider="fombo_procedural",
        user_tier="free"
    )
    assert commercial_ok is False
    assert "CC BY-NC" in license_name
    assert "non-commercial" in disclaimer.lower()

def test_commercial_rights_evaluation_pro_tier():
    commercial_ok, license_name, disclaimer = ProvenanceService.evaluate_commercial_rights(
        model_provider="fombo_procedural",
        user_tier="pro"
    )
    assert commercial_ok is True
    assert "CC0" in license_name

def test_c2pa_manifest_structure():
    manifest = ProvenanceService.create_c2pa_manifest(
        track_id="test_track_123",
        creator_id="user_abc",
        creator_username="synthking",
        audio_sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        prompt="Electric dreams",
        seed=42,
        model_provider="fombo_procedural",
        model_name="procedural-dsp-v1",
        bpm=120,
        musical_key="A Minor",
        user_tier="pro"
    )
    assert manifest["c2pa_version"] == "2.1"
    assert manifest["claim_generator_info"]["name"] == "Fombo Music AI"
    assert manifest["rights"]["commercial_use_permitted"] is True
    assert "jurisdiction_notice" in manifest["rights"]
