import re
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, PlainSerializer, StringConstraints


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


def texto(max_length: int = 200):
    return Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=max_length)]


def _normalizar_telefono(valor: str) -> str:
    limpio = re.sub(r"[\s\-().]", "", valor)
    if not re.fullmatch(r"\+?\d{7,15}", limpio):
        raise ValueError("El teléfono debe tener entre 7 y 15 dígitos y puede empezar con +")
    return limpio


Telefono = Annotated[str, AfterValidator(_normalizar_telefono)]
Email = Annotated[EmailStr, AfterValidator(lambda v: v.lower())]
# Decimal en la base de datos, número en el JSON
Dinero = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]
