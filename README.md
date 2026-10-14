# Demo Hospital

Demo de un sitio web de hospital para mostrar un stack **Python + Angular**: una API REST en FastAPI con PostgreSQL y un frontend en Angular. Es un proyecto de demostración en construcción, no un sistema clínico real.

## Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL 16 (vía Docker Compose).
- **Frontend:** Angular 21, Tailwind CSS 4, Vitest.

## Estructura

```
.
├── docker-compose.yml   # PostgreSQL para desarrollo local
├── backend/             # API FastAPI
│   ├── app/             # core (config, base de datos), models, schemas, routers
│   ├── alembic/         # migraciones
│   ├── tests/           # pytest (base hospital_test)
│   └── .env.example     # plantilla de variables de entorno
└── frontend/            # aplicación Angular (Meridiana: portada, noticias, sedes)
```

## Requisitos previos

- Docker y Docker Compose
- Python 3.12
- Node.js 20+ y npm

## Cómo arrancar

### 1. Base de datos

```bash
docker compose up -d
```

Levanta PostgreSQL en `localhost:5432` (base `hospital_db`). Usuario y contraseña por defecto de desarrollo: `hospital` / `hospital`; se pueden cambiar con las variables `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` y `POSTGRES_PORT` (si el puerto 5432 ya está ocupado en tu máquina).

### 2. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate   |   Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # Windows (PowerShell): Copy-Item .env.example .env
alembic upgrade head
python -m app.seed          # datos de ejemplo (sedes, noticias, profesionales, medicamentos, pacientes y citas); se puede repetir sin duplicar
uvicorn app.main:app --reload
```

La API queda en <http://localhost:8000> y la documentación interactiva en <http://localhost:8000/docs>.
Si cambias las credenciales de la base de datos, actualiza `DATABASE_URL` en `backend/.env`.
Los orígenes permitidos por CORS se configuran con `CORS_ORIGINS` (lista separada por comas; por defecto `http://localhost:4200`).

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

La aplicación queda en <http://localhost:4200>.

## Endpoints disponibles

> **Las escrituras (POST, PUT, DELETE) están abiertas**: todavía no hay autenticación. El bloque de login y roles las protegerá.

### Convenciones

- **Errores:** `404` si el recurso no existe, `409` si choca con una regla de negocio o una restricción (duplicados, borrar algo en uso, agenda), `422` si los datos enviados no son válidos. El cuerpo es `{"detail": "..."}` (en español para `404`/`409` y los `422` de negocio) o la lista estándar de FastAPI para los `422` de validación de campos.
- **Listas paginadas** (especialidades, profesionales, medicamentos, pacientes, citas): aceptan `limit` (1–100, por defecto 20) y `offset` (≥ 0) y responden `{"items": [...], "total": N, "limit": 20, "offset": 0}`; `total` es el número de resultados sin paginar.
- **`/sedes` y `/noticias`** siguen devolviendo una **lista simple** (la usa el frontend); aceptan `limit` (1–200) y `offset` opcionales, y sin ellos devuelven todo.
- Las búsquedas `q` no distinguen mayúsculas de minúsculas (pero sí tildes).
- Las fechas con hora usan ISO 8601 con zona horaria.

### Recursos

Todos los recursos tienen `GET /recurso` (lista), `GET /recurso/{id}`, `POST /recurso` (201), `PUT /recurso/{id}` (reemplaza) y `DELETE /recurso/{id}` (204). Se explican solo las diferencias.

| Ruta | Lista: filtros | Notas |
|------|----------------|-------|
| `/health` | | Estado de la API (solo `GET`) |
| `/sedes` | `limit`, `offset` | No se puede borrar una sede con profesionales o citas (409) |
| `/noticias` | `limit`, `offset` | Más reciente primero |
| `/especialidades` | `q` (nombre) | Nombre único (409). No se borra con profesionales asociados (409) |
| `/profesionales` | `especialidad_id`, `sede_id`, `q` (nombres y apellidos), `activo` | Registro profesional único (409). Incluye `especialidad` y `sede` anidadas (`id`, `nombre`) |
| `/medicamentos` | `q` (nombre o principio activo), `requiere_formula` | `stock` ≥ 0 y `precio` ≥ 0 con 2 decimales; el precio sale como número |
| `/pacientes` | `q` (nombre, documento o correo) | `tipo_documento` ∈ `CC`, `TI`, `CE`, `PA`. Documento único por tipo y correo único (409). Correo válido, teléfono de 7 a 15 dígitos con `+` opcional, fecha de nacimiento pasada. No se borra con citas (409) |
| `/citas` | `paciente_id`, `profesional_id`, `estado` (`programada`, `cancelada`, `atendida`), `desde`, `hasta` | Incluye `paciente`, `profesional` y `sede` anidados. Ver reglas |
| `POST /citas/{id}/cancelar` | | Cancela la cita y libera el horario (idempotente; una cita atendida no se cancela: 409) |

`PUT /citas/{id}` acepta solo los campos que cambian (`paciente_id`, `profesional_id`, `sede_id`, `inicio`, `duracion_min`, `motivo`, `estado` = `programada`/`atendida`) y solo sobre citas programadas.

### Reglas de las citas

Al crear o reprogramar una cita (`inicio` con zona horaria, `duracion_min` ∈ 20, 30, 40, 60 — por defecto 30):

- `inicio` debe ser futuro → `422`.
- La sede es la del profesional; si se envía `sede_id` debe coincidir → `422`.
- El profesional debe estar activo → `409`.
- Horario de atención: lunes a sábado, 7:00 a. m. a 7:00 p. m. (hora de Bogotá); la cita completa, incluida su duración, debe caber → `409`.
- Sin solapes para el mismo profesional ni para el mismo paciente entre citas no canceladas → `409`. Cancelar una cita libera su horario.
- `desde` / `hasta` (filtros) sin zona horaria se interpretan en hora de Bogotá.

El frontend (inicio, noticias con detalle y sedes) consume esta API. Las páginas de citas, medicamentos y profesionales son por ahora avisos de "próximamente".
La URL de la API se define en `frontend/src/environments/environment.ts` (por defecto `http://localhost:8000`).

## Tests del backend

```bash
cd backend
pip install -r requirements.txt
pytest -q
```

Las pruebas usan una base PostgreSQL aparte, `hospital_test`, en el mismo servidor que `DATABASE_URL`: se crea sola si no existe, sus tablas se generan al empezar y se vacían tras cada prueba, así que **nunca tocan los datos de desarrollo**. Si quieres otra, define `TEST_DATABASE_URL` (el nombre de la base debe terminar en `_test`). El usuario necesita permiso para crear bases de datos (el usuario de `docker-compose.yml` lo tiene).

## Hoja de ruta

- Páginas de profesionales y medicamentos en el frontend
- Login y reserva de citas
- CI
- Despliegue