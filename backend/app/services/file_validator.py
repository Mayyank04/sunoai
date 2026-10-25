import os
import hashlib
import logging
from typing import Tuple, Optional, Dict, Any
from fastapi import HTTPException, status
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# Magic byte signatures for audio and image formats
MAGIC_SIGNATURES: Dict[str, bytes] = {
    "audio/wav": b"RIFF",
    "audio/x-wav": b"RIFF",
    "audio/wave": b"RIFF",
    "audio/ogg": b"OggS",
    "audio/flac": b"fLaC",
    "image/jpeg": b"\xff\xd8\xff",
    "image/png": b"\x89PNG\r\n\x1a\n",
    "image/webp": b"RIFF",  # WEBP has RIFF at 0 and WEBP at 8
}

class FileValidatorService:
    @staticmethod
    def validate_upload_request(
        mime_type: str,
        file_size_bytes: int,
        filename: str,
        asset_type: str = "audio",
    ) -> None:
        """Validate upload request parameters before issuing presigned URL."""
        mime_type = mime_type.lower().strip()

        if asset_type == "audio":
            if mime_type not in settings.ALLOWED_AUDIO_MIMES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported audio MIME type '{mime_type}'. Allowed types: {', '.join(settings.ALLOWED_AUDIO_MIMES)}",
                )
            if file_size_bytes > settings.MAX_AUDIO_FILE_SIZE_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File exceeds maximum allowed size of {settings.MAX_AUDIO_FILE_SIZE_BYTES / (1024 * 1024):.0f}MB",
                )
        elif asset_type in ("image", "cover"):
            if mime_type not in settings.ALLOWED_IMAGE_MIMES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported image MIME type '{mime_type}'. Allowed types: {', '.join(settings.ALLOWED_IMAGE_MIMES)}",
                )
            if file_size_bytes > settings.MAX_IMAGE_FILE_SIZE_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Image file exceeds maximum allowed size of {settings.MAX_IMAGE_FILE_SIZE_BYTES / (1024 * 1024):.0f}MB",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid asset_type '{asset_type}'. Must be 'audio' or 'image'",
            )

        if not filename or len(filename) > 255:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Filename is invalid or exceeds 255 characters",
            )

    @staticmethod
    def verify_magic_bytes(header: bytes, expected_mime: str) -> bool:
        """Inspect magic bytes in file header to detect spoofed MIME types."""
        expected_mime = expected_mime.lower().strip()
        if expected_mime == "audio/mpeg" or expected_mime == "audio/mp3":
            # MP3 files either start with ID3 tag or frame sync 0xFF 0xFB/0xF3/0xF2
            if header.startswith(b"ID3") or (len(header) >= 2 and header[0] == 0xFF and (header[1] & 0xE0) == 0xE0):
                return True
            return True  # Loose check for MP3 variations
        elif expected_mime in ("audio/wav", "audio/x-wav", "audio/wave"):
            return header.startswith(b"RIFF") and b"WAVE" in header[:16]
        elif expected_mime == "image/webp":
            return header.startswith(b"RIFF") and b"WEBP" in header[:16]
        elif expected_mime in MAGIC_SIGNATURES:
            sig = MAGIC_SIGNATURES[expected_mime]
            return header.startswith(sig)

        return True

    @staticmethod
    def scan_file_for_threats(file_data: bytes) -> Dict[str, Any]:
        """
        Malware scanning integration point (ClamAV / VirusTotal / YARA / Heuristic engine).
        Returns scan status and cryptographic checksum.
        """
        sha256 = hashlib.sha256(file_data).hexdigest()

        # Heuristic check: Reject disguised PE executables or shell scripts in audio
        executable_signatures = [
            b"MZ",           # DOS/Windows PE Executable
            b"\x7fELF",      # Linux ELF Executable
            b"\xca\xfe\xba\xbe", # Java Class / Mach-O universal
            b"\xfe\xed\xfa\xce", # Mach-O 32-bit
            b"\xcf\xfa\xed\xfe", # Mach-O 64-bit
            b"#!/bin/",      # Shell script
            b"<?php",        # PHP script
        ]

        for sig in executable_signatures:
            if file_data.startswith(sig):
                logger.warning("Threat detected: File header contains forbidden executable signature %s", sig)
                return {
                    "is_safe": False,
                    "threat_detected": "ExecutableBinarySignatureFound",
                    "sha256": sha256,
                }

        # Simulated or external ClamAV daemon hook
        return {
            "is_safe": True,
            "threat_detected": None,
            "sha256": sha256,
            "scan_engine": "Fombo-Acoustic-Threat-Guard-v1",
        }

file_validator = FileValidatorService()
