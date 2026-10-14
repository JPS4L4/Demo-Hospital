from sqlalchemy import CheckConstraint, Column, Date, Identity, Integer, String, UniqueConstraint
from app.core.database import Base


class Paciente(Base):
    __tablename__ = "pacientes"
    __table_args__ = (
        UniqueConstraint("tipo_documento", "numero_documento", name="uq_pacientes_documento"),
        UniqueConstraint("email", name="uq_pacientes_email"),
        CheckConstraint("tipo_documento IN ('CC','TI','CE','PA')", name="ck_pacientes_tipo_documento"),
    )

    id = Column(Integer, Identity(always=False), primary_key=True, index=True)
    tipo_documento = Column(String(2), nullable=False)
    numero_documento = Column(String(30), nullable=False)
    nombres = Column(String(120), nullable=False)
    apellidos = Column(String(120), nullable=False)
    fecha_nacimiento = Column(Date, nullable=False)
    email = Column(String(254), nullable=False)
    telefono = Column(String(20), nullable=False)
    eps = Column(String(120))
