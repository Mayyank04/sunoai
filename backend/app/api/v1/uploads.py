from typing import Dict, Any
from fastapi import APIRouter, Depends, Request, HTTPException, Query, status
from pydantic import BaseModel
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.services.storage import storage_service

router = APIRouter(prefix="/uploads", tags=["Uploads & Storage"])

class PresignRequest(BaseModel):
    filename: str
    content_type: str = "audio/wav"
    subfolder: str = "uploads"

@router.post("/presign")
async def generate_presigned_upload_url(
    req: PresignRequest,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Generates a secure HMAC-signed upload URL for direct file upload."""
    allowed_types = ["audio/wav", "audio/mpeg", "audio/mp3", "audio/flac", "audio/ogg", "image/png", "image/jpeg"]
    if req.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported content type '{req.content_type}'. Must be audio or image."
        )

    # Prefix with user ID to avoid namespace collisions
    safe_filename = f"{current_user.id[:8]}_{req.filename}"
    return storage_service.generate_presigned_upload(
        filename=safe_filename,
        content_type=req.content_type,
        subfolder=req.subfolder
    )

@router.put("/direct/{subfolder}/{filename}")
async def handle_direct_upload(
    subfolder: str,
    filename: str,
    request: Request,
    expires: int = Query(...),
    sig: str = Query(...)
):
    """Direct upload receiver verifying HMAC signature and writing binary data to storage."""
    storage_key = f"{subfolder}/{filename}"
    if not storage_service.verify_signature(storage_key, expires, sig):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired upload signature."
        )

    body = await request.body()
    if not body:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty upload body.")

    # Save to storage
    key, access_url = storage_service.save_bytes(body, subfolder, filename)
    return {
        "status": "success",
        "storage_key": key,
        "access_url": access_url,
        "bytes_received": len(body)
    }
