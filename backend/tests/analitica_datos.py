"""Conjunto pequeño y conocido para probar la analítica: cada respuesta agregada se puede calcular
a mano. Todo en hora de Bogotá (UTC-5, sin horario de verano).

Citas (id: fecha, hora, profesional, paciente, estado, duración):
  1: lun 2026-03-02 08:00  P1 A atendida   30
  2: lun 2026-03-02 09:00  P1 B atendida   40
  3: lun 2026-03-02 14:00  P2 A cancelada  20
  4: mar 2026-03-03 08:30  P2 C atendida   20
  5: lun 2026-04-06 10:00  P3 B cancelada  30
  6: lun 2026-04-06 15:00  P3 C atendida   60
  7: mar 2025-12-30 11:00  P1 A atendida   30

P1 = Cardiología en Norte, P2 = Pediatría en Sur, P3 = Cardiología en Sur.
Pacientes: A de 40 años (30-44), B de 70 (60+), C de 5 (0-11).
"""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.models.cita import Cita
from app.models.especialidad import Especialidad
from app.models.paciente import Paciente
from app.models.profesional import Profesional
from app.models.sede import Sede

BOGOTA = ZoneInfo("America/Bogota")


def _nacimiento(anios: int) -> date:
    """Una fecha que cumple `anios` años con holgura, sea cual sea el día de hoy."""
    hoy = date.today()
    return hoy.replace(year=hoy.year - anios, day=1) - timedelta(days=30)


def sembrar_conocido(db) -> dict[str, int]:
    """Inserta el conjunto y devuelve los ids por nombre corto (`norte`, `sur`, `cardio`, ...)."""
    norte = Sede(nombre="Norte", direccion="Calle 1", ciudad="Bogotá")
    sur = Sede(nombre="Sur", direccion="Calle 2", ciudad="Cali")
    cardio = Especialidad(nombre="Cardio")
    pedia = Especialidad(nombre="Pedia")
    db.add_all([norte, sur, cardio, pedia])
    db.flush()

    def prof(n, esp, sede):
        return Profesional(
            nombres=f"Doctor{n}",
            apellidos="Prueba",
            especialidad_id=esp.id,
            sede_id=sede.id,
            registro_profesional=f"RM-{n}",
            email=f"doc{n}@example.com",
        )

    p1, p2, p3 = prof(1, cardio, norte), prof(2, pedia, sur), prof(3, cardio, sur)

    def pac(n, anios):
        return Paciente(
            tipo_documento="CC",
            numero_documento=f"99{n}",
            nombres=f"Paciente{n}",
            apellidos="Prueba",
            fecha_nacimiento=_nacimiento(anios),
            email=f"pac{n}@example.com",
            telefono="3001234567",
        )

    a, b, c = pac(1, 40), pac(2, 70), pac(3, 5)
    db.add_all([p1, p2, p3, a, b, c])
    db.flush()

    datos = [
        ((2026, 3, 2, 8, 0), p1, a, "atendida", 30),
        ((2026, 3, 2, 9, 0), p1, b, "atendida", 40),
        ((2026, 3, 2, 14, 0), p2, a, "cancelada", 20),
        ((2026, 3, 3, 8, 30), p2, c, "atendida", 20),
        ((2026, 4, 6, 10, 0), p3, b, "cancelada", 30),
        ((2026, 4, 6, 15, 0), p3, c, "atendida", 60),
        ((2025, 12, 30, 11, 0), p1, a, "atendida", 30),
    ]
    for (anio, mes, dia, hora, minuto), p, paciente, estado, duracion in datos:
        inicio = datetime(anio, mes, dia, hora, minuto, tzinfo=BOGOTA)
        db.add(
            Cita(
                paciente_id=paciente.id,
                profesional_id=p.id,
                sede_id=p.sede_id,
                inicio=inicio,
                fin=inicio + timedelta(minutes=duracion),
                duracion_min=duracion,
                motivo="Prueba",
                estado=estado,
            )
        )
    db.commit()
    return {
        "norte": norte.id,
        "sur": sur.id,
        "cardio": cardio.id,
        "pedia": pedia.id,
        "p1": p1.id,
        "p2": p2.id,
        "p3": p3.id,
    }
