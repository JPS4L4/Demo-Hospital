from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import guardar, obtener_o_404
from app.models.sede import Sede
from app.schemas.sede import SedeBase, SedeOut

router = APIRouter(prefix="/sedes", tags=["Sedes"])

NO_ENCONTRADA = "Sede no encontrada"
EN_USO = "No se puede eliminar la sede: tiene profesionales o citas asociados"


@router.get("", response_model=list[SedeOut])
def listar_sedes(
    limit: int | None = Query(None, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    # Sigue devolviendo una lista simple (la consume el frontend); limit/offset son opcionales.
    stmt = select(Sede).order_by(Sede.id).offset(offset).limit(limit)
    return db.scalars(stmt).all()


@router.get("/{sede_id}", response_model=SedeOut)
def obtener_sede(sede_id: int, db: Session = Depends(get_db)):
    return obtener_o_404(db, Sede, sede_id, NO_ENCONTRADA)


@router.post("", response_model=SedeOut, status_code=201)
def crear_sede(sede: SedeBase, db: Session = Depends(get_db)):
    nueva_sede = Sede(**sede.model_dump())
    db.add(nueva_sede)
    guardar(db)
    db.refresh(nueva_sede)
    return nueva_sede


@router.put("/{sede_id}", response_model=SedeOut)
def actualizar_sede(sede_id: int, datos: SedeBase, db: Session = Depends(get_db)):
    sede = obtener_o_404(db, Sede, sede_id, NO_ENCONTRADA)
    for campo, valor in datos.model_dump().items():
        setattr(sede, campo, valor)
    guardar(db)
    db.refresh(sede)
    return sede


@router.delete("/{sede_id}", status_code=204)
def eliminar_sede(sede_id: int, db: Session = Depends(get_db)):
    sede = obtener_o_404(db, Sede, sede_id, NO_ENCONTRADA)
    db.delete(sede)
    guardar(db, en_uso=EN_USO)
    return Response(status_code=204)
