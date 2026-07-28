from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"

    # --- Auth ---
    jwt_secret_key: str = "dev-secret-key-change-in-production-32-chars-min"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    # --- Database (Supabase Postgres) ---
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/maximreconforge"
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # --- Task queue ---
    redis_url: str = "redis://localhost:6379/0"

    # --- Frontend ---
    frontend_origin: str = "http://localhost:3000"

    # --- LLM: Groq (active) via OpenAI-compatible API ---
    groq_api_key: str = ""
    llm_default_model: str = "openai/gpt-oss-120b"
    llm_reporting_model: str = "openai/gpt-oss-120b"
    llm_fast_model: str = "openai/gpt-oss-20b"

    # --- LLM: Anthropic (future, not active yet) ---
    anthropic_api_key: str = ""

    # --- Embeddings (stub until Voyage AI key provided) ---
    voyageai_api_key: str = ""
    embedding_model: str = "voyage-3"
    embedding_dimension: int = 1024

    # --- Circuit breakers ---
    vuln_analysis_iteration_cap: int = 10
    exploitation_iteration_cap: int = 20
    vuln_analysis_token_ceiling: int = 100_000
    exploitation_token_ceiling: int = 200_000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
