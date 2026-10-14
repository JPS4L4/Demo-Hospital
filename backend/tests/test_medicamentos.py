"""Medicamentos (tarea D2)."""
import pytest

BASE = {
    "nombre": "Acetaminofén",
    "principio_activo": "Paracetamol",
    "presentacion": "Caja x 20 tabletas",
    "concentracion": "500 mg",
    "requiere_formula": False,
    "stock": 100,
    "precio": 8500.5,
}


def crear(client, **kw):
    r = client.post("/medicamentos", json=BASE | kw)
    assert r.status_code == 201, r.text
    return r.json()


def test_crud_y_forma_de_respuesta(client):
    med = crear(client)
    assert med["precio"] == 8500.5 and isinstance(med["precio"], float)
    assert {"id", "nombre", "principio_activo", "presentacion", "concentracion",
            "requiere_formula", "stock", "precio"} == set(med)
    assert client.get(f"/medicamentos/{med['id']}").json() == med
    r = client.put(f"/medicamentos/{med['id']}", json=BASE | {"stock": 7, "requiere_formula": True})
    assert r.status_code == 200 and r.json()["stock"] == 7 and r.json()["requiere_formula"] is True
    assert client.delete(f"/medicamentos/{med['id']}").status_code == 204
    assert client.get(f"/medicamentos/{med['id']}").status_code == 404
    assert client.put("/medicamentos/999", json=BASE).status_code == 404
    assert client.delete("/medicamentos/999").status_code == 404


@pytest.mark.parametrize(
    "cambio",
    [
        {"stock": -1},
        {"precio": -0.01},
        {"precio": 10.123},
        {"nombre": "  "},
        {"stock": 1.5},
        {"precio": "gratis"},
    ],
)
def test_validaciones_422(client, cambio):
    assert client.post("/medicamentos", json=BASE | cambio).status_code == 422


def test_campos_requeridos(client):
    incompleto = {k: v for k, v in BASE.items() if k != "precio"}
    assert client.post("/medicamentos", json=incompleto).status_code == 422


def test_defaults(client):
    minimo = {k: BASE[k] for k in ("nombre", "principio_activo", "presentacion", "concentracion", "precio")}
    r = client.post("/medicamentos", json=minimo)
    assert r.status_code == 201
    assert r.json()["stock"] == 0 and r.json()["requiere_formula"] is False


def test_busqueda_filtro_y_paginacion(client):
    crear(client, nombre="Acetaminofén", principio_activo="Paracetamol")
    crear(client, nombre="Ibuprofeno", principio_activo="Ibuprofeno")
    crear(client, nombre="Amoxicilina", principio_activo="Amoxicilina trihidrato", requiere_formula=True)
    crear(client, nombre="Dolex", principio_activo="Paracetamol")

    todos = client.get("/medicamentos").json()
    assert set(todos) == {"items", "total", "limit", "offset"}
    assert todos["total"] == 4 and [m["nombre"] for m in todos["items"]][0] == "Acetaminofén"

    por_nombre = client.get("/medicamentos", params={"q": "ibu"}).json()
    assert [m["nombre"] for m in por_nombre["items"]] == ["Ibuprofeno"]
    por_activo = client.get("/medicamentos", params={"q": "PARACETAMOL"}).json()
    assert por_activo["total"] == 2
    assert client.get("/medicamentos", params={"q": "100%"}).json()["total"] == 0

    con_formula = client.get("/medicamentos", params={"requiere_formula": "true"}).json()
    assert [m["nombre"] for m in con_formula["items"]] == ["Amoxicilina"]
    assert client.get("/medicamentos", params={"requiere_formula": "false"}).json()["total"] == 3
    combinado = client.get("/medicamentos", params={"requiere_formula": "false", "q": "paracetamol"}).json()
    assert combinado["total"] == 2

    pag = client.get("/medicamentos", params={"limit": 2, "offset": 2}).json()
    assert pag["total"] == 4 and pag["limit"] == 2 and pag["offset"] == 2
    assert [m["nombre"] for m in pag["items"]] == ["Dolex", "Ibuprofeno"]
    assert client.get("/medicamentos", params={"limit": 0}).status_code == 422
    assert client.get("/medicamentos", params={"limit": 101}).status_code == 422
