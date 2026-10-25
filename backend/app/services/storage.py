import os
import uuid
import logging
from typing import Optional, Dict, Any, Tuple
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        self.backend = settings.STORAGE_BACKEND
        self.bucket = settings.S3_BUCKET_NAME
        self.local_dir = settings.LOCAL_STORAGE_DIR
        os.makedirs(self.local_dir, exist_ok=True)
        os.makedirs(os.path.join(self.local_dir, "uploads"), exist_ok=True)
        os.makedirs(os.path.join(self.local_dir, "tracks"), exist_ok=True)
        os.makedirs(os.path.join(self.local_dir, "stems"), exist_ok=True)
        os.makedirs(os.path.join(self.local_dir, "covers"), exist_ok=True)

        self._s3_client = None
        if self.backend in ("s3", "r2") and settings.S3_ACCESS_KEY_ID and settings.S3_SECRET_ACCESS_KEY:
            try:
                import boto3
                from botocore.config import Config

                self._s3_client = boto3.client(
                    "s3",
                    endpoint_url=settings.S3_ENDPOINT_URL,
                    region_name=settings.S3_REGION,
                    aws_access_key_id=settings.S3_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
                    config=Config(signature_version="s3v4"),
                )
                logger.info("Initialized S3/R2 client for bucket '%s'", self.bucket)
            except Exception as e:
                logger.warning("Could not initialize S3 client: %s. Using local storage.", e)
                self.backend = "local"

    def generate_presigned_upload_url(
        self,
        user_id: str,
        filename: str,
        mime_type: str,
        asset_category: str = "uploads",
        expires_in: int = 3600,
    ) -> Dict[str, Any]:
        """
        Generate presigned upload URL and S3 key.
        Never stores binary audio in PostgreSQL.
        """
        ext = os.path.splitext(filename)[1].lower() or ".wav"
        file_uuid = str(uuid.uuid4())
        s3_key = f"{asset_category}/{user_id}/{file_uuid}{ext}"

        if self._s3_client:
            try:
                presigned_url = self._s3_client.generate_presigned_url(
                    ClientMethod="put_object",
                    Params={
                        "Bucket": self.bucket,
                        "Key": s3_key,
                        "ContentType": mime_type,
                    },
                    ExpiresIn=expires_in,
                )
                return {
                    "upload_url": presigned_url,
                    "s3_key": s3_key,
                    "s3_bucket": self.bucket,
                    "storage_backend": self.backend,
                    "file_id": file_uuid,
                    "expires_in": expires_in,
                    "public_url": f"{settings.S3_ENDPOINT_URL or ''}/{self.bucket}/{s3_key}",
                }
            except Exception as e:
                logger.error("Failed to generate S3 presigned URL: %s", e)

        # Local storage fallback
        local_path = os.path.join(self.local_dir, s3_key)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        return {
            "upload_url": f"/api/v1/storage/upload?key={s3_key}",
            "s3_key": s3_key,
            "s3_bucket": "local-disk",
            "storage_backend": "local",
            "file_id": file_uuid,
            "expires_in": expires_in,
            "public_url": f"/api/v1/storage/file/{s3_key}",
        }

    def generate_presigned_download_url(
        self, s3_key: str, expires_in: int = 3600
    ) -> str:
        """Generate presigned download URL with access token expiration."""
        if self._s3_client:
            try:
                return self._s3_client.generate_presigned_url(
                    ClientMethod="get_object",
                    Params={
                        "Bucket": self.bucket,
                        "Key": s3_key,
                    },
                    ExpiresIn=expires_in,
                )
            except Exception as e:
                logger.error("Failed to generate S3 download URL: %s", e)

        return f"/api/v1/storage/file/{s3_key}"

    def get_local_path(self, s3_key: str) -> str:
        return os.path.join(self.local_dir, s3_key)

    def get_file_bytes(self, s3_key: str) -> bytes:
        """Read file bytes from S3 or local storage."""
        if self._s3_client:
            try:
                resp = self._s3_client.get_object(Bucket=self.bucket, Key=s3_key)
                return resp["Body"].read()
            except Exception as e:
                logger.error("Failed to read S3 object %s: %s", s3_key, e)

        local_path = self.get_local_path(s3_key)
        if os.path.exists(local_path):
            with open(local_path, "rb") as f:
                return f.read()
        raise FileNotFoundError(f"Storage asset '{s3_key}' not found.")

    def delete_file(self, s3_key: str) -> bool:
        if self._s3_client:
            try:
                self._s3_client.delete_object(Bucket=self.bucket, Key=s3_key)
                return True
            except Exception as e:
                logger.error("Failed to delete S3 object %s: %s", s3_key, e)
                return False

        local_path = self.get_local_path(s3_key)
        if os.path.exists(local_path):
            try:
                os.remove(local_path)
                return True
            except Exception as e:
                logger.error("Failed to delete local file %s: %s", local_path, e)
        return False

    def generate_presigned_upload(
        self, filename: str, content_type: str = "audio/wav", subfolder: str = "uploads", expires_in: int = 3600
    ) -> Dict[str, Any]:
        """Generates an HMAC-signed local/direct upload URL for backwards-compatible test endpoints."""
        import hmac
        import time

        expires = int(time.time()) + expires_in
        storage_key = f"{subfolder}/{filename}"
        message = f"{storage_key}:{expires}"
        sig = hmac.new(settings.SECRET_KEY.encode(), message.encode(), "sha256").hexdigest()

        return {
            "upload_url": f"/api/v1/uploads/direct/{subfolder}/{filename}?expires={expires}&sig={sig}",
            "storage_key": storage_key,
            "expires": expires,
            "content_type": content_type,
        }

    def verify_signature(self, storage_key: str, expires: int, sig: str) -> bool:
        """Verify HMAC signature for direct uploads."""
        import hmac
        import time

        if time.time() > expires:
            return False
        message = f"{storage_key}:{expires}"
        expected_sig = hmac.new(settings.SECRET_KEY.encode(), message.encode(), "sha256").hexdigest()
        return hmac.compare_digest(sig, expected_sig)

    def save_bytes(self, data: bytes, subfolder: str, filename: str) -> Tuple[str, str]:
        """Save raw bytes to storage and return storage key and URL."""
        storage_key = f"{subfolder}/{filename}"
        if self._s3_client:
            self._s3_client.put_object(Bucket=self.bucket, Key=storage_key, Body=data, ContentType="audio/wav")
            return storage_key, self.generate_presigned_download_url(storage_key)
        local_path = self.get_local_path(storage_key)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(data)
        access_url = f"/api/v1/storage/file/{storage_key}"
        return storage_key, access_url

storage_service = StorageService()
