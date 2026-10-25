import os
from fastapi import APIRouter, Request, HTTPException, status
from fastapi.responses import Response
from backend.app.core.config import settings

router = APIRouter(prefix="/storage", tags=["Storage Media Serving"])

@router.get("/file/{file_path:path}")
async def serve_media_file(file_path: str, request: Request):
    """
    Streams stored audio and media assets supporting HTTP 206 Partial Content (Range requests).
    Critical for Web Audio streaming, persistent players, and waveform scrubbing.
    """
    base_dir = os.path.abspath(settings.LOCAL_STORAGE_DIR)
    filepath = os.path.abspath(os.path.join(base_dir, file_path))
    if not filepath.startswith(base_dir):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")

    file_size = os.path.getsize(filepath)
    filename = os.path.basename(filepath)
    content_type = "audio/wav" if filename.endswith(".wav") else ("audio/mpeg" if filename.endswith(".mp3") else "application/octet-stream")

    range_header = request.headers.get("range")
    if range_header:
        # Parse range header: "bytes=start-end"
        try:
            byte_range = range_header.replace("bytes=", "").split("-")
            start = int(byte_range[0])
            end = int(byte_range[1]) if byte_range[1] else file_size - 1
            length = (end - start) + 1

            with open(filepath, "rb") as f:
                f.seek(start)
                data = f.read(length)

            headers = {
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(length),
                "Content-Type": content_type,
            }
            return Response(content=data, status_code=206, headers=headers)
        except Exception:
            pass

    # Full content response
    with open(filepath, "rb") as f:
        data = f.read()

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Type": content_type,
    }
    return Response(content=data, status_code=200, headers=headers)
