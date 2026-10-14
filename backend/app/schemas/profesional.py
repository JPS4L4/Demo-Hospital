from app.schemas.common import Email, OrmModel, Telefono, texto


class EspecialidadResumen(OrmModel):
    id: int
    nombre: str


class SedeResumen(OrmModel):
    id: int
    nombre: str
    ciudad: str


class ProfesionalBase(OrmModel):
    nombres: texto(120)
    apellidos: texto(120)
    especialidad_id: int
    sede_id: int
    registro_profesional: texto(40)
    email: Email
    telefono: Telefono | None = None
    bio: texto(600) | None = None
    activo: bool = True


class ProfesionalOut(ProfesionalBase):
    id: int
    especialidad: EspecialidadResumen
    sede: SedeResumen
