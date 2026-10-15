"""El seed es idempotente y sus datos cumplen las reglas del dominio."""

from collections import Counter
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func

from app.core.config import settings
from app.models.cita import Cita
from app.models.paciente import Paciente
from app.models.usuario import Usuario
from app.seed import PROFESIONALES, seed
from app.seed_historial import (
    DIAS_HISTORIAL,
    generar_pacientes,
    planificar_historial,
)
from app.services.citas import validar_horario


def test_seed_es_idempotente(client):
    primera = seed()
    assert (
        primera["sedes"] == 4 and primera["especialidades"] == 8 and primera["profesionales"] == 12
    )
    assert primera["medicamentos"] == 15 and primera["pacientes"] == 5 and primera["citas"] == 6
    assert primera["usuarios"] == 2
    assert primera["pacientes_historicos"] > 100 and primera["citas_historicas"] > 1000
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

    citas = client.get("/citas", params={"limit": 100, "estado": "programada"}).json()["items"]
    assert len(citas) == 6
    ahora = datetime.now(UTC)
    for c in citas:
        inicio = datetime.fromisoformat(c["inicio"])
        assert inicio > ahora and c["estado"] == "programada"
        validar_horario(inicio, datetime.fromisoformat(c["fin"]))


# --- histórico sintético ---------------------------------------------------------------------


def _plan(hoy: date = date(2026, 10, 15)):
    profesionales = [(i + 1, p[2], i % 4 + 1) for i, p in enumerate(PROFESIONALES)]
    pacientes = generar_pacientes(hoy)
    ids = [(i + 1, (hoy - d["fecha_nacimiento"]).days < 18 * 365) for i, d in enumerate(pacientes)]
    return planificar_historial(profesionales, ids, hoy), profesionales


def test_planificacion_del_historial_es_determinista():
    primera, _ = _plan()
    segunda, _ = _plan()
    assert primera == segunda
    assert generar_pacientes(date(2026, 10, 15)) == generar_pacientes(date(2026, 10, 15))


def test_historial_cumple_las_reglas_de_agenda():
    hoy = date(2026, 10, 15)
    citas, _ = _plan(hoy)
    assert 2500 < len(citas) < 8000
    por_prof: dict[int, list] = {}
    por_pac: dict[int, list] = {}
    for c in citas:
        ini, fin = c["inicio"], c["fin"]
        assert ini.date() < hoy and ini.date() >= hoy - timedelta(days=DIAS_HISTORIAL)
        assert ini.weekday() != 6, "no hay atención los domingos"
        assert ini.date() == fin.date() and ini.hour >= 7 and (fin.hour, fin.minute) <= (19, 0)
        assert fin - ini == timedelta(minutes=c["duracion_min"]) and c["duracion_min"] in (
            20,
            30,
            40,
            60,
        )
        assert c["estado"] in ("atendida", "cancelada")
        if c["estado"] != "cancelada":
            por_prof.setdefault(c["profesional_id"], []).append((ini, fin))
            por_pac.setdefault(c["paciente_id"], []).append((ini, fin))
    for grupo in (*por_prof.values(), *por_pac.values()):
        grupo.sort()
        assert all(a[1] <= b[0] for a, b in zip(grupo, grupo[1:], strict=False))


def test_historial_tiene_patrones_de_demanda():
    citas, _ = _plan()
    canceladas = sum(c["estado"] == "cancelada" for c in citas) / len(citas)
    assert 0.10 <= canceladas <= 0.15
    por_dia = Counter(c["inicio"].weekday() for c in citas)
    assert por_dia[0] == max(por_dia.values()), "el lunes es el día de mayor demanda"
    assert por_dia[5] < min(por_dia[d] for d in range(5)), "el sábado tiene poca demanda"
    por_hora = Counter(c["inicio"].hour for c in citas)
    assert max(por_hora, key=por_hora.get) in (8, 9, 10), "pico por la mañana"
    por_prof = Counter(c["profesional_id"] for c in citas)
    assert max(por_prof.values()) > 1.3 * min(por_prof.values()), "especialidades desiguales"


def test_seed_siembra_historial_y_respeta_las_citas_futuras(db):
    seed()
    ahora = datetime.now(UTC)
    pasadas = db.query(Cita).filter(Cita.inicio < ahora).count()
    futuras = db.query(Cita).filter(Cita.inicio > ahora).all()
    assert pasadas > 1000
    assert len(futuras) == 6 and all(c.estado == "programada" for c in futuras)
    # Todo lo pasado está atendido o cancelado; nada queda "programada" en el pasado
    assert db.query(Cita).filter(Cita.inicio < ahora, Cita.estado == "programada").count() == 0
    # Los pacientes del histórico son ficticios y las cuentas demo siguen siendo solo dos
    assert (
        db.query(Paciente).filter(Paciente.email.like("%@example.com")).count()
        == db.query(func.count(Paciente.id)).scalar()
    )
    assert db.query(Usuario).count() == 2
