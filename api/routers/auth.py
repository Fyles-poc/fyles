from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from api.auth import verify_password, create_access_token, decode_token
from api.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    nom: str
    prenom: str
    email: str
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    user = await User.find_one(User.email == body.email)
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    if not user.actif:
        raise HTTPException(status_code=403, detail="Compte désactivé")

    token = create_access_token(str(user.id), user.email)
    return TokenResponse(
        access_token=token,
        user=UserOut(
            id=str(user.id),
            nom=user.nom,
            prenom=user.prenom,
            email=user.email,
            role=user.role,
        ),
    )


@router.get("/me", response_model=UserOut)
async def me(request: Request):
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else request.query_params.get("token", "")
    payload = decode_token(token)
    user = await User.get(payload["sub"])
    if not user or not user.actif:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    return UserOut(
        id=str(user.id),
        nom=user.nom,
        prenom=user.prenom,
        email=user.email,
        role=user.role,
    )
