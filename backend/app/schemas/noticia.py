from pydantic import BaseModel
from datetime import datetime

class NoticiaBase(BaseModel):
    titulo: str
    contenido: str

class NoticiaOut(NoticiaBase):
    id: int
    fecha_publicacion: datetime

    class Config:
        from_attributes = True