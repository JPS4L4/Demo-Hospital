"""Datos de ejemplo para el demo: sedes, noticias, especialidades, profesionales,
medicamentos, pacientes y citas.

Uso (desde backend/, con las migraciones aplicadas):

    python -m app.seed

Es idempotente: cada registro se identifica por una clave natural (nombre, título,
registro profesional, documento, paciente + profesional + motivo...) y solo se inserta
si todavía no existe. Todo el contenido es ficticio.
"""
from datetime import date, datetime, timedelta, timezone

from app.core.database import SessionLocal
from app.models.cita import Cita
from app.models.especialidad import Especialidad
from app.models.medicamento import Medicamento
from app.models.noticia import Noticia
from app.models.paciente import Paciente
from app.models.profesional import Profesional
from app.models.sede import Sede
from app.services.citas import TZ_CLINICA

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


# Las seis primeras coinciden con las de la portada del frontend.
ESPECIALIDADES = [
    ("Cardiología", "Control de la presión, ecocardiografía y rehabilitación cardiaca."),
    ("Pediatría", "Seguimiento del crecimiento, vacunación y urgencias infantiles."),
    ("Medicina interna", "Una mirada integral para adultos con una o varias condiciones."),
    ("Laboratorio clínico", "Resultados de rutina el mismo día y toma de muestras a domicilio."),
    ("Medicina preventiva", "Chequeos, vacunación y programas para evitar enfermedades."),
    ("Urgencias 24 horas", "Atención inmediata, todos los días del año, en cada sede."),
    ("Ginecología y obstetricia", "Control prenatal, planificación familiar y salud de la mujer."),
    ("Dermatología", "Diagnóstico y tratamiento de enfermedades de la piel, el pelo y las uñas."),
]

# (nombres, apellidos, especialidad, sede, registro, teléfono, bio)
PROFESIONALES = [
    ("Valentina", "Cárdenas Ruiz", "Cardiología", "Sede Chapinero", "RM-20001", "+573105550201",
     "Cardióloga con enfoque en insuficiencia cardiaca y telemonitoreo de pacientes crónicos."),
    ("Andrés", "Mejía Londoño", "Pediatría", "Sede Chapinero", "RM-20002", "+573105550202",
     "Pediatra general. Le interesa el acompañamiento a familias en los primeros años de vida."),
    ("Sofía", "Beltrán Pardo", "Medicina interna", "Sede Chapinero", "RM-20003", None,
     "Internista dedicada al seguimiento de hipertensión, diabetes y enfermedades crónicas."),
    ("Camilo", "Restrepo Zuluaga", "Urgencias 24 horas", "Sede El Poblado", "RM-20004", "+573105550204",
     "Médico de urgencias con experiencia en reanimación y atención de trauma."),
    ("Isabela", "Giraldo Arango", "Pediatría", "Sede El Poblado", "RM-20005", "+573105550205",
     "Pediatra de urgencias y consulta general. Atiende también controles de vacunación."),
    ("Mateo", "Ospina Duque", "Dermatología", "Sede El Poblado", "RM-20006", None,
     "Dermatólogo clínico: acné, dermatitis y revisión de lunares."),
    ("Daniela", "Quintero Valencia", "Ginecología y obstetricia", "Sede San Fernando", "RM-20007", "+573105550207",
     "Ginecóloga y obstetra. Control prenatal de bajo riesgo y planificación familiar."),
    ("Santiago", "Lozano Henao", "Cardiología", "Sede San Fernando", "RM-20008", "+573105550208",
     "Cardiólogo clínico. Realiza ecocardiografía y pruebas de esfuerzo."),
    ("Laura", "Castaño Ibarra", "Laboratorio clínico", "Sede San Fernando", "RM-20009", None,
     "Bacterióloga y responsable de la toma de muestras y entrega de resultados."),
    ("Julián", "Polo Barrios", "Medicina preventiva", "Sede Alto Prado", "RM-20010", "+573105550210",
     "Médico preventivista: chequeos ejecutivos, vacunación y programas de riesgo cardiovascular."),
    ("Natalia", "Sarmiento Vega", "Medicina interna", "Sede Alto Prado", "RM-20011", "+573105550211",
     "Internista. Coordina el programa de acompañamiento a pacientes con diabetes."),
    ("Esteban", "Navarro Cortés", "Dermatología", "Sede Alto Prado", "RM-20012", None,
     "Dermatólogo con interés en fotoprotección y prevención del cáncer de piel."),
]

# (nombre, principio activo, presentación, concentración, requiere fórmula, stock, precio)
MEDICAMENTOS = [
    ("Acetaminofén", "Paracetamol", "Caja x 20 tabletas", "500 mg", False, 240, 6500),
    ("Ibuprofeno", "Ibuprofeno", "Caja x 10 cápsulas blandas", "400 mg", False, 180, 9800),
    ("Loratadina", "Loratadina", "Caja x 10 tabletas", "10 mg", False, 150, 7200),
    ("Omeprazol", "Omeprazol", "Caja x 14 cápsulas", "20 mg", False, 120, 11500),
    ("Suero oral", "Sales de rehidratación oral", "Sobre x 1 litro", "27,9 g", False, 300, 3200),
    ("Amoxicilina", "Amoxicilina", "Caja x 21 cápsulas", "500 mg", True, 90, 18900),
    ("Azitromicina", "Azitromicina", "Caja x 3 tabletas", "500 mg", True, 60, 24500),
    ("Losartán", "Losartán potásico", "Caja x 30 tabletas", "50 mg", True, 110, 15600),
    ("Metformina", "Metformina clorhidrato", "Caja x 30 tabletas", "850 mg", True, 130, 12800),
    ("Atorvastatina", "Atorvastatina cálcica", "Caja x 30 tabletas", "20 mg", True, 85, 21400),
    ("Enalapril", "Enalapril maleato", "Caja x 30 tabletas", "10 mg", True, 95, 9400),
    ("Salbutamol", "Salbutamol sulfato", "Inhalador x 200 dosis", "100 mcg/dosis", True, 45, 17300),
    ("Cetirizina", "Cetirizina dihidrocloruro", "Jarabe x 60 ml", "1 mg/ml", False, 70, 13700),
    ("Diclofenaco", "Diclofenaco sódico", "Caja x 20 tabletas", "50 mg", True, 100, 8600),
    ("Levotiroxina", "Levotiroxina sódica", "Caja x 50 tabletas", "100 mcg", True, 55, 19800),
]

# (tipo, documento, nombres, apellidos, nacimiento, email, teléfono, eps)
PACIENTES = [
    ("CC", "1000100101", "Paula", "Herrera Montoya", date(1988, 4, 12), "paula.herrera@example.com", "+573205550301", "EPS Ficticia Norte"),
    ("CC", "1000100102", "Ricardo", "Salazar Peña", date(1975, 11, 3), "ricardo.salazar@example.com", "+573205550302", "EPS Ficticia Sur"),
    ("TI", "1000100103", "Emilia", "Torres Gil", date(2012, 7, 21), "emilia.torres@example.com", "+573205550303", None),
    ("CE", "9000100104", "Marco", "Bianchi", date(1990, 1, 30), "marco.bianchi@example.com", "+573205550304", "EPS Ficticia Norte"),
    ("PA", "AB1234567", "Hannah", "Müller", date(1983, 9, 9), "hannah.muller@example.com", "+573205550305", None),
]

# (índice de paciente, registro del profesional, días hacia adelante, hora, minuto, duración, motivo)
CITAS = [
    (0, "RM-20001", 3, 8, 0, 30, "Control de hipertensión"),
    (1, "RM-20003", 3, 9, 30, 40, "Seguimiento de diabetes tipo 2"),
    (2, "RM-20005", 4, 10, 0, 20, "Control de vacunación"),
    (3, "RM-20006", 5, 15, 0, 30, "Revisión de lunares"),
    (4, "RM-20007", 6, 11, 0, 60, "Control prenatal"),
    (0, "RM-20010", 8, 14, 30, 30, "Chequeo preventivo anual"),
]


def _dia_habil(dias: int, hora: int, minuto: int) -> datetime:
    """Fecha futura (lunes a sábado) a `dias` días o más de hoy, en hora de Bogotá."""
    base = datetime.now(TZ_CLINICA).replace(hour=hora, minute=minuto, second=0, microsecond=0)
    fecha = base + timedelta(days=dias)
    while fecha.weekday() == 6:
        fecha += timedelta(days=1)
    return fecha


def seed() -> dict[str, int]:
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

        db.flush()

        nuevas_especialidades = 0
        for nombre, descripcion in ESPECIALIDADES:
            if db.query(Especialidad).filter(Especialidad.nombre == nombre).first() is None:
                db.add(Especialidad(nombre=nombre, descripcion=descripcion))
                nuevas_especialidades += 1
        db.flush()

        especialidades = {e.nombre: e.id for e in db.query(Especialidad).all()}
        sedes = {s.nombre: s.id for s in db.query(Sede).all()}
        nuevos_profesionales = 0
        for nombres, apellidos, especialidad, sede, registro, telefono, bio in PROFESIONALES:
            existe = db.query(Profesional).filter(Profesional.registro_profesional == registro).first()
            if existe is None:
                slug = f"{nombres}.{apellidos.split()[0]}".lower()
                for con_tilde, sin_tilde in zip("áéíóúñ", "aeioun"):
                    slug = slug.replace(con_tilde, sin_tilde)
                db.add(
                    Profesional(
                        nombres=nombres,
                        apellidos=apellidos,
                        especialidad_id=especialidades[especialidad],
                        sede_id=sedes[sede],
                        registro_profesional=registro,
                        email=f"{slug}@example.com",
                        telefono=telefono,
                        bio=bio,
                    )
                )
                nuevos_profesionales += 1

        nuevos_medicamentos = 0
        for nombre, activo, presentacion, concentracion, formula, stock, precio in MEDICAMENTOS:
            existe = (
                db.query(Medicamento)
                .filter(Medicamento.nombre == nombre, Medicamento.concentracion == concentracion)
                .first()
            )
            if existe is None:
                db.add(
                    Medicamento(
                        nombre=nombre,
                        principio_activo=activo,
                        presentacion=presentacion,
                        concentracion=concentracion,
                        requiere_formula=formula,
                        stock=stock,
                        precio=precio,
                    )
                )
                nuevos_medicamentos += 1

        nuevos_pacientes = 0
        for tipo, documento, nombres, apellidos, nacimiento, email, telefono, eps in PACIENTES:
            existe = (
                db.query(Paciente)
                .filter(Paciente.tipo_documento == tipo, Paciente.numero_documento == documento)
                .first()
            )
            if existe is None:
                db.add(
                    Paciente(
                        tipo_documento=tipo,
                        numero_documento=documento,
                        nombres=nombres,
                        apellidos=apellidos,
                        fecha_nacimiento=nacimiento,
                        email=email,
                        telefono=telefono,
                        eps=eps,
                    )
                )
                nuevos_pacientes += 1
        db.flush()

        nuevas_citas = 0
        for idx_paciente, registro, dias, hora, minuto, duracion, motivo in CITAS:
            tipo, documento = PACIENTES[idx_paciente][:2]
            paciente = (
                db.query(Paciente)
                .filter(Paciente.tipo_documento == tipo, Paciente.numero_documento == documento)
                .one()
            )
            profesional = db.query(Profesional).filter(Profesional.registro_profesional == registro).one()
            existe = (
                db.query(Cita)
                .filter(
                    Cita.paciente_id == paciente.id,
                    Cita.profesional_id == profesional.id,
                    Cita.motivo == motivo,
                )
                .first()
            )
            if existe is None:
                inicio = _dia_habil(dias, hora, minuto)
                db.add(
                    Cita(
                        paciente_id=paciente.id,
                        profesional_id=profesional.id,
                        sede_id=profesional.sede_id,
                        inicio=inicio,
                        fin=inicio + timedelta(minutes=duracion),
                        duracion_min=duracion,
                        motivo=motivo,
                    )
                )
                nuevas_citas += 1

        db.commit()
        nuevos = {
            "sedes": nuevas_sedes,
            "noticias": nuevas_noticias,
            "especialidades": nuevas_especialidades,
            "profesionales": nuevos_profesionales,
            "medicamentos": nuevos_medicamentos,
            "pacientes": nuevos_pacientes,
            "citas": nuevas_citas,
        }
        print("Registros nuevos: " + " | ".join(f"{k}: {v}" for k, v in nuevos.items()))
        return nuevos
    finally:
        db.close()


if __name__ == "__main__":
    seed()
