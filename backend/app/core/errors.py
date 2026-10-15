from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

UNIQUE_VIOLATION = "23505"
FOREIGN_KEY_VIOLATION = "23503"
EXCLUSION_VIOLATION = "23P01"

# Restricciones EXCLUDE de la base (ver el modelo Cita) y su mensaje
SOLAPES = {
    "ex_citas_profesional_solape": "El profesional ya tiene una cita en ese horario",
    "ex_citas_paciente_solape": "El paciente ya tiene una cita en ese horario",
}
SOLAPE_POR_DEFECTO = "Ya existe una cita en ese horario"


def mensaje_de_integridad(
    exc: IntegrityError,
    unicos: dict[str, str] | None = None,
    en_uso: str = "No se puede eliminar: el registro está en uso",
    unico_por_defecto: str = "Ya existe un registro con esos datos",
) -> str | None:
    """Mensaje 409 para los errores de integridad conocidos; None si no se reconoce."""
    codigo = getattr(exc.orig, "pgcode", None)
    nombre = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
    if codigo == UNIQUE_VIOLATION:
        return (unicos or {}).get(nombre, unico_por_defecto)
    if codigo == FOREIGN_KEY_VIOLATION:
        return en_uso
    if codigo == EXCLUSION_VIOLATION:
        return SOLAPES.get(nombre, SOLAPE_POR_DEFECTO)
    return None


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
        mensaje = mensaje_de_integridad(exc, unicos, en_uso, unico_por_defecto)
        if mensaje is None:
            raise
        raise HTTPException(409, mensaje) from exc


def obtener_o_404(db: Session, modelo, id_: int, mensaje: str):
    objeto = db.get(modelo, id_)
    if objeto is None:
        raise HTTPException(404, mensaje)
    return objeto
