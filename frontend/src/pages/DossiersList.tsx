import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, ChevronRight, SortAsc } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { LoadingSpinner, ErrorMessage } from '../components/ui/LoadingSpinner';
import { StatusBadge } from '../components/ui/Badge';
import type { DossierStatus } from '../lib/api';

const statusFilters: { value: DossierStatus | 'tous'; label: string }[] = [
  { value: 'tous', label: 'Tous' },
  { value: 'boite_reception', label: 'Boîte de réception' },
  { value: 'en_instruction', label: 'En instruction' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'approuve', label: 'Approuvés' },
  { value: 'refuse', label: 'Refusés' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function DossiersList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultStatus = (searchParams.get('statut') ?? 'tous') as DossierStatus | 'tous';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DossierStatus | 'tous'>(defaultStatus);

  const { data: dossiers, loading, error } = useApi(
    () => api.getDossiers({
      statut: statusFilter !== 'tous' ? statusFilter : undefined,
      q: search || undefined,
    }),
    [statusFilter, search]
  );

  const { data: workflows } = useApi(() => api.getWorkflows(), []);
  const workflowNames: Record<string, string> = Object.fromEntries(
    (workflows ?? []).map((w) => [w.id, w.nom])
  );

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dossiers</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {dossiers ? `${dossiers.length} dossier(s) trouvé(s)` : 'Chargement...'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par référence, demandeur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          {statusFilters.map((f) => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === f.value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        <button className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          <Filter size={14} />Filtres
        </button>
        <button className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          <SortAsc size={14} />Trier
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Chargement des dossiers..." />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Référence', 'Workflow', 'Type', 'Statut', 'Dernière MàJ', 'Instructeur', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!dossiers || dossiers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">
                    Aucun dossier trouvé
                  </td>
                </tr>
              ) : (
                dossiers.map((d) => (
                  <tr key={d.id}
                    className="border-b border-slate-50 hover:bg-blue-50/40 cursor-pointer transition-colors group"
                    onClick={() => navigate(`/dossiers/${d.reference}`)}>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-blue-600">{d.reference}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-700 text-xs font-medium">
                      {workflowNames[d.workflow_id] ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{d.type}</td>
                    <td className="px-5 py-4"><StatusBadge type="dossier" status={d.statut} /></td>
                    <td className="px-5 py-4 text-slate-500 text-xs">{formatDate(d.derniere_maj)}</td>
                    <td className="px-5 py-4 text-slate-500">{d.instructeur ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-5 py-4">
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-400 transition-colors" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>Affichage de {dossiers?.length ?? 0} dossier(s)</span>
        <div className="flex items-center gap-1">
          <button className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs disabled:opacity-40" disabled>Précédent</button>
          <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs">1</button>
          <button className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs disabled:opacity-40" disabled>Suivant</button>
        </div>
      </div>
    </div>
  );
}
