from datetime import datetime

from pydantic import BaseModel, Field


class ResumenOut(BaseModel):
    """KPIs del periodo/filtros pedidos. `tasa_cancelacion` es una fracción (0.12 = 12 %)."""

    total: int
    atendidas: int
    canceladas: int
    programadas: int
    tasa_cancelacion: float | None = Field(description="canceladas / total; null si no hay citas")
    duracion_media_min: float | None = Field(
        description="Duración media (min) de las citas no canceladas; null si no hay"
    )
    pacientes_distintos: int


class FilaCitas(BaseModel):
    dimensiones: dict[str, str | int] = Field(
        description="Valor de cada dimensión pedida en `agrupar` (clave = nombre de la dimensión)"
    )
    valor: float | int | None


class CitasAgregadasOut(BaseModel):
    medida: str
    agrupar: list[str]
    filas: list[FilaCitas]


class EstadoAnaliticaOut(BaseModel):
    refrescado_en: datetime | None = Field(
        description="Último refresco registrado; null si nunca se ha refrescado desde la migración"
    )
    citas_oltp: int
    citas_analitica: int
    actualizada: bool = Field(description="True si ambos conteos coinciden")


class RefrescoOut(BaseModel):
    refrescado_en: datetime
