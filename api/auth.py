from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt
from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from api.config import get_settings

# Chemins accessibles sans token
_PUBLIC_EXACT = {
    "/health",
    "/api/auth/login",
    "/api/dossiers/submit",
}
_PUBLIC_PREFIXES = ("/docs", "/openapi.json", "/redoc")


def _is_public(path: str) -> bool:
    if path in _PUBLIC_EXACT:
        return True
    return path.startswith(_PUBLIC_PREFIXES)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str, email: str) -> str:
    cfg = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=cfg.jwt_expire_minutes)
    payload = {"sub": user_id, "email": email, "exp": expire}
    return jwt.encode(payload, cfg.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict:
    cfg = get_settings()
    return jwt.decode(token, cfg.jwt_secret, algorithms=["HS256"])


async def get_current_user(request: Request):
    """Dependency FastAPI — retourne l'utilisateur connecté depuis le JWT."""
    from api.models.user import User  # import local pour éviter les imports circulaires
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else request.query_params.get("token", "")
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise JWTError()
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")
    user = await User.get(user_id)
    if not user or not user.actif:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    return user


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Laisser passer les preflight CORS
        if request.method == "OPTIONS" or _is_public(request.url.path):
            return await call_next(request)

        # Accepte le token dans le header OU en query param (pour les URLs de téléchargement)
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
        else:
            token = request.query_params.get("token", "")

        if not token:
            return JSONResponse(status_code=401, content={"detail": "Non authentifié"})

        try:
            payload = decode_token(token)
            if not payload.get("sub"):
                raise JWTError()
        except JWTError:
            return JSONResponse(status_code=401, content={"detail": "Token invalide ou expiré"})

        return await call_next(request)
