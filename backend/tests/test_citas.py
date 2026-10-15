"""Citas y reglas de agenda (tarea D3)."""

from datetime import UTC, timedelta

import pytest
from agenda import dia_futuro, iso

LUNES, SABADO, DOMINGO = 0, 5, 6


@pytest.fixture
def escenario(client, crear, paciente):
    sede = crear.sede(nombre="Sede Chapinero")
    prof = crear.profesional(sede_id=sede["id"])
    return {"sede": sede, "prof": prof, "pac": paciente()}


def reservar(client, esc, inicio, **kw):
    datos = {
        "paciente_id": esc["pac"]["id"],
        "profesional_id": esc["prof"]["id"],
        "inicio": iso(inicio),
        "motivo": "Control general",
    } | kw
    return client.post("/citas", json=datos)


def test_crear_cita_deriva_sede_y_anida_datos(client, escenario):
    inicio = dia_futuro(LUNES, 10, 0)
    r = reservar(client, escenario, inicio)
    assert r.status_code == 201, r.text
    cita = r.json()
    assert cita["estado"] == "programada" and cita["duracion_min"] == 30
    assert cita["sede_id"] == escenario["sede"]["id"] and cita["sede"]["nombre"] == "Sede Chapinero"
    assert cita["paciente"]["id"] == escenario["pac"]["id"]
    assert cita["profesional"]["especialidad"]["nombre"].startswith("Especialidad")
    assert cita["fin"] > cita["inicio"]
    assert client.get(f"/citas/{cita['id']}").json() == cita


def test_sede_explicita_debe_coincidir(client, escenario, crear):
    inicio = dia_futuro(LUNES, 10, 0)
    ok = reservar(client, escenario, inicio, sede_id=escenario["sede"]["id"])
    assert ok.status_code == 201
    otra = crear.sede()
    r = reservar(client, escenario, inicio + timedelta(hours=1), sede_id=otra["id"])
    assert r.status_code == 422 and "sede" in r.json()["detail"]


def test_referencias_inexistentes_422(client, escenario):
    inicio = dia_futuro(LUNES, 10, 0)
    assert reservar(client, escenario, inicio, paciente_id=999).status_code == 422
    assert reservar(client, escenario, inicio, profesional_id=999).status_code == 422


@pytest.mark.parametrize("cambio", [{"duracion_min": 25}, {"motivo": ""}])
def test_validacion_de_entrada_422(client, escenario, cambio):
    r = reservar(client, escenario, dia_futuro(LUNES, 10, 0), **cambio)
    assert r.status_code == 422


def test_inicio_sin_zona_horaria_422(client, escenario):
    naive = dia_futuro(LUNES, 10, 0).replace(tzinfo=None)
    r = reservar(client, escenario, naive)
    assert r.status_code == 422


def test_cita_en_el_pasado_422(client, escenario):
    pasado = dia_futuro(LUNES, 10, 0, semanas=-3)
    r = reservar(client, escenario, pasado)
    assert r.status_code == 422 and "futur" in r.json()["detail"]


def test_cita_demasiado_lejana_422(client, escenario):
    lejana = dia_futuro(LUNES, 10, 0, semanas=60)
    r = reservar(client, escenario, lejana)
    assert r.status_code == 422 and "anticipación" in r.json()["detail"]


@pytest.mark.parametrize("anio", [2200, 9999])
def test_fecha_extrema_no_desborda_al_crear(client, escenario, anio):
    r = reservar(client, escenario, dia_futuro(LUNES, 10, 0).replace(year=anio))
    assert r.status_code == 422, r.text


def test_fecha_extrema_no_desborda_al_reprogramar(client, escenario):
    cita = reservar(client, escenario, dia_futuro(LUNES, 10, 0)).json()
    for anio in (2200, 9999):
        lejana = dia_futuro(LUNES, 10, 0).replace(year=anio)
        r = client.put(f"/citas/{cita['id']}", json={"inicio": iso(lejana)})
        assert r.status_code == 422, r.text


def test_domingo_409(client, escenario):
    r = reservar(client, escenario, dia_futuro(DOMINGO, 10, 0))
    assert r.status_code == 409 and "domingo" in r.json()["detail"]


def test_sabado_si_hay_atencion(client, escenario):
    assert reservar(client, escenario, dia_futuro(SABADO, 9, 0)).status_code == 201


@pytest.mark.parametrize(
    "hora, minuto, duracion, esperado",
    [
        (6, 40, 20, 409),  # antes de abrir
        (7, 0, 30, 201),  # justo a la apertura
        (18, 30, 30, 201),  # termina justo a las 19:00
        (18, 40, 30, 409),  # termina a las 19:10
        (19, 0, 20, 409),  # empieza al cierre
        (18, 40, 20, 201),  # termina a las 19:00
        (18, 0, 60, 201),
        (18, 20, 60, 409),
    ],
)
def test_horario_de_atencion(client, escenario, hora, minuto, duracion, esperado):
    r = reservar(client, escenario, dia_futuro(LUNES, hora, minuto), duracion_min=duracion)
    assert r.status_code == esperado, r.text
    if esperado == 409:
        assert "horario" in r.json()["detail"]


def test_horario_se_evalua_en_hora_de_bogota_aunque_llegue_en_utc(client, escenario):
    # 12:00 UTC = 07:00 en Bogotá (dentro); 11:30 UTC = 06:30 (fuera)
    dentro = dia_futuro(LUNES, 7, 0).astimezone(UTC)
    assert dentro.hour == 12
    assert reservar(client, escenario, dentro).status_code == 201
    fuera = dia_futuro(LUNES + 1, 6, 30).astimezone(UTC)
    assert reservar(client, escenario, fuera).status_code == 409


def test_profesional_inactivo_409(client, escenario):
    p = escenario["prof"]
    cambios = {
        k: p[k]
        for k in (
            "nombres",
            "apellidos",
            "especialidad_id",
            "sede_id",
            "registro_profesional",
            "email",
        )
    }
    assert (
        client.put(f"/profesionales/{p['id']}", json=cambios | {"activo": False}).status_code == 200
    )
    r = reservar(client, escenario, dia_futuro(LUNES, 10, 0))
    assert r.status_code == 409 and "activo" in r.json()["detail"]


def test_solape_del_mismo_profesional_409(client, escenario, paciente):
    inicio = dia_futuro(LUNES, 10, 0)
    assert reservar(client, escenario, inicio).status_code == 201
    otro = {"pac": paciente(), "prof": escenario["prof"]}
    for desplazamiento in (0, 10, 29):
        r = reservar(client, otro, inicio + timedelta(minutes=desplazamiento))
        assert r.status_code == 409 and "profesional" in r.json()["detail"]
    # una cita que termina justo cuando empieza otra no se solapa
    assert reservar(client, otro, inicio + timedelta(minutes=30)).status_code == 201
    assert reservar(client, otro, inicio - timedelta(minutes=30)).status_code == 201


def test_solape_del_mismo_paciente_con_otro_profesional_409(client, escenario, crear):
    inicio = dia_futuro(LUNES, 10, 0)
    assert reservar(client, escenario, inicio).status_code == 201
    otro_prof = crear.profesional()
    r = reservar(client, escenario, inicio + timedelta(minutes=15), profesional_id=otro_prof["id"])
    assert r.status_code == 409 and "paciente" in r.json()["detail"]


def test_la_duracion_cuenta_para_el_solape(client, escenario, paciente):
    inicio = dia_futuro(LUNES, 10, 0)
    assert reservar(client, escenario, inicio, duracion_min=60).status_code == 201
    otro = {"pac": paciente(), "prof": escenario["prof"]}
    assert reservar(client, otro, inicio + timedelta(minutes=50)).status_code == 409
    assert reservar(client, otro, inicio + timedelta(minutes=60)).status_code == 201


def test_cancelar_libera_el_horario(client, escenario, paciente):
    inicio = dia_futuro(LUNES, 10, 0)
    cita = reservar(client, escenario, inicio).json()
    otro = {"pac": paciente(), "prof": escenario["prof"]}
    assert reservar(client, otro, inicio).status_code == 409

    r = client.post(f"/citas/{cita['id']}/cancelar")
    assert r.status_code == 200 and r.json()["estado"] == "cancelada"
    assert reservar(client, otro, inicio).status_code == 201
    # el paciente original también queda libre
    assert reservar(client, escenario, inicio + timedelta(hours=2)).status_code == 201
    # cancelar de nuevo no cambia nada
    assert client.post(f"/citas/{cita['id']}/cancelar").json()["estado"] == "cancelada"
    assert client.post("/citas/999/cancelar").status_code == 404


def test_no_se_cancela_una_cita_atendida(client, escenario):
    cita = reservar(client, escenario, dia_futuro(LUNES, 10, 0)).json()
    r = client.put(f"/citas/{cita['id']}", json={"estado": "atendida"})
    assert r.status_code == 200 and r.json()["estado"] == "atendida"
    assert client.post(f"/citas/{cita['id']}/cancelar").status_code == 409
    assert client.put(f"/citas/{cita['id']}", json={"motivo": "otro"}).status_code == 409


def test_reprogramar(client, escenario, paciente):
    inicio = dia_futuro(LUNES, 10, 0)
    cita = reservar(client, escenario, inicio).json()
    bloqueo = reservar(
        client, {"pac": paciente(), "prof": escenario["prof"]}, inicio + timedelta(hours=1)
    ).json()

    # mover sobre la cita de otro paciente con el mismo profesional: conflicto
    r = client.put(f"/citas/{cita['id']}", json={"inicio": iso(inicio + timedelta(hours=1))})
    assert r.status_code == 409
    # a un hueco libre
    r = client.put(
        f"/citas/{cita['id']}",
        json={"inicio": iso(inicio + timedelta(hours=3)), "duracion_min": 40},
    )
    assert r.status_code == 200 and r.json()["duracion_min"] == 40
    assert r.json()["fin"] != cita["fin"]
    # moverse unos minutos sobre sí misma no cuenta como solape
    r = client.put(
        f"/citas/{cita['id']}", json={"inicio": iso(inicio + timedelta(hours=3, minutes=10))}
    )
    assert r.status_code == 200
    # fuera de horario, al pasado
    assert (
        client.put(
            f"/citas/{cita['id']}", json={"inicio": iso(dia_futuro(DOMINGO, 10))}
        ).status_code
        == 409
    )
    assert (
        client.put(
            f"/citas/{cita['id']}", json={"inicio": iso(dia_futuro(LUNES, 10, semanas=-2))}
        ).status_code
        == 422
    )
    # la cita cancelada no se puede editar
    client.post(f"/citas/{bloqueo['id']}/cancelar")
    assert client.put(f"/citas/{bloqueo['id']}", json={"motivo": "x"}).status_code == 409
    assert client.put("/citas/999", json={"motivo": "x"}).status_code == 404


def test_editar_solo_el_motivo_no_revalida_la_agenda(client, escenario):
    cita = reservar(client, escenario, dia_futuro(LUNES, 10, 0)).json()
    r = client.put(f"/citas/{cita['id']}", json={"motivo": "Control de resultados"})
    assert r.status_code == 200 and r.json()["motivo"] == "Control de resultados"
    assert r.json()["inicio"] == cita["inicio"]


def test_cambiar_de_profesional_actualiza_sede(client, escenario, crear):
    cita = reservar(client, escenario, dia_futuro(LUNES, 10, 0)).json()
    otro = crear.profesional()
    r = client.put(f"/citas/{cita['id']}", json={"profesional_id": otro["id"]})
    assert r.status_code == 200 and r.json()["sede_id"] == otro["sede_id"]
    r = client.put(
        f"/citas/{cita['id']}",
        json={"profesional_id": escenario["prof"]["id"], "sede_id": otro["sede_id"]},
    )
    assert r.status_code == 422


def test_listar_con_filtros_y_paginacion(client, escenario, paciente, crear):
    inicio = dia_futuro(LUNES, 8, 0)
    otro_pac = paciente()
    otro_prof = crear.profesional()
    a = reservar(client, escenario, inicio).json()
    b = reservar(client, escenario, inicio + timedelta(days=1)).json()
    c = reservar(client, {"pac": otro_pac, "prof": otro_prof}, inicio + timedelta(days=2)).json()
    client.post(f"/citas/{b['id']}/cancelar")

    def ids(**params):
        pagina = client.get("/citas", params=params).json()
        return [x["id"] for x in pagina["items"]]

    assert ids() == [a["id"], b["id"], c["id"]]
    assert ids(paciente_id=otro_pac["id"]) == [c["id"]]
    assert ids(profesional_id=escenario["prof"]["id"]) == [a["id"], b["id"]]
    assert ids(estado="cancelada") == [b["id"]]
    assert ids(estado="programada", profesional_id=escenario["prof"]["id"]) == [a["id"]]
    assert ids(desde=iso(inicio + timedelta(days=1))) == [b["id"], c["id"]]
    assert ids(hasta=iso(inicio + timedelta(days=1))) == [a["id"], b["id"]]
    assert ids(
        desde=iso(inicio + timedelta(hours=1)), hasta=iso(inicio + timedelta(days=1, hours=1))
    ) == [b["id"]]
    # sin zona horaria se interpreta como hora de Bogotá
    assert ids(
        desde=inicio.replace(tzinfo=None).isoformat(), hasta=inicio.replace(tzinfo=None).isoformat()
    ) == [a["id"]]
    pag = client.get("/citas", params={"limit": 2, "offset": 2}).json()
    assert pag["total"] == 3 and pag["limit"] == 2 and pag["offset"] == 2 and len(pag["items"]) == 1
    assert client.get("/citas", params={"estado": "otra"}).status_code == 422


def test_eliminar_cita_y_dependencias(client, escenario):
    cita = reservar(client, escenario, dia_futuro(LUNES, 10, 0)).json()
    # con citas asociadas no se elimina ni el paciente, ni el profesional ni la sede
    assert client.delete(f"/pacientes/{escenario['pac']['id']}").status_code == 409
    assert client.delete(f"/profesionales/{escenario['prof']['id']}").status_code == 409
    assert client.delete(f"/sedes/{escenario['sede']['id']}").status_code == 409
    assert client.delete(f"/citas/{cita['id']}").status_code == 204
    assert client.delete(f"/citas/{cita['id']}").status_code == 404
    assert client.get(f"/citas/{cita['id']}").status_code == 404
    assert client.delete(f"/pacientes/{escenario['pac']['id']}").status_code == 204
