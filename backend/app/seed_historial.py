"""Histórico sintético de citas para el demo de analítica.

Genera unos 12 meses de citas PASADAS (hasta ayer, hora de Bogotá) con patrones de demanda
creíbles: lunes con más demanda y sábados con poca, atención de lunes a sábado de 7:00 a 19:00,
pico de actividad por la mañana, una estacionalidad suave (vacaciones de mitad y fin de año), un
crecimiento leve a lo largo del año, especialidades más y menos populares y entre un 10 % y un
15 % de cancelaciones. Las citas pasadas no canceladas quedan `atendida`; no se inventan estados.

Es determinista: la planificación depende solo de la semilla fija y de la fecha `hoy`, así que dos
ejecuciones el mismo día producen exactamente las mismas filas. Respeta las mismas reglas que la
agenda real (sin solapes por profesional ni por paciente, la cita cabe en el horario), pero se
inserta directamente con el ORM: la API no deja crear citas en el pasado y aquí es lo que se quiere.

Todos los pacientes son ficticios (documentos que empiezan por `PREFIJO_DOCUMENTO`, correos
`@example.com`). La presencia del primero marca que el histórico ya se sembró (idempotencia).
"""

import random
from datetime import date, datetime, time, timedelta

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from app.models.cita import Cita
from app.models.paciente import Paciente
from app.services.citas import APERTURA, CIERRE, TZ_CLINICA

SEMILLA = 20261015
DIAS_HISTORIAL = 365
N_PACIENTES = 320
PORCENTAJE_NINOS = 0.2
PREFIJO_DOCUMENTO = "11"  # los documentos del histórico: "11" + 8 dígitos
CITAS_POR_DIA_BASE = 15.0  # media de un día "normal" antes de aplicar los factores

# Lunes = 0 ... sábado = 5 (domingo no hay atención)
FACTOR_DIA_SEMANA = {0: 1.3, 1: 1.1, 2: 1.0, 3: 1.0, 4: 0.9, 5: 0.45}
# Mes -> factor: enero y julio (vacaciones) y diciembre bajan; octubre y noviembre suben
FACTOR_MES = {
    1: 0.85,
    2: 1.0,
    3: 1.05,
    4: 0.95,
    5: 1.05,
    6: 1.0,
    7: 0.9,
    8: 1.0,
    9: 1.05,
    10: 1.1,
    11: 1.1,
    12: 0.8,
}
# Hora de inicio -> peso: pico de mañana, caída al mediodía y repunte suave por la tarde
PESO_HORA = {
    7: 1.0,
    8: 1.7,
    9: 1.9,
    10: 1.7,
    11: 1.2,
    12: 0.5,
    13: 0.8,
    14: 1.2,
    15: 1.2,
    16: 1.0,
    17: 0.7,
    18: 0.35,
}

# especialidad -> (popularidad, duraciones posibles, prob. de cancelación, motivos)
PERFIL_ESPECIALIDAD: dict[str, tuple[float, tuple[int, ...], float, tuple[str, ...]]] = {
    "Medicina interna": (
        1.5,
        (30, 40),
        0.12,
        (
            "Control de hipertensión",
            "Seguimiento de diabetes tipo 2",
            "Dolor de espalda persistente",
            "Revisión de exámenes de laboratorio",
        ),
    ),
    "Pediatría": (
        1.4,
        (20, 30),
        0.13,
        (
            "Control de crecimiento",
            "Fiebre y malestar general",
            "Control de vacunación",
            "Tos y congestión",
        ),
    ),
    "Cardiología": (
        1.1,
        (30, 40),
        0.10,
        (
            "Control de presión arterial",
            "Ecocardiografía",
            "Palpitaciones",
            "Prueba de esfuerzo",
        ),
    ),
    "Medicina preventiva": (
        1.0,
        (30, 60),
        0.14,
        ("Chequeo preventivo anual", "Vacunación del adulto", "Control de riesgo cardiovascular"),
    ),
    "Ginecología y obstetricia": (
        1.0,
        (40, 60),
        0.12,
        ("Control prenatal", "Citología anual", "Planificación familiar", "Control ginecológico"),
    ),
    "Dermatología": (
        0.9,
        (20, 30),
        0.15,
        ("Revisión de lunares", "Acné", "Dermatitis", "Caída del cabello"),
    ),
    "Urgencias 24 horas": (
        0.9,
        (20, 30),
        0.07,
        ("Dolor abdominal", "Curación de herida", "Reacción alérgica", "Control posurgencia"),
    ),
    "Laboratorio clínico": (
        0.7,
        (20,),
        0.09,
        ("Toma de muestras de rutina", "Perfil lipídico", "Hemograma", "Examen de glucosa"),
    ),
}
PERFIL_POR_DEFECTO = (0.8, (30,), 0.12, ("Consulta general",))
# Especialidades cuyos pacientes son, sobre todo, niños
ESPECIALIDADES_INFANTILES = {"Pediatría"}

NOMBRES = (
    "Camila",
    "Sebastián",
    "María",
    "Juan",
    "Luisa",
    "Carlos",
    "Ana",
    "Felipe",
    "Diana",
    "Jorge",
    "Carolina",
    "Nicolás",
    "Paola",
    "David",
    "Claudia",
    "Alejandro",
    "Mónica",
    "Tomás",
    "Gabriela",
    "Óscar",
    "Lina",
    "Iván",
    "Marcela",
    "Hernán",
    "Adriana",
    "Samuel",
    "Juliana",
    "Rafael",
    "Karen",
    "Emmanuel",
)
APELLIDOS = (
    "Gómez",
    "Rodríguez",
    "Martínez",
    "López",
    "Hernández",
    "García",
    "Ramírez",
    "Vargas",
    "Castro",
    "Moreno",
    "Rojas",
    "Ortiz",
    "Muñoz",
    "Silva",
    "Cruz",
    "Parra",
    "Acosta",
    "Mora",
    "Cardona",
    "Aguirre",
    "Duarte",
    "Ríos",
    "Pineda",
    "Franco",
    "Medina",
    "Ayala",
    "Escobar",
    "Cano",
    "Suárez",
    "Zapata",
)
EPS = ("EPS Ficticia Norte", "EPS Ficticia Sur", "EPS Ficticia Centro", None)


def _sin_tildes(texto: str) -> str:
    for con, sin in zip("áéíóúñÁÉÍÓÚÑ", "aeiounAEIOUN", strict=True):
        texto = texto.replace(con, sin)
    return texto


def generar_pacientes(hoy: date, rng: random.Random | None = None) -> list[dict]:
    """Pacientes ficticios del histórico (un `dict` por columna de `Paciente`), deterministas."""
    rng = rng or random.Random(SEMILLA)
    pacientes = []
    for n in range(N_PACIENTES):
        es_nino = rng.random() < PORCENTAJE_NINOS
        if es_nino:
            edad_dias = rng.randint(30, 17 * 365)
        else:
            # Adultos de 18 a 90 años, con más peso en 25-65
            edad_dias = int(rng.triangular(18, 90, 40) * 365.25)
        nombres = rng.choice(NOMBRES)
        apellidos = f"{rng.choice(APELLIDOS)} {rng.choice(APELLIDOS)}"
        correo = f"{_sin_tildes(nombres).lower()}.{n:03d}@example.com"
        pacientes.append(
            {
                "tipo_documento": "TI" if es_nino and edad_dias > 7 * 365 else "CC",
                "numero_documento": f"{PREFIJO_DOCUMENTO}{n:08d}",
                "nombres": nombres,
                "apellidos": apellidos,
                "fecha_nacimiento": hoy - timedelta(days=edad_dias),
                "email": correo,
                "telefono": f"+57320{5560000 + n}",
                "eps": rng.choice(EPS),
            }
        )
    return pacientes


def _factor_tendencia(dia: int) -> float:
    """Crecimiento leve: de 0.9 hace un año a 1.1 ayer."""
    return 0.9 + 0.2 * (1 - dia / DIAS_HISTORIAL)


def planificar_historial(
    profesionales: list[tuple[int, str, int]],
    pacientes: list[tuple[int, bool]],
    hoy: date,
    semilla: int = SEMILLA,
) -> list[dict]:
    """Planifica las citas pasadas. Función pura: no toca la base de datos.

    `profesionales` = (id, nombre de la especialidad, sede_id); `pacientes` = (id, es_nino).
    Devuelve una lista de `dict` listos para `insert(Cita)`, ordenados por inicio.
    """
    rng = random.Random(semilla)
    perfiles = [PERFIL_ESPECIALIDAD.get(esp, PERFIL_POR_DEFECTO) for _, esp, _ in profesionales]
    pesos_prof = [p[0] for p in perfiles]
    ninos = [pid for pid, es_nino in pacientes if es_nino]
    adultos = [pid for pid, es_nino in pacientes if not es_nino]
    horas = list(PESO_HORA)
    pesos_hora = list(PESO_HORA.values())

    ocupado: dict[tuple[str, int, date], list[tuple[datetime, datetime]]] = {}

    def libre(clave: tuple[str, int, date], ini: datetime, fin: datetime) -> bool:
        return not any(o_ini < fin and o_fin > ini for o_ini, o_fin in ocupado.get(clave, ()))

    citas = []
    for dias_atras in range(DIAS_HISTORIAL, 0, -1):
        dia = hoy - timedelta(days=dias_atras)
        if dia.weekday() == 6:
            continue
        media = (
            CITAS_POR_DIA_BASE
            * FACTOR_DIA_SEMANA[dia.weekday()]
            * FACTOR_MES[dia.month]
            * _factor_tendencia(dias_atras)
        )
        cantidad = max(0, round(rng.gauss(media, media**0.5)))
        for _ in range(cantidad):
            idx = rng.choices(range(len(profesionales)), weights=pesos_prof)[0]
            prof_id, especialidad, sede_id = profesionales[idx]
            _, duraciones, prob_cancelar, motivos = perfiles[idx]
            duracion = rng.choice(duraciones)
            for _intento in range(8):
                hora = rng.choices(horas, weights=pesos_hora)[0]
                minuto = rng.choice((0, 10, 20, 30, 40, 50))
                inicio = datetime.combine(dia, time(hora, minuto), tzinfo=TZ_CLINICA)
                fin = inicio + timedelta(minutes=duracion)
                if inicio.time() < APERTURA or fin.time() > CIERRE or fin.date() != dia:
                    continue
                infantil = especialidad in ESPECIALIDADES_INFANTILES
                # Los niños también van, de vez en cuando, a otras especialidades
                usar_ninos = (infantil and ninos) or (
                    not infantil and ninos and rng.random() < 0.05
                )
                paciente_id = rng.choice(ninos if usar_ninos else adultos or ninos)
                if not libre(("p", prof_id, dia), inicio, fin) or not libre(
                    ("a", paciente_id, dia), inicio, fin
                ):
                    continue
                ocupado.setdefault(("p", prof_id, dia), []).append((inicio, fin))
                ocupado.setdefault(("a", paciente_id, dia), []).append((inicio, fin))
                # Más cancelaciones los lunes y los sábados
                ajuste = 1.15 if dia.weekday() in (0, 5) else 1.0
                cancelada = rng.random() < prob_cancelar * ajuste
                citas.append(
                    {
                        "paciente_id": paciente_id,
                        "profesional_id": prof_id,
                        "sede_id": sede_id,
                        "inicio": inicio,
                        "fin": fin,
                        "duracion_min": duracion,
                        "motivo": rng.choice(motivos),
                        "estado": "cancelada" if cancelada else "atendida",
                    }
                )
                break
    citas.sort(key=lambda c: (c["inicio"], c["profesional_id"]))
    return citas


def sembrar_historial(db: Session, profesionales: list[tuple[int, str, int]]) -> dict[str, int]:
    """Inserta pacientes y citas históricos si todavía no están. No confirma la transacción."""
    hoy = datetime.now(TZ_CLINICA).date()
    ya_sembrado = db.scalar(
        select(Paciente.id).where(
            Paciente.tipo_documento.in_(("CC", "TI")),
            Paciente.numero_documento == f"{PREFIJO_DOCUMENTO}{0:08d}",
        )
    )
    if ya_sembrado is not None:
        return {"pacientes_historicos": 0, "citas_historicas": 0}

    datos_pacientes = generar_pacientes(hoy)
    db.execute(insert(Paciente), datos_pacientes)
    filas = db.execute(
        select(Paciente.id, Paciente.numero_documento)
        .where(Paciente.numero_documento.in_([d["numero_documento"] for d in datos_pacientes]))
        .order_by(Paciente.numero_documento)
    ).all()
    # El orden por documento coincide con el de generación (índice con ceros a la izquierda)
    ids = [pid for pid, _ in filas][: len(datos_pacientes)]
    es_nino = [(hoy - d["fecha_nacimiento"]).days < 18 * 365 for d in datos_pacientes]
    citas = planificar_historial(profesionales, list(zip(ids, es_nino, strict=True)), hoy)
    if citas:
        db.execute(insert(Cita), citas)
    db.flush()
    return {"pacientes_historicos": len(datos_pacientes), "citas_historicas": len(citas)}
