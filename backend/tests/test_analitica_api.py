"""API OLAP: permisos, lista blanca, exactitud de las agregaciones y refresco."""

import pytest
from sqlalchemy import text

from app.seed import seed
from app.services.analitica import refrescar_analitica
from tests.analitica_datos import sembrar_conocido


@pytest.fixture
def conocido(db, client):
    """El conjunto conocido (ver analitica_datos.py), ya refrescado en las vistas."""
    ids = sembrar_conocido(db)
    refrescar_analitica(db, concurrently=False)
    db.commit()
    return ids


def _citas(client, **params):
    r = client.get("/analitica/citas", params=params)
    assert r.status_code == 200, r.text
    return r.json()


def _mapa(cuerpo, *dims):
    """{(valores de las dimensiones...): valor} para comparar sin depender del orden."""
    return {tuple(f["dimensiones"][d] for d in dims): f["valor"] for f in cuerpo["filas"]}


# --- permisos --------------------------------------------------------------------------------

RUTAS = [
    ("get", "/analitica/resumen"),
    ("get", "/analitica/citas?agrupar=sede"),
    ("get", "/analitica/estado"),
    ("post", "/analitica/refrescar"),
]


@pytest.mark.parametrize(("metodo", "ruta"), RUTAS)
def test_anonimo_recibe_401(anon, metodo, ruta):
    assert getattr(anon, metodo)(ruta).status_code == 401


@pytest.mark.parametrize(("metodo", "ruta"), RUTAS)
def test_paciente_recibe_403(cuenta_paciente, cliente_de, metodo, ruta):
    c = cliente_de(cuenta_paciente())
    assert getattr(c, metodo)(ruta).status_code == 403


# --- lista blanca ----------------------------------------------------------------------------


@pytest.mark.parametrize(
    "agrupar",
    [
        "",
        "nombre",
        "fecha.siglo",
        "sede;DROP TABLE citas",
        "sede, 1=1",
        "sede,sede",
        "sede,especialidad,franja",
        "paciente.nombres",
    ],
)
def test_agrupar_fuera_de_la_lista_blanca_es_422(client, agrupar):
    r = client.get("/analitica/citas", params={"agrupar": agrupar})
    assert r.status_code == 422, r.text


def test_agrupar_es_obligatorio(client):
    assert client.get("/analitica/citas").status_code == 422


@pytest.mark.parametrize("medida", ["suma", "total; DROP TABLE citas", "TOTAL", ""])
def test_medida_desconocida_es_422(client, medida):
    r = client.get("/analitica/citas", params={"agrupar": "sede", "medida": medida})
    assert r.status_code == 422


def test_filtros_invalidos_son_422(client):
    base = {"agrupar": "sede"}
    assert client.get("/analitica/citas", params=base | {"estado": "otro"}).status_code == 422
    assert client.get("/analitica/citas", params=base | {"sede_id": "x"}).status_code == 422
    assert client.get("/analitica/citas", params=base | {"desde": "ayer"}).status_code == 422
    inversion = base | {"desde": "2026-04-01", "hasta": "2026-03-01"}
    assert client.get("/analitica/citas", params=inversion).status_code == 422
    assert (
        client.get(
            "/analitica/resumen", params={"desde": "2026-04-01", "hasta": "2026-03-01"}
        ).status_code
        == 422
    )


def test_la_inyeccion_en_filtros_no_altera_la_consulta(client, conocido):
    r = client.get("/analitica/citas", params={"agrupar": "sede", "estado": "x' OR '1'='1"})
    assert r.status_code == 422  # el estado es un Literal
    assert _citas(client, agrupar="sede")["filas"]  # y la tabla sigue ahí


# --- correctitud (conjunto conocido) ---------------------------------------------------------


def test_resumen_global(client, conocido):
    r = client.get("/analitica/resumen")
    assert r.status_code == 200
    assert r.json() == {
        "total": 7,
        "atendidas": 5,
        "canceladas": 2,
        "programadas": 0,
        "tasa_cancelacion": round(2 / 7, 4),
        "duracion_media_min": 36.0,  # (30 + 40 + 20 + 60 + 30) / 5, sin las canceladas
        "pacientes_distintos": 3,
    }


def test_resumen_con_filtros(client, conocido):
    sur = client.get("/analitica/resumen", params={"sede_id": conocido["sur"]}).json()
    assert (sur["total"], sur["canceladas"], sur["tasa_cancelacion"]) == (4, 2, 0.5)
    assert sur["duracion_media_min"] == 40.0  # 20 y 60 atendidas
    marzo = client.get(
        "/analitica/resumen", params={"desde": "2026-03-01", "hasta": "2026-03-31"}
    ).json()
    assert (marzo["total"], marzo["canceladas"], marzo["pacientes_distintos"]) == (4, 1, 3)
    cardio_marzo = client.get(
        "/analitica/resumen",
        params={
            "desde": "2026-03-01",
            "hasta": "2026-03-31",
            "especialidad_id": conocido["cardio"],
        },
    ).json()
    assert (cardio_marzo["total"], cardio_marzo["canceladas"]) == (2, 0)


def test_resumen_sin_citas_no_divide_por_cero(client, conocido):
    r = client.get("/analitica/resumen", params={"desde": "2030-01-01"}).json()
    assert r["total"] == 0 and r["tasa_cancelacion"] is None and r["duracion_media_min"] is None


def test_total_por_niveles_de_la_jerarquia_de_fecha(client, conocido):
    por_anio = _citas(client, agrupar="fecha.anio")
    assert por_anio["agrupar"] == ["fecha.anio"] and por_anio["medida"] == "total"
    assert _mapa(por_anio, "fecha.anio") == {(2025,): 1, (2026,): 6}
    # roll-up / drill-down: del año al trimestre, al mes y al día
    assert _mapa(_citas(client, agrupar="fecha.trimestre"), "fecha.trimestre") == {
        ("2025-T4",): 1,
        ("2026-T1",): 4,
        ("2026-T2",): 2,
    }
    por_mes = _citas(client, agrupar="fecha.mes")
    assert _mapa(por_mes, "fecha.mes") == {("2025-12",): 1, ("2026-03",): 4, ("2026-04",): 2}
    assert [f["dimensiones"]["fecha.mes"] for f in por_mes["filas"]] == [
        "2025-12",
        "2026-03",
        "2026-04",
    ], "orden cronológico"
    assert _mapa(_citas(client, agrupar="fecha.semana"), "fecha.semana") == {
        ("2026-S01",): 1,  # el 30-dic-2025 cae en la semana ISO 1 de 2026
        ("2026-S10",): 4,
        ("2026-S15",): 2,
    }
    por_dia = _mapa(_citas(client, agrupar="fecha.dia"), "fecha.dia")
    assert por_dia == {
        ("2025-12-30",): 1,
        ("2026-03-02",): 3,
        ("2026-03-03",): 1,
        ("2026-04-06",): 2,
    }
    # Cada nivel suma lo mismo
    assert sum(por_dia.values()) == sum(_mapa(por_mes, "fecha.mes").values()) == 7


def test_dia_de_la_semana_hora_y_franja(client, conocido):
    assert _mapa(_citas(client, agrupar="fecha.dia_semana"), "fecha.dia_semana") == {
        ("lunes",): 5,
        ("martes",): 2,
    }
    assert _mapa(_citas(client, agrupar="hora"), "hora") == {
        (8,): 2,
        (9,): 1,
        (10,): 1,
        (11,): 1,
        (14,): 1,
        (15,): 1,
    }
    franja = _citas(client, agrupar="franja")
    assert [f["dimensiones"]["franja"] for f in franja["filas"]] == ["mañana", "tarde"]
    assert _mapa(franja, "franja") == {("mañana",): 5, ("tarde",): 2}


def test_dimensiones_de_entidad(client, conocido):
    assert _mapa(_citas(client, agrupar="especialidad"), "especialidad") == {
        ("Cardio",): 5,
        ("Pedia",): 2,
    }
    assert _mapa(_citas(client, agrupar="sede"), "sede") == {("Norte",): 3, ("Sur",): 4}
    assert _mapa(_citas(client, agrupar="profesional"), "profesional") == {
        ("Doctor1 Prueba",): 3,
        ("Doctor2 Prueba",): 2,
        ("Doctor3 Prueba",): 2,
    }
    edades = _citas(client, agrupar="paciente.rango_edad")
    assert [f["dimensiones"]["paciente.rango_edad"] for f in edades["filas"]] == [
        "0-11",
        "30-44",
        "60+",
    ]
    assert _mapa(edades, "paciente.rango_edad") == {("0-11",): 2, ("30-44",): 3, ("60+",): 2}


def test_medidas(client, conocido):
    def por_sede(medida):
        return _mapa(_citas(client, agrupar="sede", medida=medida), "sede")

    assert por_sede("total") == {("Norte",): 3, ("Sur",): 4}
    assert por_sede("canceladas") == {("Norte",): 0, ("Sur",): 2}
    assert por_sede("atendidas") == {("Norte",): 3, ("Sur",): 2}
    assert por_sede("tasa_cancelacion") == {("Norte",): 0.0, ("Sur",): 0.5}
    # Norte: (30 + 40 + 30) / 3; Sur: (20 + 60) / 2 (las canceladas no cuentan)
    assert por_sede("duracion_media") == {("Norte",): 33.3, ("Sur",): 40.0}
    por_especialidad = _mapa(
        _citas(client, agrupar="especialidad", medida="tasa_cancelacion"), "especialidad"
    )
    assert por_especialidad == {("Cardio",): round(1 / 5, 4), ("Pedia",): 0.5}


def test_dos_dimensiones(client, conocido):
    cuerpo = _citas(client, agrupar="fecha.mes,especialidad")
    assert cuerpo["agrupar"] == ["fecha.mes", "especialidad"]
    assert _mapa(cuerpo, "fecha.mes", "especialidad") == {
        ("2025-12", "Cardio"): 1,
        ("2026-03", "Cardio"): 2,
        ("2026-03", "Pedia"): 2,
        ("2026-04", "Cardio"): 2,
    }
    cancel = _citas(client, agrupar="sede,franja", medida="canceladas")
    assert _mapa(cancel, "sede", "franja") == {
        ("Norte", "mañana"): 0,
        ("Sur", "mañana"): 1,
        ("Sur", "tarde"): 1,
    }


def test_filtros_slice_y_dice(client, conocido):
    sur = _citas(client, agrupar="fecha.mes", sede_id=conocido["sur"])
    assert _mapa(sur, "fecha.mes") == {("2026-03",): 2, ("2026-04",): 2}
    entre = _citas(client, agrupar="sede", desde="2026-03-03", hasta="2026-04-06")
    assert _mapa(entre, "sede") == {("Sur",): 3}
    una_fecha = _citas(client, agrupar="hora", desde="2026-03-02", hasta="2026-03-02")
    assert sum(_mapa(una_fecha, "hora").values()) == 3
    assert _mapa(_citas(client, agrupar="sede", estado="cancelada"), "sede") == {("Sur",): 2}
    assert _mapa(
        _citas(client, agrupar="fecha.anio", profesional_id=conocido["p1"]), "fecha.anio"
    ) == {
        (2025,): 1,
        (2026,): 2,
    }
    combinado = _citas(
        client, agrupar="sede", especialidad_id=conocido["cardio"], estado="atendida"
    )
    assert _mapa(combinado, "sede") == {("Norte",): 3, ("Sur",): 1}
    assert _citas(client, agrupar="sede", sede_id=999999)["filas"] == []


def test_la_hora_de_bogota_decide_el_dia(db, client, conocido):
    """Una cita a las 23:30 de Bogotá es del día siguiente en UTC: debe contar en su día local."""
    from datetime import datetime, timedelta

    from app.models.cita import Cita
    from tests.analitica_datos import BOGOTA

    inicio = datetime(2026, 5, 10, 23, 30, tzinfo=BOGOTA)  # domingo, 04:30 UTC del lunes 11
    db.add(
        Cita(
            paciente_id=1,
            profesional_id=conocido["p1"],
            sede_id=conocido["norte"],
            inicio=inicio,
            fin=inicio + timedelta(minutes=30),
            duracion_min=30,
            motivo="Noche",
            estado="atendida",
        )
    )
    db.commit()
    refrescar_analitica(db, concurrently=False)
    db.commit()
    assert _mapa(_citas(client, agrupar="fecha.dia", desde="2026-05-01"), "fecha.dia") == {
        ("2026-05-10",): 1
    }


# --- coherencia con el OLTP, estado y refresco -----------------------------------------------


def test_hechos_igual_a_citas_y_totales_coinciden_tras_el_seed(client, db):
    seed()
    oltp = db.scalar(text("SELECT count(*) FROM citas"))
    por_anio = _citas(client, agrupar="fecha.anio")
    assert sum(f["valor"] for f in por_anio["filas"]) == oltp
    assert client.get("/analitica/resumen").json()["total"] == oltp
    estado = client.get("/analitica/estado").json()
    assert estado["citas_oltp"] == estado["citas_analitica"] == oltp and estado["actualizada"]
    assert estado["refrescado_en"] is not None
    # El histórico sintético está en el rango de cancelación pedido
    tasa = client.get("/analitica/resumen").json()["tasa_cancelacion"]
    assert 0.09 <= tasa <= 0.15


def test_estado_marca_la_copia_como_desactualizada_hasta_refrescar(client, db, conocido):
    assert client.get("/analitica/estado").json()["actualizada"] is True
    db.execute(text("DELETE FROM citas WHERE id = 1"))
    db.commit()
    estado = client.get("/analitica/estado").json()
    assert (estado["citas_oltp"], estado["citas_analitica"], estado["actualizada"]) == (6, 7, False)

    r = client.post("/analitica/refrescar")
    assert r.status_code == 200 and r.json()["refrescado_en"]
    estado = client.get("/analitica/estado").json()
    assert estado["actualizada"] is True and estado["refrescado_en"] == r.json()["refrescado_en"]
    assert client.get("/analitica/resumen").json()["total"] == 6


def test_refrescar_refleja_citas_nuevas(client, db, conocido):
    from tests.analitica_datos import BOGOTA

    assert client.get("/analitica/resumen").json()["total"] == 7
    from datetime import datetime, timedelta

    from app.models.cita import Cita

    inicio = datetime(2026, 6, 1, 8, 0, tzinfo=BOGOTA)
    db.add(
        Cita(
            paciente_id=1,
            profesional_id=conocido["p1"],
            sede_id=conocido["norte"],
            inicio=inicio,
            fin=inicio + timedelta(minutes=20),
            duracion_min=20,
            motivo="Nueva",
            estado="cancelada",
        )
    )
    db.commit()
    assert client.get("/analitica/resumen").json()["total"] == 7  # aún sin refrescar
    assert client.post("/analitica/refrescar").status_code == 200
    resumen = client.get("/analitica/resumen").json()
    assert (resumen["total"], resumen["canceladas"]) == (8, 3)
    assert (
        _mapa(_citas(client, agrupar="fecha.mes", estado="cancelada"), "fecha.mes")[("2026-06",)]
        == 1
    )


def test_sin_el_schema_analitica_responde_503(client, engine):
    from app.analitica.sql import CREAR, ELIMINAR

    with engine.begin() as con:
        for sentencia in ELIMINAR:
            con.execute(text(sentencia))
    try:
        for metodo, ruta in (*RUTAS[:3], RUTAS[3]):
            r = getattr(client, metodo)(ruta)
            assert r.status_code == 503, ruta
            assert "alembic upgrade head" in r.json()["detail"]
    finally:
        with engine.begin() as con:
            for sentencia in CREAR:
                con.execute(text(sentencia))
