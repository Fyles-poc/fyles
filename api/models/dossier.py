from datetime import datetime
from enum import Enum
from typing import Optional
from beanie import Document, Indexed
from pydantic import BaseModel, Field
from pymongo import IndexModel, ASCENDING


class DossierStatus(str, Enum):
    en_cours = "en_cours"
    en_attente = "en_attente"
    approuve = "approuve"
    refuse = "refuse"
    signale = "signale"


class DocumentStatus(str, Enum):
    valide = "valide"
    manquant = "manquant"
    invalide = "invalide"
    en_attente = "en_attente"


class RecommendationDecision(str, Enum):
    approuver = "approuver"
    refuser = "refuser"
    complement = "complement"


class Demandeur(BaseModel):
    nom: str
    prenom: str
    email: str


class DocumentItem(BaseModel):
    id: str
    nom: str
    type: str
    statut: DocumentStatus
    obligatoire: bool
    uploaded_at: Optional[str] = None
    file_size: Optional[str] = None
    validation_message: Optional[str] = None
    minio_key: Optional[str] = None
    content_type: Optional[str] = None


class AIAnalysisResult(BaseModel):
    id: str
    label: str
    statut: str  # ok | warning | error
    message: str
    details: list[str] = Field(default_factory=list)


class AIRecommendation(BaseModel):
    decision: RecommendationDecision
    confidence: int
    motif: str
    points_bloquants: list[str] = Field(default_factory=list)
    points_attention: list[str] = Field(default_factory=list)


class Dossier(Document):
    reference: str
    demandeur: Demandeur
    type: str
    workflow_id: str
    statut: DossierStatus = DossierStatus.en_cours
    confiance_ia: int = 0
    derniere_maj: datetime = Field(default_factory=datetime.utcnow)
    instructeur: Optional[str] = None
    documents: list[DocumentItem] = Field(default_factory=list)
    analysis_results: list[AIAnalysisResult] = Field(default_factory=list)
    recommendation: Optional[AIRecommendation] = None
    reponses: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "dossiers"
        indexes = [IndexModel([("reference", ASCENDING)], unique=True)]


# ---- Request/Response schemas ----

class DecisionPayload(BaseModel):
    decision: RecommendationDecision
    commentaire: Optional[str] = None
    instructeur: Optional[str] = None


class DossierSummary(BaseModel):
    id: str
    reference: str
    demandeur: Demandeur
    type: str
    statut: DossierStatus
    confiance_ia: int
    derniere_maj: datetime
    instructeur: Optional[str]
    created_at: datetime
