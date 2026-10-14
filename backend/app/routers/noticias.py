from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.noticia import Noticia
from app.schemas.noticia import NoticiaOut, NoticiaBase

router = APIRouter(prefix="/noticias", tags=["Noticias"])

@router.get("", response_model=list[NoticiaOut])
def listar_noticias(db: Session = Depends(get_db)):
    return db.query(Noticia).all()

@router.post("", response_model=NoticiaOut, status_code=201)
def crear_noticia(noticia: NoticiaBase, db: Session = Depends(get_db)):
    nueva_noticia = Noticia(**noticia.model_dump())
    db.add(nueva_noticia)
    db.commit()
    db.refresh(nueva_noticia)
    return nueva_noticia