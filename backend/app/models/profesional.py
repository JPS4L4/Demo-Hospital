from sqlalchemy import Boolean, Column, ForeignKey, Identity, Integer, String, Text, UniqueConstraint, true
from sqlalchemy.orm import relationship
from app.core.database import Base


class Profesional(Base):
    __tablename__ = "profesionales"
    __table_args__ = (UniqueConstraint("registro_profesional", name="uq_profesionales_registro"),)

    id = Column(Integer, Identity(always=False), primary_key=True, index=True)
    nombres = Column(String(120), nullable=False)
    apellidos = Column(String(120), nullable=False)
    especialidad_id = Column(Integer, ForeignKey("especialidades.id"), nullable=False, index=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False, index=True)
    registro_profesional = Column(String(40), nullable=False)
    email = Column(String(254), nullable=False)
    telefono = Column(String(20))
    bio = Column(Text)
    activo = Column(Boolean, nullable=False, server_default=true())

    especialidad = relationship("Especialidad", lazy="joined")
    sede = relationship("Sede", lazy="joined")
