from sqlalchemy import Column, Integer,Identity, String
from app.core.database import Base

class Sede(Base):
    __tablename__ = "sedes"

    id = Column(Integer, Identity(always=False), primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    direccion = Column(String, nullable=False)
    ciudad = Column(String, nullable=False)
    telefono = Column(String)