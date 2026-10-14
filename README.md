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
python -m app.seed          # datos de ejemplo (sedes y noticias); se puede repetir sin duplicar
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

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado de la API |
| GET | `/sedes` | Lista las sedes |
| GET | `/sedes/{id}` | Detalle de una sede (404 si no existe) |
| POST | `/sedes` | Crea una sede |
| GET | `/noticias` | Lista las noticias, la más reciente primero |
| GET | `/noticias/{id}` | Detalle de una noticia (404 si no existe) |
| POST | `/noticias` | Crea una noticia |

El frontend (inicio, noticias con detalle y sedes) consume esta API. Las páginas de citas, medicamentos y profesionales son por ahora avisos de "próximamente".
La URL de la API se define en `frontend/src/environments/environment.ts` (por defecto `http://localhost:8000`).

## Hoja de ruta

- Profesionales, pacientes, citas y medicamentos en el backend
- Login y reserva de citas
- Tests y CI
- Despliegue