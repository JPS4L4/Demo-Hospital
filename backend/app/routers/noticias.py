from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.core.database import get_db
from app.core.errors import guardar, obtener_o_404
from app.models.noticia import Noticia
from app.schemas.noticia import NoticiaBase, NoticiaOut

router = APIRouter(prefix="/noticias", tags=["Noticias"])

NO_ENCONTRADA = "Noticia no encontrada"


@router.get("", response_model=list[NoticiaOut])
def listar_noticias(
    limit: int | None = Query(None, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    # Sigue devolviendo una lista simple (la consume el frontend); limit/offset son opcionales.
    stmt = (
        select(Noticia)
        .order_by(Noticia.fecha_publicacion.desc(), Noticia.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return db.scalars(stmt).all()


@router.get("/{noticia_id}", response_model=NoticiaOut)
def obtener_noticia(noticia_id: int, db: Session = Depends(get_db)):
    return obtener_o_404(db, Noticia, noticia_id, NO_ENCONTRADA)


@router.post("", response_model=NoticiaOut, status_code=201, dependencies=[Depends(require_admin)])
def crear_noticia(noticia: NoticiaBase, db: Session = Depends(get_db)):
    nueva_noticia = Noticia(**noticia.model_dump())
    db.add(nueva_noticia)
    guardar(db)
    db.refresh(nueva_noticia)
    return nueva_noticia


@router.put("/{noticia_id}", response_model=NoticiaOut, dependencies=[Depends(require_admin)])
def actualizar_noticia(noticia_id: int, datos: NoticiaBase, db: Session = Depends(get_db)):
    noticia = obtener_o_404(db, Noticia, noticia_id, NO_ENCONTRADA)
    for campo, valor in datos.model_dump().items():
        setattr(noticia, campo, valor)
    guardar(db)
    db.refresh(noticia)
    return noticia


@router.delete("/{noticia_id}", status_code=204, dependencies=[Depends(require_admin)])
def eliminar_noticia(noticia_id: int, db: Session = Depends(get_db)):
    noticia = obtener_o_404(db, Noticia, noticia_id, NO_ENCONTRADA)
    db.delete(noticia)
    guardar(db)
    return Response(status_code=204)
