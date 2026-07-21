from pydantic import BaseModel

class SedeBase(BaseModel):
    nombre: str
    direccion: str
    ciudad: str
    telefono: str | None = None

class SedeOut(SedeBase):
    id: int

    class Config:
        from_attributes = True