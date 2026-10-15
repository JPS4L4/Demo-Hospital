"""El reinicio de la demo deja la base igual que un seed recién hecho y no se pisa a sí mismo."""

from sqlalchemy import text

from app.core.config import settings
from app.core.database import Base
from app.models.cita import Cita
from app.models.profesional import Profesional
from app.models.usuario import Usuario
from app.seed import ADMIN_EMAIL, seed
from app.services.demo import CLAVE_BLOQUEO_REINICIO, reiniciar_demo


def _conteos(db) -> dict[str, int]:
    return {
        t.name: db.scalar(text(f'SELECT count(*) FROM "{t.name}"'))
        for t in Base.metadata.sorted_tables
    }


def test_reinicio_deja_la_base_como_un_seed_nuevo(anon, client, crear, db, engine):
    seed()
    esperado = _conteos(db)
    assert esperado["citas"] == 6
    # La cuenta de administración que crea el fixture `client` no pertenece al seed y desaparece
    esperado["usuarios"] -= 1

    # Destrozos: datos nuevos, un profesional borrado (con sus citas) y la clave del admin cambiada
    sede = crear.sede(nombre="Sede de prueba")
    crear.profesional(sede_id=sede["id"])
    db.expire_all()
    db.query(Cita).delete()
    db.query(Profesional).filter(Profesional.registro_profesional == "RM-20001").delete()
    admin = db.query(Usuario).filter(Usuario.email == ADMIN_EMAIL).one()
    admin.password_hash = "x"
    db.commit()
    assert _conteos(db) != esperado
    assert reiniciar_demo(db) is True

    assert _conteos(db) == esperado
    assert db.query(Profesional).filter(Profesional.registro_profesional == "RM-20001").count() == 1
    login = anon.post(
        "/auth/login", json={"email": ADMIN_EMAIL, "password": settings.demo_admin_password}
    )
    assert login.status_code == 200 and login.json()["usuario"]["rol"] == "admin"
    cuenta = db.query(Usuario).filter(Usuario.rol == "paciente").one()
    login = anon.post(
        "/auth/login", json={"email": cuenta.email, "password": settings.demo_patient_password}
    )
    assert login.status_code == 200


def test_reinicio_reinicia_los_identificadores(db):
    seed()
    reiniciar_demo(db)
    assert db.scalar(text("SELECT min(id) FROM sedes")) == 1


def test_reinicio_no_toca_alembic_version(db, engine):
    with engine.begin() as con:
        con.execute(text("CREATE TABLE IF NOT EXISTS alembic_version (version_num varchar(32))"))
        con.execute(text("DELETE FROM alembic_version"))
        con.execute(text("INSERT INTO alembic_version VALUES ('abc')"))
    try:
        assert reiniciar_demo(db) is True
        assert db.scalar(text("SELECT version_num FROM alembic_version")) == "abc"
    finally:
        db.rollback()  # suelta el bloqueo de lectura antes de borrar la tabla
        with engine.begin() as con:
            con.execute(text("DROP TABLE alembic_version"))


def test_reinicio_se_omite_si_otro_proceso_tiene_el_bloqueo(db, engine):
    seed()
    antes = _conteos(db)
    with engine.connect() as otro:
        otro.execute(text("SELECT pg_advisory_lock(:k)"), {"k": CLAVE_BLOQUEO_REINICIO})
        try:
            assert reiniciar_demo(db) is False
            assert _conteos(db) == antes
        finally:
            otro.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": CLAVE_BLOQUEO_REINICIO})
            otro.commit()
    assert reiniciar_demo(db) is True


def test_si_el_seed_falla_no_se_pierde_nada(db, monkeypatch):
    seed()
    antes = _conteos(db)

    def _roto(_db):
        raise RuntimeError("fallo del seed")

    monkeypatch.setattr("app.services.demo.sembrar", _roto)
    try:
        reiniciar_demo(db)
    except RuntimeError:
        pass
    else:
        raise AssertionError("debía propagar el error")
    assert _conteos(db) == antes
