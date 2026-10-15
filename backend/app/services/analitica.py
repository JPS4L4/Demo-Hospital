"""Refresco y consulta del modelo en estrella (schema `analitica`).

Las vistas materializadas (ver `app/analitica/sql.py`) son una copia agregada del OLTP: no se
actualizan solas. Se refrescan tras el seed, tras el reinicio de la demo y bajo demanda.

`REFRESH MATERIALIZED VIEW CONCURRENTLY` (no bloquea las lecturas) sí puede ejecutarse dentro de
una transacción, pero necesita que la vista ya esté poblada y un índice único; cuando se acaba de
vaciar y sembrar todo (seed, reinicio) es más barato y simple el refresco normal, que además
queda dentro de la misma transacción: o se confirma todo junto o nada.
"""

import logging
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.analitica.sql import SCHEMA, TABLA_REFRESCO, VISTAS

logger = logging.getLogger("app.analitica")

# Clave fija del advisory lock: serializa los refrescos (dos a la vez se estorbarían)
CLAVE_BLOQUEO_REFRESCO = 7_246_002


class AnaliticaNoDisponible(RuntimeError):
    """El schema `analitica` no existe (base creada sin aplicar las migraciones)."""


def analitica_disponible(db: Session) -> bool:
    return db.scalar(text("SELECT to_regclass(:v)"), {"v": f"{SCHEMA}.hechos_citas"}) is not None


def refrescar_analitica(db: Session, concurrently: bool = True) -> datetime:
    """Refresca todas las vistas (dimensiones primero) y devuelve la hora del refresco.

    Va dentro de la transacción de `db` y NO la confirma: quien llama decide. Un bloqueo de
    transacción serializa refrescos simultáneos. `concurrently=True` mantiene las vistas
    legibles durante el refresco; `False` toma un bloqueo exclusivo breve (más rápido tras una
    carga masiva). Lanza `AnaliticaNoDisponible` si las vistas no existen.
    """
    if not analitica_disponible(db):
        raise AnaliticaNoDisponible(
            "El schema 'analitica' no existe: aplica las migraciones (alembic upgrade head)"
        )
    db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": CLAVE_BLOQUEO_REFRESCO})
    opcion = "CONCURRENTLY " if concurrently else ""
    for vista in VISTAS:
        db.execute(text(f"REFRESH MATERIALIZED VIEW {opcion}{SCHEMA}.{vista}"))
    return db.scalar(
        text(
            f"INSERT INTO {SCHEMA}.{TABLA_REFRESCO} (id, refrescado_en) VALUES (1, now()) "
            "ON CONFLICT (id) DO UPDATE SET refrescado_en = excluded.refrescado_en "
            "RETURNING refrescado_en"
        )
    )


def refrescar_si_existe(db: Session, concurrently: bool = False) -> datetime | None:
    """Como `refrescar_analitica`, pero si las vistas no existen lo registra y sigue (seed y
    reinicio deben funcionar también en una base creada sin migraciones)."""
    try:
        return refrescar_analitica(db, concurrently=concurrently)
    except AnaliticaNoDisponible:
        logger.warning("Analítica omitida: el schema 'analitica' no existe (falta migrar)")
        return None
