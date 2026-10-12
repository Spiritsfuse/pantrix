"""Runtime configuration, read from environment variables (12-factor style)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Pantrix API"
    app_version: str = "1.0.0"
    environment: str = "local"

    # Default matches docker-compose.yml. Kubernetes injects it from a Secret.
    database_url: str = "postgresql+psycopg://pantrix:pantrix@localhost:5432/pantrix"

    # Comma-separated list of browser origins allowed to call the API directly.
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # Insert demo records on startup when the tables are empty.
    seed_demo_data: bool = False

    # Days before expiry at which stock is flagged as "expiring soon".
    expiry_warning_days: int = 7

    log_level: str = "INFO"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
