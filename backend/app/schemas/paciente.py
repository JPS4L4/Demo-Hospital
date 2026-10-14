from datetime import date
from typing import Annotated, Literal

from pydantic import AfterValidator

from app.schemas.common import Email, OrmModel, Telefono, texto

TipoDocumento = Literal["CC", "TI", "CE", "PA"]


def _validar_documento(valor: str) -> str:
    valor = valor.strip().upper()
    if not valor.isalnum() or not 4 <= len(valor) <= 30 or not valor.isascii():
        raise ValueError("El número de documento debe tener entre 4 y 30 letras o dígitos, sin espacios")
    return valor


def _validar_nacimiento(valor: date) -> date:
    if valor >= date.today():
        raise ValueError("La fecha de nacimiento debe ser anterior a hoy")
    if valor.year < 1900:
        raise ValueError("La fecha de nacimiento no es válida")
    return valor


class PacienteBase(OrmModel):
    tipo_documento: TipoDocumento
    numero_documento: Annotated[str, AfterValidator(_validar_documento)]
    nombres: texto(120)
    apellidos: texto(120)
    fecha_nacimiento: Annotated[date, AfterValidator(_validar_nacimiento)]
    email: Email
    telefono: Telefono
    eps: texto(120) | None = None


class PacienteOut(PacienteBase):
    id: int
