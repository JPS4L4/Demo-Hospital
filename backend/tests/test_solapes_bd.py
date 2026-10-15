"""La base garantiza que no haya dobles reservas aunque falle (o se salte) la validación de la app."""

import threading
from datetime import timedelta

import pytest
from agenda import dia_futuro, iso
from sqlalchemy.exc import IntegrityError

from app.models.cita import Cita

LUNES = 0


@pytest.fixture
def escenario(client, crear, paciente):
    sede = crear.sede()
    return {
        "sede": sede,
        "prof_a": crear.profesional(sede_id=sede["id"]),
        "prof_b": crear.profesional(sede_id=sede["id"]),
        "pac_a": paciente(),
        "pac_b": paciente(),
    }


def _cuerpo(paciente, profesional, inicio):
    return {
        "paciente_id": paciente["id"],
        "profesional_id": profesional["id"],
        "inicio": iso(inicio),
        "motivo": "Control general",
    }


def _reservar_a_la_vez(cliente_de, admin, cuerpos):
    """Lanza una reserva por hilo (cada una con su propio cliente) y las suelta a la vez."""
    clientes = [cliente_de(admin) for _ in cuerpos]
    salida: list = [None] * len(cuerpos)
    arranque = threading.Barrier(len(cuerpos))

    def _hilo(i):
        arranque.wait()
        salida[i] = clientes[i].post("/citas", json=cuerpos[i])

    hilos = [threading.Thread(target=_hilo, args=(i,)) for i in range(len(cuerpos))]
    for h in hilos:
        h.start()
    for h in hilos:
        h.join()
    return sorted(r.status_code for r in salida)


def test_dos_reservas_simultaneas_del_mismo_profesional(escenario, cliente_de, admin):
    inicio = dia_futuro(LUNES, 10, 0)
    cuerpos = [
        _cuerpo(escenario["pac_a"], escenario["prof_a"], inicio),
        _cuerpo(escenario["pac_b"], escenario["prof_a"], inicio),
    ]
    assert _reservar_a_la_vez(cliente_de, admin, cuerpos) == [201, 409]


def test_dos_reservas_simultaneas_del_mismo_paciente(escenario, cliente_de, admin):
    inicio = dia_futuro(LUNES, 11, 0)
    cuerpos = [
        _cuerpo(escenario["pac_a"], escenario["prof_a"], inicio),
        _cuerpo(escenario["pac_a"], escenario["prof_b"], inicio),
    ]
    assert _reservar_a_la_vez(cliente_de, admin, cuerpos) == [201, 409]


def test_muchas_reservas_simultaneas_dejan_una_sola(escenario, cliente_de, admin):
    inicio = dia_futuro(LUNES, 12, 0)
    cuerpos = [
        _cuerpo(escenario["pac_a"], escenario["prof_a"], inicio + timedelta(minutes=m))
        for m in (0, 10, 20, 0)
    ]
    estados = _reservar_a_la_vez(cliente_de, admin, cuerpos)
    assert estados.count(201) == 1 and estados.count(409) == 3


def _cita(escenario, paciente, profesional, inicio, estado="programada"):
    return Cita(
        paciente_id=escenario[paciente]["id"],
        profesional_id=escenario[profesional]["id"],
        sede_id=escenario["sede"]["id"],
        inicio=inicio,
        fin=inicio + timedelta(minutes=30),
        duracion_min=30,
        motivo="Directa",
        estado=estado,
    )


def test_la_bd_rechaza_solape_del_profesional_sin_pasar_por_la_app(escenario, db):
    inicio = dia_futuro(LUNES, 9, 0)
    db.add(_cita(escenario, "pac_a", "prof_a", inicio))
    db.commit()
    db.add(_cita(escenario, "pac_b", "prof_a", inicio + timedelta(minutes=15)))
    with pytest.raises(IntegrityError) as exc:
        db.commit()
    assert exc.value.orig.pgcode == "23P01"
    assert exc.value.orig.diag.constraint_name == "ex_citas_profesional_solape"


def test_la_bd_rechaza_solape_del_paciente_sin_pasar_por_la_app(escenario, db):
    inicio = dia_futuro(LUNES, 9, 0)
    db.add(_cita(escenario, "pac_a", "prof_a", inicio))
    db.commit()
    db.add(_cita(escenario, "pac_a", "prof_b", inicio))
    with pytest.raises(IntegrityError) as exc:
        db.commit()
    assert exc.value.orig.diag.constraint_name == "ex_citas_paciente_solape"


def test_la_bd_permite_citas_contiguas_y_canceladas(escenario, db):
    inicio = dia_futuro(LUNES, 9, 0)
    db.add(_cita(escenario, "pac_a", "prof_a", inicio))
    db.add(_cita(escenario, "pac_a", "prof_a", inicio + timedelta(minutes=30)))  # contigua
    db.add(_cita(escenario, "pac_b", "prof_a", inicio, estado="cancelada"))  # cancelada
    db.commit()
    assert db.query(Cita).count() == 3


def test_la_api_responde_409_si_la_bd_detecta_el_solape(escenario, client, monkeypatch):
    """Si la validación de la app no lo viera, el 23P01 de la base se traduce a 409 (no a 500)."""
    monkeypatch.setattr("app.services.citas._hay_solape", lambda *a, **k: False)
    inicio = dia_futuro(LUNES, 14, 0)
    ok = client.post("/citas", json=_cuerpo(escenario["pac_a"], escenario["prof_a"], inicio))
    assert ok.status_code == 201
    r = client.post("/citas", json=_cuerpo(escenario["pac_b"], escenario["prof_a"], inicio))
    assert r.status_code == 409 and "profesional" in r.json()["detail"]
    r = client.post("/citas", json=_cuerpo(escenario["pac_a"], escenario["prof_b"], inicio))
    assert r.status_code == 409 and "paciente" in r.json()["detail"]
