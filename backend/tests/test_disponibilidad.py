"""GET /profesionales/{id}/disponibilidad y su coherencia con las reglas de reserva."""
from datetime import date, datetime, timedelta, timezone

import pytest

from agenda import BOGOTA, dia_futuro, iso
from app.models.profesional import Profesional
from app.services.citas import huecos_libres

LUNES, SABADO, DOMINGO = 0, 5, 6


@pytest.fixture
def prof(crear):
    return crear.profesional()


def consultar(c, prof, dia, **params):
    return c.get(f"/profesionales/{prof['id']}/disponibilidad", params={"fecha": dia.date().isoformat(), **params})


def horas(r):
    return [datetime.fromisoformat(h["inicio"]).astimezone(BOGOTA).strftime("%H:%M") for h in r.json()["huecos"]]


def reservar(c, prof, paciente_id, inicio, duracion=30, motivo="Control"):
    return c.post(
        "/citas",
        json={"paciente_id": paciente_id, "profesional_id": prof["id"], "inicio": iso(inicio),
              "duracion_min": duracion, "motivo": motivo},
    )


def test_dia_libre_cubre_todo_el_horario_y_es_publico(anon, prof):
    r = consultar(anon, prof, dia_futuro(LUNES))
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["profesional_id"] == prof["id"] and cuerpo["duracion_min"] == 30
    assert horas(r)[0] == "07:00" and horas(r)[-1] == "18:30" and len(cuerpo["huecos"]) == 24
    assert cuerpo["huecos"][0]["inicio"].endswith("-05:00")


@pytest.mark.parametrize(
    "duracion,cantidad,ultimo", [(20, 36, "18:40"), (30, 24, "18:30"), (40, 18, "18:20"), (60, 12, "18:00")]
)
def test_el_paso_es_la_duracion_y_la_cita_cabe_antes_de_las_7pm(client, prof, duracion, cantidad, ultimo):
    r = consultar(client, prof, dia_futuro(LUNES), duracion=duracion)
    assert len(r.json()["huecos"]) == cantidad and horas(r)[-1] == ultimo
    fin = datetime.fromisoformat(r.json()["huecos"][-1]["fin"]).astimezone(BOGOTA)
    assert fin.hour * 60 + fin.minute <= 19 * 60


def test_sabado_si_domingo_vacio(client, prof):
    assert len(consultar(client, prof, dia_futuro(SABADO)).json()["huecos"]) == 24
    r = consultar(client, prof, dia_futuro(DOMINGO))
    assert r.status_code == 200 and r.json()["huecos"] == []


def test_fecha_pasada_422_y_parametros_invalidos(client, prof):
    ayer = datetime.now(BOGOTA) - timedelta(days=1)
    assert consultar(client, prof, ayer).status_code == 422
    base = f"/profesionales/{prof['id']}/disponibilidad"
    assert client.get(base).status_code == 422
    assert client.get(base, params={"fecha": "no-es-fecha"}).status_code == 422
    assert client.get(base, params={"fecha": "2999-01-04", "duracion": 25}).status_code == 422
    assert client.get("/profesionales/999/disponibilidad", params={"fecha": "2999-01-04"}).status_code == 404


def test_profesional_inactivo_sin_huecos(client, prof):
    campos = ("nombres", "apellidos", "especialidad_id", "sede_id", "registro_profesional", "email")
    cambios = {k: prof[k] for k in campos} | {"activo": False}
    assert client.put(f"/profesionales/{prof['id']}", json=cambios).status_code == 200
    assert consultar(client, prof, dia_futuro(LUNES)).json()["huecos"] == []


def test_hoy_no_ofrece_horas_pasadas(db, prof):
    profesional = db.get(Profesional, prof["id"])
    dia = date(2999, 1, 4)  # un lunes

    def primero(h, m):
        ahora = datetime(2999, 1, 4, h, m, tzinfo=BOGOTA).astimezone(timezone.utc)
        huecos = huecos_libres(db, profesional, dia, 30, ahora=ahora)
        return huecos[0][0].astimezone(BOGOTA).strftime("%H:%M") if huecos else None

    assert primero(12, 10) == "12:30"
    assert primero(12, 30) == "13:00"  # validar_agenda exige inicio estrictamente futuro
    assert primero(19, 0) is None


def test_hueco_reservado_desaparece_y_al_cancelar_vuelve(client, prof, paciente):
    dia = dia_futuro(LUNES)
    cita = reservar(client, prof, paciente()["id"], dia_futuro(LUNES, 10)).json()
    ocupado = horas(consultar(client, prof, dia))
    assert "10:00" not in ocupado and "09:30" in ocupado and "10:30" in ocupado and len(ocupado) == 23
    sesenta = horas(consultar(client, prof, dia, duracion=60))
    assert "10:00" not in sesenta and "09:00" in sesenta and "11:00" in sesenta

    client.post(f"/citas/{cita['id']}/cancelar")
    assert "10:00" in horas(consultar(client, prof, dia))


def test_citas_de_otro_profesional_no_ocupan_y_las_atendidas_si(client, crear, paciente):
    a, b = crear.profesional(), crear.profesional()
    cita = reservar(client, a, paciente()["id"], dia_futuro(LUNES, 8)).json()
    assert "08:00" in horas(consultar(client, b, dia_futuro(LUNES)))
    client.put(f"/citas/{cita['id']}", json={"estado": "atendida"})
    assert "08:00" not in horas(consultar(client, a, dia_futuro(LUNES)))


@pytest.mark.parametrize("duracion", [20, 40])
def test_disponibilidad_y_reserva_nunca_discrepan(client, prof, paciente, duracion):
    """Cada hueco de la rejilla se reserva (201) si y solo si la disponibilidad lo ofrece (si no, 409)."""
    dia = dia_futuro(LUNES)
    assert reservar(client, prof, paciente()["id"], dia_futuro(LUNES, 10, 10), motivo="Bloqueo").status_code == 201
    ofrecidos = set(horas(consultar(client, prof, dia, duracion=duracion)))
    inicio = dia.replace(hour=7, minute=0)
    rejilla = [inicio + timedelta(minutes=duracion * i) for i in range(12 * 60 // duracion + 1)]
    pid = paciente()["id"]
    for h in rejilla:
        r = reservar(client, prof, pid, h, duracion, "Prueba")
        assert (r.status_code == 201) == (h.strftime("%H:%M") in ofrecidos), (h, r.status_code, r.text)
        if r.status_code == 201:
            client.post(f"/citas/{r.json()['id']}/cancelar")
