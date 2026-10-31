from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Read from environment variables (see ../.env.example). No secrets in code."""

    model_config = SettingsConfigDict(env_prefix="COACH_")

    # Ollama on this laptop. In Docker, host.docker.internal reaches the Mac's own
    # Ollama (fast, uses the GPU); http://ollama:11434 uses the compose container.
    ollama_url: str = "http://localhost:11434"
    model: str = "qwen2.5:7b"
    timeout_seconds: float = 60.0
    # Web demo only: comma-separated browser origins, e.g. http://localhost:8081.
    cors_origins: str = ""
    # Where crisis_terms.json lives; empty = the repo's content/ folder.
    content_dir: str = ""


settings = Settings()
