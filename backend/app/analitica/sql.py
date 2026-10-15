"""SQL del modelo en estrella (schema `analitica`), compartido por la migración y las pruebas.

`create_all` de SQLAlchemy no crea vistas materializadas, así que el DDL vive aquí, en una sola
lista ordenada (`CREAR`) y su inversa (`ELIMINAR`). La migración de Alembic y `tests/conftest.py`
las ejecutan tal cual: no puede haber dos definiciones que se desvíen.

Modelo (una fila por cita en `hechos_citas`):

    dim_fecha  dim_profesional  dim_especialidad  dim_sede  dim_paciente
          \         |                |               |        /
                         hechos_citas

Fechas y horas se derivan en hora de Bogotá (`America/Bogota`), la misma que usa la agenda
(`services/citas.py`). `dim_paciente` solo guarda atributos agregados (rango de edad); nunca
nombres, documentos ni correos. Cada vista tiene un índice único, requisito de
`REFRESH MATERIALIZED VIEW CONCURRENTLY`.
"""

SCHEMA = "analitica"
# Orden de refresco: primero las dimensiones, al final los hechos
VISTAS = (
    "dim_fecha",
    "dim_profesional",
    "dim_especialidad",
    "dim_sede",
    "dim_paciente",
    "hechos_citas",
)
TABLA_REFRESCO = "refresco"

_LOCAL = "(c.inicio AT TIME ZONE 'America/Bogota')"

CREAR: tuple[str, ...] = (
    f"CREATE SCHEMA {SCHEMA}",
    # --- dimensiones ---------------------------------------------------------------------
    # Un día por fila, sin huecos, desde la primera hasta la última cita
    f"""
    CREATE MATERIALIZED VIEW {SCHEMA}.dim_fecha AS
    SELECT
        to_char(d, 'YYYYMMDD')::int AS fecha_key,
        d::date AS fecha,
        extract(year FROM d)::int AS anio,
        extract(quarter FROM d)::int AS trimestre,
        extract(month FROM d)::int AS mes,
        (ARRAY['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
               'septiembre','octubre','noviembre','diciembre'])[extract(month FROM d)::int]
            AS nombre_mes,
        extract(week FROM d)::int AS semana,
        extract(isodow FROM d)::int AS dia_semana,
        (ARRAY['lunes','martes','miércoles','jueves','viernes','sábado','domingo'])
            [extract(isodow FROM d)::int] AS nombre_dia,
        extract(isodow FROM d) >= 6 AS es_fin_de_semana,
        to_char(d, 'YYYY') || '-T' || extract(quarter FROM d)::int AS anio_trimestre,
        to_char(d, 'YYYY-MM') AS anio_mes,
        to_char(d, 'IYYY-"S"IW') AS anio_semana
    FROM (
        SELECT generate_series(min(f)::timestamp, max(f)::timestamp, interval '1 day') AS d
        FROM (SELECT {_LOCAL}::date AS f FROM public.citas c) x
    ) dias
    """,
    f"CREATE UNIQUE INDEX ux_dim_fecha ON {SCHEMA}.dim_fecha (fecha_key)",
    f"""
    CREATE MATERIALIZED VIEW {SCHEMA}.dim_especialidad AS
    SELECT e.id AS especialidad_id, e.nombre
    FROM public.especialidades e
    """,
    f"CREATE UNIQUE INDEX ux_dim_especialidad ON {SCHEMA}.dim_especialidad (especialidad_id)",
    f"""
    CREATE MATERIALIZED VIEW {SCHEMA}.dim_sede AS
    SELECT s.id AS sede_id, s.nombre, s.ciudad
    FROM public.sedes s
    """,
    f"CREATE UNIQUE INDEX ux_dim_sede ON {SCHEMA}.dim_sede (sede_id)",
    f"""
    CREATE MATERIALIZED VIEW {SCHEMA}.dim_profesional AS
    SELECT p.id AS profesional_id,
           p.nombres || ' ' || p.apellidos AS nombre_completo,
           p.especialidad_id,
           p.sede_id,
           p.activo
    FROM public.profesionales p
    """,
    f"CREATE UNIQUE INDEX ux_dim_profesional ON {SCHEMA}.dim_profesional (profesional_id)",
    # Solo atributos agregados. La edad se calcula al refrescar, no en la fecha de cada cita
    f"""
    CREATE MATERIALIZED VIEW {SCHEMA}.dim_paciente AS
    SELECT p.id AS paciente_id,
           CASE
               WHEN edad < 12 THEN '0-11'
               WHEN edad < 18 THEN '12-17'
               WHEN edad < 30 THEN '18-29'
               WHEN edad < 45 THEN '30-44'
               WHEN edad < 60 THEN '45-59'
               ELSE '60+'
           END AS rango_edad
    FROM public.pacientes p
    CROSS JOIN LATERAL (
        SELECT date_part('year', age(CURRENT_DATE, p.fecha_nacimiento))::int AS edad
    ) e
    """,
    f"CREATE UNIQUE INDEX ux_dim_paciente ON {SCHEMA}.dim_paciente (paciente_id)",
    # --- hechos --------------------------------------------------------------------------
    f"""
    CREATE MATERIALIZED VIEW {SCHEMA}.hechos_citas AS
    SELECT c.id AS cita_id,
           to_char({_LOCAL}, 'YYYYMMDD')::int AS fecha_key,
           extract(hour FROM {_LOCAL})::int AS hora,
           CASE WHEN extract(hour FROM {_LOCAL}) < 12 THEN 'mañana' ELSE 'tarde' END AS franja,
           c.profesional_id,
           p.especialidad_id,
           c.sede_id,
           c.paciente_id,
           c.estado,
           c.estado = 'cancelada' AS cancelada,
           c.estado = 'atendida' AS atendida,
           c.duracion_min
    FROM public.citas c
    JOIN public.profesionales p ON p.id = c.profesional_id
    """,
    f"CREATE UNIQUE INDEX ux_hechos_citas ON {SCHEMA}.hechos_citas (cita_id)",
    f"CREATE INDEX ix_hechos_citas_fecha ON {SCHEMA}.hechos_citas (fecha_key)",
    f"CREATE INDEX ix_hechos_citas_sede ON {SCHEMA}.hechos_citas (sede_id)",
    f"CREATE INDEX ix_hechos_citas_especialidad ON {SCHEMA}.hechos_citas (especialidad_id)",
    f"CREATE INDEX ix_hechos_citas_profesional ON {SCHEMA}.hechos_citas (profesional_id)",
    # Una sola fila: cuándo se refrescó por última vez
    f"""
    CREATE TABLE {SCHEMA}.{TABLA_REFRESCO} (
        id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        refrescado_en timestamptz NOT NULL
    )
    """,
)

# Borra el schema entero (vistas, índices y la tabla de refresco); idempotente
ELIMINAR: tuple[str, ...] = (f"DROP SCHEMA IF EXISTS {SCHEMA} CASCADE",)
