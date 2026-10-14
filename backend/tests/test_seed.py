"""El seed es idempotente y sus datos cumplen las reglas del dominio."""
from datetime import datetime, timezone

from app.seed import seed
from app.services.citas import validar_horario


def test_seed_es_idempotente(client):
    primera = seed()
    assert primera["sedes"] == 4 and primera["especialidades"] == 8 and primera["profesionales"] == 12
    assert primera["medicamentos"] == 15 and primera["pacientes"] == 5 and primera["citas"] == 6
    assert sum(seed().values()) == 0


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
