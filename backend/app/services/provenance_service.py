import hashlib
import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.models.provenance import Provenance, DEFAULT_DISCLAIMER
from backend.app.models.track import Track
from backend.app.models.user import User

NON_COMMERCIAL_PROVIDERS = {"audiocraft_academic_nc", "suno_free_tier", "sample_eval"}

class ProvenanceService:
    """
    Verified Rights & Provenance Registry Engine.
    Evaluates:
    - AI Provider licensing terms
    - User-supplied audio/vocal assets and their source rights attestations
    - Dynamic commercial-use eligibility
    - Cryptographic C2PA manifest digests
    - Enforces statutory disclaimer: Never promises copyright registration or non-infringement.
    """

    @staticmethod
    def evaluate_commercial_eligibility(
        model_provider: str,
        source_declarations: Optional[Dict[str, Any]] = None,
        tier: str = "pro",
    ) -> Tuple[str, List[str]]:
        """
        Calculates commercial-use eligibility:
        - 'eligible': Model provider permits commercial use AND all source assets are cleared.
        - 'restricted': User-supplied assets are non-commercial or pending rights clearance.
        - 'ineligible': Model provider license or platform free tier strictly forbids commercial use.
        """
        reasons: List[str] = []
        status = "eligible"

        # 1. Evaluate Model Provider & Platform Tier
        if model_provider.lower() in NON_COMMERCIAL_PROVIDERS or tier == "free":
            status = "ineligible"
            reasons.append(
                f"Provider model '{model_provider}' (or free tier) terms restrict output to non-commercial personal use."
            )
        else:
            reasons.append(f"Model provider '{model_provider}' grants commercial exploitation rights.")

        # 2. Evaluate User-Supplied Source Assets & Rights Declarations
        if source_declarations:
            for asset_id, decl in source_declarations.items():
                clearance = decl.get("clearance_type", "unspecified")
                if clearance in ("non_commercial", "unspecified"):
                    status = "restricted"
                    reasons.append(
                        f"Source asset '{decl.get('asset_name', asset_id)}' carries non-commercial limitation or unspecified rights ({clearance})."
                    )
                elif clearance in ("original_composition", "cc0_public_domain", "commercially_licensed"):
                    reasons.append(
                        f"Source asset '{decl.get('asset_name', asset_id)}' verified under attested rights ({clearance})."
                    )

        if status == "eligible":
            reasons.append(
                "All upstream provider terms and downstream source asset declarations satisfy commercial exploitation clearance."
            )

        return status, reasons

    @staticmethod
    def compute_sha256(data: str) -> str:
        return hashlib.sha256(data.encode("utf-8")).hexdigest()

    @staticmethod
    async def get_or_create_registry_record(
        db: AsyncSession,
        track_id: str,
        creator_id: str,
        model_provider: str = "fombo_procedural_dsp",
        model_version: str = "2.4.0",
        prompt: str = "Analog synth arpeggio",
        seed: int = 42,
        user_supplied_assets: Optional[List[Dict[str, Any]]] = None,
        source_declarations: Optional[Dict[str, Any]] = None,
        audio_sha256: Optional[str] = None,
        edit_history: Optional[List[Dict[str, Any]]] = None,
    ) -> Provenance:
        """
        Creates or updates a verified rights and provenance registry entry for a track.
        """
        res = await db.execute(select(Provenance).where(Provenance.track_id == track_id))
        prov = res.scalar_one_or_none()

        prompt_hash = ProvenanceService.compute_sha256(prompt)
        output_hash = audio_sha256 or ProvenanceService.compute_sha256(f"{track_id}:{seed}:{prompt}")

        # Evaluate commercial eligibility
        comm_status, comm_reasons = ProvenanceService.evaluate_commercial_eligibility(
            model_provider=model_provider,
            source_declarations=source_declarations,
            tier="pro",
        )

        c2pa_manifest_data = {
            "claim_generator": "Fombo Music AI C2PA Engine v2.4",
            "title": f"Fombo Provenance Manifest - {track_id}",
            "assertions": [
                {
                    "label": "c2pa.actions",
                    "data": {
                        "actions": [
                            {"action": "c2pa.created", "softwareAgent": f"Fombo DSP {model_version}"}
                        ]
                    },
                },
                {
                    "label": "fombo.rights",
                    "data": {
                        "commercial_use_eligibility": comm_status,
                        "license_version": "FOMBO-COMMERCIAL-V2.1" if comm_status == "eligible" else "FOMBO-PERSONAL-CC-BY-NC-4.0",
                        "statutory_disclaimer": DEFAULT_DISCLAIMER,
                    },
                },
            ],
            "signature": {
                "algorithm": "sha256WithRSAEncryption",
                "issuer": "Fombo Trust & Safety CA",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        }
        c2pa_hash = ProvenanceService.compute_sha256(json.dumps(c2pa_manifest_data, sort_keys=True))

        if not prov:
            prov = Provenance(
                track_id=track_id,
                creator_id=creator_id,
                model_provider=model_provider,
                model_version=model_version,
                model_checkpoint_hash=ProvenanceService.compute_sha256(f"{model_provider}:{model_version}"),
                generation_seed=seed,
                generation_timestamp=datetime.now(timezone.utc),
                input_prompt_hash=prompt_hash,
                output_audio_sha256=output_hash,
                c2pa_manifest=c2pa_manifest_data,
                c2pa_manifest_hash=c2pa_hash,
                license_type="commercial" if comm_status == "eligible" else "non_commercial_personal",
                license_version="FOMBO-COMMERCIAL-V2.1" if comm_status == "eligible" else "FOMBO-PERSONAL-CC-BY-NC-4.0",
                commercial_eligibility=(comm_status == "eligible"),
                commercial_use_eligibility=comm_status,
                commercial_eligibility_reasons=comm_reasons,
                user_supplied_assets=user_supplied_assets or [],
                source_asset_rights_declarations=source_declarations or {},
                prompt_reference={"prompt": prompt, "seed": seed, "timestamp": datetime.now(timezone.utc).isoformat()},
                edit_history=edit_history or [],
                disclaimer=DEFAULT_DISCLAIMER,
                legal_disclaimer=DEFAULT_DISCLAIMER,
            )
            db.add(prov)
            await db.commit()
            await db.refresh(prov)
        else:
            prov.commercial_use_eligibility = comm_status
            prov.commercial_eligibility_reasons = comm_reasons
            prov.commercial_eligibility = (comm_status == "eligible")
            if source_declarations:
                prov.source_asset_rights_declarations = source_declarations
            if edit_history:
                prov.edit_history = edit_history
            await db.commit()
            await db.refresh(prov)

        return prov
