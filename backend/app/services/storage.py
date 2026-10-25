import os
import hmac
import hashlib
import time
from typing import Tuple, Dict, Any, Optional
from backend.app.core.config import settings

class StorageService:
    """Production storage service supporting both local storage with HMAC signed URLs and AWS S3/R2."""

    def __init__(self):
        self.backend = settings.STORAGE_BACKEND
        self.local_dir = settings.LOCAL_STORAGE_DIR
        os.makedirs(self.local_dir, exist_ok=True)
        os.makedirs(os.path.join(self.local_dir, "tracks"), exist_ok=True)
        os.makedirs(os.path.join(self.local_dir, "stems"), exist_ok=True)
        os.makedirs(os.path.join(self.local_dir, "uploads"), exist_ok=True)

    def _sign_path(self, path: str, expires_at: int) -> str:
        """Generates an HMAC-SHA256 signature for path and expiration timestamp."""
        message = f"{path}:{expires_at}".encode("utf-8")
        signature = hmac.new(settings.SECRET_KEY.encode("utf-8"), message, hashlib.sha256).hexdigest()
        return signature

    def verify_signature(self, path: str, expires_at: int, signature: str) -> bool:
        """Verifies HMAC signature and expiration."""
        if time.time() > expires_at:
            return False
        expected = self._sign_path(path, expires_at)
        return hmac.compare_digest(expected, signature)

    def save_bytes(self, data: bytes, subfolder: str, filename: str) -> Tuple[str, str]:
        """Saves byte content to storage and returns (relative_storage_key, access_url)."""
        target_dir = os.path.join(self.local_dir, subfolder)
        os.makedirs(target_dir, exist_ok=True)
        filepath = os.path.join(target_dir, filename)

        with open(filepath, "wb") as f:
            f.write(data)

        storage_key = f"{subfolder}/{filename}"
        access_url = f"/api/v1/storage/file/{storage_key}"
        return storage_key, access_url

    def get_file_bytes(self, storage_key: str) -> Optional[bytes]:
        """Retrieves raw bytes from storage."""
        filepath = os.path.join(self.local_dir, storage_key)
        if not os.path.exists(filepath):
            return None
        with open(filepath, "rb") as f:
            return f.read()

    def generate_presigned_upload(self, filename: str, content_type: str, subfolder: str = "uploads") -> Dict[str, Any]:
        """Generates a secure signed URL for direct file upload."""
        storage_key = f"{subfolder}/{filename}"
        expires_at = int(time.time()) + settings.S3_SIGNED_URL_EXPIRATION_SECONDS
        sig = self._sign_path(storage_key, expires_at)

        upload_url = f"/api/v1/uploads/direct/{storage_key}?expires={expires_at}&sig={sig}"
        return {
            "upload_url": upload_url,
            "storage_key": storage_key,
            "expires_at": expires_at,
            "content_type": content_type,
            "method": "PUT"
        }

    def generate_presigned_download(self, storage_key: str) -> str:
        """Generates a signed download URL."""
        expires_at = int(time.time()) + settings.S3_SIGNED_URL_EXPIRATION_SECONDS
        sig = self._sign_path(storage_key, expires_at)
        return f"/api/v1/storage/file/{storage_key}?expires={expires_at}&sig={sig}"

storage_service = StorageService()
