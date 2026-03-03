from datetime import datetime
from typing import Optional, Any
from beanie import Document
from pydantic import BaseModel, Field
from pymongo import IndexModel, ASCENDING


class WorkflowValidation(BaseModel):
    id: str
    type: str  # required_fields | doc_type | crosscheck | llm_check
    label: str
    prompt: Optional[str] = None
    config: Optional[dict[str, Any]] = None


class WorkflowDocument(BaseModel):
    id: str
    nom: str
    description: str
    statut: str  # OBLIGATOIRE | OPTIONNEL
    validations: list[WorkflowValidation] = Field(default_factory=list)


class WorkflowNode(BaseModel):
    id: str
    type: str  # document_check | identity_match | decision | condition
    label: str
    config: Optional[dict[str, Any]] = None
    next: Optional[Any] = None  # str or list[{condition, node}]


class AIConfig(BaseModel):
    model: str = "claude-sonnet-4-6"
    temperature: float = 0.1
    seuil_confiance_auto: int = 90
    prompt_systeme: str = ""


class FormCondition(BaseModel):
    field_id: str
    operator: str  # equals | not_equals | greater_than | less_than
    value: str


class FormBlock(BaseModel):
    id: str
    type: str
    label: str = ""
    required: bool = True
    eligibility: Optional[bool] = None
    options: Optional[list[str]] = None
    condition: Optional[FormCondition] = None
    blocks: Optional[list['FormBlock']] = None  # for container type


FormBlock.model_rebuild()


class FormPage(BaseModel):
    id: str
    title: str
    blocks: list[FormBlock] = Field(default_factory=list)


class Workflow(Document):
    nom: str
    description: str
    type: str
    documents: list[WorkflowDocument] = Field(default_factory=list)
    nodes: list[WorkflowNode] = Field(default_factory=list)
    ai_config: AIConfig = Field(default_factory=AIConfig)
    formulaire_demande: list[FormPage] = Field(default_factory=list)
    formulaire_instruction: list[FormPage] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    dossiers_count: int = 0

    class Settings:
        name = "workflows"
        indexes = [IndexModel([("nom", ASCENDING)])]


class WorkflowUpdate(BaseModel):
    nom: Optional[str] = None
    description: Optional[str] = None
    documents: Optional[list[WorkflowDocument]] = None
    nodes: Optional[list[WorkflowNode]] = None
    ai_config: Optional[AIConfig] = None
    formulaire_demande: Optional[list[FormPage]] = None
    formulaire_instruction: Optional[list[FormPage]] = None
