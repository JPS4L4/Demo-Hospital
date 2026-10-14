from pydantic import Field
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    # Orígenes permitidos por CORS, separados por comas (variable CORS_ORIGINS)
    cors_origins: str = "http://localhost:4200"

    # Firma de los tokens JWT (variable JWT_SECRET). Obligatoria, mínimo 32 caracteres;
    # no tiene valor por defecto a propósito. Genera uno con: python -c "import secrets; print(secrets.token_urlsafe(48))"
    jwt_secret: str = Field(min_length=32)
    # Vigencia del token de acceso, en minutos (variable JWT_EXPIRE_MINUTES)
    jwt_expire_minutes: int = Field(60, ge=1)

    # Contraseñas de las cuentas demo que crea `python -m app.seed`. Son solo para el demo público.
    demo_admin_password: str = Field("Admin-Demo-2026", min_length=8)
    demo_patient_password: str = Field("Paciente-Demo-2026", min_length=8)

    class Config:
        env_file = ".env"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

settings = Settings()
