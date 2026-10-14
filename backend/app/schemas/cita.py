from datetime import datetime
from typing import Literal

from pydantic import AwareDatetime

from app.schemas.common import OrmModel, texto
from app.schemas.paciente import TipoDocumento
from app.schemas.profesional import EspecialidadResumen, SedeResumen

EstadoCita = Literal["programada", "cancelada", "atendida"]
Duracion = Literal[20, 30, 40, 60]


class PacienteResumen(OrmModel):
    id: int
    tipo_documento: TipoDocumento
    numero_documento: str
    nombres: str
    apellidos: str


class ProfesionalResumen(OrmModel):
    id: int
    nombres: str
    apellidos: str
    especialidad: EspecialidadResumen


class CitaCreate(OrmModel):
    # Admin: obligatorio. Paciente: se toma de su sesión; si se envía debe ser el suyo (403 si no).
    paciente_id: int | None = None
    profesional_id: int
    # Opcional: si se omite se usa la sede del profesional; si se envía debe coincidir con ella
    sede_id: int | None = None
    inicio: AwareDatetime
    duracion_min: Duracion = 30
    motivo: texto(500)


class CitaUpdate(OrmModel):
    """Todos los campos son opcionales; solo se modifican los enviados."""

    paciente_id: int | None = None
    profesional_id: int | None = None
    sede_id: int | None = None
    inicio: AwareDatetime | None = None
    duracion_min: Duracion | None = None
    motivo: texto(500) | None = None
    # Para cancelar usar POST /citas/{id}/cancelar
    estado: Literal["programada", "atendida"] | None = None


class CitaOut(OrmModel):
    id: int
    paciente_id: int
    profesional_id: int
    sede_id: int
    inicio: datetime
    fin: datetime
    duracion_min: int
    motivo: str
    estado: EstadoCita
    paciente: PacienteResumen
    profesional: ProfesionalResumen
    sede: SedeResumen

