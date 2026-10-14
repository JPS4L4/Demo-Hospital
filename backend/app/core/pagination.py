from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

T = TypeVar("T")

LIMITE_POR_DEFECTO = 20
LIMITE_MAXIMO = 100


class Page(BaseModel, Generic[T]):
    """Forma común de las listas paginadas de los recursos nuevos."""

    items: list[T]
    total: int
    limit: int
    offset: int


class PageParams:
    def __init__(
        self,
        limit: int = Query(LIMITE_POR_DEFECTO, ge=1, le=LIMITE_MAXIMO),
        offset: int = Query(0, ge=0),
    ):
        self.limit = limit
        self.offset = offset


def paginar(db: Session, stmt: Select, params: PageParams) -> dict:
    """Ejecuta `stmt` (ya filtrada y ordenada) y devuelve {items, total, limit, offset}."""
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
    items = db.scalars(stmt.limit(params.limit).offset(params.offset)).unique().all()
    return {"items": items, "total": total, "limit": params.limit, "offset": params.offset}


def escapar_like(texto: str) -> str:
    return texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
