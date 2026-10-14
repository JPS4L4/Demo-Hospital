from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.sede import Sede
from app.schemas.sede import SedeOut, SedeBase

router = APIRouter(prefix="/sedes", tags=["Sedes"])

@router.get("", response_model=list[SedeOut])
def listar_sedes(db: Session = Depends(get_db)):
    return db.query(Sede).all()

@router.post("", response_model=SedeOut, status_code=201)
def crear_sede(sede: SedeBase, db: Session = Depends(get_db)):
    nueva_sede = Sede(**sede.model_dump())
    db.add(nueva_sede)
    db.commit()
    db.refresh(nueva_sede)
    return nueva_sede