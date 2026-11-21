"""
Application configuration using Pydantic Settings
"""
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


def _find_project_root() -> Path:
    """Locate the folder containing ml_models/ (repo root locally, /app in Docker)"""
    for parent in Path(__file__).resolve().parents:
        if (parent / "ml_models").is_dir():
            return parent
    return Path.cwd()


PROJECT_ROOT = _find_project_root()
DEFAULT_SECRET_KEY = "change-this-secret-key-in-production"


# Loopback and private-network origins (any port): localhost, 127.0.0.1, [::1], 10/8, 172.16/12, 192.168/16
DEV_ORIGIN_PATTERN = (
    r"^https?://(localhost|127\.0\.0\.1|\[::1\]|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}"
    r"|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})(:\d+)?$"
)


class Settings(BaseSettings):
    """Application settings"""

    model_config = SettingsConfigDict(
        # The repo-root .env, also when uvicorn is started from backend/ (Docker passes env vars instead)
        env_file=PROJECT_ROOT / ".env",
        case_sensitive=True,
        extra="ignore",  # Ignore extra fields from frontend .env
    )

    # Application
    APP_NAME: str = "DeepSea eDNA AI Backend"
    APP_VERSION: str = "2.2.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # "production" enforces a real SECRET_KEY

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000  # Frontend dev server uses 3000
    WORKERS: int = 1

    # Public URLs (used for OAuth redirects)
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_PUBLIC_URL: str = "http://localhost:8000"

    # Database: SQLite file for local dev/tests, PostgreSQL in docker-compose
    DATABASE_URL: str = f"sqlite:///{(PROJECT_ROOT / 'data' / 'deepsea.db').as_posix()}"
    REDIS_URL: str = "redis://localhost:6379/0"

    # File Storage
    UPLOAD_DIR: str = str(PROJECT_ROOT / "data" / "uploads")
    STATE_DIR: str = str(PROJECT_ROOT / "data" / "state")  # Model registry & experiments
    MODEL_DIR: str = str(PROJECT_ROOT / "ml_models")  # Parent folder; DEFAULT_MODEL is a subfolder
    MAX_UPLOAD_SIZE: int = 524288000  # 500MB

    # Deep Learning
    DEFAULT_MODEL: str = "marine_model"  # Bundled model folder inside MODEL_DIR
    MODEL_DEVICE: str = "cpu"  # "cuda" falls back to cpu if no GPU is available
    MAX_SEQUENCE_LENGTH: int = 1000  # model input size; also the longest read /api/predict accepts

    # Model source: "mlflow" (registry only, fail if unavailable), "local" (bundled files)
    # or "auto" (MLflow when MLFLOW_TRACKING_URI is set, otherwise/fallback local)
    MODEL_SOURCE: str = "auto"

    # MLflow (inside Docker use the service name or host.docker.internal, never localhost)
    MLFLOW_TRACKING_URI: str = ""
    MLFLOW_EXPERIMENT: str = "marine-edna-classification"
    MLFLOW_MODEL_NAME: str = "marine-edna-classifier"
    MLFLOW_MODEL_ALIAS: str = "champion"

    # Security
    SECRET_KEY: str = DEFAULT_SECRET_KEY
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ADMIN_EMAILS: str = ""  # Comma-separated; these accounts are always admins
    LOGIN_RATE_LIMIT_PER_MINUTE: int = 10
    # Header carrying the real client IP when behind a trusted proxy (e.g. cloudfront-viewer-address)
    TRUSTED_PROXY_HEADER: str = ""

    # OAuth providers (leave blank to hide the button)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        """CORS_ORIGINS plus FRONTEND_URL, deduplicated"""
        origins = [o.strip().rstrip("/") for o in self.CORS_ORIGINS.split(",") if o.strip()]
        frontend = self.FRONTEND_URL.rstrip("/")
        return origins if frontend in origins else [*origins, frontend]

    @property
    def cors_origin_regex(self) -> Optional[str]:
        """In development, also accept the frontend from this machine's other addresses (127.0.0.1, LAN IP)."""
        return None if self.is_production else DEV_ORIGIN_PATTERN

    @property
    def admin_emails(self) -> set:
        return {e.strip().lower() for e in self.ADMIN_EMAILS.split(",") if e.strip()}

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    # Logging
    LOG_LEVEL: str = "INFO"

    def validate_for_runtime(self):
        """Refuse to run a production deployment with insecure defaults"""
        if self.is_production:
            if self.SECRET_KEY == DEFAULT_SECRET_KEY or len(self.SECRET_KEY) < 32:
                raise RuntimeError(
                    "SECRET_KEY must be set to a random value of at least 32 characters in production "
                    "(e.g. python -c \"import secrets; print(secrets.token_urlsafe(48))\")"
                )


settings = Settings()
