from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Identity,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class Cita(Base):
    __tablename__ = "citas"
    __table_args__ = (
        CheckConstraint("estado IN ('programada','cancelada','atendida')", name="ck_citas_estado"),
        CheckConstraint("duracion_min IN (20,30,40,60)", name="ck_citas_duracion"),
        CheckConstraint("fin > inicio", name="ck_citas_fin"),
    )

    id = Column(Integer, Identity(always=False), primary_key=True, index=True)
    paciente_id = Column(Integer, ForeignKey("pacientes.id"), nullable=False, index=True)
    profesional_id = Column(Integer, ForeignKey("profesionales.id"), nullable=False, index=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False, index=True)
    inicio = Column(DateTime(timezone=True), nullable=False, index=True)
    # inicio + duracion_min; se guarda para detectar solapes con una consulta simple
    fin = Column(DateTime(timezone=True), nullable=False)
    duracion_min = Column(Integer, nullable=False, server_default="30")
    motivo = Column(Text, nullable=False)
    estado = Column(String(12), nullable=False, server_default="programada")

    paciente = relationship("Paciente", lazy="joined")
    profesional = relationship("Profesional", lazy="joined")
    sede = relationship("Sede", lazy="joined")
