"""Registro, inicio de sesión y /auth/me."""
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.core.config import settings
from app.core.security import ALGORITMO
from app.models.paciente import Paciente
from app.models.usuario import Usuario
from conftest import CONTRASENA

REGISTRO = {
    "tipo_documento": "CC",
    "numero_documento": "1098765432",
    "nombres": "Lucía",
    "apellidos": "Mendoza Rey",
    "fecha_nacimiento": "1995-08-21",
    "email": "Lucia.Mendoza@Example.com",
    "telefono": "+57 311 555 0123",
    "password": "una-clave-larga-1",
}


def token_para(usuario_id, **cambios):
    ahora = datetime.now(timezone.utc)
    claims = {"sub": str(usuario_id), "iat": ahora, "exp": ahora + timedelta(minutes=5)} | cambios
    return jwt.encode(claims, settings.jwt_secret, algorithm=ALGORITMO)


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def test_registro_crea_ficha_y_cuenta_y_abre_sesion(anon):
    r = anon.post("/auth/registro", json=REGISTRO)
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert cuerpo["token_type"] == "bearer" and cuerpo["expires_in"] == 3600
    usuario = cuerpo["usuario"]
    assert usuario["email"] == "lucia.mendoza@example.com" and usuario["rol"] == "paciente"
    assert usuario["paciente"]["telefono"] == "+573115550123"
    assert "password" not in str(cuerpo) and "hash" not in str(cuerpo)

    me = anon.get("/auth/me", headers=bearer(cuerpo["access_token"]))
    assert me.status_code == 200 and me.json() == usuario


def test_registro_guarda_hash_no_la_contrasena(anon, db):
    anon.post("/auth/registro", json=REGISTRO)
    guardado = db.query(Usuario).one().password_hash
    assert guardado.startswith("$argon2") and REGISTRO["password"] not in guardado


def test_login_tras_registro_no_distingue_mayusculas_del_correo(anon):
    anon.post("/auth/registro", json=REGISTRO)
    r = anon.post("/auth/login", json={"email": "  LUCIA.MENDOZA@example.com ", "password": REGISTRO["password"]})
    assert r.status_code == 200 and r.json()["usuario"]["rol"] == "paciente"


def test_registro_duplicados_409_y_no_deja_restos(anon, db):
    assert anon.post("/auth/registro", json=REGISTRO).status_code == 201
    mismo_correo = anon.post("/auth/registro", json=REGISTRO | {"numero_documento": "5555555555"})
    assert mismo_correo.status_code == 409
    mismo_documento = anon.post("/auth/registro", json=REGISTRO | {"email": "otra@example.com"})
    assert mismo_documento.status_code == 409 and "documento" in mismo_documento.json()["detail"]
    # las transacciones fallidas no dejaron ficha ni cuenta sueltas
    assert db.query(Usuario).count() == 1 and db.query(Paciente).count() == 1


@pytest.mark.parametrize(
    "cambio",
    [
        {"password": "corta"},
        {"password": "x" * 129},
        {"email": "no-es-correo"},
        {"fecha_nacimiento": "2999-01-01"},
        {"tipo_documento": "XX"},
        {"telefono": "123"},
    ],
)
def test_registro_valida_con_las_mismas_reglas_del_paciente(anon, cambio):
    assert anon.post("/auth/registro", json=REGISTRO | cambio).status_code == 422


def test_registro_no_permite_elegir_rol(anon, db):
    anon.post("/auth/registro", json=REGISTRO | {"rol": "admin"})
    assert db.query(Usuario).one().rol == "paciente"


def test_login_correcto_y_mismo_error_generico_para_todo_fallo(anon, cuenta_paciente, db):
    usuario = cuenta_paciente()
    ok = anon.post("/auth/login", json={"email": usuario.email, "password": CONTRASENA})
    assert ok.status_code == 200 and ok.json()["usuario"]["id"] == usuario.id

    mala = anon.post("/auth/login", json={"email": usuario.email, "password": "equivocada-123"})
    inexistente = anon.post("/auth/login", json={"email": "nadie@example.com", "password": CONTRASENA})
    usuario.activo = False
    db.commit()
    inactiva = anon.post("/auth/login", json={"email": usuario.email, "password": CONTRASENA})
    for r in (mala, inexistente, inactiva):
        assert r.status_code == 401
        assert r.json() == {"detail": "Correo o contraseña incorrectos"}
        assert r.headers["www-authenticate"] == "Bearer"


def test_login_sin_cuerpo_valido_422(anon):
    assert anon.post("/auth/login", json={"email": "a@b.co"}).status_code == 422


def test_me_de_admin_no_tiene_ficha(client, admin):
    r = client.get("/auth/me")
    assert r.status_code == 200
    assert r.json() == {"id": admin.id, "email": admin.email, "rol": "admin", "activo": True, "paciente": None}


def test_me_de_paciente_incluye_ficha(cuenta_paciente, cliente_de):
    usuario = cuenta_paciente()
    cuerpo = cliente_de(usuario).get("/auth/me").json()
    assert cuerpo["rol"] == "paciente" and cuerpo["paciente"]["id"] == usuario.paciente_id


def test_me_sin_token_401(anon):
    r = anon.get("/auth/me")
    assert r.status_code == 401 and r.headers["www-authenticate"] == "Bearer"


def test_me_rechaza_tokens_invalidos(anon, cuenta_paciente, db):
    usuario = cuenta_paciente()
    ahora = datetime.now(timezone.utc)
    futuro = ahora + timedelta(minutes=5)
    invalidos = {
        "basura": "esto-no-es-un-jwt",
        "expirado": token_para(usuario.id, exp=ahora - timedelta(minutes=1)),
        "otra_firma": jwt.encode({"sub": str(usuario.id), "exp": futuro}, "x" * 40, algorithm="HS256"),
        "sin_firma": jwt.encode({"sub": str(usuario.id), "exp": futuro}, None, algorithm="none"),
        "sin_exp": jwt.encode({"sub": str(usuario.id)}, settings.jwt_secret, algorithm="HS256"),
        "sub_no_numerico": token_para("abc"),
        "usuario_inexistente": token_para(999999),
    }
    for nombre, token in invalidos.items():
        assert anon.get("/auth/me", headers=bearer(token)).status_code == 401, nombre
    assert anon.get("/auth/me", headers={"Authorization": "Basic abc"}).status_code == 401

    assert anon.get("/auth/me", headers=bearer(token_para(usuario.id))).status_code == 200
    usuario.activo = False
    db.commit()
    assert anon.get("/auth/me", headers=bearer(token_para(usuario.id))).status_code == 401
