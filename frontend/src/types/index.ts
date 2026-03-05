export type DossierStatus =
  | 'boite_reception'
  | 'en_instruction'
  | 'en_attente'
  | 'approuve'
  | 'refuse';

export type DocumentStatus =
  | 'valide'
  | 'manquant'
  | 'invalide'
  | 'en_attente';

export type DocumentType =
  | 'formulaire_demande'
  | 'piece_identite'
  | 'justificatif_domicile'
  | 'avis_imposition'
  | 'rib'
  | 'autre';

export interface Document {
  id: string;
  nom: string;
  type: DocumentType;
  statut: DocumentStatus;
  obligatoire: boolean;
  uploadedAt?: string;
  fileSize?: string;
  validationMessage?: string;
}

export interface AIAnalysisResult {
  id: string;
  label: string;
  statut: 'ok' | 'warning' | 'error';
  message: string;
  details?: string[];
}

export interface AIRecommendation {
  decision: 'approuver' | 'refuser' | 'complement';
  confidence: number;
  motif: string;
  pointsBloquants: string[];
  pointsAttention: string[];
}

export interface Dossier {
  id: string;
  reference: string;
  demandeur: {
    nom: string;
    prenom: string;
    email: string;
  };
  type: string;
  workflowId: string;
  statut: DossierStatus;
  confianceIA: number;
  derniereMaj: string;
  instructeur?: string;
  documents: Document[];
  analysisResults: AIAnalysisResult[];
  recommendation: AIRecommendation;
  createdAt: string;
}

export interface WorkflowDocument {
  id: string;
  nom: string;
  description: string;
  statut: 'OBLIGATOIRE' | 'OPTIONNEL';
  validations: WorkflowValidation[];
}

export interface WorkflowValidation {
  id: string;
  type: 'required_fields' | 'doc_type' | 'crosscheck' | 'llm_check';
  label: string;
  prompt?: string;
  config?: Record<string, unknown>;
}

export interface WorkflowNode {
  id: string;
  type: 'document_check' | 'identity_match' | 'decision' | 'condition';
  label: string;
  config?: Record<string, unknown>;
  next?: string | { condition: string; node: string }[];
}

export interface Workflow {
  id: string;
  nom: string;
  description: string;
  type: string;
  documents: WorkflowDocument[];
  nodes: WorkflowNode[];
  aiConfig: {
    model: string;
    temperature: number;
    seuilConfianceAuto: number;
    promptSysteme: string;
  };
  createdAt: string;
  updatedAt: string;
  dossiersCount: number;
}

export interface User {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: 'admin' | 'instructeur' | 'superviseur';
  actif: boolean;
}

export interface Organization {
  nom: string;
  siret: string;
  adresse: string;
  email: string;
  telephone: string;
}
