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
        or "postgresql://hospital:hospital@localhost:55432/hospital_db"
    )
    return make_url(base).set(database="hospital_test").render_as_string(hide_password=False)


TEST_URL = _url_de_pruebas()
if not make_url(TEST_URL).database.endswith("_test"):
    raise RuntimeError("La base de pruebas debe tener un nombre terminado en '_test'")

# Debe fijarse antes de importar la app: así el engine global nunca apunta a la base real.
os.environ["DATABASE_URL"] = TEST_URL
# Secreto propio de las pruebas (nunca el de un entorno real)
os.environ["JWT_SECRET"] = "secreto-solo-para-pruebas-0123456789abcdef"
os.environ["JWT_EXPIRE_MINUTES"] = "60"
# Las pruebas hacen muchos logins seguidos: el límite se activa solo en test_ratelimit.py
os.environ["RATE_LIMIT_ENABLED"] = "false"

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

import app.models.cita  # noqa: F401
import app.models.especialidad  # noqa: F401
import app.models.medicamento  # noqa: F401
import app.models.noticia  # noqa: F401
import app.models.paciente  # noqa: F401
import app.models.profesional  # noqa: F401
import app.models.sede  # noqa: F401
import app.models.usuario  # noqa: F401
from app.analitica.sql import CREAR as CREAR_ANALITICA
from app.analitica.sql import ELIMINAR as ELIMINAR_ANALITICA
from app.core.database import Base, get_db
from app.core.security import hashear
from app.main import app as api
from app.models.paciente import Paciente
from app.models.usuario import Usuario


def _crear_base_si_falta() -> None:
    url = make_url(TEST_URL)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as con:
        existe = con.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": url.database}
        )
        if not existe:
            con.execute(text(f'CREATE DATABASE "{url.database}"'))
    admin.dispose()


@pytest.fixture(scope="session")
def engine():
    _crear_base_si_falta()
    eng = create_engine(TEST_URL)
    # Las vistas de `analitica` dependen de las tablas: se borran antes que ellas
    with eng.begin() as con:
        for sentencia in ELIMINAR_ANALITICA:
            con.execute(text(sentencia))
    Base.metadata.drop_all(eng)
    # Las restricciones EXCLUDE de citas necesitan btree_gist (la migración también la crea)
    with eng.begin() as con:
        con.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))
    Base.metadata.create_all(eng)
    # create_all no crea vistas materializadas: mismo SQL que la migración
    with eng.begin() as con:
        for sentencia in CREAR_ANALITICA:
            con.execute(text(sentencia))
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


CONTRASENA = "Contrasena-de-prueba-1"


@pytest.fixture
def anon(engine):
    """Cliente sin sesión."""
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


def _con_token(cliente: TestClient, email: str, contrasena: str = CONTRASENA) -> TestClient:
    r = cliente.post("/auth/login", json={"email": email, "password": contrasena})
    assert r.status_code == 200, r.text
    cliente.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    return cliente


@pytest.fixture
def admin(db):
    usuario = Usuario(
        email="admin-prueba@example.com", password_hash=hashear(CONTRASENA), rol="admin"
    )
    db.add(usuario)
    db.commit()
    return usuario


@pytest.fixture
def client(anon, admin):
    """Cliente autenticado como administrador: las pruebas de recursos lo usan por defecto."""
    return _con_token(anon, admin.email)


@pytest.fixture
def cuenta_paciente(db):
    """Fábrica de cuentas de paciente (ficha + usuario) creadas directamente en la base."""
    contador = {"n": 0}

    def _crear(**kw) -> Usuario:
        contador["n"] += 1
        n = contador["n"]
        ficha = Paciente(
            tipo_documento="CC",
            numero_documento=f"2000{n:05d}",
            nombres=f"Cuenta{n}",
            apellidos=f"Prueba{n}",
            fecha_nacimiento="1992-03-04",
            email=f"cuenta{n}@example.com",
            telefono="3001234567",
        )
        usuario = Usuario(
            email=ficha.email, password_hash=hashear(CONTRASENA), rol="paciente", paciente=ficha
        )
        db.add(usuario)
        db.commit()
        return usuario

    return _crear


@pytest.fixture
def cliente_de(anon):
    """Devuelve un cliente nuevo autenticado como el usuario dado (otra sesión HTTP distinta de `client`)."""
    abiertos = []

    def _hacer(usuario: Usuario) -> TestClient:
        c = TestClient(api)
        abiertos.append(c)
        return _con_token(c, usuario.email)

    yield _hacer
    for c in abiertos:
        c.close()


# --- fábricas de datos vía API -------------------------------------------------------------


@pytest.fixture
def crear(client):
    contador = {"n": 0}

    def _sig() -> int:
        contador["n"] += 1
        return contador["n"]

    class Fabrica:
        def sede(self, **kw):
            datos = {
                "nombre": f"Sede {_sig()}",
                "direccion": "Calle 1 # 2-3",
                "ciudad": "Bogotá",
            } | kw
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
