from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.core.database import get_db
from app.core.errors import guardar, obtener_o_404
from app.core.pagination import Page, PageParams, escapar_like, paginar
from app.models.especialidad import Especialidad
from app.schemas.especialidad import EspecialidadBase, EspecialidadOut

router = APIRouter(prefix="/especialidades", tags=["Especialidades"])

NO_ENCONTRADA = "Especialidad no encontrada"
UNICOS = {"uq_especialidades_nombre": "Ya existe una especialidad con ese nombre"}
EN_USO = "No se puede eliminar la especialidad: tiene profesionales asociados"


@router.get("", response_model=Page[EspecialidadOut])
def listar_especialidades(
    q: str | None = Query(None, max_length=120),
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
):
    stmt = select(Especialidad).order_by(Especialidad.nombre, Especialidad.id)
    if q and q.strip():
        stmt = stmt.where(Especialidad.nombre.ilike(f"%{escapar_like(q.strip())}%", escape="\\"))
    return paginar(db, stmt, params)


@router.get("/{especialidad_id}", response_model=EspecialidadOut)
def obtener_especialidad(especialidad_id: int, db: Session = Depends(get_db)):
    return obtener_o_404(db, Especialidad, especialidad_id, NO_ENCONTRADA)


@router.post(
    "", response_model=EspecialidadOut, status_code=201, dependencies=[Depends(require_admin)]
)
def crear_especialidad(datos: EspecialidadBase, db: Session = Depends(get_db)):
    nueva = Especialidad(**datos.model_dump())
    db.add(nueva)
    guardar(db, UNICOS)
    db.refresh(nueva)
    return nueva


@router.put(
    "/{especialidad_id}", response_model=EspecialidadOut, dependencies=[Depends(require_admin)]
)
def actualizar_especialidad(
    especialidad_id: int, datos: EspecialidadBase, db: Session = Depends(get_db)
):
    especialidad = obtener_o_404(db, Especialidad, especialidad_id, NO_ENCONTRADA)
    for campo, valor in datos.model_dump().items():
        setattr(especialidad, campo, valor)
    guardar(db, UNICOS)
    db.refresh(especialidad)
    return especialidad


@router.delete("/{especialidad_id}", status_code=204, dependencies=[Depends(require_admin)])
def eliminar_especialidad(especialidad_id: int, db: Session = Depends(get_db)):
    especialidad = obtener_o_404(db, Especialidad, especialidad_id, NO_ENCONTRADA)
    db.delete(especialidad)
    guardar(db, en_uso=EN_USO)
    return Response(status_code=204)
