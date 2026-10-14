from pydantic import BaseModel, ConfigDict

from app.schemas.common import texto


class SedeBase(BaseModel):
    nombre: texto(120)
    direccion: texto(200)
    ciudad: texto(80)
    telefono: texto(40) | None = None


class SedeOut(SedeBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
