from sqlalchemy import Column, Identity, Integer, String, Text, UniqueConstraint
from app.core.database import Base


class Especialidad(Base):
    __tablename__ = "especialidades"
    __table_args__ = (UniqueConstraint("nombre", name="uq_especialidades_nombre"),)

    id = Column(Integer, Identity(always=False), primary_key=True, index=True)
    nombre = Column(String(120), nullable=False)
    descripcion = Column(Text)
