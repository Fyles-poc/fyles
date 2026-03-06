import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, GitBranch, FolderOpen, Clock, ChevronRight,
  MoreVertical, Trash2, X, Loader2,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { LoadingSpinner, ErrorMessage } from '../components/ui/LoadingSpinner';

// ── CreateModal ─────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nom.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.createWorkflow({
        nom: nom.trim(),
        description: description.trim(),
        type: type.trim() || 'Général',
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-120 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <GitBranch size={16} className="text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Nouveau workflow</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="ex: Aide au logement RSA"
              autoFocus
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez brièvement ce workflow..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Type</label>
            <input
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="ex: Aide sociale, Permis de construire…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">Par défaut : « Général »</p>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || !nom.trim()}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? 'Création…' : 'Créer le workflow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── WorkflowsList ───────────────────────────────────────────────────────────

export function WorkflowsList() {
  const navigate = useNavigate();
  const { data: workflows, loading, error, refetch } = useApi(() => api.getWorkflows());

  const { data: dossiers } = useApi(() => api.getDossiers(), []);

  const dossierStatsByWorkflow = useMemo(() => {
    const map: Record<string, { total: number; pending: number }> = {};
    for (const d of dossiers ?? []) {
      if (!map[d.workflow_id]) map[d.workflow_id] = { total: 0, pending: 0 };
      map[d.workflow_id].total++;
      if (d.statut === 'boite_reception') map[d.workflow_id].pending++;
    }
    return map;
  }, [dossiers]);

  const [showCreate, setShowCreate] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.deleteWorkflow(id);
      refetch();
    } catch {
      // silently ignore — list stays unchanged
    } finally {
      setDeletingId(null);
      setOpenMenuId(null);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Workflows</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {workflows ? `${workflows.length} workflow(s) configuré(s)` : 'Chargement...'}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Nouveau workflow
        </button>
      </div>

      {loading ? (
        <LoadingSpinner label="Chargement des workflows..." />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : (
        <div className="grid gap-4">
          {workflows?.map((wf) => (
            <div
              key={wf.id}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => navigate(`/workflows/${wf.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                    <GitBranch size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">{wf.nom}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{wf.description}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <FolderOpen size={12} />
                        {dossierStatsByWorkflow[wf.id]?.total ?? 0} dossier(s) traité(s)
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock size={12} />
                        {dossierStatsByWorkflow[wf.id]?.pending ?? 0} en attente
                      </div>
                      <span className="text-xs text-slate-400">
                        MàJ {new Date(wf.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                    {wf.type}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/workflows/${wf.id}`); }}
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ChevronRight size={16} className="text-slate-400" />
                  </button>

                  {/* 3-dot menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === wf.id ? null : wf.id);
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <MoreVertical size={16} className="text-slate-400" />
                    </button>

                    {openMenuId === wf.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }}
                        />
                        <div className="absolute right-0 top-9 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 w-44 overflow-hidden">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(wf.id); }}
                            disabled={deletingId === wf.id}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            {deletingId === wf.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Trash2 size={14} />
                            }
                            {deletingId === wf.id ? 'Suppression…' : 'Supprimer'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {workflows?.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <GitBranch size={32} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-medium">Aucun workflow configuré</p>
              <p className="text-xs mt-1">Cliquez sur « Nouveau workflow » pour commencer</p>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={refetch}
        />
      )}
    </div>
  );
}
