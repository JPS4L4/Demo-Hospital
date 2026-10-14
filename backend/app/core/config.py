from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    # Orígenes permitidos por CORS, separados por comas (variable CORS_ORIGINS)
    cors_origins: str = "http://localhost:4200"

    class Config:
        env_file = ".env"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

settings = Settings()
