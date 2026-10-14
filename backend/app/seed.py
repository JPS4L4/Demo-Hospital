"""Datos de ejemplo para el demo: sedes y noticias.

Uso (desde backend/, con las migraciones aplicadas):

    python -m app.seed

Es idempotente: cada registro se identifica por nombre (sedes) o título
(noticias) y solo se inserta si todavía no existe.
Todo el contenido es ficticio.
"""
from datetime import datetime, timedelta, timezone

from app.core.database import SessionLocal
from app.models.noticia import Noticia
from app.models.sede import Sede

SEDES = [
    {
        "nombre": "Sede Chapinero",
        "direccion": "Carrera 13 # 63-40",
        "ciudad": "Bogotá",
        "telefono": "+57 601 555 0101",
    },
    {
        "nombre": "Sede El Poblado",
        "direccion": "Calle 10 # 34-25",
        "ciudad": "Medellín",
        "telefono": "+57 604 555 0102",
    },
    {
        "nombre": "Sede San Fernando",
        "direccion": "Avenida 5 Norte # 20-18",
        "ciudad": "Cali",
        "telefono": "+57 602 555 0103",
    },
    {
        "nombre": "Sede Alto Prado",
        "direccion": "Carrera 53 # 82-60",
        "ciudad": "Barranquilla",
        "telefono": "+57 605 555 0104",
    },
]

# (días atrás, título, contenido)
NOTICIAS = [
    (
        3,
        "Nueva unidad de cardiología con telemonitoreo en la Sede Chapinero",
        "La Sede Chapinero estrena una unidad de cardiología que combina consulta presencial y "
        "seguimiento remoto. Los pacientes con insuficiencia cardiaca o hipertensión podrán "
        "registrar su presión y su ritmo desde casa, y el equipo médico revisará los datos a "
        "diario para ajustar tratamientos sin necesidad de acudir a cada control.\n\n"
        "La unidad cuenta con ecocardiografía, prueba de esfuerzo y consulta de rehabilitación "
        "cardiaca. Las citas se asignan en un plazo máximo de cinco días hábiles.",
    ),
    (
        10,
        "Jornada gratuita de vacunación en las cuatro sedes",
        "Durante el próximo sábado, de 8:00 a. m. a 4:00 p. m., ofreceremos vacunación contra la "
        "influenza y actualización del esquema de refuerzo para adultos y niños, sin costo y sin "
        "cita previa. Solo es necesario presentar un documento de identidad.\n\n"
        "Recomendamos llegar en las primeras horas de la mañana y, si es posible, traer el carné "
        "de vacunación. Habrá un acceso preferente para adultos mayores y mujeres gestantes.",
    ),
    (
        18,
        "Cinco hábitos para cuidar la salud del corazón",
        "Caminar al menos treinta minutos al día, reducir la sal, dormir entre siete y ocho "
        "horas, no fumar y controlar la presión arterial una vez al año son hábitos sencillos "
        "que disminuyen de forma importante el riesgo cardiovascular.\n\n"
        "Nuestro equipo de medicina interna recuerda que ninguno de ellos reemplaza una "
        "valoración médica: si tienes antecedentes familiares o síntomas como dolor en el pecho "
        "o falta de aire, solicita una cita de evaluación.",
    ),
    (
        27,
        "Ampliamos el horario de urgencias pediátricas en Medellín",
        "Desde este mes, la Sede El Poblado atiende urgencias pediátricas las 24 horas, todos los "
        "días del año. La sala cuenta con pediatras de turno, área de observación y un espacio "
        "adaptado para que los niños esperen con menos estrés.\n\n"
        "Para consultas que no son urgentes, sigue disponible la agenda de pediatría general de "
        "lunes a sábado.",
    ),
    (
        41,
        "Programa de acompañamiento para pacientes con diabetes",
        "Lanzamos un programa que reúne endocrinología, nutrición y enfermería en un mismo plan "
        "de seguimiento. Cada paciente recibe una ruta personalizada con controles periódicos, "
        "educación sobre alimentación y actividad física, y una línea de consulta para resolver "
        "dudas entre visitas.\n\n"
        "La inscripción está abierta en la Sede San Fernando y en la Sede Alto Prado.",
    ),
    (
        58,
        "Renovamos el laboratorio clínico para entregar resultados más rápido",
        "El laboratorio clínico de la red incorpora nuevos analizadores automatizados que reducen "
        "el tiempo de entrega de los exámenes de rutina. La mayoría de los resultados estarán "
        "disponibles el mismo día de la toma de muestra.\n\n"
        "Además, mantenemos el servicio de toma de muestras a domicilio para adultos mayores y "
        "personas con movilidad reducida.",
    ),
]


def seed() -> None:
    db = SessionLocal()
    try:
        nuevas_sedes = 0
        for datos in SEDES:
            existe = db.query(Sede).filter(Sede.nombre == datos["nombre"]).first()
            if existe is None:
                db.add(Sede(**datos))
                nuevas_sedes += 1

        nuevas_noticias = 0
        ahora = datetime.now(timezone.utc)
        for dias, titulo, contenido in NOTICIAS:
            existe = db.query(Noticia).filter(Noticia.titulo == titulo).first()
            if existe is None:
                db.add(
                    Noticia(
                        titulo=titulo,
                        contenido=contenido,
                        fecha_publicacion=ahora - timedelta(days=dias),
                    )
                )
                nuevas_noticias += 1

        db.commit()
        print(f"Sedes nuevas: {nuevas_sedes} | Noticias nuevas: {nuevas_noticias}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
