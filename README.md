# Demo Hospital

[![CI](https://github.com/JPS4L4/Demo-Hospital/actions/workflows/ci.yml/badge.svg)](https://github.com/JPS4L4/Demo-Hospital/actions/workflows/ci.yml)

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
python -m app.seed          # datos de ejemplo (sedes, noticias, profesionales, medicamentos, pacientes, citas y cuentas demo); se puede repetir sin duplicar
uvicorn app.main:app --reload
```

La API queda en <http://localhost:8000> y la documentación interactiva en <http://localhost:8000/docs>.
Si cambias las credenciales de la base de datos, actualiza `DATABASE_URL` en `backend/.env`. `JWT_SECRET` es obligatorio (ver [Variables de entorno](#variables-de-entorno)): si tu `.env` es anterior al login, añade esa variable.
Los orígenes permitidos por CORS se configuran con `CORS_ORIGINS` (lista separada por comas; por defecto `http://localhost:4200`).

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

La aplicación queda en <http://localhost:4200>.

## Endpoints disponibles

> Las lecturas del catálogo público (`GET` de sedes, noticias, especialidades, profesionales y medicamentos, y la disponibilidad) son abiertas. Todo lo demás exige sesión: ver [Autenticación y permisos](#autenticación-y-permisos).

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

`PUT /citas/{id}` (solo admin) acepta solo los campos que cambian (`paciente_id`, `profesional_id`, `sede_id`, `inicio`, `duracion_min`, `motivo`, `estado` = `programada`/`atendida`) y solo sobre citas programadas.

`GET /profesionales/{id}/disponibilidad?fecha=YYYY-MM-DD&duracion=30` (público) devuelve los huecos libres del día:

```json
{"profesional_id": 3, "fecha": "2026-10-19", "duracion_min": 30,
 "huecos": [{"inicio": "2026-10-19T07:00:00-05:00", "fin": "2026-10-19T07:30:00-05:00"}, "..."]}
```

- `fecha` es el día en hora de Bogotá; `duracion` ∈ 20, 30, 40, 60 (por defecto 30) y es también el paso entre huecos (con 40 min: 7:00, 7:40, 8:20…). Solo se ofrecen huecos cuya cita completa cabe antes de las 7:00 p. m.
- Se descartan los que se solapan con citas no canceladas del profesional y, si la fecha es hoy, los que ya pasaron.
- Fecha anterior a hoy → `422`; profesional inexistente → `404`. **Domingos, profesional inactivo o día ya agotado → lista vacía** (no es un error).
- Usa las mismas reglas que la reserva (`services/citas.py`): todo hueco ofrecido se puede reservar. No tiene en cuenta otras citas del mismo paciente (reservar sigue pudiendo dar `409` por solape del paciente).

## Autenticación y permisos

Autenticación con **JWT** (HS256) en el encabezado `Authorization: Bearer <token>`. Las contraseñas se guardan con **Argon2id** (`pwdlib`).

| Ruta | Descripción |
|------|-------------|
| `POST /auth/registro` | Crea la ficha de paciente y su cuenta (rol `paciente`) en una sola transacción y abre sesión. Cuerpo: los campos de `POST /pacientes` más `password` (8 a 128 caracteres). El correo de la ficha es el de inicio de sesión. `201` con el mismo cuerpo que el login; `409` si el correo o el documento ya existen |
| `POST /auth/login` | Cuerpo JSON `{"email": "...", "password": "..."}` (el correo no distingue mayúsculas). `200` con `{"access_token", "token_type": "bearer", "expires_in": 3600, "usuario": {...}}`. Cualquier fallo (correo desconocido, contraseña errónea, cuenta desactivada) es `401` con el mismo mensaje `Correo o contraseña incorrectos` |
| `GET /auth/me` | Usuario en sesión: `{"id", "email", "rol", "activo", "paciente": {ficha} \| null}` (`paciente` es `null` para el admin) |
| `GET`/`PUT /pacientes/me` | Ficha del paciente en sesión (para el admin: `404`). Si cambia el correo, cambia también el de acceso |

En la documentación interactiva (`/docs`) pulsa **Authorize** y pega el `access_token`. El token expira a los `JWT_EXPIRE_MINUTES` (60 por defecto); no hay refresco: al expirar la API responde `401` y hay que volver a iniciar sesión.

**Errores:** `401` (`{"detail": ...}` con `WWW-Authenticate: Bearer`) si falta el token, es inválido o expiró, o la cuenta está desactivada; `403` si hay sesión pero el rol no alcanza (o el paciente pide datos de otro explícitamente); `404` si el paciente intenta ver o cancelar un recurso **ajeno** (se responde como si no existiera, para no revelar qué ids existen).

| Recurso | Anónimo | Paciente | Admin |
|---------|---------|----------|-------|
| `GET` sedes, noticias, especialidades, profesionales, medicamentos, `/profesionales/{id}/disponibilidad`, `/health` | sí | sí | sí |
| `POST`/`PUT`/`DELETE` de esos recursos | 401 | 403 | sí |
| `GET /pacientes`, `POST /pacientes`, `DELETE /pacientes/{id}` | 401 | 403 | sí |
| `GET`/`PUT /pacientes/{id}`, `/pacientes/me` | 401 | solo la propia (ajena: 404) | cualquiera |
| `GET /citas`, `GET /citas/{id}` | 401 | solo las propias (`?paciente_id=` ajeno: 403; cita ajena: 404) | todas |
| `POST /citas` | 401 | solo para sí (el `paciente_id` sale de la sesión y puede omitirse; si se envía otro: 403) | para cualquier paciente (`paciente_id` obligatorio) |
| `POST /citas/{id}/cancelar` | 401 | solo las propias (ajena: 404) | cualquiera |
| `PUT /citas/{id}` (reprogramar, marcar `atendida`), `DELETE /citas/{id}` | 401 | 403 | sí |

Borrar la ficha de un paciente (admin) borra también su cuenta.

### Cuentas demo

`python -m app.seed` crea (si no existen) dos cuentas **solo para el demo público**: no uses estas credenciales ni estos valores por defecto en ningún entorno real.

| Rol | Correo | Contraseña (variable) | Valor por defecto |
|-----|--------|-----------------------|-------------------|
| Admin | `admin@meridiana.example` | `DEMO_ADMIN_PASSWORD` | `Admin-Demo-2026` |
| Paciente (Paula Herrera, ficha del seed) | `paula.herrera@example.com` | `DEMO_PATIENT_PASSWORD` | `Paciente-Demo-2026` |

El seed no modifica una cuenta que ya existe (no restablece su contraseña). Cualquier paciente nuevo se crea desde `/auth/registro`.

### Reinicio periódico de la demo

Las credenciales de las cuentas demo son públicas, así que cualquiera puede crear o borrar datos. Para que el estropicio se deshaga solo, la API puede **reiniciar la base** cada cierto tiempo: vacía todas las tablas de datos (`TRUNCATE ... RESTART IDENTITY CASCADE`; `alembic_version` no se toca) y vuelve a ejecutar el seed, todo en una sola transacción, de modo que o queda como un seed recién hecho o no cambia nada. Las citas se generan otra vez relativas a la fecha del reinicio y las cuentas demo recuperan sus contraseñas por defecto.

- **Está desactivado por defecto**, porque borra todos los datos. Para activarlo en el despliegue del demo público define `DEMO_RESET_ENABLED=true` (y, si quieres, `DEMO_RESET_INTERVAL_HORAS`) en el entorno de la API. No lo actives en ningún entorno con datos reales.
- Se programa dentro de la propia API (tarea en segundo plano), sin cron ni servicios extra. El primer reinicio llega tras un intervalo completo, no al arrancar. Cada reinicio queda en el registro (`hecho` u `omitido`); si falla, se registra el error y se reintenta en el siguiente intervalo.
- Con varios workers o réplicas, todos programan el reinicio pero solo uno lo ejecuta: se coordinan con un *advisory lock* de PostgreSQL (`pg_try_advisory_xact_lock`) y los demás lo omiten.
- En local puedes lanzarlo a mano con un intervalo corto, p. ej. `DEMO_RESET_ENABLED=true DEMO_RESET_INTERVAL_HORAS=0.01`.
- La pantalla de ingreso avisa a quien visita la demo de que los datos se reinician periódicamente.

### Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | sí | Conexión a PostgreSQL |
| `JWT_SECRET` | sí | Secreto de firma de los tokens, mínimo 32 caracteres. `.env.example` trae un valor ficticio de desarrollo; en otros entornos genera uno propio (`python -c "import secrets; print(secrets.token_urlsafe(48))"`) |
| `JWT_EXPIRE_MINUTES` | no | Vigencia del token en minutos (60) |
| `CORS_ORIGINS` | no | Orígenes permitidos (`http://localhost:4200`) |
| `DEMO_ADMIN_PASSWORD`, `DEMO_PATIENT_PASSWORD` | no | Contraseñas de las cuentas demo del seed |
| `DEMO_RESET_ENABLED` | no | `true` activa el reinicio periódico de la demo (`false`) |
| `DEMO_RESET_INTERVAL_HORAS` | no | Horas entre reinicios, mayor que 0 (6) |
| `LOG_LEVEL` | no | Nivel de registro: `DEBUG`, `INFO`, `WARNING` o `ERROR` (`INFO`) |
| `RATE_LIMIT_ENABLED` | no | `false` desactiva el límite de intentos (`true`) |
| `RATE_LIMIT_LOGIN_POR_MINUTO` | no | Intentos por IP y minuto en `POST /auth/login` (10) |
| `RATE_LIMIT_REGISTRO_POR_MINUTO` | no | Intentos por IP y minuto en `POST /auth/registro` (5) |
| `TRUSTED_PROXY` | no | `true` solo si la API está detrás de un proxy de confianza que añade `X-Forwarded-For` (`false`) |

### Límite de intentos

`POST /auth/login` y `POST /auth/registro` (cada uno con su propio contador) admiten un número máximo de peticiones por IP y minuto, porque cada una cuesta un hash Argon2. Al superarlo responde `429` con `{"detail": "Demasiados intentos. Espera N segundos..."}` y la cabecera `Retry-After`. Cuentan todas las peticiones, correctas o no. El resto de la API no tiene límite.

- El contador vive en la memoria de cada proceso y se reinicia con él: con varios workers el límite efectivo se multiplica. Para una demo basta; en producción conviene un límite en el proxy o un almacén compartido.
- Con `TRUSTED_PROXY=false` (por defecto) se usa la IP de la conexión y se ignora `X-Forwarded-For`, que cualquiera puede falsear. Actívalo solo detrás de un proxy propio: entonces se toma la **última** IP del encabezado, la que añade ese proxy.

No implementado: recuperación de contraseña y verificación de correo.

### Salud del servicio

`GET /health` ejecuta `SELECT 1` en la base de datos: `200 {"status": "ok"}` si responde y `503 {"status": "error", "database": "no disponible"}` si no, para que un balanceador o monitor distinga una API viva de una API sin base de datos. El motor SQLAlchemy usa `pool_pre_ping` y `pool_recycle` (30 min) para no reutilizar conexiones cortadas. Los errores no controlados responden `500 {"detail": "Error interno del servidor"}` y quedan registrados con su traza; un error de integridad que ningún endpoint tradujo responde `409`.

### Reglas de las citas

Al crear o reprogramar una cita (`inicio` con zona horaria, `duracion_min` ∈ 20, 30, 40, 60 — por defecto 30):

- `inicio` debe ser futuro → `422`.
- La sede es la del profesional; si se envía `sede_id` debe coincidir → `422`.
- El profesional debe estar activo → `409`.
- Horario de atención: lunes a sábado, 7:00 a. m. a 7:00 p. m. (hora de Bogotá); la cita completa, incluida su duración, debe caber → `409`.
- `inicio` no puede estar a más de 365 días de anticipación → `422`.
- Sin solapes para el mismo profesional ni para el mismo paciente entre citas no canceladas → `409`. Cancelar una cita libera su horario.

**Sin dobles reservas, aunque falle el código.** Además de la validación de la API (que bloquea las filas del paciente y del profesional con `SELECT ... FOR UPDATE`), la base de datos tiene dos restricciones `EXCLUDE` (`ex_citas_profesional_solape` y `ex_citas_paciente_solape`, con `btree_gist`) que impiden que dos citas no canceladas del mismo profesional, o del mismo paciente, se solapen en el rango `[inicio, fin)`; citas contiguas sí caben. Si dos reservas simultáneas del mismo hueco llegan a la vez, una responde `201` y la otra `409`. La migración que las crea necesita `CREATE EXTENSION btree_gist` (en PostgreSQL 13+ es una extensión de confianza, así que basta ser dueño de la base) y falla si ya hay citas solapadas, que habría que corregir antes.

- `desde` / `hasta` (filtros) sin zona horaria se interpretan en hora de Bogotá.

El frontend consume esta API.
La URL de la API se define en `frontend/src/environments/environment.ts` (por defecto `http://localhost:8000`).

## Tests del backend

```bash
cd backend
pip install -r requirements.txt
pytest -q
```

Las pruebas usan una base PostgreSQL aparte, `hospital_test`, en el mismo servidor que `DATABASE_URL`: se crea sola si no existe, sus tablas se generan al empezar y se vacían tras cada prueba, así que **nunca tocan los datos de desarrollo**. Si quieres otra, define `TEST_DATABASE_URL` (el nombre de la base debe terminar en `_test`). El usuario necesita permiso para crear bases de datos (el usuario de `docker-compose.yml` lo tiene).

## Lint y formato

Backend (desde `backend/`, con el entorno virtual activo; usa [ruff](https://docs.astral.sh/ruff/), configurado en `backend/pyproject.toml`):

```bash
ruff check .          # lint (añade --fix para corregir lo automático)
ruff format .         # formatea
ruff format --check . # solo comprueba el formato
```

Frontend (desde `frontend/`; ESLint con angular-eslint y Prettier):

```bash
npm run lint          # ESLint
npm run format        # Prettier, reescribe los archivos
npm run format:check  # Prettier, solo comprueba
```

### Migraciones

Las migraciones están en `backend/alembic/` (`alembic upgrade head` desde `backend/`). Tras cambiar un modelo, genera la migración con `alembic revision --autogenerate -m "..."` y revísala. `alembic check` falla si los modelos y las migraciones no coinciden. Limitación: Alembic no detecta las restricciones `EXCLUDE`, así que esas se mantienen a mano (modelo y migración).

GitHub Actions (`.github/workflows/ci.yml`) ejecuta todo esto en cada push a `main` y en cada pull request: en el backend `ruff check`, `ruff format --check`, `alembic upgrade head` y `alembic check` (contra un PostgreSQL 16 como servicio, para comprobar que las migraciones aplican desde cero y no hay deriva) y `pytest`; en el frontend `npm run lint`, `npm run format:check`, `npm test` y `npm run build`.

## Hoja de ruta

- Páginas de profesionales y medicamentos en el frontend
- Login, reserva de citas y panel de administración en el frontend
- Despliegue