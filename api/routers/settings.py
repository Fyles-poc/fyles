from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from api.models.organization import Organization, OrganizationUpdate
from api.models.user import User, UserCreate, UserUpdate
from api.auth import get_current_user

router = APIRouter(prefix="/settings", tags=["Settings"])


# ---- Profil utilisateur courant ----

class ApiKeyPayload(BaseModel):
    api_key: str

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "nom": current_user.nom,
        "prenom": current_user.prenom,
        "email": current_user.email,
        "role": current_user.role,
        "has_api_key": bool(current_user.anthropic_api_key),
    }

@router.patch("/me/api-key", status_code=204)
async def save_api_key(payload: ApiKeyPayload, current_user: User = Depends(get_current_user)):
    current_user.anthropic_api_key = payload.api_key.strip() or None
    await current_user.save()


# ---- Organisation ----

@router.get("/organization", response_model=Organization)
async def get_organization():
    org = await Organization.find_one()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation non configurée")
    return org


@router.put("/organization", response_model=Organization)
async def update_organization(payload: OrganizationUpdate):
    org = await Organization.find_one()
    if not org:
        org = Organization(**payload.model_dump())
        await org.insert()
    else:
        await org.set(payload.model_dump())
    return org


# ---- Users ----

@router.get("/users", response_model=list[User])
async def list_users():
    return await User.find_all().to_list()


@router.post("/users", response_model=User, status_code=201)
async def create_user(payload: UserCreate):
    existing = await User.find_one(User.email == payload.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email déjà utilisé")
    user = User(**payload.model_dump())
    await user.insert()
    return user


@router.patch("/users/{user_id}", response_model=User)
async def update_user(user_id: str, payload: UserUpdate):
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    update_data = payload.model_dump(exclude_none=True)
    if update_data:
        await user.set(update_data)
    return user


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: str):
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    await user.delete()
