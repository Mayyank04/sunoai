from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import json
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, get_optional_current_user
from backend.app.models.user import User
from backend.app.models.track import Track
from backend.app.models.provenance import Provenance, DEFAULT_DISCLAIMER
from backend.app.schemas.provenance import (
    VerifiedRightsProvenanceRecord,
    RightsDeclarationRequest,
    ProvenanceCertificateResponse,
)
from backend.app.services.provenance_service import ProvenanceService

router = APIRouter(prefix="/provenance", tags=["Provenance & Verified Rights Registry"])

@router.get("/track/{track_id}", response_model=VerifiedRightsProvenanceRecord)
async def get_verified_rights_registry(
    track_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve comprehensive Verified Rights & Provenance Registry for a track.
    Includes:
    - AI Provider & Model Checkpoint version
    - Generation timestamp & seed
    - User-supplied source assets & rights attestations
    - Dynamic commercial-use eligibility calculation
    - Edit history and C2PA cryptographic digests
    - Statutory non-infringement / copyright disclaimer
    """
    t_res = await db.execute(select(Track).where(Track.id == track_id))
    track = t_res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    res = await db.execute(select(Provenance).where(Provenance.track_id == track_id))
    prov = res.scalar_one_or_none()
    if not prov:
        # Generate registry entry on demand
        prov = await ProvenanceService.get_or_create_registry_record(
            db=db,
            track_id=track.id,
            creator_id=track.user_id,
            model_provider="fombo_procedural_dsp",
            model_version="2.4.0",
            prompt=track.title or "Procedural synthesis",
            seed=1337,
        )

    return VerifiedRightsProvenanceRecord.model_validate(prov)

@router.post("/track/{track_id}/rights-declaration", response_model=VerifiedRightsProvenanceRecord)
async def register_source_asset_rights(
    track_id: str,
    req: RightsDeclarationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Register user-supplied source asset rights declaration and re-evaluate commercial eligibility.
    Permits creators to attest ownership or commercial clearance for uploaded audio stems/samples.
    """
    t_res = await db.execute(select(Track).where(Track.id == track_id))
    track = t_res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    if track.user_id != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify rights declarations for this recording.",
        )

    res = await db.execute(select(Provenance).where(Provenance.track_id == track_id))
    prov = res.scalar_one_or_none()
    if not prov:
        prov = await ProvenanceService.get_or_create_registry_record(
            db=db,
            track_id=track.id,
            creator_id=track.user_id,
        )

    current_declarations = dict(prov.source_asset_rights_declarations or {})
    current_declarations[req.asset_id] = {
        "asset_id": req.asset_id,
        "clearance_type": req.clearance_type,
        "rights_holder_name": req.rights_holder_name,
        "attestation_statement": req.attestation_statement,
        "commercial_allowed": req.commercial_allowed,
        "declared_at": datetime.now(timezone.utc).isoformat(),
        "attesting_user_id": current_user.id,
    }

    # Re-evaluate commercial eligibility
    comm_status, comm_reasons = ProvenanceService.evaluate_commercial_eligibility(
        model_provider=prov.model_provider,
        source_declarations=current_declarations,
        tier="free" if current_user.role == "listener" else "pro",
    )

    prov.source_asset_rights_declarations = current_declarations
    prov.commercial_use_eligibility = comm_status
    prov.commercial_eligibility_reasons = comm_reasons
    prov.commercial_eligibility = (comm_status == "eligible")
    prov.verified_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(prov)
    return VerifiedRightsProvenanceRecord.model_validate(prov)

@router.get("/track/{track_id}/certificate", response_model=ProvenanceCertificateResponse)
async def get_provenance_certificate(
    track_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Issue verifiable cryptographic rights & provenance certificate.
    Provides verifiable SHA-256 digest and platform verification URL.
    """
    res = await db.execute(select(Provenance).where(Provenance.track_id == track_id))
    prov = res.scalar_one_or_none()
    if not prov:
        t_res = await db.execute(select(Track).where(Track.id == track_id))
        track = t_res.scalar_one_or_none()
        if not track:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")
        prov = await ProvenanceService.get_or_create_registry_record(
            db=db,
            track_id=track.id,
            creator_id=track.user_id,
        )

    record = VerifiedRightsProvenanceRecord.model_validate(prov)
    cert_digest = ProvenanceService.compute_sha256(
        f"{prov.id}:{prov.track_id}:{prov.output_audio_sha256}:{prov.commercial_use_eligibility}"
    )

    return ProvenanceCertificateResponse(
        certificate_id=f"CERT-{prov.id[:8].upper()}-{track_id[:8].upper()}",
        track_id=track_id,
        issued_at=datetime.now(timezone.utc),
        registry_record=record,
        sha256_digest=cert_digest,
        verification_url=f"/provenance/{track_id}/certificate",
        statutory_disclaimer=DEFAULT_DISCLAIMER,
    )

# Backward-compatible endpoint for existing modal calls
@router.get("/{track_id}", response_model=VerifiedRightsProvenanceRecord)
async def get_provenance_record_legacy(track_id: str, db: AsyncSession = Depends(get_db)):
    return await get_verified_rights_registry(track_id=track_id, db=db)
