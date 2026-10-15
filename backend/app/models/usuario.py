from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Identity,
    Integer,
    String,
    UniqueConstraint,
    func,
    true,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = (
        UniqueConstraint("email", name="uq_usuarios_email"),
        UniqueConstraint("paciente_id", name="uq_usuarios_paciente"),
        CheckConstraint("rol IN ('paciente','admin')", name="ck_usuarios_rol"),
        CheckConstraint("email = lower(email)", name="ck_usuarios_email_minusculas"),
        CheckConstraint(
            "rol <> 'paciente' OR paciente_id IS NOT NULL", name="ck_usuarios_paciente_requerido"
        ),
    )

    id = Column(Integer, Identity(always=False), primary_key=True, index=True)
    email = Column(String(254), nullable=False)
    password_hash = Column(String(255), nullable=False)
    rol = Column(String(10), nullable=False)
    # Obligatorio para el rol paciente; al borrar la ficha del paciente se borra también su cuenta
    paciente_id = Column(Integer, ForeignKey("pacientes.id", ondelete="CASCADE"))
    activo = Column(Boolean, nullable=False, server_default=true())
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    paciente = relationship("Paciente", lazy="joined")
