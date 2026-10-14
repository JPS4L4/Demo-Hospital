from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.errors import guardar
from app.core.security import crear_token, hashear, verificar
from app.models.paciente import Paciente
from app.models.usuario import Usuario
from app.routers.pacientes import UNICOS as UNICOS_PACIENTE
from app.schemas.auth import LoginIn, RegistroIn, TokenOut, UsuarioOut

router = APIRouter(prefix="/auth", tags=["Autenticación"])

UNICOS = UNICOS_PACIENTE | {
    "uq_usuarios_email": "Ya existe una cuenta con ese correo electrónico",
}
CREDENCIALES_INVALIDAS = "Correo o contraseña incorrectos"


def _respuesta_token(usuario: Usuario) -> dict:
    token, expira_en = crear_token(usuario.id)
    return {"access_token": token, "token_type": "bearer", "expires_in": expira_en, "usuario": usuario}


@router.post("/registro", response_model=TokenOut, status_code=201)
def registrar(datos: RegistroIn, db: Session = Depends(get_db)):
    """Crea la ficha de paciente y su cuenta (rol `paciente`) en una sola transacción y abre sesión."""
    campos = datos.model_dump(exclude={"password"})
    usuario = Usuario(
        email=campos["email"],
        password_hash=hashear(datos.password),
        rol="paciente",
        paciente=Paciente(**campos),
    )
    db.add(usuario)
    guardar(db, UNICOS)
    db.refresh(usuario)
    return _respuesta_token(usuario)


@router.post("/login", response_model=TokenOut)
def iniciar_sesion(datos: LoginIn, db: Session = Depends(get_db)):
    """Inicio de sesión con JSON `{email, password}`. Mismo error (401) si el correo no existe,
    la contraseña no coincide o la cuenta está desactivada."""
    usuario = db.scalar(select(Usuario).where(Usuario.email == datos.email))
    valida = verificar(datos.password, usuario.password_hash if usuario else None)
    if usuario is None or not valida or not usuario.activo:
        raise HTTPException(401, CREDENCIALES_INVALIDAS, headers={"WWW-Authenticate": "Bearer"})
    return _respuesta_token(usuario)


@router.get("/me", response_model=UsuarioOut)
def perfil(usuario: Usuario = Depends(get_current_user)):
    return usuario
