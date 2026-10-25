from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import os

class Settings(BaseSettings):
    # App Settings
    APP_ENV: str = "development"
    APP_NAME: str = "Fombo Music AI"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    SECRET_KEY: str = "fombo_super_secret_production_key_change_in_env_2026_x89"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day for convenient dev/prod use
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    # Database Settings
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_HOST: Optional[str] = None
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: Optional[str] = None

    DATABASE_URL: str = "sqlite+aiosqlite:///./fombo_music.db"
    SYNC_DATABASE_URL: str = "sqlite:///./fombo_music.db"

    # Redis & Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: Optional[str] = None
    CELERY_RESULT_BACKEND: Optional[str] = None

    # Object Storage Settings (Cloudflare R2 / AWS S3 / MinIO / Local)
    STORAGE_BACKEND: str = "local"  # 'local', 's3', 'r2'
    LOCAL_STORAGE_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../storage_data"))
    S3_ENDPOINT_URL: Optional[str] = None
    S3_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = "fombo-music-assets"
    S3_ACCESS_KEY_ID: Optional[str] = None
    S3_SECRET_ACCESS_KEY: Optional[str] = None
    S3_SIGNED_URL_EXPIRATION_SECONDS: int = 3600

    # Upload Constraints & Security
    MAX_AUDIO_FILE_SIZE_BYTES: int = 52_428_800  # 50 MB
    MAX_IMAGE_FILE_SIZE_BYTES: int = 5_242_880   # 5 MB
    ALLOWED_AUDIO_MIMES: List[str] = [
        "audio/wav",
        "audio/x-wav",
        "audio/wave",
        "audio/mpeg",
        "audio/mp3",
        "audio/ogg",
        "audio/flac",
        "audio/x-m4a",
        "audio/aac",
    ]
    ALLOWED_IMAGE_MIMES: List[str] = [
        "image/jpeg",
        "image/png",
        "image/webp",
    ]
    ENABLE_MALWARE_SCANNING: bool = True

    # Rate Limiting & Idempotency
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 120
    IDEMPOTENCY_CACHE_TTL_SECONDS: int = 86400  # 24 hours

    # Job Engine Policies
    DEFAULT_JOB_TIMEOUT_SECONDS: int = 300
    MAX_JOB_RETRIES: int = 3
    JOB_RETRY_BACKOFF_SECONDS: float = 2.0

    # Model Provider & Inference Configurations
    ENABLE_PROCEDURAL_SYNTH: bool = True
    ACE_STEP_SERVICE_URL: Optional[str] = None
    ACE_STEP_WEIGHTS_PATH: Optional[str] = None
    ACE_STEP_API_TOKEN: Optional[str] = None
    ACE_STEP_MODEL_REVISION: str = "v1.5.0-openweight"
    HEARTMULA_SERVICE_URL: Optional[str] = None
    AUDIOCRAFT_SERVICE_URL: Optional[str] = None
    REPLICATE_API_TOKEN: Optional[str] = None
    SUNO_API_URL: Optional[str] = None
    SUNO_API_KEY: Optional[str] = None
    STABILITY_API_KEY: Optional[str] = None
    DEMUCS_SERVICE_URL: Optional[str] = None
    VOICE_SYNTH_SERVICE_URL: Optional[str] = None

    # Moderation & Safety
    MODERATION_STRICT_MODE: bool = True
    BANNED_ARTIST_NAMES: str = (
        "Taylor Swift,Drake,Beyonce,Beatles,Eminem,The Weeknd,Ed Sheeran,Michael Jackson,Billie Eilish"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def get_database_url(self) -> str:
        if self.POSTGRES_USER and self.POSTGRES_PASSWORD and self.POSTGRES_HOST and self.POSTGRES_DB:
            return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        return self.DATABASE_URL

    def get_sync_database_url(self) -> str:
        if self.POSTGRES_USER and self.POSTGRES_PASSWORD and self.POSTGRES_HOST and self.POSTGRES_DB:
            return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        return self.SYNC_DATABASE_URL

    @property
    def effective_celery_broker(self) -> str:
        return self.CELERY_BROKER_URL or self.REDIS_URL

    @property
    def effective_celery_backend(self) -> str:
        return self.CELERY_RESULT_BACKEND or self.REDIS_URL

    @property
    def banned_artists_list(self) -> List[str]:
        return [name.strip().lower() for name in self.BANNED_ARTIST_NAMES.split(",") if name.strip()]

settings = Settings()
