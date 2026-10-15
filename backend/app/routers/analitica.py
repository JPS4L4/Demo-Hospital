from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.core.database import get_db
from app.schemas.analitica import (
    CitasAgregadasOut,
    EstadoAnaliticaOut,
    RefrescoOut,
    ResumenOut,
)
from app.services import analitica_consultas as consultas
from app.services.analitica import (
    AnaliticaNoDisponible,
    analitica_disponible,
    refrescar_analitica,
)

# Todo el router es solo para administración (401 sin sesión, 403 si no es admin)
router = APIRouter(prefix="/analitica", tags=["Analítica"], dependencies=[Depends(require_admin)])

NO_DISPONIBLE = "La analítica no está disponible: aplica las migraciones (alembic upgrade head)"


def _exigir_vistas(db: Session) -> None:
    if not analitica_disponible(db):
        raise HTTPException(503, NO_DISPONIBLE)


def _filtros(
    desde: date | None,
    hasta: date | None,
    sede_id: int | None,
    especialidad_id: int | None,
    profesional_id: int | None = None,
    estado: str | None = None,
) -> dict:
    if desde is not None and hasta is not None and desde > hasta:
        raise HTTPException(422, "'desde' no puede ser posterior a 'hasta'")
    return {
        "desde": desde,
        "hasta": hasta,
        "sede_id": sede_id,
        "especialidad_id": especialidad_id,
        "profesional_id": profesional_id,
        "estado": estado,
    }


@router.get("/resumen", response_model=ResumenOut)
def resumen(
    desde: date | None = Query(None, description="Día inicial (inclusive, hora de Bogotá)"),
    hasta: date | None = Query(None, description="Día final (inclusive, hora de Bogotá)"),
    sede_id: int | None = None,
    especialidad_id: int | None = None,
    db: Session = Depends(get_db),
):
    filtros = _filtros(desde, hasta, sede_id, especialidad_id)
    _exigir_vistas(db)
    return consultas.resumen(db, **filtros)


@router.get("/citas", response_model=CitasAgregadasOut)
def citas_agregadas(
    agrupar: str = Query(
        ...,
        description=(
            "Una o dos dimensiones separadas por coma: "
            + ", ".join(consultas.DIMENSIONES)
            + ". Ej.: fecha.mes,especialidad"
        ),
    ),
    medida: Literal["total", "canceladas", "atendidas", "tasa_cancelacion", "duracion_media"] = (
        "total"
    ),
    desde: date | None = Query(None, description="Día inicial (inclusive, hora de Bogotá)"),
    hasta: date | None = Query(None, description="Día final (inclusive, hora de Bogotá)"),
    sede_id: int | None = None,
    especialidad_id: int | None = None,
    profesional_id: int | None = None,
    estado: Literal["programada", "cancelada", "atendida"] | None = None,
    db: Session = Depends(get_db),
):
    try:
        dimensiones = consultas.parsear_dimensiones(agrupar)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    filtros = _filtros(desde, hasta, sede_id, especialidad_id, profesional_id, estado)
    _exigir_vistas(db)
    return {
        "medida": medida,
        "agrupar": dimensiones,
        "filas": consultas.agregar_citas(db, medida, dimensiones, **filtros),
    }


@router.get("/estado", response_model=EstadoAnaliticaOut)
def estado_analitica(db: Session = Depends(get_db)):
    """Cuándo se refrescó por última vez y si la copia analítica tiene tantas citas como el OLTP."""
    _exigir_vistas(db)
    return consultas.estado(db)


@router.post("/refrescar", response_model=RefrescoOut)
def refrescar(db: Session = Depends(get_db)):
    """Refresca el modelo en estrella desde las tablas operativas (sin bloquear las lecturas)."""
    try:
        momento = refrescar_analitica(db, concurrently=True)
    except AnaliticaNoDisponible as exc:
        raise HTTPException(503, NO_DISPONIBLE) from exc
    db.commit()
    return {"refrescado_en": momento}
