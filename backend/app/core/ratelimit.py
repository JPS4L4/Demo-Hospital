"""Límite de intentos por IP (ventana deslizante en memoria) para los endpoints de autenticación.

Se usa como dependencia: `Depends(limitar("login"))`. Al superarlo responde 429 con `Retry-After`.
Los límites y el interruptor salen de `settings` en cada petición.
"""

import threading
import time
from collections import deque

from fastapi import HTTPException, Request

from app.core.config import settings

VENTANA_SEGUNDOS = 60.0
_LIMITES = {
    "login": lambda: settings.rate_limit_login_por_minuto,
    "registro": lambda: settings.rate_limit_registro_por_minuto,
}


class LimitadorVentana:
    """Cuenta eventos por clave en los últimos `ventana` segundos."""

    def __init__(self, ventana: float = VENTANA_SEGUNDOS):
        self.ventana = ventana
        self._eventos: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def reiniciar(self) -> None:
        with self._lock:
            self._eventos.clear()

    def registrar(self, clave: str, limite: int) -> float | None:
        """Anota un intento. None si cabe; si no, los segundos que faltan para que se libere un cupo."""
        ahora = time.monotonic()
        with self._lock:
            if len(self._eventos) > 10_000:  # evita que la memoria crezca sin tope
                self._purgar(ahora)
            cola = self._eventos.setdefault(clave, deque())
            while cola and ahora - cola[0] >= self.ventana:
                cola.popleft()
            if len(cola) >= limite:
                return self.ventana - (ahora - cola[0])
            cola.append(ahora)
            return None

    def _purgar(self, ahora: float) -> None:
        for clave in [
            k for k, c in self._eventos.items() if not c or ahora - c[-1] >= self.ventana
        ]:
            del self._eventos[clave]


limitador = LimitadorVentana()


def ip_del_cliente(request: Request) -> str:
    if settings.trusted_proxy:
        reenviado = request.headers.get("x-forwarded-for", "")
        ultima = reenviado.split(",")[-1].strip()
        if ultima:
            return ultima
    return request.client.host if request.client else "desconocida"


def limitar(nombre: str):
    """Dependencia que aplica el límite `nombre` ("login" o "registro") a la IP del cliente."""
    limite_de = _LIMITES[nombre]

    def _dependencia(request: Request) -> None:
        if not settings.rate_limit_enabled:
            return
        espera = limitador.registrar(f"{nombre}:{ip_del_cliente(request)}", limite_de())
        if espera is not None:
            segundos = max(1, int(espera) + 1)
            raise HTTPException(
                429,
                f"Demasiados intentos. Espera {segundos} segundos antes de volver a intentarlo",
                headers={"Retry-After": str(segundos)},
            )

    return _dependencia
