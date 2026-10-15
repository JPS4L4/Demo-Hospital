import logging

from app.core.config import settings

FORMATO = "%(asctime)s %(levelname)s %(name)s: %(message)s"


def configurar_logging() -> None:
    """Configuración básica de registro (stderr). El nivel sale de LOG_LEVEL; uno inválido usa INFO."""
    nivel = logging.getLevelName(settings.log_level.upper())
    logging.basicConfig(level=nivel if isinstance(nivel, int) else logging.INFO, format=FORMATO)
