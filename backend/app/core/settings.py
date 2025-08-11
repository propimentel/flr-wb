import os
from typing import Optional

from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    """Application settings using Pydantic BaseSettings."""

    # Firebase settings
    firebase_project_id: str = ""
    firebase_auth_domain: str = ""
    firebase_storage_bucket: str = ""
    firebase_messaging_sender_id: str = ""
    firebase_app_id: str = ""
    firebase_measurement_id: str = ""
    firebase_service_account_path: Optional[str] = None

    # GCP Storage settings
    gcp_bucket_name: str = ""
    max_files_per_user: int = 5
    max_file_size_mb: int = 10

    # Cleanup settings
    retention_days: int = 15
    service_cleanup_key: str = ""

    # API settings
    api_prefix: str = "/api"
    debug: bool = False

    # CORS settings - in production, allow all origins by default
    allowed_origins: list[str] = ["*"]

    # Server settings
    host: str = "0.0.0.0"
    port: int = int(os.getenv("PORT", "4000"))

    class Config:
        env_file = [".env"]
        env_file_encoding = "utf-8"


# Global settings instance
settings = Settings()
