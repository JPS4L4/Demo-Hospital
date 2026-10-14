from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_admin
from app.core.database import get_db
from app.core.errors import guardar, obtener_o_404
from app.core.pagination import Page, PageParams, escapar_like, paginar
from app.models.paciente import Paciente
from app.models.usuario import Usuario
from app.schemas.paciente import PacienteBase, PacienteOut

router = APIRouter(prefix="/pacientes", tags=["Pacientes"])

NO_ENCONTRADO = "Paciente no encontrado"
UNICOS = {
    "uq_pacientes_documento": "Ya existe un paciente con ese tipo y número de documento",
    "uq_pacientes_email": "Ya existe un paciente con ese correo electrónico",
}
EN_USO = "No se puede eliminar el paciente: tiene citas asociadas"
UNICOS_CON_CUENTA = UNICOS | {"uq_usuarios_email": "Ya existe una cuenta con ese correo electrónico"}


def _aplicar_cambios(db: Session, paciente: Paciente, datos: PacienteBase) -> Paciente:
    """Actualiza la ficha; si el paciente tiene cuenta, su correo de acceso sigue al de la ficha."""
    for campo, valor in datos.model_dump().items():
        setattr(paciente, campo, valor)
    cuenta = db.scalar(select(Usuario).where(Usuario.paciente_id == paciente.id))
    if cuenta is not None:
        cuenta.email = paciente.email
    guardar(db, UNICOS_CON_CUENTA)
    db.refresh(paciente)
    return paciente


def _paciente_propio(usuario: Usuario) -> Paciente:
    """Ficha del usuario en sesión (los administradores no tienen)."""
    if usuario.paciente is None:
        raise HTTPException(404, NO_ENCONTRADO)
    return usuario.paciente


def _autorizar(usuario: Usuario, paciente_id: int) -> None:
    """Admin: cualquiera. Paciente: solo la propia; las ajenas responden 404 como si no existieran."""
    if usuario.rol != "admin" and usuario.paciente_id != paciente_id:
        raise HTTPException(404, NO_ENCONTRADO)


@router.get("", response_model=Page[PacienteOut], dependencies=[Depends(require_admin)])
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


@router.get("/me", response_model=PacienteOut)
def obtener_mi_ficha(usuario: Usuario = Depends(get_current_user)):
    return _paciente_propio(usuario)


@router.put("/me", response_model=PacienteOut)
def actualizar_mi_ficha(
    datos: PacienteBase, usuario: Usuario = Depends(get_current_user), db: Session = Depends(get_db)
):
    return _aplicar_cambios(db, _paciente_propio(usuario), datos)


@router.get("/{paciente_id}", response_model=PacienteOut)
def obtener_paciente(
    paciente_id: int, usuario: Usuario = Depends(get_current_user), db: Session = Depends(get_db)
):
    _autorizar(usuario, paciente_id)
    return obtener_o_404(db, Paciente, paciente_id, NO_ENCONTRADO)


@router.post("", response_model=PacienteOut, status_code=201, dependencies=[Depends(require_admin)])
def crear_paciente(datos: PacienteBase, db: Session = Depends(get_db)):
    nuevo = Paciente(**datos.model_dump())
    db.add(nuevo)
    guardar(db, UNICOS)
    db.refresh(nuevo)
    return nuevo


@router.put("/{paciente_id}", response_model=PacienteOut)
def actualizar_paciente(
    paciente_id: int,
    datos: PacienteBase,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _autorizar(usuario, paciente_id)
    paciente = obtener_o_404(db, Paciente, paciente_id, NO_ENCONTRADO)
    return _aplicar_cambios(db, paciente, datos)


@router.delete("/{paciente_id}", status_code=204, dependencies=[Depends(require_admin)])
def eliminar_paciente(paciente_id: int, db: Session = Depends(get_db)):
    paciente = obtener_o_404(db, Paciente, paciente_id, NO_ENCONTRADO)
    db.delete(paciente)
    guardar(db, en_uso=EN_USO)
    return Response(status_code=204)
