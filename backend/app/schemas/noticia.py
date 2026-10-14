from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.common import texto


class NoticiaBase(BaseModel):
    titulo: texto(200)
    contenido: texto(20000)


class NoticiaOut(NoticiaBase):
    id: int
    fecha_publicacion: datetime

    model_config = ConfigDict(from_attributes=True)
