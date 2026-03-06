import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, X, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { LoadingSpinner, ErrorMessage } from '../components/ui/LoadingSpinner';
import { StatusBadge } from '../components/ui/Badge';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import type { DossierStatus } from '../lib/api';

const statusFilters: { value: DossierStatus | 'tous'; label: string }[] = [
  { value: 'tous', label: 'Tous' },
  { value: 'boite_reception', label: 'Boîte de réception' },
  { value: 'en_instruction', label: 'En instruction' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'approuve', label: 'Approuvés' },
  { value: 'refuse', label: 'Refusés' },
];

type SortKey = 'reference' | 'workflow' | 'type' | 'statut' | 'derniere_maj' | 'instructeur';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey | null; sortDir: 'asc' | 'desc' }) {
  if (sortKey !== col) return <ChevronsUpDown size={12} className="text-slate-300 ml-1 inline" />;
  return sortDir === 'asc'
    ? <ChevronUp size={12} className="text-blue-500 ml-1 inline" />
    : <ChevronDown size={12} className="text-blue-500 ml-1 inline" />;
}

export function DossiersList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultStatus = (searchParams.get('statut') ?? 'tous') as DossierStatus | 'tous';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DossierStatus | 'tous'>(defaultStatus);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmRef, setConfirmRef] = useState<string | null>(null);

  // Advanced filter state
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [workflowFilter, setWorkflowFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [instructeurFilter, setInstructeurFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const filterPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setShowFilterPanel(false);
      }
    }
    if (showFilterPanel) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showFilterPanel]);

  const { data: dossiers, loading, error, refetch } = useApi(
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

  // Unique types and instructeurs from loaded data
  const uniqueTypes = useMemo(() => [...new Set((dossiers ?? []).map((d) => d.type).filter(Boolean))].sort(), [dossiers]);
  const uniqueInstructeurs = useMemo(() => [...new Set((dossiers ?? []).map((d) => d.instructeur).filter(Boolean) as string[])].sort(), [dossiers]);

  // Client-side filtering + sorting
  const filteredSorted = useMemo(() => {
    let list = dossiers ?? [];

    if (workflowFilter) list = list.filter((d) => d.workflow_id === workflowFilter);
    if (typeFilter) list = list.filter((d) => d.type === typeFilter);
    if (instructeurFilter) list = list.filter((d) => d.instructeur === instructeurFilter);
    if (dateFrom) list = list.filter((d) => new Date(d.derniere_maj) >= new Date(dateFrom));
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((d) => new Date(d.derniere_maj) <= to);
    }

    if (sortKey) {
      list = [...list].sort((a, b) => {
        let va: string, vb: string;
        switch (sortKey) {
          case 'reference': va = a.reference; vb = b.reference; break;
          case 'workflow': va = workflowNames[a.workflow_id] ?? ''; vb = workflowNames[b.workflow_id] ?? ''; break;
          case 'type': va = a.type ?? ''; vb = b.type ?? ''; break;
          case 'statut': va = a.statut; vb = b.statut; break;
          case 'derniere_maj': va = a.derniere_maj; vb = b.derniere_maj; break;
          case 'instructeur': va = a.instructeur ?? ''; vb = b.instructeur ?? ''; break;
        }
        const cmp = va.localeCompare(vb, 'fr');
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return list;
  }, [dossiers, workflowFilter, typeFilter, instructeurFilter, dateFrom, dateTo, sortKey, sortDir, workflowNames]);

  const activeFilterCount = [workflowFilter, typeFilter, instructeurFilter, dateFrom, dateTo].filter(Boolean).length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function clearFilters() {
    setWorkflowFilter('');
    setTypeFilter('');
    setInstructeurFilter('');
    setDateFrom('');
    setDateTo('');
  }

  const doDelete = async () => {
    if (!confirmRef) return;
    const ref = confirmRef;
    setConfirmRef(null);
    setDeletingId(ref);
    try {
      await api.deleteDossier(ref);
      await refetch();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const columns: { key: SortKey; label: string }[] = [
    { key: 'reference', label: 'Référence' },
    { key: 'workflow', label: 'Workflow' },
    { key: 'type', label: 'Type' },
    { key: 'statut', label: 'Statut' },
    { key: 'derniere_maj', label: 'Dernière MàJ' },
    { key: 'instructeur', label: 'Instructeur' },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dossiers</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {dossiers
            ? filteredSorted.length < dossiers.length
              ? `${filteredSorted.length} sur ${dossiers.length} dossier(s)`
              : `${dossiers.length} dossier(s) trouvé(s)`
            : 'Chargement...'}
        </p>
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-3 flex-wrap">
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

        {/* Filter button + panel */}
        <div className="relative" ref={filterPanelRef}>
          <button
            onClick={() => setShowFilterPanel((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
              showFilterPanel || activeFilterCount > 0
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter size={14} />
            Filtres
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {showFilterPanel && (
            <div className="absolute top-full left-0 mt-2 z-30 bg-white border border-slate-200 rounded-xl shadow-lg p-4 w-80 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Filtres avancés</span>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                    <X size={11} /> Réinitialiser
                  </button>
                )}
              </div>

              {/* Workflow */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Workflow</label>
                <select
                  value={workflowFilter}
                  onChange={(e) => setWorkflowFilter(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tous</option>
                  {(workflows ?? []).map((w) => (
                    <option key={w.id} value={w.id}>{w.nom}</option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tous</option>
                  {uniqueTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Instructeur */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Instructeur</label>
                <select
                  value={instructeurFilter}
                  onChange={(e) => setInstructeurFilter(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tous</option>
                  {uniqueInstructeurs.map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>

              {/* Date range */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Dernière MàJ — du</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">au</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {workflowFilter && (
            <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
              Workflow: {workflowNames[workflowFilter] ?? workflowFilter}
              <button onClick={() => setWorkflowFilter('')}><X size={10} /></button>
            </span>
          )}
          {typeFilter && (
            <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
              Type: {typeFilter}
              <button onClick={() => setTypeFilter('')}><X size={10} /></button>
            </span>
          )}
          {instructeurFilter && (
            <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
              Instructeur: {instructeurFilter}
              <button onClick={() => setInstructeurFilter('')}><X size={10} /></button>
            </span>
          )}
          {dateFrom && (
            <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
              Depuis: {dateFrom}
              <button onClick={() => setDateFrom('')}><X size={10} /></button>
            </span>
          )}
          {dateTo && (
            <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
              Jusqu'au: {dateTo}
              <button onClick={() => setDateTo('')}><X size={10} /></button>
            </span>
          )}
        </div>
      )}

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
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-700 select-none"
                  >
                    {col.label}
                    <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                  </th>
                ))}
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredSorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">
                    Aucun dossier trouvé
                  </td>
                </tr>
              ) : (
                filteredSorted.map((d) => (
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
                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmRef(d.reference); }}
                        disabled={deletingId === d.reference}
                        title="Supprimer le dossier"
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
                        {deletingId === d.reference
                          ? <Loader2 size={15} className="animate-spin" />
                          : <Trash2 size={15} />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>Affichage de {filteredSorted.length} dossier(s)</span>
        <div className="flex items-center gap-1">
          <button className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs disabled:opacity-40" disabled>Précédent</button>
          <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs">1</button>
          <button className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs disabled:opacity-40" disabled>Suivant</button>
        </div>
      </div>

      {confirmRef && (
        <ConfirmModal
          title="Supprimer le dossier"
          message={`Le dossier ${confirmRef} et tous ses fichiers seront définitivement supprimés. Cette action est irréversible.`}
          confirmLabel="Supprimer définitivement"
          loading={deletingId === confirmRef}
          onConfirm={doDelete}
          onCancel={() => setConfirmRef(null)}
        />
      )}
    </div>
  );
}
