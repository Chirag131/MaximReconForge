from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = "development"

    # --- Auth ---
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    # --- Database (Supabase Postgres) ---
    database_url: str
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # --- Task queue ---
    redis_url: str

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

    class Config:
        env_file = ".env"


settings = Settings()
