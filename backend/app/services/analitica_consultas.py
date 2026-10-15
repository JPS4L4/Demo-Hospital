"""Consultas OLAP sobre el modelo en estrella (schema `analitica`).

Nada del usuario se interpola en el SQL: `agrupar` y `medida` solo eligen fragmentos de las listas
blancas de este módulo y todos los filtros viajan como parámetros enlazados.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.analitica.sql import SCHEMA, TABLA_REFRESCO

# nombre público -> (expresión SELECT, expresiones GROUP BY, expresión ORDER BY).
# Los niveles de fecha incluyen a sus padres (el mes es "2026-03", no "3"), así que subir o bajar
# de nivel (roll-up / drill-down) nunca mezcla años.
DIMENSIONES: dict[str, tuple[str, str, str]] = {
    "fecha.anio": ("f.anio", "f.anio", "f.anio"),
    "fecha.trimestre": ("f.anio_trimestre", "f.anio_trimestre", "f.anio_trimestre"),
    "fecha.mes": ("f.anio_mes", "f.anio_mes", "f.anio_mes"),
    "fecha.semana": ("f.anio_semana", "f.anio_semana", "f.anio_semana"),
    "fecha.dia": ("CAST(f.fecha AS text)", "f.fecha", "f.fecha"),
    "fecha.dia_semana": ("f.nombre_dia", "f.dia_semana, f.nombre_dia", "f.dia_semana"),
    "franja": ("h.franja", "h.franja", "CASE h.franja WHEN 'mañana' THEN 1 ELSE 2 END"),
    "hora": ("h.hora", "h.hora", "h.hora"),
    "especialidad": ("es.nombre", "es.especialidad_id, es.nombre", "es.nombre"),
    "sede": ("se.nombre", "se.sede_id, se.nombre", "se.nombre"),
    "profesional": (
        "pr.nombre_completo",
        "pr.profesional_id, pr.nombre_completo",
        "pr.nombre_completo",
    ),
    "paciente.rango_edad": (
        "pa.rango_edad",
        "pa.rango_edad",
        "CASE pa.rango_edad WHEN '0-11' THEN 1 WHEN '12-17' THEN 2 WHEN '18-29' THEN 3 "
        "WHEN '30-44' THEN 4 WHEN '45-59' THEN 5 ELSE 6 END",
    ),
}
MAX_DIMENSIONES = 2

MEDIDAS: dict[str, str] = {
    "total": "count(*)",
    "canceladas": "count(*) FILTER (WHERE h.cancelada)",
    "atendidas": "count(*) FILTER (WHERE h.atendida)",
    "tasa_cancelacion": "round(count(*) FILTER (WHERE h.cancelada) / CAST(count(*) AS numeric), 4)",
    # Solo citas no canceladas: una cita cancelada no llegó a ocupar tiempo de consulta
    "duracion_media": "round(avg(h.duracion_min) FILTER (WHERE NOT h.cancelada), 1)",
}

_DESDE = f"""
    FROM {SCHEMA}.hechos_citas h
    JOIN {SCHEMA}.dim_fecha f ON f.fecha_key = h.fecha_key
    JOIN {SCHEMA}.dim_profesional pr ON pr.profesional_id = h.profesional_id
    JOIN {SCHEMA}.dim_especialidad es ON es.especialidad_id = h.especialidad_id
    JOIN {SCHEMA}.dim_sede se ON se.sede_id = h.sede_id
    JOIN {SCHEMA}.dim_paciente pa ON pa.paciente_id = h.paciente_id
"""

# nombre del filtro -> condición con su parámetro enlazado
_FILTROS: dict[str, str] = {
    "desde": "f.fecha >= :desde",
    "hasta": "f.fecha <= :hasta",
    "sede_id": "h.sede_id = :sede_id",
    "especialidad_id": "h.especialidad_id = :especialidad_id",
    "profesional_id": "h.profesional_id = :profesional_id",
    "estado": "h.estado = :estado",
}


def parsear_dimensiones(agrupar: str) -> list[str]:
    """Convierte `fecha.mes,sede` en la lista validada; lanza ValueError con un mensaje para el usuario."""
    pedidas = [d.strip() for d in agrupar.split(",") if d.strip()]
    if not pedidas:
        raise ValueError("Indica al menos una dimensión en 'agrupar'")
    if len(pedidas) > MAX_DIMENSIONES:
        raise ValueError(f"Se admiten como máximo {MAX_DIMENSIONES} dimensiones en 'agrupar'")
    if len(set(pedidas)) != len(pedidas):
        raise ValueError("Las dimensiones de 'agrupar' no pueden repetirse")
    for dim in pedidas:
        if dim not in DIMENSIONES:
            raise ValueError(
                f"Dimensión no permitida: '{dim}'. Permitidas: {', '.join(DIMENSIONES)}"
            )
    return pedidas


def _donde(filtros: dict) -> tuple[str, dict]:
    activos = {k: v for k, v in filtros.items() if v is not None}
    condiciones = [_FILTROS[k] for k in activos]
    return (" WHERE " + " AND ".join(condiciones)) if condiciones else "", activos


def resumen(db: Session, **filtros) -> dict:
    donde, parametros = _donde(filtros)
    fila = (
        db.execute(
            text(
                "SELECT count(*) AS total,"
                " count(*) FILTER (WHERE h.atendida) AS atendidas,"
                " count(*) FILTER (WHERE h.cancelada) AS canceladas,"
                " count(*) FILTER (WHERE h.estado = 'programada') AS programadas,"
                " avg(h.duracion_min) FILTER (WHERE NOT h.cancelada) AS duracion_media_min,"
                " count(DISTINCT h.paciente_id) AS pacientes_distintos" + _DESDE + donde
            ),
            parametros,
        )
        .mappings()
        .one()
    )
    total = fila["total"]
    duracion = fila["duracion_media_min"]
    return {
        "total": total,
        "atendidas": fila["atendidas"],
        "canceladas": fila["canceladas"],
        "programadas": fila["programadas"],
        "tasa_cancelacion": round(fila["canceladas"] / total, 4) if total else None,
        "duracion_media_min": round(float(duracion), 1) if duracion is not None else None,
        "pacientes_distintos": fila["pacientes_distintos"],
    }


def agregar_citas(db: Session, medida: str, dimensiones: list[str], **filtros) -> list[dict]:
    """Una fila por combinación de `dimensiones` con el valor de `medida`.

    `medida` y `dimensiones` deben haberse validado ya (KeyError si no: nunca llegan al SQL).
    """
    columnas = [DIMENSIONES[d] for d in dimensiones]
    seleccion = ", ".join(f"{sel} AS d{i}" for i, (sel, _, _) in enumerate(columnas))
    agrupacion = ", ".join(grp for _, grp, _ in columnas)
    orden = ", ".join(ord_ for _, _, ord_ in columnas)
    donde, parametros = _donde(filtros)
    sql = (
        f"SELECT {seleccion}, {MEDIDAS[medida]} AS valor{_DESDE}{donde} "
        f"GROUP BY {agrupacion} ORDER BY {orden}"
    )
    filas = []
    for fila in db.execute(text(sql), parametros).all():
        valor = fila[-1]
        if valor is not None and not isinstance(valor, int):
            valor = float(valor)  # Decimal de round(...)
        filas.append(
            {"dimensiones": {dim: fila[i] for i, dim in enumerate(dimensiones)}, "valor": valor}
        )
    return filas


def estado(db: Session) -> dict:
    refrescado = db.scalar(text(f"SELECT refrescado_en FROM {SCHEMA}.{TABLA_REFRESCO}"))
    oltp = db.scalar(text("SELECT count(*) FROM citas"))
    olap = db.scalar(text(f"SELECT count(*) FROM {SCHEMA}.hechos_citas"))
    return {
        "refrescado_en": refrescado,
        "citas_oltp": oltp,
        "citas_analitica": olap,
        "actualizada": oltp == olap,
    }
