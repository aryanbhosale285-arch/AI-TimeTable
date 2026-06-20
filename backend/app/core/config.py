from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Defaults to a local SQLite file so the app runs with zero external setup.
    # Docker Compose overrides this with a Postgres URL via the DATABASE_URL env var.
    DATABASE_URL: str = "sqlite:///./timetable.db"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    class Config:
        env_file = ".env"


settings = Settings()
