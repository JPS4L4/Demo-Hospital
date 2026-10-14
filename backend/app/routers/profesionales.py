from datetime import date, datetime
from typing import get_args

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.core.database import get_db
from app.core.errors import guardar, obtener_o_404
from app.core.pagination import Page, PageParams, escapar_like, paginar
from app.models.especialidad import Especialidad
from app.models.profesional import Profesional
from app.models.sede import Sede
from app.schemas.cita import DisponibilidadOut, Duracion
from app.schemas.profesional import ProfesionalBase, ProfesionalOut
from app.services import citas as reglas

router = APIRouter(prefix="/profesionales", tags=["Profesionales"])

NO_ENCONTRADO = "Profesional no encontrado"
UNICOS = {"uq_profesionales_registro": "Ya existe un profesional con ese registro profesional"}
EN_USO = "No se puede eliminar el profesional: tiene citas asociadas"


def _validar_referencias(db: Session, datos: ProfesionalBase) -> None:
    if db.get(Especialidad, datos.especialidad_id) is None:
        raise HTTPException(422, "La especialidad indicada no existe")
    if db.get(Sede, datos.sede_id) is None:
        raise HTTPException(422, "La sede indicada no existe")


@router.get("", response_model=Page[ProfesionalOut])
def listar_profesionales(
    especialidad_id: int | None = None,
    sede_id: int | None = None,
    q: str | None = Query(None, max_length=120, description="Busca en nombres y apellidos"),
    activo: bool | None = None,
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
):
    stmt = select(Profesional).order_by(Profesional.apellidos, Profesional.nombres, Profesional.id)
    if especialidad_id is not None:
        stmt = stmt.where(Profesional.especialidad_id == especialidad_id)
    if sede_id is not None:
        stmt = stmt.where(Profesional.sede_id == sede_id)
    if activo is not None:
        stmt = stmt.where(Profesional.activo == activo)
    if q and q.strip():
        nombre_completo = func.concat(Profesional.nombres, " ", Profesional.apellidos)
        stmt = stmt.where(nombre_completo.ilike(f"%{escapar_like(q.strip())}%", escape="\\"))
    return paginar(db, stmt, params)


@router.get("/{profesional_id}", response_model=ProfesionalOut)
def obtener_profesional(profesional_id: int, db: Session = Depends(get_db)):
    return obtener_o_404(db, Profesional, profesional_id, NO_ENCONTRADO)


@router.get("/{profesional_id}/disponibilidad", response_model=DisponibilidadOut)
def disponibilidad(
    profesional_id: int,
    fecha: date = Query(..., description="Día a consultar, YYYY-MM-DD (hora de Bogotá)"),
    duracion: int = Query(30, description="Duración de la cita en minutos; también es el paso entre huecos"),
    db: Session = Depends(get_db),
):
    """Huecos libres del profesional en un día. Fechas pasadas → 422; domingos, profesional inactivo o
    día ya agotado → lista vacía."""
    profesional = obtener_o_404(db, Profesional, profesional_id, NO_ENCONTRADO)
    if duracion not in get_args(Duracion):
        raise HTTPException(422, "La duración debe ser 20, 30, 40 o 60 minutos")
    if fecha < datetime.now(reglas.TZ_CLINICA).date():
        raise HTTPException(422, "La fecha debe ser hoy o posterior")
    huecos = reglas.huecos_libres(db, profesional, fecha, duracion)
    return {
        "profesional_id": profesional.id,
        "fecha": fecha,
        "duracion_min": duracion,
        "huecos": [{"inicio": i, "fin": f} for i, f in huecos],
    }


@router.post("", response_model=ProfesionalOut, status_code=201, dependencies=[Depends(require_admin)])
def crear_profesional(datos: ProfesionalBase, db: Session = Depends(get_db)):
    _validar_referencias(db, datos)
    nuevo = Profesional(**datos.model_dump())
    db.add(nuevo)
    guardar(db, UNICOS)
    db.refresh(nuevo)
    return nuevo


@router.put("/{profesional_id}", response_model=ProfesionalOut, dependencies=[Depends(require_admin)])
def actualizar_profesional(profesional_id: int, datos: ProfesionalBase, db: Session = Depends(get_db)):
    profesional = obtener_o_404(db, Profesional, profesional_id, NO_ENCONTRADO)
    _validar_referencias(db, datos)
    for campo, valor in datos.model_dump().items():
        setattr(profesional, campo, valor)
    guardar(db, UNICOS)
    db.refresh(profesional)
    return profesional


@router.delete("/{profesional_id}", status_code=204, dependencies=[Depends(require_admin)])
def eliminar_profesional(profesional_id: int, db: Session = Depends(get_db)):
    profesional = obtener_o_404(db, Profesional, profesional_id, NO_ENCONTRADO)
    db.delete(profesional)
    guardar(db, en_uso=EN_USO)
    return Response(status_code=204)
