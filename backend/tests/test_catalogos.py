"""Sedes, noticias, especialidades y profesionales (tarea D1)."""


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


# --- sedes y noticias: listas simples + CRUD ---------------------------------------------------


def test_sedes_lista_sigue_siendo_array_con_limit_offset_opcionales(client, crear):
    for _ in range(3):
        crear.sede()
    todas = client.get("/sedes")
    assert todas.status_code == 200
    assert isinstance(todas.json(), list) and len(todas.json()) == 3
    assert {"id", "nombre", "direccion", "ciudad", "telefono"} <= set(todas.json()[0])
    assert len(client.get("/sedes", params={"limit": 2}).json()) == 2
    assert len(client.get("/sedes", params={"offset": 2}).json()) == 1
    assert client.get("/sedes", params={"limit": 0}).status_code == 422


def test_sede_crud_completo(client):
    r = client.post(
        "/sedes", json={"nombre": " Sede Norte ", "direccion": "Av 1", "ciudad": "Cali"}
    )
    assert r.status_code == 201
    sede = r.json()
    assert sede["nombre"] == "Sede Norte" and sede["telefono"] is None
    r = client.put(
        f"/sedes/{sede['id']}", json={"nombre": "Sede Sur", "direccion": "Av 2", "ciudad": "Cali"}
    )
    assert r.status_code == 200 and r.json()["nombre"] == "Sede Sur"
    assert client.get(f"/sedes/{sede['id']}").json()["direccion"] == "Av 2"
    assert client.delete(f"/sedes/{sede['id']}").status_code == 204
    assert client.get(f"/sedes/{sede['id']}").status_code == 404
    assert (
        client.put("/sedes/999", json={"nombre": "x", "direccion": "x", "ciudad": "x"}).status_code
        == 404
    )
    assert client.delete("/sedes/999").status_code == 404


def test_sede_validacion_422(client):
    assert (
        client.post("/sedes", json={"nombre": "  ", "direccion": "x", "ciudad": "x"}).status_code
        == 422
    )
    assert client.post("/sedes", json={"nombre": "x"}).status_code == 422


def test_sede_con_profesionales_no_se_elimina(client, crear):
    sede = crear.sede()
    crear.profesional(sede_id=sede["id"])
    r = client.delete(f"/sedes/{sede['id']}")
    assert r.status_code == 409
    assert "profesionales" in r.json()["detail"]


def test_noticias_lista_array_orden_y_crud(client):
    a = client.post("/noticias", json={"titulo": "Primera", "contenido": "Texto"}).json()
    b = client.post("/noticias", json={"titulo": "Segunda", "contenido": "Texto"}).json()
    lista = client.get("/noticias").json()
    assert isinstance(lista, list)
    assert [n["id"] for n in lista] == [b["id"], a["id"]]
    assert {"id", "titulo", "contenido", "fecha_publicacion"} <= set(lista[0])
    assert len(client.get("/noticias", params={"limit": 1}).json()) == 1
    r = client.put(f"/noticias/{a['id']}", json={"titulo": "Editada", "contenido": "Nuevo"})
    assert r.status_code == 200 and r.json()["titulo"] == "Editada"
    assert client.delete(f"/noticias/{a['id']}").status_code == 204
    assert client.get(f"/noticias/{a['id']}").status_code == 404
    assert client.put("/noticias/999", json={"titulo": "x", "contenido": "x"}).status_code == 404
    assert client.post("/noticias", json={"titulo": "", "contenido": "x"}).status_code == 422


# --- especialidades -----------------------------------------------------------------------------


def test_especialidades_crud_y_unicidad(client):
    r = client.post("/especialidades", json={"nombre": "Cardiología", "descripcion": "Corazón"})
    assert r.status_code == 201
    esp = r.json()
    dup = client.post("/especialidades", json={"nombre": "Cardiología"})
    assert dup.status_code == 409 and "nombre" in dup.json()["detail"]
    otra = client.post("/especialidades", json={"nombre": "Pediatría"}).json()
    choque = client.put(f"/especialidades/{otra['id']}", json={"nombre": "Cardiología"})
    assert choque.status_code == 409
    ok = client.put(f"/especialidades/{esp['id']}", json={"nombre": "Cardiología clínica"})
    assert ok.status_code == 200 and ok.json()["descripcion"] is None
    assert client.get("/especialidades/999").status_code == 404
    assert client.delete(f"/especialidades/{otra['id']}").status_code == 204
    assert client.post("/especialidades", json={"nombre": ""}).status_code == 422


def test_especialidades_lista_paginada_y_busqueda(client):
    for nombre in ["Cardiología", "Pediatría", "Medicina interna", "Medicina preventiva"]:
        client.post("/especialidades", json={"nombre": nombre})
    page = client.get("/especialidades", params={"limit": 2}).json()
    assert set(page) == {"items", "total", "limit", "offset"}
    assert page["total"] == 4 and page["limit"] == 2 and page["offset"] == 0
    assert [e["nombre"] for e in page["items"]] == ["Cardiología", "Medicina interna"]
    sig = client.get("/especialidades", params={"limit": 2, "offset": 2}).json()
    assert [e["nombre"] for e in sig["items"]] == ["Medicina preventiva", "Pediatría"]
    q = client.get("/especialidades", params={"q": "MEDICINA"}).json()
    assert q["total"] == 2


def test_especialidad_con_profesionales_no_se_elimina(client, crear):
    esp = crear.especialidad()
    crear.profesional(especialidad_id=esp["id"])
    r = client.delete(f"/especialidades/{esp['id']}")
    assert r.status_code == 409 and "profesionales" in r.json()["detail"]


# --- profesionales ------------------------------------------------------------------------------


def test_profesional_detalle_incluye_especialidad_y_sede(client, crear):
    esp = crear.especialidad(nombre="Cardiología")
    sede = crear.sede(nombre="Sede Chapinero", ciudad="Bogotá")
    prof = crear.profesional(
        especialidad_id=esp["id"], sede_id=sede["id"], bio="Bio corta", telefono="+57 300 123 4567"
    )
    det = client.get(f"/profesionales/{prof['id']}").json()
    assert det["especialidad"] == {"id": esp["id"], "nombre": "Cardiología"}
    assert det["sede"] == {"id": sede["id"], "nombre": "Sede Chapinero", "ciudad": "Bogotá"}
    assert det["telefono"] == "+573001234567"
    assert det["activo"] is True and det["bio"] == "Bio corta"
    assert client.get("/profesionales/999").status_code == 404


def test_profesionales_filtros_y_paginacion(client, crear):
    cardio, pedia = crear.especialidad(nombre="Cardiología"), crear.especialidad(nombre="Pediatría")
    s1, s2 = crear.sede(), crear.sede()
    crear.profesional(cardio["id"], s1["id"], nombres="Ana", apellidos="Zapata")
    crear.profesional(cardio["id"], s2["id"], nombres="Luis", apellidos="Álvarez")
    crear.profesional(pedia["id"], s1["id"], nombres="Marta", apellidos="Rojas")

    todos = client.get("/profesionales").json()
    assert todos["total"] == 3 and todos["limit"] == 20 and len(todos["items"]) == 3
    assert (
        client.get("/profesionales", params={"especialidad_id": cardio["id"]}).json()["total"] == 2
    )
    assert client.get("/profesionales", params={"sede_id": s1["id"]}).json()["total"] == 2
    ambos = client.get(
        "/profesionales", params={"especialidad_id": cardio["id"], "sede_id": s1["id"]}
    ).json()
    assert [p["apellidos"] for p in ambos["items"]] == ["Zapata"]
    assert [
        p["apellidos"] for p in client.get("/profesionales", params={"q": "mar"}).json()["items"]
    ] == ["Rojas"]
    assert client.get("/profesionales", params={"q": "ana zap"}).json()["total"] == 1
    assert client.get("/profesionales", params={"q": "100%"}).json()["total"] == 0
    pag = client.get("/profesionales", params={"limit": 1, "offset": 1}).json()
    assert pag["total"] == 3 and len(pag["items"]) == 1
    assert client.get("/profesionales", params={"limit": 101}).status_code == 422
    assert client.get("/profesionales", params={"offset": -1}).status_code == 422


def test_profesional_registro_unico_y_validaciones(client, crear):
    prof = crear.profesional(registro_profesional="RM-1")
    base = {
        k: prof[k]
        for k in (
            "nombres",
            "apellidos",
            "especialidad_id",
            "sede_id",
            "registro_profesional",
            "email",
        )
    }
    dup = client.post("/profesionales", json=base)
    assert dup.status_code == 409 and "registro" in dup.json()["detail"]
    assert (
        client.post(
            "/profesionales", json=base | {"registro_profesional": "RM-2", "email": "no-es-email"}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/profesionales", json=base | {"registro_profesional": "RM-2", "telefono": "abc"}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/profesionales", json=base | {"registro_profesional": "RM-2", "especialidad_id": 999}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/profesionales", json=base | {"registro_profesional": "RM-2", "sede_id": 999}
        ).status_code
        == 422
    )
    assert client.post("/profesionales", json={"nombres": "x"}).status_code == 422


def test_profesional_actualizar_y_eliminar(client, crear):
    prof = crear.profesional()
    cambios = {
        "nombres": "Nuevo",
        "apellidos": prof["apellidos"],
        "especialidad_id": prof["especialidad_id"],
        "sede_id": prof["sede_id"],
        "registro_profesional": prof["registro_profesional"],
        "email": "NUEVO@Example.com",
        "activo": False,
    }
    r = client.put(f"/profesionales/{prof['id']}", json=cambios)
    assert r.status_code == 200
    assert (
        r.json()["nombres"] == "Nuevo"
        and r.json()["activo"] is False
        and r.json()["email"] == "nuevo@example.com"
    )
    assert client.put("/profesionales/999", json=cambios).status_code == 404
    assert client.get("/profesionales", params={"activo": "true"}).json()["total"] == 0
    assert client.delete(f"/profesionales/{prof['id']}").status_code == 204
    assert client.delete(f"/profesionales/{prof['id']}").status_code == 404
