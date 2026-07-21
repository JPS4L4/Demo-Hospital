from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import sedes, noticias

app = FastAPI(title="Hospital API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

app.include_router(sedes.router)
app.include_router(noticias.router)