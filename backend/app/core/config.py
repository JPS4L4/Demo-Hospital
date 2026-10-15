from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    # Orígenes permitidos por CORS, separados por comas (variable CORS_ORIGINS)
    cors_origins: str = "http://localhost:4200"

    # Nivel de registro de la aplicación: DEBUG, INFO, WARNING, ERROR (variable LOG_LEVEL)
    log_level: str = "INFO"

    # Límite de intentos por IP y por minuto en /auth/login y /auth/registro (cada uno con su
    # contador). Argon2 gasta CPU en cada petición, así que sin límite es fácil saturar el servidor.
    # El contador vive en la memoria de cada proceso: con varios workers el límite efectivo se multiplica.
    rate_limit_enabled: bool = True  # RATE_LIMIT_ENABLED
    rate_limit_login_por_minuto: int = Field(10, ge=1)  # RATE_LIMIT_LOGIN_POR_MINUTO
    rate_limit_registro_por_minuto: int = Field(5, ge=1)  # RATE_LIMIT_REGISTRO_POR_MINUTO
    # Solo si la API corre detrás de UN proxy de confianza que añade X-Forwarded-For (TRUSTED_PROXY):
    # entonces la IP del cliente es la última del encabezado. Activado sin proxy, cualquiera
    # podría falsear su IP y esquivar el límite.
    trusted_proxy: bool = False

    # Firma de los tokens JWT (variable JWT_SECRET). Obligatoria, mínimo 32 caracteres;
    # no tiene valor por defecto a propósito. Genera uno con: python -c "import secrets; print(secrets.token_urlsafe(48))"
    jwt_secret: str = Field(min_length=32)
    # Vigencia del token de acceso, en minutos (variable JWT_EXPIRE_MINUTES)
    jwt_expire_minutes: int = Field(60, ge=1)

    # Contraseñas de las cuentas demo que crea `python -m app.seed`. Son solo para el demo público.
    demo_admin_password: str = Field("Admin-Demo-2026", min_length=8)
    demo_patient_password: str = Field("Paciente-Demo-2026", min_length=8)

    # Reinicio periódico de la demo (variable DEMO_RESET_ENABLED): vacía la base y vuelve a sembrarla
    # cada DEMO_RESET_INTERVAL_HORAS horas. Desactivado por defecto: borra TODOS los datos.
    demo_reset_enabled: bool = False
    demo_reset_interval_horas: float = Field(6, gt=0)

    class Config:
        env_file = ".env"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
