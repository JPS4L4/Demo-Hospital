from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import guardar, obtener_o_404
from app.core.pagination import Page, PageParams, escapar_like, paginar
from app.models.paciente import Paciente
from app.schemas.paciente import PacienteBase, PacienteOut

router = APIRouter(prefix="/pacientes", tags=["Pacientes"])

NO_ENCONTRADO = "Paciente no encontrado"
UNICOS = {
    "uq_pacientes_documento": "Ya existe un paciente con ese tipo y número de documento",
    "uq_pacientes_email": "Ya existe un paciente con ese correo electrónico",
}
EN_USO = "No se puede eliminar el paciente: tiene citas asociadas"


@router.get("", response_model=Page[PacienteOut])
def listar_pacientes(
    q: str | None = Query(None, max_length=120, description="Busca en nombre, documento y correo"),
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
):
    stmt = select(Paciente).order_by(Paciente.apellidos, Paciente.nombres, Paciente.id)
    if q and q.strip():
        patron = f"%{escapar_like(q.strip())}%"
        nombre_completo = func.concat(Paciente.nombres, " ", Paciente.apellidos)
        stmt = stmt.where(
            or_(
                nombre_completo.ilike(patron, escape="\\"),
                Paciente.numero_documento.ilike(patron, escape="\\"),
                Paciente.email.ilike(patron, escape="\\"),
            )
        )
    return paginar(db, stmt, params)


@router.get("/{paciente_id}", response_model=PacienteOut)
def obtener_paciente(paciente_id: int, db: Session = Depends(get_db)):
    return obtener_o_404(db, Paciente, paciente_id, NO_ENCONTRADO)


@router.post("", response_model=PacienteOut, status_code=201)
def crear_paciente(datos: PacienteBase, db: Session = Depends(get_db)):
    nuevo = Paciente(**datos.model_dump())
    db.add(nuevo)
    guardar(db, UNICOS)
    db.refresh(nuevo)
    return nuevo


@router.put("/{paciente_id}", response_model=PacienteOut)
def actualizar_paciente(paciente_id: int, datos: PacienteBase, db: Session = Depends(get_db)):
    paciente = obtener_o_404(db, Paciente, paciente_id, NO_ENCONTRADO)
    for campo, valor in datos.model_dump().items():
        setattr(paciente, campo, valor)
    guardar(db, UNICOS)
    db.refresh(paciente)
    return paciente


@router.delete("/{paciente_id}", status_code=204)
def eliminar_paciente(paciente_id: int, db: Session = Depends(get_db)):
    paciente = obtener_o_404(db, Paciente, paciente_id, NO_ENCONTRADO)
    db.delete(paciente)
    guardar(db, en_uso=EN_USO)
    return Response(status_code=204)
