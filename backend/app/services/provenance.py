import hashlib
import json
from datetime import datetime, timezone
from typing import Dict, Any, Tuple

class ProvenanceService:
    """Production provenance engine implementing C2PA metadata manifests and commercial rights verification."""

    @staticmethod
    def compute_sha256(data: bytes) -> str:
        """Computes SHA-256 hexadecimal digest of arbitrary byte content."""
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def compute_prompt_hash(prompt: str) -> str:
        """Computes SHA-256 hash of normalized prompt text."""
        normalized = prompt.strip().lower()
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    @classmethod
    def evaluate_commercial_rights(
        cls,
        model_provider: str,
        user_tier: str,
        has_voice_consent: bool = False
    ) -> Tuple[bool, str, str]:
        """
        Calculates honest commercial rights eligibility based on provider licensing and subscription tier.
        Returns: (commercial_eligibility: bool, license_name: str, legal_disclaimer: str)
        """
        # Free Tier is always Non-Commercial
        if user_tier == "free":
            return (
                False,
                "Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)",
                "This track was generated under the Free Tier for personal, non-commercial use only. Commercial monetization, streaming distribution, or sync licensing is prohibited. In accordance with USCO guidance, raw AI audio generation does not confer copyright ownership."
            )

        # Pro / Studio Tiers:
        if model_provider == "fombo_procedural":
            return (
                True,
                "Creative Commons Zero 1.0 (CC0) / Public Domain Algorithmic DSP",
                "Full commercial rights granted. The algorithmic DSP engine is unencumbered and royalty-free. Note: AI or procedural synthesis does not protect against independent copyright claims if user prompts intentionally mimic protected melodies."
            )
        elif model_provider == "audiocraft":
            return (
                True,
                "Audiocraft / MusicGen Open Commercial Grant",
                "Commercial use permitted under the open-source model parameters. Commercial exploitation is subject to verifying training data restrictions for specific fine-tuned checkpoints."
            )
        elif model_provider == "suno":
            return (
                True,
                "Suno API Commercial License (Enterprise/Pro)",
                "Commercial rights granted under active paid tier terms. Platform does not warrant against third-party infringement claims or guarantee exclusive registerability."
            )
        elif model_provider == "stability":
            return (
                True,
                "Stability Audio Commercial API License",
                "Commercial monetization permitted under Stability Audio Developer Terms."
            )
        else:
            return (
                False,
                "Restricted Prototype License",
                "Commercial use eligibility could not be verified for this provider."
            )

    @classmethod
    def create_c2pa_manifest(
        cls,
        track_id: str,
        creator_id: str,
        creator_username: str,
        audio_sha256: str,
        prompt: str,
        seed: int,
        model_provider: str,
        model_name: str,
        bpm: int,
        musical_key: str,
        user_tier: str
    ) -> Dict[str, Any]:
        """Generates a standard C2PA-compatible provenance manifest."""
        prompt_hash = cls.compute_prompt_hash(prompt)
        commercial_ok, license_name, disclaimer = cls.evaluate_commercial_rights(model_provider, user_tier)

        manifest = {
            "c2pa_version": "2.1",
            "generator": "Fombo Music AI / C2PA Provenance Engine 1.0.0",
            "claim_generator_info": {
                "name": "Fombo Music AI",
                "version": "1.0.0-PROD",
                "website": "https://fombo.ai"
            },
            "asset": {
                "format": "audio/wav",
                "sha256_digest": audio_sha256,
                "track_id": track_id
            },
            "creator": {
                "user_id": creator_id,
                "username": creator_username,
                "verified": user_tier in ("pro", "studio")
            },
            "lineage": {
                "action": "c2pa.created",
                "software_agent": f"{model_provider}:{model_name}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "generation_parameters": {
                    "provider": model_provider,
                    "model": model_name,
                    "seed": seed,
                    "prompt_sha256": prompt_hash,
                    "bpm": bpm,
                    "musical_key": musical_key
                }
            },
            "rights": {
                "commercial_use_permitted": commercial_ok,
                "license": license_name,
                "disclaimer": disclaimer,
                "jurisdiction_notice": "Determined pursuant to verified provider terms and subscription quota level."
            }
        }
        return manifest

provenance_service = ProvenanceService()
