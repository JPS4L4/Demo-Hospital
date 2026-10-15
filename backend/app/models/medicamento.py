from sqlalchemy import Boolean, CheckConstraint, Column, Identity, Integer, Numeric, String, false

from app.core.database import Base


class Medicamento(Base):
    __tablename__ = "medicamentos"
    __table_args__ = (
        CheckConstraint("stock >= 0", name="ck_medicamentos_stock"),
        CheckConstraint("precio >= 0", name="ck_medicamentos_precio"),
    )

    id = Column(Integer, Identity(always=False), primary_key=True, index=True)
    nombre = Column(String(150), nullable=False, index=True)
    principio_activo = Column(String(150), nullable=False)
    presentacion = Column(String(150), nullable=False)
    concentracion = Column(String(60), nullable=False)
    requiere_formula = Column(Boolean, nullable=False, server_default=false())
    stock = Column(Integer, nullable=False, server_default="0")
    precio = Column(Numeric(10, 2), nullable=False)
