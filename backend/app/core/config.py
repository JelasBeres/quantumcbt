from functools import lru_cache
from pathlib import Path
import os
import warnings

from dotenv import load_dotenv
from sqlalchemy.engine import make_url

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")


def _is_production_env() -> bool:
    app_env = os.getenv("APP_ENV") or os.getenv("ENV") or os.getenv("ENVIRONMENT") or ""
    normalized = app_env.strip().lower()
    return normalized in ("production", "prod")


class Settings:
    def __init__(self):
        self.database_url = self._load_database_url()
        self.secret_key = self._load_secret_key()
        self.access_token_expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
        self.cors_origins = self._load_cors_origins()
        self.allowed_hosts = self._load_allowed_hosts()
        self.app_env = os.getenv("APP_ENV", "development").strip().lower()
        self.is_production = self.app_env == "production"

    def _load_secret_key(self) -> str:
        secret_key = os.getenv("SECRET_KEY", "").strip()
        if _is_production_env() and (not secret_key or len(secret_key) < 32 or secret_key == "dev-secret"):
            raise ValueError(
                "SECRET_KEY is required in production and must be at least 32 characters "
                "and not use the default value"
            )
        return secret_key or "dev-secret"

    def _load_allowed_hosts(self) -> list[str]:
        raw = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,testserver")
        return [host.strip() for host in raw.split(",") if host.strip()]

    def _load_cors_origins(self) -> list[str]:
        raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000")
        origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
        
        # FIXED: Validate CORS origins properly (not just filter cloudflare)
        import re
        valid_origins = []
        url_pattern = re.compile(r'^https?://[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*(:[0-9]{1,5})?$')
        
        for origin in origins:
            if origin.startswith("javascript:") or origin.startswith("data:"):
                continue
            # Validate URL format
            if url_pattern.match(origin):
                valid_origins.append(origin)
            else:
                warnings.warn(f"Invalid CORS origin ignored: {origin}", stacklevel=2)
        
        return valid_origins

    def _load_database_url(self) -> str:
        database_url = os.getenv("DATABASE_URL", "sqlite:///./dev.db")
        if database_url.startswith("postgresql"):
            try:
                make_url(database_url)
            except Exception as exc:
                raise ValueError(f"Invalid DATABASE_URL: {exc}") from exc
        return database_url


@lru_cache()
def get_settings() -> Settings:
    return Settings()
