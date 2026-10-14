from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.noticia import Noticia
from app.schemas.noticia import NoticiaOut, NoticiaBase

router = APIRouter(prefix="/noticias", tags=["Noticias"])

@router.get("", response_model=list[NoticiaOut])
def listar_noticias(db: Session = Depends(get_db)):
    return db.query(Noticia).order_by(Noticia.fecha_publicacion.desc(), Noticia.id.desc()).all()

@router.get("/{noticia_id}", response_model=NoticiaOut)
def obtener_noticia(noticia_id: int, db: Session = Depends(get_db)):
    noticia = db.get(Noticia, noticia_id)
    if noticia is None:
        raise HTTPException(status_code=404, detail="Noticia no encontrada")
    return noticia

@router.post("", response_model=NoticiaOut, status_code=201)
def crear_noticia(noticia: NoticiaBase, db: Session = Depends(get_db)):
    nueva_noticia = Noticia(**noticia.model_dump())
    db.add(nueva_noticia)
    db.commit()
    db.refresh(nueva_noticia)
    return nueva_noticia