from beanie import Document
from pydantic import BaseModel


class Organization(Document):
    nom: str
    siret: str
    adresse: str
    email: str
    telephone: str

    class Settings:
        name = "organization"


class OrganizationUpdate(BaseModel):
    nom: str
    siret: str
    adresse: str
    email: str
    telephone: str
