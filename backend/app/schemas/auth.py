from typing import Annotated, Literal

from pydantic import StringConstraints

from app.schemas.common import OrmModel
from app.schemas.paciente import PacienteBase, PacienteOut

Rol = Literal["paciente", "admin"]
Contrasena = Annotated[str, StringConstraints(min_length=8, max_length=128)]


class LoginIn(OrmModel):
    email: Annotated[
        str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=1, max_length=254)
    ]
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class RegistroIn(PacienteBase):
    """Ficha del paciente (mismas reglas que POST /pacientes) más la contraseña de la cuenta.

    El correo de la ficha es también el correo de inicio de sesión.
    """

    password: Contrasena


class UsuarioOut(OrmModel):
    id: int
    email: str
    rol: Rol
    activo: bool
    paciente: PacienteOut | None


class TokenOut(OrmModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int  # segundos
    usuario: UsuarioOut
