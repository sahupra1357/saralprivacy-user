from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str
    ACCESS_TOKEN_SECRET: str
    REFRESH_TOKEN_SECRET: str
    ORCHESTRATOR_TOKEN_SECRET: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str
    BCRYPT_ROUNDS: int = 12
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # Injected by orchestrator — call this URL after registration to record the claiming user
    ORCHESTRATOR_CALLBACK_URL: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
