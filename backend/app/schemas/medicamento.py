from typing import Annotated

from pydantic import Field

from app.schemas.common import Dinero, OrmModel, texto


class MedicamentoBase(OrmModel):
    nombre: texto(150)
    principio_activo: texto(150)
    presentacion: texto(150)
    concentracion: texto(60)
    requiere_formula: bool = False
    stock: Annotated[int, Field(ge=0, le=1_000_000)] = 0
    precio: Annotated[Dinero, Field(ge=0, max_digits=10, decimal_places=2)]


class MedicamentoOut(MedicamentoBase):
    id: int
