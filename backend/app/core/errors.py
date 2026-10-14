from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

UNIQUE_VIOLATION = "23505"
FOREIGN_KEY_VIOLATION = "23503"


def guardar(
    db: Session,
    unicos: dict[str, str] | None = None,
    en_uso: str = "No se puede eliminar: el registro está en uso",
    unico_por_defecto: str = "Ya existe un registro con esos datos",
) -> None:
    """Confirma la transacción traduciendo los errores de integridad a 409.

    `unicos` asocia el nombre de cada restricción UNIQUE con su mensaje.
    """
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        codigo = getattr(exc.orig, "pgcode", None)
        if codigo == UNIQUE_VIOLATION:
            nombre = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
            raise HTTPException(409, (unicos or {}).get(nombre, unico_por_defecto)) from exc
        if codigo == FOREIGN_KEY_VIOLATION:
            raise HTTPException(409, en_uso) from exc
        raise


def obtener_o_404(db: Session, modelo, id_: int, mensaje: str):
    objeto = db.get(modelo, id_)
    if objeto is None:
        raise HTTPException(404, mensaje)
    return objeto
