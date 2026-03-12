from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "fyles"

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "fyles"
    minio_secure: bool = False

    anthropic_api_key: str = ""

    jwt_secret: str = "changeme-use-a-strong-random-secret-in-production"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 jours

    # Origines CORS autorisées (séparées par des virgules)
    cors_origins: str = "http://localhost:5173,http://localhost:5174,http://localhost:4173"

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
