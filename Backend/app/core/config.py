from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "VoiceX AI Backend"
    app_version: str = "0.1.0"
    app_env: str = "development"
    host: str = "127.0.0.1"
    port: int = 8000
    frontend_origins: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://localhost:3000,"
        "http://127.0.0.1:3000"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.frontend_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
