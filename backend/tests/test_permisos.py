"""Matriz de autorización: 401 sin sesión, 403 con el rol equivocado, 404 para lo ajeno."""
from datetime import timedelta

import pytest

from agenda import dia_futuro, iso
from conftest import CONTRASENA

LUNES = 0

PUBLICAS = [
    "/health", "/sedes", "/sedes/1", "/noticias", "/noticias/1", "/especialidades", "/especialidades/1",
    "/profesionales", "/profesionales/1", "/profesionales/1/disponibilidad?fecha=2999-01-04", "/medicamentos",
    "/medicamentos/1",
]
ESCRITURAS_ADMIN = [
    (m, f"/{r}" + ("" if m == "POST" else "/1"))
    for r in ("sedes", "noticias", "especialidades", "profesionales", "medicamentos")
    for m in ("POST", "PUT", "DELETE")
]
SOLO_ADMIN = [
    ("GET", "/pacientes"), ("POST", "/pacientes"), ("DELETE", "/pacientes/1"),
    ("PUT", "/citas/1"), ("DELETE", "/citas/1"),
]
PROTEGIDAS = ESCRITURAS_ADMIN + SOLO_ADMIN + [
    ("GET", "/pacientes/1"), ("PUT", "/pacientes/1"), ("GET", "/pacientes/me"), ("PUT", "/pacientes/me"),
    ("GET", "/citas"), ("GET", "/citas/1"), ("POST", "/citas"), ("POST", "/citas/1/cancelar"), ("GET", "/auth/me"),
]


def con_cuerpo(metodo):
    return {} if metodo in ("POST", "PUT") else None


@pytest.mark.parametrize("ruta", PUBLICAS)
def test_lecturas_de_catalogo_siguen_abiertas(anon, ruta):
    assert anon.get(ruta).status_code in (200, 404)  # 404 = no existe, nunca 401/403


@pytest.mark.parametrize("metodo,ruta", PROTEGIDAS)
def test_sin_token_401(anon, metodo, ruta):
    r = anon.request(metodo, ruta, json=con_cuerpo(metodo))
    assert r.status_code == 401, r.text


@pytest.mark.parametrize("metodo,ruta", ESCRITURAS_ADMIN + SOLO_ADMIN)
def test_paciente_no_puede_hacer_acciones_de_admin_403(cuenta_paciente, cliente_de, metodo, ruta):
    c = cliente_de(cuenta_paciente())
    r = c.request(metodo, ruta, json=con_cuerpo(metodo))
    assert r.status_code == 403, r.text


def test_admin_escribe_catalogo(client):
    r = client.post("/noticias", json={"titulo": "Jornada de salud", "contenido": "Este sábado."})
    assert r.status_code == 201
    assert client.delete(f"/noticias/{r.json()['id']}").status_code == 204


# --- pacientes ---------------------------------------------------------------------------------

def ficha_de(usuario):
    p = usuario.paciente
    return {
        "tipo_documento": p.tipo_documento, "numero_documento": p.numero_documento, "nombres": p.nombres,
        "apellidos": p.apellidos, "fecha_nacimiento": "1992-03-04", "email": p.email, "telefono": p.telefono,
    }


def test_paciente_ve_y_edita_solo_su_ficha(cuenta_paciente, cliente_de):
    yo, otro = cuenta_paciente(), cuenta_paciente()
    c = cliente_de(yo)
    propio = c.get(f"/pacientes/{yo.paciente_id}")
    assert propio.status_code == 200 and c.get("/pacientes/me").json() == propio.json()
    assert c.get(f"/pacientes/{otro.paciente_id}").status_code == 404
    assert c.put(f"/pacientes/{otro.paciente_id}", json=ficha_de(otro)).status_code == 404

    r = c.put("/pacientes/me", json=ficha_de(yo) | {"nombres": "Renombrada", "eps": "EPS Ficticia"})
    assert r.status_code == 200 and r.json()["nombres"] == "Renombrada"
    assert c.put(f"/pacientes/{yo.paciente_id}", json=ficha_de(yo) | {"eps": None}).json()["eps"] is None


def test_cambiar_el_correo_de_la_ficha_cambia_el_de_acceso(anon, cuenta_paciente, cliente_de):
    yo, otro = cuenta_paciente(), cuenta_paciente()
    c = cliente_de(yo)
    assert c.put("/pacientes/me", json=ficha_de(yo) | {"email": otro.email}).status_code == 409
    assert c.put("/pacientes/me", json=ficha_de(yo) | {"email": "Nuevo@Example.com"}).status_code == 200
    login = anon.post("/auth/login", json={"email": "nuevo@example.com", "password": CONTRASENA})
    assert login.status_code == 200 and login.json()["usuario"]["email"] == "nuevo@example.com"


def test_admin_no_tiene_ficha_propia(client):
    assert client.get("/pacientes/me").status_code == 404


def test_admin_gestiona_pacientes_y_borrar_la_ficha_borra_la_cuenta(client, cuenta_paciente, anon):
    usuario = cuenta_paciente()
    assert client.get("/pacientes").json()["total"] == 1
    assert client.get(f"/pacientes/{usuario.paciente_id}").status_code == 200
    assert client.delete(f"/pacientes/{usuario.paciente_id}").status_code == 204
    assert anon.post("/auth/login", json={"email": usuario.email, "password": CONTRASENA}).status_code == 401


# --- citas -------------------------------------------------------------------------------------

@pytest.fixture
def agenda(client, crear):
    return crear.profesional()


def cuerpo(prof, inicio, **kw):
    return {"profesional_id": prof["id"], "inicio": iso(inicio), "motivo": "Control general"} | kw


def test_paciente_reserva_para_si_mismo_sin_enviar_su_id(cuenta_paciente, cliente_de, agenda):
    yo = cuenta_paciente()
    r = cliente_de(yo).post("/citas", json=cuerpo(agenda, dia_futuro(LUNES, 10)))
    assert r.status_code == 201, r.text
    assert r.json()["paciente_id"] == yo.paciente_id and r.json()["estado"] == "programada"


def test_paciente_no_reserva_para_otro_403(cuenta_paciente, cliente_de, agenda):
    yo, otro = cuenta_paciente(), cuenta_paciente()
    c = cliente_de(yo)
    r = c.post("/citas", json=cuerpo(agenda, dia_futuro(LUNES, 10), paciente_id=otro.paciente_id))
    assert r.status_code == 403
    ok = c.post("/citas", json=cuerpo(agenda, dia_futuro(LUNES, 10), paciente_id=yo.paciente_id))
    assert ok.status_code == 201


def test_admin_debe_indicar_el_paciente(client, agenda, cuenta_paciente):
    assert client.post("/citas", json=cuerpo(agenda, dia_futuro(LUNES, 10))).status_code == 422
    pid = cuenta_paciente().paciente_id
    assert client.post("/citas", json=cuerpo(agenda, dia_futuro(LUNES, 10), paciente_id=pid)).status_code == 201


def test_paciente_solo_ve_sus_citas(client, cuenta_paciente, cliente_de, agenda):
    ana, beto = cuenta_paciente(), cuenta_paciente()
    c_ana, c_beto = cliente_de(ana), cliente_de(beto)
    de_ana = c_ana.post("/citas", json=cuerpo(agenda, dia_futuro(LUNES, 10))).json()
    de_beto = c_beto.post("/citas", json=cuerpo(agenda, dia_futuro(LUNES, 11))).json()

    assert [c["id"] for c in c_ana.get("/citas").json()["items"]] == [de_ana["id"]]
    assert [c["id"] for c in c_beto.get("/citas").json()["items"]] == [de_beto["id"]]
    assert c_ana.get("/citas", params={"paciente_id": ana.paciente_id}).json()["total"] == 1
    assert c_ana.get("/citas", params={"paciente_id": beto.paciente_id}).status_code == 403
    assert c_ana.get(f"/citas/{de_ana['id']}").status_code == 200
    assert c_ana.get(f"/citas/{de_beto['id']}").status_code == 404
    assert client.get("/citas").json()["total"] == 2  # el admin ve todas


def test_paciente_cancela_la_suya_y_no_la_ajena(client, cuenta_paciente, cliente_de, agenda):
    ana, beto = cuenta_paciente(), cuenta_paciente()
    c_ana, c_beto = cliente_de(ana), cliente_de(beto)
    de_ana = c_ana.post("/citas", json=cuerpo(agenda, dia_futuro(LUNES, 10))).json()

    assert c_beto.post(f"/citas/{de_ana['id']}/cancelar").status_code == 404
    assert client.get(f"/citas/{de_ana['id']}").json()["estado"] == "programada"
    assert c_ana.post(f"/citas/{de_ana['id']}/cancelar").json()["estado"] == "cancelada"
    # el hueco liberado vuelve a poder reservarse
    assert c_beto.post("/citas", json=cuerpo(agenda, dia_futuro(LUNES, 10))).status_code == 201


def test_paciente_no_marca_atendida_ni_edita_ni_borra(client, cuenta_paciente, cliente_de, agenda):
    c = cliente_de(cuenta_paciente())
    cita = c.post("/citas", json=cuerpo(agenda, dia_futuro(LUNES, 10))).json()
    assert c.put(f"/citas/{cita['id']}", json={"estado": "atendida"}).status_code == 403
    assert c.put(f"/citas/{cita['id']}", json={"motivo": "otro"}).status_code == 403
    assert c.delete(f"/citas/{cita['id']}").status_code == 403
    assert client.put(f"/citas/{cita['id']}", json={"estado": "atendida"}).json()["estado"] == "atendida"
    assert c.post(f"/citas/{cita['id']}/cancelar").status_code == 409  # atendida: no se cancela


def test_paciente_sigue_sujeto_a_las_reglas_de_agenda(cuenta_paciente, cliente_de, agenda):
    c = cliente_de(cuenta_paciente())
    inicio = dia_futuro(LUNES, 10)
    assert c.post("/citas", json=cuerpo(agenda, inicio)).status_code == 201
    assert c.post("/citas", json=cuerpo(agenda, inicio + timedelta(minutes=10))).status_code == 409
    assert c.post("/citas", json=cuerpo(agenda, inicio - timedelta(days=30))).status_code == 422
