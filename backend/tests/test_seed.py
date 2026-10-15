"""El seed es idempotente y sus datos cumplen las reglas del dominio."""

from datetime import datetime, timezone

from app.core.config import settings
from app.models.usuario import Usuario
from app.seed import seed
from app.services.citas import validar_horario


def test_seed_es_idempotente(client):
    primera = seed()
    assert (
        primera["sedes"] == 4 and primera["especialidades"] == 8 and primera["profesionales"] == 12
    )
    assert primera["medicamentos"] == 15 and primera["pacientes"] == 5 and primera["citas"] == 6
    assert primera["usuarios"] == 2
    assert sum(seed().values()) == 0


def test_seed_crea_cuentas_demo_que_pueden_iniciar_sesion(anon, db):
    seed()
    seed()
    assert db.query(Usuario).count() == 2
    admin = anon.post(
        "/auth/login",
        json={"email": "admin@meridiana.example", "password": settings.demo_admin_password},
    )
    assert admin.status_code == 200 and admin.json()["usuario"]["rol"] == "admin"
    cuenta = db.query(Usuario).filter(Usuario.rol == "paciente").one()
    paciente = anon.post(
        "/auth/login", json={"email": cuenta.email, "password": settings.demo_patient_password}
    )
    assert (
        paciente.status_code == 200
        and paciente.json()["usuario"]["paciente"]["id"] == cuenta.paciente_id
    )
    assert (
        anon.post(
            "/auth/login", json={"email": cuenta.email, "password": "otra-clave-1234"}
        ).status_code
        == 401
    )


def test_seed_no_pisa_una_cuenta_existente(db):
    seed()
    admin = db.query(Usuario).filter(Usuario.email == "admin@meridiana.example").one()
    antes = admin.password_hash
    seed()
    db.refresh(admin)
    assert admin.password_hash == antes


def test_datos_del_seed_son_consistentes(client):
    seed()
    profesionales = client.get("/profesionales", params={"limit": 100}).json()
    assert profesionales["total"] == 12
    assert len({p["sede"]["id"] for p in profesionales["items"]}) == 4
    assert all(p["activo"] for p in profesionales["items"])
    assert client.get("/medicamentos", params={"requiere_formula": "true"}).json()["total"] > 0

    citas = client.get("/citas", params={"limit": 100}).json()["items"]
    ahora = datetime.now(timezone.utc)
    for c in citas:
        inicio = datetime.fromisoformat(c["inicio"])
        assert inicio > ahora and c["estado"] == "programada"
        validar_horario(inicio, datetime.fromisoformat(c["fin"]))
