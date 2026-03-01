from enum import Enum
from typing import Optional
from beanie import Document
from pydantic import BaseModel, Field
from pymongo import IndexModel, ASCENDING


class UserRole(str, Enum):
    admin = "admin"
    instructeur = "instructeur"
    superviseur = "superviseur"


class User(Document):
    nom: str
    prenom: str
    email: str
    role: UserRole = UserRole.instructeur
    actif: bool = True

    class Settings:
        name = "users"
        indexes = [IndexModel([("email", ASCENDING)], unique=True)]


class UserCreate(BaseModel):
    nom: str
    prenom: str
    email: str
    role: UserRole = UserRole.instructeur


class UserUpdate(BaseModel):
    role: Optional[UserRole] = None
    actif: Optional[bool] = None
