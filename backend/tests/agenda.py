"""Fechas de prueba para las reglas de agenda (hora de Bogotá, UTC-5 sin horario de verano)."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BOGOTA = ZoneInfo("America/Bogota")


def dia_futuro(weekday: int, hora: int = 10, minuto: int = 0, semanas: int = 1) -> datetime:
    """Próximo `weekday` (0 = lunes ... 6 = domingo), al menos `semanas` semanas adelante."""
    hoy = datetime.now(BOGOTA).replace(hour=hora, minute=minuto, second=0, microsecond=0)
    dias = (weekday - hoy.weekday()) % 7 + 7 * semanas
    return hoy + timedelta(days=dias)


def iso(valor: datetime) -> str:
    return valor.isoformat()
