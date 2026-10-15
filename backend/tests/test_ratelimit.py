"""Límite de intentos por IP en /auth/login y /auth/registro."""

import pytest
from conftest import CONTRASENA

from app.core import ratelimit
from app.core.config import settings

LOGIN_MALO = {"email": "nadie@example.com", "password": "incorrecta-1234"}


@pytest.fixture(autouse=True)
def limite_activo(monkeypatch):
    """En el resto de pruebas el límite está apagado (conftest); aquí se enciende y se reinicia."""
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(settings, "rate_limit_login_por_minuto", 3)
    monkeypatch.setattr(settings, "rate_limit_registro_por_minuto", 2)
    monkeypatch.setattr(settings, "trusted_proxy", False)
    ratelimit.limitador.reiniciar()
    yield
    ratelimit.limitador.reiniciar()


def test_login_devuelve_429_al_superar_el_limite(anon):
    for _ in range(3):
        assert anon.post("/auth/login", json=LOGIN_MALO).status_code == 401
    r = anon.post("/auth/login", json=LOGIN_MALO)
    assert r.status_code == 429
    assert "Demasiados intentos" in r.json()["detail"]
    assert int(r.headers["Retry-After"]) >= 1


def test_el_limite_cuenta_tambien_los_logins_correctos(anon, admin):
    for _ in range(3):
        assert (
            anon.post(
                "/auth/login", json={"email": admin.email, "password": CONTRASENA}
            ).status_code
            == 200
        )
    assert anon.post("/auth/login", json=LOGIN_MALO).status_code == 429


def test_registro_tiene_su_propio_limite(anon):
    for _ in range(2):
        # cuerpo inválido: igual cuenta, y no cuesta un hash de Argon2
        assert anon.post("/auth/registro", json={}).status_code == 422
    assert anon.post("/auth/registro", json={}).status_code == 429
    # el contador de login es independiente
    assert anon.post("/auth/login", json=LOGIN_MALO).status_code == 401


def test_el_resto_de_la_api_no_se_limita(anon):
    for _ in range(10):
        assert anon.get("/health").status_code == 200


def test_el_cupo_se_libera_al_pasar_la_ventana(anon, monkeypatch):
    reloj = [1000.0]
    monkeypatch.setattr(ratelimit.time, "monotonic", lambda: reloj[0])
    for _ in range(3):
        anon.post("/auth/login", json=LOGIN_MALO)
    assert anon.post("/auth/login", json=LOGIN_MALO).status_code == 429
    reloj[0] += 61
    assert anon.post("/auth/login", json=LOGIN_MALO).status_code == 401


def test_desactivado_no_limita(anon, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", False)
    for _ in range(6):
        assert anon.post("/auth/login", json=LOGIN_MALO).status_code == 401


def _agotar(anon, ip):
    for _ in range(3):
        anon.post("/auth/login", json=LOGIN_MALO, headers={"X-Forwarded-For": ip})


def test_sin_proxy_de_confianza_se_ignora_x_forwarded_for(anon):
    _agotar(anon, "1.1.1.1")
    r = anon.post("/auth/login", json=LOGIN_MALO, headers={"X-Forwarded-For": "2.2.2.2"})
    assert r.status_code == 429  # misma IP real: el encabezado no sirve para esquivar el límite


def test_con_proxy_de_confianza_cada_ip_tiene_su_cupo(anon, monkeypatch):
    monkeypatch.setattr(settings, "trusted_proxy", True)
    _agotar(anon, "9.9.9.9, 1.1.1.1")
    mismo = anon.post(
        "/auth/login", json=LOGIN_MALO, headers={"X-Forwarded-For": "8.8.8.8, 1.1.1.1"}
    )
    otro = anon.post("/auth/login", json=LOGIN_MALO, headers={"X-Forwarded-For": "1.1.1.2"})
    assert mismo.status_code == 429  # cuenta la última IP, la que añadió el proxy
    assert otro.status_code == 401


def test_el_limitador_libera_memoria_de_claves_vencidas():
    lim = ratelimit.LimitadorVentana(ventana=60)
    for i in range(10_001):
        lim.registrar(f"k{i}", 5)
    assert len(lim._eventos) == 10_001
    lim._purgar(10**9)
    assert lim._eventos == {}
