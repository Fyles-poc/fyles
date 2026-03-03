const BASE = 'http://localhost:8000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.detail ?? `Erreur ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---- Types mirroring backend ----

export type DossierStatus = 'en_cours' | 'en_attente' | 'approuve' | 'refuse' | 'signale';
export type DocumentStatus = 'valide' | 'manquant' | 'invalide' | 'en_attente';
export type RecommendationDecision = 'approuver' | 'refuser' | 'complement';

export interface Demandeur { nom: string; prenom: string; email: string }

export interface DocumentItem {
  id: string; nom: string; type: string; statut: DocumentStatus;
  obligatoire: boolean; uploaded_at?: string; file_size?: string;
  validation_message?: string;
  minio_key?: string;
  content_type?: string;
}

export interface AIAnalysisResult {
  id: string; label: string; statut: 'ok' | 'warning' | 'error';
  message: string; details: string[];
}

export interface AIRecommendation {
  decision: RecommendationDecision; confidence: number; motif: string;
  points_bloquants: string[]; points_attention: string[];
}

export interface Dossier {
  id: string; reference: string; demandeur: Demandeur; type: string;
  workflow_id: string; statut: DossierStatus; confiance_ia: number;
  derniere_maj: string; instructeur?: string;
  documents: DocumentItem[]; analysis_results: AIAnalysisResult[];
  recommendation?: AIRecommendation; created_at: string;
}

export interface WorkflowValidation {
  id: string; type: string; label: string; prompt?: string;
}

export interface WorkflowDocument {
  id: string; nom: string; description: string;
  statut: 'OBLIGATOIRE' | 'OPTIONNEL';
  validations: WorkflowValidation[];
}

export interface WorkflowNode {
  id: string; type: string; label: string; config?: Record<string, unknown>;
  next?: string | { condition: string; node: string }[];
}

export interface AIConfig {
  model: string; temperature: number;
  seuil_confiance_auto: number; prompt_systeme: string;
}

export interface Workflow {
  id: string; nom: string; description: string; type: string;
  documents: WorkflowDocument[]; nodes: WorkflowNode[];
  ai_config: AIConfig; created_at: string; updated_at: string;
  dossiers_count: number;
}

export interface User {
  id: string; nom: string; prenom: string; email: string;
  role: 'admin' | 'instructeur' | 'superviseur'; actif: boolean;
}

export interface Organization {
  id: string; nom: string; siret: string; adresse: string;
  email: string; telephone: string;
}

export interface DashboardStats {
  dossiers_en_cours: number;
  en_attente_validation: number;
  auto_approuves: number;
  signales_ia: number;
  status_distribution: { name: string; value: number; color: string }[];
  recent_activity: {
    id: string; dossier: string; action: string; time: string; icon: string;
  }[];
}

// ---- API functions ----

export const api = {
  // Dashboard
  getStats: () => request<DashboardStats>('/dashboard/stats'),

  // Dossiers
  getDossiers: (params?: { statut?: DossierStatus; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.statut) qs.set('statut', params.statut);
    if (params?.q) qs.set('q', params.q);
    const query = qs.toString();
    return request<Dossier[]>(`/dossiers${query ? `?${query}` : ''}`);
  },
  getDossier: (reference: string) =>
    request<Dossier>(`/dossiers/${reference}`),
  patchDecision: (
    reference: string,
    payload: { decision: RecommendationDecision; commentaire?: string; instructeur?: string }
  ) => request<Dossier>(`/dossiers/${reference}/decision`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),

  // Documents
  getDocumentContentUrl: (reference: string, docId: string, download = false) =>
    `${BASE}/dossiers/${reference}/documents/${docId}/content${download ? '?download=true' : ''}`,

  // Workflows
  getWorkflows: () => request<Workflow[]>('/workflows'),
  getWorkflow: (id: string) => request<Workflow>(`/workflows/${id}`),
  updateWorkflow: (id: string, payload: Partial<Workflow>) =>
    request<Workflow>(`/workflows/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  // Settings
  getOrganization: () => request<Organization>('/settings/organization'),
  updateOrganization: (payload: Omit<Organization, 'id'>) =>
    request<Organization>('/settings/organization', { method: 'PUT', body: JSON.stringify(payload) }),
  getUsers: () => request<User[]>('/settings/users'),
  createUser: (payload: Omit<User, 'id' | 'actif'>) =>
    request<User>('/settings/users', { method: 'POST', body: JSON.stringify(payload) }),
  deleteUser: (id: string) => request<void>(`/settings/users/${id}`, { method: 'DELETE' }),
};
