"""Hash de contraseñas (Argon2id vía pwdlib) y tokens JWT (HS256 vía PyJWT)."""
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.core.config import settings

ALGORITMO = "HS256"

_hasher = PasswordHash((Argon2Hasher(),))
# Hash válido de una contraseña que nadie conoce: sirve para que el login de un correo inexistente
# tarde lo mismo que el de uno existente y no delate qué correos están registrados.
_HASH_FALSO = _hasher.hash("contraseña-inexistente-no-usar")


def hashear(contrasena: str) -> str:
    return _hasher.hash(contrasena)


def verificar(contrasena: str, hash_guardado: str | None) -> bool:
    coincide = _hasher.verify(contrasena, hash_guardado or _HASH_FALSO)
    return coincide and hash_guardado is not None


def crear_token(usuario_id: int) -> tuple[str, int]:
    """Devuelve (token, segundos de vigencia)."""
    ahora = datetime.now(timezone.utc)
    vigencia = timedelta(minutes=settings.jwt_expire_minutes)
    claims = {"sub": str(usuario_id), "iat": ahora, "exp": ahora + vigencia}
    return jwt.encode(claims, settings.jwt_secret, algorithm=ALGORITMO), int(vigencia.total_seconds())


def leer_token(token: str) -> int | None:
    """Id del usuario si el token es válido y no ha expirado; si no, None."""
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITMO], options={"require": ["exp", "sub"]})
        return int(claims["sub"])
    except (jwt.PyJWTError, ValueError):
        return None
