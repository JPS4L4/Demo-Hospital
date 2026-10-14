"""Dependencias de autenticación y autorización.

401: falta el token o es inválido/expirado, o la cuenta está desactivada.
403: hay sesión pero el rol no alcanza.
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import leer_token
from app.models.usuario import Usuario

_bearer = HTTPBearer(auto_error=False, description="Token de /auth/login o /auth/registro")


def _no_autenticado(detalle: str = "No autenticado") -> HTTPException:
    return HTTPException(401, detalle, headers={"WWW-Authenticate": "Bearer"})


def get_current_user(
    credenciales: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    if credenciales is None:
        raise _no_autenticado()
    usuario_id = leer_token(credenciales.credentials)
    usuario = db.get(Usuario, usuario_id) if usuario_id is not None else None
    if usuario is None or not usuario.activo:
        raise _no_autenticado("Sesión inválida o expirada")
    return usuario


def require_admin(usuario: Usuario = Depends(get_current_user)) -> Usuario:
    if usuario.rol != "admin":
        raise HTTPException(403, "No tienes permiso para realizar esta acción")
    return usuario
