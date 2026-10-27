from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Read from environment variables (see ../.env.example). No secrets in code."""

    model_config = SettingsConfigDict(env_prefix="SERVER_")

    database_url: str = "postgresql://localhost/recovery_companion"
    enable_docs: bool = False


settings = Settings()
