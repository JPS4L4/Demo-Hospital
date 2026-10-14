"""Infraestructura de pruebas.

Las pruebas usan una base PostgreSQL propia (`hospital_test` por defecto) en el mismo
servidor que la de desarrollo: se crea si no existe, las tablas se crean con
`Base.metadata.create_all` al empezar la sesión y se vacían tras cada prueba.

`TEST_DATABASE_URL` permite elegir otra; su nombre de base debe terminar en `_test`
para no tocar nunca datos de desarrollo por error.
"""
import os
from pathlib import Path

import pytest
from dotenv import dotenv_values
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


def _url_de_pruebas() -> str:
    explicita = os.environ.get("TEST_DATABASE_URL")
    if explicita:
        return explicita
    base = (
        os.environ.get("DATABASE_URL")
        or dotenv_values(Path(__file__).resolve().parents[1] / ".env").get("DATABASE_URL")
        or "postgresql://hospital:hospital@localhost:5432/hospital_db"
    )
    return make_url(base).set(database="hospital_test").render_as_string(hide_password=False)


TEST_URL = _url_de_pruebas()
if not make_url(TEST_URL).database.endswith("_test"):
    raise RuntimeError("La base de pruebas debe tener un nombre terminado en '_test'")

# Debe fijarse antes de importar la app: así el engine global nunca apunta a la base real.
os.environ["DATABASE_URL"] = TEST_URL

from app.core.database import Base, get_db  # noqa: E402
from app.main import app as api  # noqa: E402
import app.models.cita, app.models.especialidad, app.models.medicamento, app.models.noticia  # noqa: E402,F401,E401
import app.models.paciente, app.models.profesional, app.models.sede  # noqa: E402,F401,E401

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402


def _crear_base_si_falta() -> None:
    url = make_url(TEST_URL)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as con:
        existe = con.scalar(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": url.database})
        if not existe:
            con.execute(text(f'CREATE DATABASE "{url.database}"'))
    admin.dispose()


@pytest.fixture(scope="session")
def engine():
    _crear_base_si_falta()
    eng = create_engine(TEST_URL)
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture(autouse=True)
def _limpiar_tablas(engine):
    yield
    tablas = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    with engine.begin() as con:
        con.execute(text(f"TRUNCATE {tablas} RESTART IDENTITY CASCADE"))


@pytest.fixture
def db(engine):
    sesion = sessionmaker(bind=engine, autoflush=False)()
    try:
        yield sesion
    finally:
        sesion.close()


@pytest.fixture
def client(engine):
    factoria = sessionmaker(bind=engine, autoflush=False)

    def _get_db():
        sesion = factoria()
        try:
            yield sesion
        finally:
            sesion.close()

    api.dependency_overrides[get_db] = _get_db
    with TestClient(api) as c:
        yield c
    api.dependency_overrides.clear()


# --- fábricas de datos vía API -------------------------------------------------------------

@pytest.fixture
def crear(client):
    contador = {"n": 0}

    def _sig() -> int:
        contador["n"] += 1
        return contador["n"]

    class Fabrica:
        def sede(self, **kw):
            datos = {"nombre": f"Sede {_sig()}", "direccion": "Calle 1 # 2-3", "ciudad": "Bogotá"} | kw
            r = client.post("/sedes", json=datos)
            assert r.status_code == 201, r.text
            return r.json()

        def especialidad(self, **kw):
            datos = {"nombre": f"Especialidad {_sig()}", "descripcion": "Descripción"} | kw
            r = client.post("/especialidades", json=datos)
            assert r.status_code == 201, r.text
            return r.json()

        def profesional(self, especialidad_id=None, sede_id=None, **kw):
            n = _sig()
            datos = {
                "nombres": f"Nombre{n}",
                "apellidos": f"Apellido{n}",
                "especialidad_id": especialidad_id or self.especialidad()["id"],
                "sede_id": sede_id or self.sede()["id"],
                "registro_profesional": f"RM-{n:05d}",
                "email": f"prof{n}@example.com",
            } | kw
            r = client.post("/profesionales", json=datos)
            assert r.status_code == 201, r.text
            return r.json()

    return Fabrica()


@pytest.fixture
def paciente(client):
    """Fábrica de pacientes únicos vía API."""
    contador = {"n": 0}

    def _crear(**kw):
        contador["n"] += 1
        n = contador["n"]
        datos = {
            "tipo_documento": "CC",
            "numero_documento": f"1000{n:05d}",
            "nombres": f"Paciente{n}",
            "apellidos": f"Prueba{n}",
            "fecha_nacimiento": "1990-05-17",
            "email": f"paciente{n}@example.com",
            "telefono": "3001234567",
        } | kw
        r = client.post("/pacientes", json=datos)
        assert r.status_code == 201, r.text
        return r.json()

    return _crear
