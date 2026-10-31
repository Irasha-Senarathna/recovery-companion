from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Read from environment variables (see ../.env.example). No secrets in code."""

    model_config = SettingsConfigDict(env_prefix="SERVER_")

    # Either a full URL (tests, local runs) or, in Docker, the parts below. The parts
    # are joined with proper escaping, so passwords may contain any character.
    database_url: str = ""
    db_host: str = "localhost"
    db_name: str = "recovery_companion"
    db_user: str = ""
    db_password: str = ""
    enable_docs: bool = False
    # Off until FCM is set up for the Expo project; supporters then see requests in the app.
    push_enabled: bool = False
    # Web demo only: comma-separated browser origins, e.g. http://localhost:8081.
    cors_origins: str = ""


settings = Settings()
