from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.core.database import get_db
from app.core.errors import guardar, obtener_o_404
from app.core.pagination import Page, PageParams, escapar_like, paginar
from app.models.medicamento import Medicamento
from app.schemas.medicamento import MedicamentoBase, MedicamentoOut

router = APIRouter(prefix="/medicamentos", tags=["Medicamentos"])

NO_ENCONTRADO = "Medicamento no encontrado"


@router.get("", response_model=Page[MedicamentoOut])
def listar_medicamentos(
    q: str | None = Query(None, max_length=150, description="Busca en nombre y principio activo"),
    requiere_formula: bool | None = None,
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
):
    stmt = select(Medicamento).order_by(Medicamento.nombre, Medicamento.id)
    if q and q.strip():
        patron = f"%{escapar_like(q.strip())}%"
        stmt = stmt.where(
            or_(
                Medicamento.nombre.ilike(patron, escape="\\"),
                Medicamento.principio_activo.ilike(patron, escape="\\"),
            )
        )
    if requiere_formula is not None:
        stmt = stmt.where(Medicamento.requiere_formula == requiere_formula)
    return paginar(db, stmt, params)


@router.get("/{medicamento_id}", response_model=MedicamentoOut)
def obtener_medicamento(medicamento_id: int, db: Session = Depends(get_db)):
    return obtener_o_404(db, Medicamento, medicamento_id, NO_ENCONTRADO)


@router.post(
    "", response_model=MedicamentoOut, status_code=201, dependencies=[Depends(require_admin)]
)
def crear_medicamento(datos: MedicamentoBase, db: Session = Depends(get_db)):
    nuevo = Medicamento(**datos.model_dump())
    db.add(nuevo)
    guardar(db)
    db.refresh(nuevo)
    return nuevo


@router.put(
    "/{medicamento_id}", response_model=MedicamentoOut, dependencies=[Depends(require_admin)]
)
def actualizar_medicamento(
    medicamento_id: int, datos: MedicamentoBase, db: Session = Depends(get_db)
):
    medicamento = obtener_o_404(db, Medicamento, medicamento_id, NO_ENCONTRADO)
    for campo, valor in datos.model_dump().items():
        setattr(medicamento, campo, valor)
    guardar(db)
    db.refresh(medicamento)
    return medicamento


@router.delete("/{medicamento_id}", status_code=204, dependencies=[Depends(require_admin)])
def eliminar_medicamento(medicamento_id: int, db: Session = Depends(get_db)):
    medicamento = obtener_o_404(db, Medicamento, medicamento_id, NO_ENCONTRADO)
    db.delete(medicamento)
    guardar(db)
    return Response(status_code=204)
