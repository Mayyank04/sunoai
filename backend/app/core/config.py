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
    DATABASE_URL: str = "sqlite+aiosqlite:///./fombo_music.db"
    SYNC_DATABASE_URL: str = "sqlite:///./fombo_music.db"

    # Redis & Celery
    REDIS_URL: Optional[str] = None
    CELERY_BROKER_URL: Optional[str] = None

    # Object Storage Settings
    STORAGE_BACKEND: str = "local"  # 'local' or 's3'
    LOCAL_STORAGE_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../storage_data"))
    S3_ENDPOINT_URL: Optional[str] = None
    S3_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = "fombo-music-assets"
    S3_ACCESS_KEY_ID: Optional[str] = None
    S3_SECRET_ACCESS_KEY: Optional[str] = None
    S3_SIGNED_URL_EXPIRATION_SECONDS: int = 3600

    # Model Provider & Inference Configurations
    ENABLE_PROCEDURAL_SYNTH: bool = True
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

    @property
    def banned_artists_list(self) -> List[str]:
        return [name.strip().lower() for name in self.BANNED_ARTIST_NAMES.split(",") if name.strip()]

settings = Settings()
