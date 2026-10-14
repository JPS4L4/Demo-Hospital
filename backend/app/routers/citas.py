from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import guardar, obtener_o_404
from app.core.pagination import Page, PageParams, paginar
from app.models.cita import Cita
from app.schemas.cita import CitaCreate, CitaOut, CitaUpdate, EstadoCita
from app.services import citas as reglas

router = APIRouter(prefix="/citas", tags=["Citas"])

NO_ENCONTRADA = "Cita no encontrada"


@router.get("", response_model=Page[CitaOut])
def listar_citas(
    paciente_id: int | None = None,
    profesional_id: int | None = None,
    estado: EstadoCita | None = None,
    desde: datetime | None = Query(None, description="Citas que empiezan desde este instante (sin zona = hora de Bogotá)"),
    hasta: datetime | None = Query(None, description="Citas que empiezan hasta este instante (inclusive)"),
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
):
    stmt = select(Cita).order_by(Cita.inicio, Cita.id)
    if paciente_id is not None:
        stmt = stmt.where(Cita.paciente_id == paciente_id)
    if profesional_id is not None:
        stmt = stmt.where(Cita.profesional_id == profesional_id)
    if estado is not None:
        stmt = stmt.where(Cita.estado == estado)
    if desde is not None:
        stmt = stmt.where(Cita.inicio >= reglas.a_hora_clinica(desde))
    if hasta is not None:
        stmt = stmt.where(Cita.inicio <= reglas.a_hora_clinica(hasta))
    return paginar(db, stmt, params)


@router.get("/{cita_id}", response_model=CitaOut)
def obtener_cita(cita_id: int, db: Session = Depends(get_db)):
    return obtener_o_404(db, Cita, cita_id, NO_ENCONTRADA)


@router.post("", response_model=CitaOut, status_code=201)
def crear_cita(datos: CitaCreate, db: Session = Depends(get_db)):
    paciente = reglas.obtener_paciente(db, datos.paciente_id)
    profesional = reglas.obtener_profesional(db, datos.profesional_id)
    sede_id = reglas.validar_sede(profesional, datos.sede_id)
    fin = reglas.validar_agenda(db, paciente, profesional, datos.inicio, datos.duracion_min)
    nueva = Cita(
        paciente_id=paciente.id,
        profesional_id=profesional.id,
        sede_id=sede_id,
        inicio=datos.inicio,
        fin=fin,
        duracion_min=datos.duracion_min,
        motivo=datos.motivo,
    )
    db.add(nueva)
    guardar(db)
    db.refresh(nueva)
    return nueva


@router.put("/{cita_id}", response_model=CitaOut)
def actualizar_cita(cita_id: int, datos: CitaUpdate, db: Session = Depends(get_db)):
    """Reprograma o edita una cita programada. Solo se aplican los campos enviados."""
    cita = obtener_o_404(db, Cita, cita_id, NO_ENCONTRADA)
    if cita.estado != "programada":
        raise HTTPException(409, f"Solo se pueden modificar citas programadas (esta está {cita.estado})")

    cambios = datos.model_dump(exclude_unset=True)
    nuevo = {
        "paciente_id": cambios.get("paciente_id") or cita.paciente_id,
        "profesional_id": cambios.get("profesional_id") or cita.profesional_id,
        "inicio": cambios.get("inicio") or cita.inicio,
        "duracion_min": cambios.get("duracion_min") or cita.duracion_min,
    }
    agenda_cambia = any(nuevo[k] != getattr(cita, k) for k in nuevo) or "sede_id" in cambios
    if agenda_cambia:
        paciente = reglas.obtener_paciente(db, nuevo["paciente_id"])
        profesional = reglas.obtener_profesional(db, nuevo["profesional_id"])
        cita.sede_id = reglas.validar_sede(profesional, cambios.get("sede_id"))
        cita.fin = reglas.validar_agenda(
            db, paciente, profesional, nuevo["inicio"], nuevo["duracion_min"], excluir_id=cita.id
        )
        cita.paciente_id, cita.profesional_id = paciente.id, profesional.id
        cita.inicio, cita.duracion_min = nuevo["inicio"], nuevo["duracion_min"]
    if cambios.get("motivo"):
        cita.motivo = cambios["motivo"]
    if cambios.get("estado"):
        cita.estado = cambios["estado"]
    guardar(db)
    db.refresh(cita)
    return cita


@router.post("/{cita_id}/cancelar", response_model=CitaOut)
def cancelar_cita(cita_id: int, db: Session = Depends(get_db)):
    """Cancela la cita y libera el horario. Cancelar una cita ya cancelada no cambia nada."""
    cita = obtener_o_404(db, Cita, cita_id, NO_ENCONTRADA)
    if cita.estado == "atendida":
        raise HTTPException(409, "No se puede cancelar una cita que ya fue atendida")
    if cita.estado != "cancelada":
        cita.estado = "cancelada"
        guardar(db)
        db.refresh(cita)
    return cita


@router.delete("/{cita_id}", status_code=204)
def eliminar_cita(cita_id: int, db: Session = Depends(get_db)):
    cita = obtener_o_404(db, Cita, cita_id, NO_ENCONTRADA)
    db.delete(cita)
    guardar(db)
    return Response(status_code=204)
