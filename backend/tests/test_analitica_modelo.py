"""El modelo en estrella (schema `analitica`): contenido de las vistas y refresco."""

import pytest
from sqlalchemy import text

from app.analitica.sql import ELIMINAR, VISTAS
from app.seed import seed
from app.services.analitica import (
    AnaliticaNoDisponible,
    analitica_disponible,
    refrescar_analitica,
    refrescar_si_existe,
)
from app.services.demo import reiniciar_demo
from tests.analitica_datos import sembrar_conocido


def _filas(db, sql: str, **params):
    return db.execute(text(sql), params).all()


def test_las_vistas_existen_y_estan_vacias_sin_datos(db):
    refrescar_analitica(db, concurrently=False)
    for vista in VISTAS:
        assert db.scalar(text(f"SELECT count(*) FROM analitica.{vista}")) == 0


def test_hechos_tiene_una_fila_por_cita_tras_el_seed(db):
    seed()
    citas = db.scalar(text("SELECT count(*) FROM citas"))
    assert citas > 1000
    assert db.scalar(text("SELECT count(*) FROM analitica.hechos_citas")) == citas
    # Sin huérfanos: cada clave de hechos existe en su dimensión
    for dim, clave in (
        ("dim_fecha", "fecha_key"),
        ("dim_profesional", "profesional_id"),
        ("dim_especialidad", "especialidad_id"),
        ("dim_sede", "sede_id"),
        ("dim_paciente", "paciente_id"),
    ):
        huerfanos = db.scalar(
            text(
                f"SELECT count(*) FROM analitica.hechos_citas h "
                f"LEFT JOIN analitica.{dim} d USING ({clave}) WHERE d.{clave} IS NULL"
            )
        )
        assert huerfanos == 0, dim


def test_dimensiones_del_conjunto_conocido(db):
    sembrar_conocido(db)
    refrescar_analitica(db, concurrently=False)
    lunes, sabado, domingo = _filas(
        db,
        "SELECT anio, trimestre, mes, nombre_mes, semana, dia_semana, nombre_dia, "
        "es_fin_de_semana, anio_mes, anio_trimestre, anio_semana FROM analitica.dim_fecha "
        "WHERE fecha IN ('2026-03-02', '2026-03-07', '2026-03-08') ORDER BY fecha",
    )
    assert tuple(lunes) == (
        2026,
        1,
        3,
        "marzo",
        10,
        1,
        "lunes",
        False,
        "2026-03",
        "2026-T1",
        "2026-S10",
    )
    assert (sabado.nombre_dia, sabado.es_fin_de_semana) == ("sábado", True)
    assert (domingo.dia_semana, domingo.es_fin_de_semana) == (7, True)
    # Sin huecos: un día por fila desde la primera (2025-12-30) hasta la última cita (2026-04-06)
    total, primero, ultimo = _filas(
        db, "SELECT count(*), min(fecha), max(fecha) FROM analitica.dim_fecha"
    )[0]
    assert (total, str(primero), str(ultimo)) == (98, "2025-12-30", "2026-04-06")
    assert dict(_filas(db, "SELECT nombre_completo, activo FROM analitica.dim_profesional")) == {
        "Doctor1 Prueba": True,
        "Doctor2 Prueba": True,
        "Doctor3 Prueba": True,
    }
    assert sorted(_filas(db, "SELECT rango_edad FROM analitica.dim_paciente")) == [
        ("0-11",),
        ("30-44",),
        ("60+",),
    ]


def test_dim_paciente_no_expone_datos_personales(db):
    columnas = {
        fila[0]
        for fila in _filas(
            db,
            "SELECT attname FROM pg_attribute WHERE attrelid = 'analitica.dim_paciente'::regclass "
            "AND attnum > 0 AND NOT attisdropped",
        )
    }
    assert columnas == {"paciente_id", "rango_edad"}


def test_hechos_usa_hora_de_bogota(db):
    sembrar_conocido(db)
    refrescar_analitica(db, concurrently=False)
    cita4 = _filas(
        db,
        "SELECT fecha_key, hora, franja, cancelada, atendida, duracion_min "
        "FROM analitica.hechos_citas WHERE cita_id = 4",
    )[0]
    assert tuple(cita4) == (20260303, 8, "mañana", False, True, 20)
    cita3 = _filas(
        db, "SELECT franja, cancelada, atendida FROM analitica.hechos_citas WHERE cita_id = 3"
    )[0]
    assert tuple(cita3) == ("tarde", True, False)


def test_refresco_normal_y_concurrente_reflejan_datos_nuevos(db):
    sembrar_conocido(db)
    refrescar_analitica(db, concurrently=False)
    assert db.scalar(text("SELECT count(*) FROM analitica.hechos_citas")) == 7
    db.execute(text("DELETE FROM citas WHERE id IN (6, 7)"))
    db.commit()
    # Sin refrescar, la copia analítica sigue igual
    assert db.scalar(text("SELECT count(*) FROM analitica.hechos_citas")) == 7
    momento = refrescar_analitica(db, concurrently=True)
    db.commit()
    assert db.scalar(text("SELECT count(*) FROM analitica.hechos_citas")) == 5
    assert db.scalar(text("SELECT refrescado_en FROM analitica.refresco")) == momento


def test_seed_y_reinicio_refrescan_la_analitica(db):
    seed()
    assert db.scalar(text("SELECT count(*) FROM analitica.hechos_citas")) == db.scalar(
        text("SELECT count(*) FROM citas")
    )
    assert db.scalar(text("SELECT refrescado_en FROM analitica.refresco")) is not None
    db.execute(text("DELETE FROM citas"))
    db.commit()
    assert reiniciar_demo(db) is True
    assert db.scalar(text("SELECT count(*) FROM analitica.hechos_citas")) == db.scalar(
        text("SELECT count(*) FROM citas")
    )


def test_sin_vistas_el_refresco_falla_claro_y_seed_lo_omite(db, engine, caplog):
    """Una base creada sin migrar (sin schema `analitica`): el refresco explícito falla con un
    error claro; el seed y el reinicio solo avisan y siguen."""
    from app.analitica.sql import CREAR

    with engine.begin() as con:
        for sentencia in ELIMINAR:
            con.execute(text(sentencia))
    try:
        assert analitica_disponible(db) is False
        with pytest.raises(AnaliticaNoDisponible, match="alembic upgrade head"):
            refrescar_analitica(db)
        db.rollback()
        assert refrescar_si_existe(db) is None
        assert "Analítica omitida" in caplog.text
        assert reiniciar_demo(db) is True
    finally:
        db.rollback()
        db.close()
        with engine.begin() as con:
            for sentencia in CREAR:
                con.execute(text(sentencia))
