from sqlalchemy import Column, Identity, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class Noticia(Base):
    __tablename__ = "noticias"

    id = Column(Integer, Identity(always=False) ,primary_key=True, index=True)
    titulo = Column(String, nullable=False)
    contenido = Column(Text, nullable=False)
    fecha_publicacion = Column(DateTime(timezone=True), server_default=func.now())