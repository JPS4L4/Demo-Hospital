from app.schemas.common import OrmModel, texto


class EspecialidadBase(OrmModel):
    nombre: texto(120)
    descripcion: texto(1000) | None = None


class EspecialidadOut(EspecialidadBase):
    id: int
