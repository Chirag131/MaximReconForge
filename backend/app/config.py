from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    environment: str = "development"

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    database_url: str
    redis_url: str
    qdrant_host: str = "qdrant"
    qdrant_port: int = 6333

    frontend_origin: str = "http://localhost:3000"

    llm_provider: str = "anthropic"
    llm_api_key: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
