"""Reglas de agenda de las citas.

- La cita debe empezar en el futuro (422).
- Atención de lunes a sábado, 07:00 a 19:00 hora de Bogotá; la cita completa debe caber (409).
- El profesional debe estar activo (409).
- Sin solapes para el mismo profesional ni para el mismo paciente entre citas no canceladas (409).
- Si se indica sede debe ser la del profesional (422).

`huecos_libres` aplica estas mismas reglas (constantes, horario, solapes) para ofrecer solo
horarios que `validar_agenda` aceptaría, de modo que la reserva y la disponibilidad no discrepen.
"""

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.cita import Cita
from app.models.paciente import Paciente
from app.models.profesional import Profesional

TZ_CLINICA = ZoneInfo("America/Bogota")
APERTURA = time(7, 0)
CIERRE = time(19, 0)
SABADO = 5


def a_hora_clinica(valor: datetime) -> datetime:
    """Los datetime sin zona (filtros de consulta) se interpretan en hora de Bogotá."""
    return valor.replace(tzinfo=TZ_CLINICA) if valor.tzinfo is None else valor


def obtener_paciente(db: Session, paciente_id: int) -> Paciente:
    paciente = db.get(Paciente, paciente_id)
    if paciente is None:
        raise HTTPException(422, "El paciente indicado no existe")
    return paciente


def obtener_profesional(db: Session, profesional_id: int) -> Profesional:
    profesional = db.get(Profesional, profesional_id)
    if profesional is None:
        raise HTTPException(422, "El profesional indicado no existe")
    return profesional


def validar_horario(inicio: datetime, fin: datetime) -> None:
    ini, fi = inicio.astimezone(TZ_CLINICA), fin.astimezone(TZ_CLINICA)
    if ini.weekday() > SABADO:
        raise HTTPException(409, "No hay atención los domingos: elige un día de lunes a sábado")
    if ini.date() != fi.date() or ini.time() < APERTURA or fi.time() > CIERRE:
        raise HTTPException(
            409,
            "La cita debe estar dentro del horario de atención: lunes a sábado, de 7:00 a. m. a 7:00 p. m.",
        )


def _hay_solape(
    db: Session, columna, valor: int, inicio: datetime, fin: datetime, excluir_id: int | None
) -> bool:
    stmt = select(Cita.id).where(
        columna == valor,
        Cita.estado != "cancelada",
        Cita.inicio < fin,
        Cita.fin > inicio,
    )
    if excluir_id is not None:
        stmt = stmt.where(Cita.id != excluir_id)
    return db.scalar(stmt.limit(1)) is not None


def validar_agenda(
    db: Session,
    paciente: Paciente,
    profesional: Profesional,
    inicio: datetime,
    duracion_min: int,
    excluir_id: int | None = None,
) -> datetime:
    """Aplica todas las reglas y devuelve el instante de fin de la cita."""
    if inicio <= datetime.now(timezone.utc):
        raise HTTPException(422, "La cita debe programarse en una fecha y hora futuras")
    fin = inicio + timedelta(minutes=duracion_min)
    if not profesional.activo:
        raise HTTPException(409, "El profesional no está activo y no puede recibir citas")
    validar_horario(inicio, fin)

    # Se bloquean las filas del paciente y del profesional (siempre en este orden) para que dos
    # solicitudes simultáneas no puedan reservar el mismo horario.
    db.execute(select(Paciente.id).where(Paciente.id == paciente.id).with_for_update())
    db.execute(select(Profesional.id).where(Profesional.id == profesional.id).with_for_update())
    if _hay_solape(db, Cita.profesional_id, profesional.id, inicio, fin, excluir_id):
        raise HTTPException(409, "El profesional ya tiene una cita en ese horario")
    if _hay_solape(db, Cita.paciente_id, paciente.id, inicio, fin, excluir_id):
        raise HTTPException(409, "El paciente ya tiene una cita en ese horario")
    return fin


def validar_sede(profesional: Profesional, sede_id: int | None) -> int:
    if sede_id is not None and sede_id != profesional.sede_id:
        raise HTTPException(422, "La sede indicada no coincide con la sede del profesional")
    return profesional.sede_id


def huecos_libres(
    db: Session,
    profesional: Profesional,
    dia: date,
    duracion_min: int,
    ahora: datetime | None = None,
) -> list[tuple[datetime, datetime]]:
    """Huecos (inicio, fin) libres del profesional en `dia` (hora de Bogotá), uno cada `duracion_min` minutos.

    Vacío si es domingo, si el profesional no está activo o si ya no queda ningún hueco futuro.
    Excluye los que se solapan con citas no canceladas del profesional y los que ya pasaron.
    """
    if dia.weekday() > SABADO or not profesional.activo:
        return []
    ahora = ahora or datetime.now(timezone.utc)
    apertura = datetime.combine(dia, APERTURA, tzinfo=TZ_CLINICA)
    cierre = datetime.combine(dia, CIERRE, tzinfo=TZ_CLINICA)
    ocupadas = db.execute(
        select(Cita.inicio, Cita.fin).where(
            Cita.profesional_id == profesional.id,
            Cita.estado != "cancelada",
            Cita.inicio < cierre,
            Cita.fin > apertura,
        )
    ).all()
    paso = timedelta(minutes=duracion_min)
    huecos = []
    inicio = apertura
    while inicio + paso <= cierre:
        fin = inicio + paso
        # mismo criterio que validar_agenda: futuro y sin solape con citas no canceladas
        if inicio > ahora and not any(o_ini < fin and o_fin > inicio for o_ini, o_fin in ocupadas):
            huecos.append((inicio, fin))
        inicio = fin
    return huecos
