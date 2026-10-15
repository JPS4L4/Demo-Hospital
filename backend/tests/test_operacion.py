"""Manejo global de errores, /health y configuración operativa."""

import logging

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError, OperationalError

from app.core.database import engine, get_db
from app.core.errors import mensaje_de_integridad
from app.main import app as api


def test_health_ok_consulta_la_base(anon):
    r = anon.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_health_503_si_la_base_falla(anon):
    class SesionRota:
        def execute(self, *a, **k):
            raise OperationalError("SELECT 1", {}, Exception("conexión rechazada"))

    def _get_db_roto():
        yield SesionRota()

    api.dependency_overrides[get_db] = _get_db_roto
    r = anon.get("/health")
    assert r.status_code == 503
    assert r.json()["status"] == "error"


def test_el_engine_verifica_y_recicla_conexiones():
    assert engine.pool._pre_ping is True
    assert engine.pool._recycle == 1800


class _Orig(Exception):
    def __init__(self, pgcode, constraint=None):
        self.pgcode = pgcode
        self.diag = type("Diag", (), {"constraint_name": constraint})()


def _sesion_que_falla(error):
    """Sustituye la sesión de BD por una cuyas consultas lanzan `error`."""

    class Sesion:
        def scalars(self, *a, **k):
            raise error

    def _get_db():
        yield Sesion()

    api.dependency_overrides[get_db] = _get_db


@pytest.fixture
def cliente_sin_reraise(anon):
    with TestClient(api, raise_server_exceptions=False) as c:
        yield c


def test_excepcion_no_controlada_responde_500_json_y_se_registra(cliente_sin_reraise, caplog):
    _sesion_que_falla(RuntimeError("fallo inesperado"))
    with caplog.at_level(logging.ERROR, logger="app"):
        r = cliente_sin_reraise.get("/sedes")
    assert r.status_code == 500
    assert r.json() == {"detail": "Error interno del servidor"}
    assert any("fallo inesperado" in str(rec.exc_info[1]) for rec in caplog.records if rec.exc_info)


@pytest.mark.parametrize(
    "pgcode, constraint, esperado",
    [
        ("23P01", "ex_citas_profesional_solape", "El profesional ya tiene una cita"),
        ("23P01", None, "Ya existe una cita en ese horario"),
        ("23505", None, "Ya existe un registro"),
        ("23514", None, "conflicto"),
    ],
)
def test_integrity_error_no_traducido_responde_409(
    cliente_sin_reraise, pgcode, constraint, esperado
):
    _sesion_que_falla(IntegrityError("INSERT", {}, _Orig(pgcode, constraint)))
    r = cliente_sin_reraise.get("/sedes")
    assert r.status_code == 409
    assert esperado in r.json()["detail"]


def test_mensaje_de_integridad_desconocido_es_none():
    assert mensaje_de_integridad(IntegrityError("x", {}, _Orig("23514"))) is None
