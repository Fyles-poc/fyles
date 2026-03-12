import { getToken, clearAuth } from './auth';

// URL configurable au runtime (injectée par Docker via window.__ENV__)
// ou via variable Vite en dev, avec fallback sur localhost
function getApiBase(): string {
  const w = window as Window & { __ENV__?: { API_URL?: string } };
  if (w.__ENV__?.API_URL) return `${w.__ENV__.API_URL}/api`;
  if (import.meta.env.VITE_API_URL) return `${import.meta.env.VITE_API_URL}/api`;
  return 'http://localhost:8000/api';
}

const BASE = getApiBase();

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });
  if (res.status === 401) {
    clearAuth();
    window.location.href = '/login';
    throw new Error('Session expirée');
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.detail ?? `Erreur ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---- Types mirroring backend ----

export type DossierStatus = 'boite_reception' | 'en_instruction' | 'en_attente' | 'approuve' | 'refuse';
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

export interface AIAnalysisResultOverrides {
  statut?: 'ok' | 'warning' | 'error';
  details?: string[];
  message?: string;
}

export interface AIAnalysisResult {
  id: string; label: string; statut: 'ok' | 'warning' | 'error';
  message: string; details: string[];
  manual_overrides?: AIAnalysisResultOverrides;
  override_reason?: string;
  is_overridden?: boolean;
  overridden_at?: string;
}

export interface AIRecommendation {
  decision: RecommendationDecision; confidence: number; motif: string;
  points_bloquants: string[]; points_attention: string[];
}

export interface Dossier {
  id: string; reference: string; demandeur: Demandeur; type: string;
  workflow_id: string; statut: DossierStatus;
  derniere_maj: string; instructeur?: string;
  documents: DocumentItem[]; analysis_results: AIAnalysisResult[];
  recommendation?: AIRecommendation; created_at: string;
  reponses: Record<string, unknown>;
}

export interface FormCondition {
  field_id: string; operator: string; value: string;
}

export interface FormBlock {
  id: string; type: string; label: string; required: boolean;
  eligibility?: boolean; options?: string[];
  conditions?: FormCondition[];
  conditionLogic?: 'AND' | 'OR';
  blocks?: FormBlock[];
}

export interface FormPage {
  id: string; title: string; blocks: FormBlock[];
}

export interface WorkflowValidation {
  id: string; type: string; label: string; prompt?: string;
}

export interface WorkflowDocument {
  id: string; nom: string; description: string;
  statut: 'OBLIGATOIRE' | 'OPTIONNEL';
  validations: WorkflowValidation[];
}

export interface FieldExtractorConfig {
  field_id: string;
  field_label: string;
  variable_name: string;
  field_type: string;
}

export interface LLMCheckConfig {
  model: string;
  prompt: string;
  variables: string[];
  output_variable: string;
}

export interface ConditionConfig {
  variable: string;
  operator: string;
  value: string;
  true_next: string | null;
  false_next: string | null;
}

export interface SetStatusConfig {
  status: DossierStatus;
  comment: string;
}

export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  config?: FieldExtractorConfig | LLMCheckConfig | ConditionConfig | SetStatusConfig | Record<string, unknown>;
  next?: string | { true: string; false: string } | null;
}

export interface NodeExecutionEntry {
  node_id: string;
  type: string;
  label: string;
  status: 'ok' | 'warning' | 'error' | 'skipped' | 'break' | 'not_run';
  output: Record<string, unknown>;
}

export interface WorkflowExecutionResult {
  success: boolean;
  error?: string;
  execution_trace: NodeExecutionEntry[];
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
  formulaire_demande: FormPage[];
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
  boite_reception: number;
  dossiers_en_instruction: number;
  en_attente_validation: number;
  auto_approuves: number;
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
  patchStatut: (reference: string, statut: DossierStatus) =>
    request<Dossier>(`/dossiers/${reference}/statut`, {
      method: 'PATCH',
      body: JSON.stringify({ statut }),
    }),

  patchDecision: (
    reference: string,
    payload: { decision: RecommendationDecision; commentaire?: string; instructeur?: string }
  ) => request<Dossier>(`/dossiers/${reference}/decision`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),

  deleteDossier: (reference: string) => request<void>(`/dossiers/${reference}`, { method: 'DELETE' }),
  updateDossierReponses: (reference: string, payload: Record<string, unknown>) =>
    request<Dossier>(`/dossiers/${reference}/reponses`, { method: 'PATCH', body: JSON.stringify(payload) }),
  replaceDossierDocument: (reference: string, docId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const token = getToken();
    return fetch(`${BASE}/dossiers/${reference}/documents/${docId}`, {
      cache: 'no-store',
      method: 'PUT',
      body: fd,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(async (r) => {
      if (r.status === 401) { clearAuth(); window.location.href = '/login'; throw new Error('Session expirée'); }
      if (!r.ok) { const t = await r.text(); throw new Error(t); }
      return r.json() as Promise<Dossier>;
    });
  },

  // Documents — le token est passé en query param pour les URLs directes (download, viewer)
  getDocumentContentUrl: (reference: string, docId: string, download = false) => {
    const params = new URLSearchParams();
    if (download) params.set('download', 'true');
    const token = getToken();
    if (token) params.set('token', token);
    const qs = params.toString();
    return `${BASE}/dossiers/${reference}/documents/${docId}/content${qs ? `?${qs}` : ''}`;
  },

  // Workflows
  getWorkflows: () => request<Workflow[]>('/workflows'),
  getWorkflow: (id: string) => request<Workflow>(`/workflows/${id}`),
  createWorkflow: (payload: { nom: string; description: string; type: string }) =>
    request<Workflow>('/workflows', { method: 'POST', body: JSON.stringify(payload) }),
  updateWorkflow: (id: string, payload: Partial<Workflow>) =>
    request<Workflow>(`/workflows/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteWorkflow: (id: string) => request<void>(`/workflows/${id}`, { method: 'DELETE' }),
  executeWorkflow: (workflowId: string, dossierReference: string) =>
    request<WorkflowExecutionResult>(`/workflows/${workflowId}/execute/${dossierReference}`, { method: 'POST' }),
  executeWorkflowNode: (workflowId: string, dossierReference: string, nodeId: string) =>
    request<{ success: boolean; node_id: string; output?: Record<string, unknown>; error?: string }>(
      `/workflows/${workflowId}/execute/${dossierReference}/node/${nodeId}`,
      { method: 'POST' }
    ),

  updateAnalysisResult: (
    reference: string,
    resultId: string,
    payload: { overrides: AIAnalysisResultOverrides; override_reason?: string }
  ) => request<Dossier>(`/dossiers/${reference}/results/${resultId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),

  // Dossier submit (multipart) — endpoint PUBLIC, pas de token nécessaire
  submitDossier: (formData: FormData) =>
    fetch(`${BASE}/dossiers/submit`, { method: 'POST', body: formData }).then(async (r) => {
      if (!r.ok) { const t = await r.text(); throw new Error(t); }
      return r.json() as Promise<{ reference: string; id: string }>;
    }),

  // Profil courant
  getMe: () => request<{ id: string; nom: string; prenom: string; email: string; role: string; has_api_key: boolean }>('/settings/me'),
  saveApiKey: (api_key: string) => request<void>('/settings/me/api-key', { method: 'PATCH', body: JSON.stringify({ api_key }) }),

  // Settings
  getOrganization: () => request<Organization>('/settings/organization'),
  updateOrganization: (payload: Omit<Organization, 'id'>) =>
    request<Organization>('/settings/organization', { method: 'PUT', body: JSON.stringify(payload) }),
  getUsers: () => request<User[]>('/settings/users'),
  createUser: (payload: Omit<User, 'id' | 'actif'>) =>
    request<User>('/settings/users', { method: 'POST', body: JSON.stringify(payload) }),
  deleteUser: (id: string) => request<void>(`/settings/users/${id}`, { method: 'DELETE' }),
};
