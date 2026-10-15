"""Reinicio de la demo: vacía los datos y vuelve a sembrarlos.

Las credenciales de las cuentas demo son públicas, así que cualquiera puede borrar o ensuciar
datos. Esta función devuelve la base al estado del seed en una sola transacción: o queda todo
como un seed recién hecho o no cambia nada.
"""

import asyncio
import logging

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import Base, SessionLocal
from app.seed import sembrar
from app.services.analitica import refrescar_si_existe

logger = logging.getLogger("app.demo")

# Clave fija del advisory lock. Con varios workers (o varias réplicas) todos intentan reiniciar a
# la vez; solo el primero en tomarla lo hace y los demás lo omiten.
CLAVE_BLOQUEO_REINICIO = 7_246_001


def reiniciar_demo(db: Session) -> bool:
    """Vacía todas las tablas de datos y ejecuta el seed, todo en la transacción de `db`.

    Devuelve False (sin tocar nada) si otro proceso ya está reiniciando. Nunca toca
    `alembic_version`: solo las tablas del modelo. El bloqueo es de transacción, así que se
    libera solo al confirmar o deshacer; si algo falla se deshace todo y se relanza el error.
    """
    try:
        if not db.scalar(
            text("SELECT pg_try_advisory_xact_lock(:k)"), {"k": CLAVE_BLOQUEO_REINICIO}
        ):
            db.rollback()
            return False
        tablas = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
        db.execute(text(f"TRUNCATE {tablas} RESTART IDENTITY CASCADE"))
        # Los objetos que la sesión tuviera cargados ya no existen: fuera del mapa de identidad
        db.expunge_all()
        sembrar(db)
        # Refresco normal (no CONCURRENTLY) dentro de la misma transacción: tras vaciar y
        # sembrar todo es lo más barato y deja datos y analítica confirmados juntos.
        refrescar_si_existe(db, concurrently=False)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return True


def reiniciar_demo_en_sesion_propia() -> bool:
    """Abre su propia sesión (se ejecuta en un hilo, fuera del bucle de eventos) y reinicia."""
    with SessionLocal() as db:
        return reiniciar_demo(db)


async def bucle_reinicio(intervalo_horas: float, reiniciar=reiniciar_demo_en_sesion_propia) -> None:
    """Reinicia la demo cada `intervalo_horas`; el primer reinicio llega tras un intervalo, no al
    arrancar. Un error se registra y el bucle sigue; solo la cancelación (apagado) lo detiene."""
    while True:
        await asyncio.sleep(intervalo_horas * 3600)
        try:
            if await asyncio.to_thread(reiniciar):
                logger.info("Reinicio de la demo: hecho")
            else:
                logger.info("Reinicio de la demo: omitido (otro proceso ya lo está haciendo)")
        except Exception:
            logger.exception("Reinicio de la demo: falló; se reintentará en el siguiente intervalo")
