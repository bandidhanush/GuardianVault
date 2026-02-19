import os
import secrets
from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).parent


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite:///./accident_detection.db"

    # Twilio
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""
    ALERT_TO_NUMBER: str = "+917330633070"

    # Encryption - 32-byte AES key (generate once, store securely)
    ENCRYPTION_KEY: str = secrets.token_hex(16)  # 32 hex chars = 16 bytes; use env override

    # Storage
    STORAGE_PATH: str = str(BASE_DIR / "storage")

    # ML
    MODEL_CONFIDENCE_THRESHOLD: float = 0.55
    ACCIDENT_MODEL_PATH: str = str(BASE_DIR / "ml" / "models" / "accident_classifier.pt")
    SEVERITY_MODEL_PATH: str = str(BASE_DIR / "ml" / "models" / "severity_classifier.pt")

    # App
    APP_NAME: str = "Road Accident Detection & Emergency Alert System"
    VERSION: str = "1.0.0"
    DEBUG: bool = True

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Ensure storage directories exist
for subdir in ["encrypted_videos", "thumbnails", "temp"]:
    os.makedirs(os.path.join(settings.STORAGE_PATH, subdir), exist_ok=True)
