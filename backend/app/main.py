import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.errors import mensaje_de_integridad
from app.core.logs import configurar_logging
from app.routers import (
    auth,
    citas,
    especialidades,
    medicamentos,
    noticias,
    pacientes,
    profesionales,
    sedes,
)
from app.services.demo import bucle_reinicio

configurar_logging()
logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Si DEMO_RESET_ENABLED está activo, lanza el reinicio periódico de la demo y lo cancela al apagar."""
    tarea = None
    if settings.demo_reset_enabled:
        tarea = asyncio.create_task(bucle_reinicio(settings.demo_reset_interval_horas))
        logger.info(
            "Reinicio periódico de la demo activado: cada %s h", settings.demo_reset_interval_horas
        )
    try:
        yield
    finally:
        if tarea is not None:
            tarea.cancel()
            await asyncio.gather(tarea, return_exceptions=True)


app = FastAPI(title="Hospital API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(IntegrityError)
async def integridad(request: Request, exc: IntegrityError):
    """Red de seguridad: un error de integridad que ningún endpoint tradujo es un conflicto (409), no un 500."""
    mensaje = mensaje_de_integridad(exc)
    if mensaje is None:
        logger.warning(
            "Error de integridad sin traducción en %s %s", request.method, request.url.path
        )
        mensaje = "Los datos entran en conflicto con los registros existentes"
    return JSONResponse(status_code=409, content={"detail": mensaje})


@app.exception_handler(Exception)
async def error_no_controlado(request: Request, exc: Exception):
    logger.error("Error no controlado en %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Responde 200 solo si la base de datos contesta; si no, 503 (para balanceadores y monitoreo)."""
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        logger.exception("La comprobación de salud no alcanza la base de datos")
        return JSONResponse(
            status_code=503, content={"status": "error", "database": "no disponible"}
        )
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(sedes.router)
app.include_router(noticias.router)
app.include_router(especialidades.router)
app.include_router(profesionales.router)
app.include_router(medicamentos.router)
app.include_router(pacientes.router)
app.include_router(citas.router)
