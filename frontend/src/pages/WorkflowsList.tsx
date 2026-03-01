import { useNavigate } from 'react-router-dom';
import { Plus, GitBranch, FolderOpen, ChevronRight, Settings } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { LoadingSpinner, ErrorMessage } from '../components/ui/LoadingSpinner';

export function WorkflowsList() {
  const navigate = useNavigate();
  const { data: workflows, loading, error } = useApi(() => api.getWorkflows());

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Workflows</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {workflows ? `${workflows.length} workflow(s) configuré(s)` : 'Chargement...'}
          </p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
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
            <div key={wf.id}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => navigate(`/workflows/${wf.id}`)}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <GitBranch size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">{wf.nom}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{wf.description}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <FolderOpen size={12} />
                        {wf.dossiers_count} dossiers traités
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Settings size={12} />
                        {wf.documents.length} documents requis
                      </div>
                      <span className="text-xs text-slate-400">
                        MàJ {new Date(wf.updated_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">{wf.type}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/workflows/${wf.id}`); }}
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                    <ChevronRight size={16} className="text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
