from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import especialidades, medicamentos, noticias, profesionales, sedes

app = FastAPI(title="Hospital API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

app.include_router(sedes.router)
app.include_router(noticias.router)
app.include_router(especialidades.router)
app.include_router(profesionales.router)
app.include_router(medicamentos.router)
