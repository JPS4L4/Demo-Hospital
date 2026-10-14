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
└── frontend/            # aplicación Angular (páginas, header y footer)
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
uvicorn app.main:app --reload
```

La API queda en <http://localhost:8000> y la documentación interactiva en <http://localhost:8000/docs>.
Si cambias las credenciales de la base de datos, actualiza `DATABASE_URL` en `backend/.env`.

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
| POST | `/sedes` | Crea una sede |
| GET | `/noticias` | Lista las noticias |
| POST | `/noticias` | Crea una noticia |

Por ahora el frontend tiene las páginas (inicio, citas, medicamentos, profesionales y noticias) pero todavía no consume la API.

## Hoja de ruta

- Frontend conectado a la API
- Profesionales, pacientes, citas y medicamentos en el backend
- Login y reserva de citas
- Tests y CI
- Despliegue