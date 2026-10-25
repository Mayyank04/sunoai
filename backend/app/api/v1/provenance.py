from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.core.database import get_db
from backend.app.models.provenance import Provenance
from backend.app.schemas.other import ProvenanceResponse

router = APIRouter(prefix="/provenance", tags=["Provenance & Rights Registry"])

@router.get("/{track_id}", response_model=ProvenanceResponse)
async def get_provenance_record(track_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieves C2PA manifest, seed provenance, audio hash and license terms for a track."""
    result = await db.execute(select(Provenance).where(Provenance.track_id == track_id))
    prov = result.scalar_one_or_none()
    if not prov:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provenance record for track '{track_id}' not found."
        )

    return ProvenanceResponse.model_validate(prov)
