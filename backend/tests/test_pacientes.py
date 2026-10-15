"""Pacientes (tarea D3)."""

from datetime import date, timedelta

import pytest

BASE = {
    "tipo_documento": "CC",
    "numero_documento": "1020304050",
    "nombres": "Camila",
    "apellidos": "Ríos Vargas",
    "fecha_nacimiento": "1992-03-14",
    "email": "camila.rios@example.com",
    "telefono": "+57 310 555 0199",
    "eps": "EPS Ficticia",
}


def test_crud_basico(client):
    r = client.post("/pacientes", json=BASE)
    assert r.status_code == 201
    pac = r.json()
    assert pac["telefono"] == "+573105550199" and pac["email"] == "camila.rios@example.com"
    assert client.get(f"/pacientes/{pac['id']}").json() == pac
    r = client.put(f"/pacientes/{pac['id']}", json=BASE | {"eps": None, "nombres": "Camila Andrea"})
    assert (
        r.status_code == 200 and r.json()["eps"] is None and r.json()["nombres"] == "Camila Andrea"
    )
    assert client.get("/pacientes/999").status_code == 404
    assert client.put("/pacientes/999", json=BASE).status_code == 404
    assert client.delete(f"/pacientes/{pac['id']}").status_code == 204
    assert client.delete(f"/pacientes/{pac['id']}").status_code == 404


def test_documento_unico_por_tipo(client):
    assert client.post("/pacientes", json=BASE).status_code == 201
    otro = BASE | {"email": "otra@example.com"}
    dup = client.post("/pacientes", json=otro)
    assert dup.status_code == 409 and "documento" in dup.json()["detail"]
    # mismo número con otro tipo de documento es otra persona
    assert client.post("/pacientes", json=otro | {"tipo_documento": "CE"}).status_code == 201


def test_documento_se_normaliza_a_mayusculas(client):
    r = client.post(
        "/pacientes", json=BASE | {"tipo_documento": "PA", "numero_documento": "ab123456"}
    )
    assert r.status_code == 201 and r.json()["numero_documento"] == "AB123456"
    dup = client.post(
        "/pacientes",
        json=BASE
        | {"tipo_documento": "PA", "numero_documento": "AB123456", "email": "x@example.com"},
    )
    assert dup.status_code == 409


def test_email_unico_sin_distinguir_mayusculas(client):
    assert client.post("/pacientes", json=BASE).status_code == 201
    dup = client.post(
        "/pacientes",
        json=BASE | {"numero_documento": "999999999", "email": "CAMILA.RIOS@Example.com"},
    )
    assert dup.status_code == 409 and "correo" in dup.json()["detail"]


def test_actualizar_con_datos_de_otro_paciente_da_409(client, paciente):
    a, b = paciente(), paciente()
    datos = {k: b[k] for k in BASE if k in b} | {"email": a["email"]}
    assert client.put(f"/pacientes/{b['id']}", json=datos).status_code == 409


@pytest.mark.parametrize(
    "cambio",
    [
        {"tipo_documento": "XX"},
        {"numero_documento": "12"},
        {"numero_documento": "12 345 678"},
        {"email": "no-es-correo"},
        {"telefono": "123"},
        {"telefono": "telefono"},
        {"telefono": "+1234567890123456"},
        {"fecha_nacimiento": str(date.today() + timedelta(days=1))},
        {"fecha_nacimiento": str(date.today())},
        {"fecha_nacimiento": "1850-01-01"},
        {"nombres": ""},
    ],
)
def test_validaciones_422(client, cambio):
    assert client.post("/pacientes", json=BASE | cambio).status_code == 422


def test_eps_es_opcional(client):
    sin_eps = {k: v for k, v in BASE.items() if k != "eps"}
    r = client.post("/pacientes", json=sin_eps)
    assert r.status_code == 201 and r.json()["eps"] is None


def test_lista_paginada_y_busqueda(client, paciente):
    paciente(nombres="Ana", apellidos="Gómez", numero_documento="111111111")
    paciente(nombres="Luis", apellidos="Gómez", numero_documento="222222222")
    paciente(
        nombres="Marta", apellidos="Rojas", numero_documento="333333333", email="marta@example.com"
    )
    page = client.get("/pacientes").json()
    assert set(page) == {"items", "total", "limit", "offset"} and page["total"] == 3
    assert client.get("/pacientes", params={"q": "gómez"}).json()["total"] == 2
    assert client.get("/pacientes", params={"q": "3333"}).json()["total"] == 1
    assert client.get("/pacientes", params={"q": "marta@"}).json()["total"] == 1
    assert client.get("/pacientes", params={"q": "ana gó"}).json()["total"] == 1
    assert len(client.get("/pacientes", params={"limit": 2}).json()["items"]) == 2
