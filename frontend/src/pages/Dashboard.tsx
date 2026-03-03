import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FolderOpen, Clock, CheckCircle, AlertTriangle, Plus, Check, X, Bell } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { LoadingSpinner, ErrorMessage } from '../components/ui/LoadingSpinner';
import { StatusBadge, ConfidenceBadge } from '../components/ui/Badge';

function StatCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string; value: number; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

const activityIcon: Record<string, React.ElementType> = {
  check: Check, alert: AlertTriangle, plus: Plus, x: X,
};
const activityColor: Record<string, string> = {
  check: 'bg-emerald-100 text-emerald-600',
  alert: 'bg-purple-100 text-purple-600',
  plus: 'bg-blue-100 text-blue-600',
  x: 'bg-red-100 text-red-600',
};

export function Dashboard() {
  const navigate = useNavigate();
  const { data: stats, loading, error } = useApi(() => api.getStats());
  const { data: dossiers } = useApi(() => api.getDossiers());

  if (loading) return <div className="p-6"><LoadingSpinner label="Chargement du tableau de bord..." /></div>;
  if (error) return <div className="p-6"><ErrorMessage message={error} /></div>;
  if (!stats) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tableau de bord</h1>
          <p className="text-slate-500 text-sm mt-0.5">Vue d'ensemble de l'activité d'instruction</p>
        </div>
        <button
          onClick={() => navigate('/dossiers')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <FolderOpen size={16} />
          Voir tous les dossiers
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Dossiers en cours" value={stats.dossiers_en_cours} icon={FolderOpen} color="bg-blue-500" sub="actifs ce mois" />
        <StatCard label="En attente de validation" value={stats.en_attente_validation} icon={Clock} color="bg-amber-500" sub="décisions à confirmer" />
        <StatCard label="Auto-approuvés" value={stats.auto_approuves} icon={CheckCircle} color="bg-emerald-500" sub="confiance IA ≥ 90%" />
        <StatCard label="Signalés par l'IA" value={stats.signales_ia} icon={AlertTriangle} color="bg-purple-500" sub="nécessitent attention" />
      </div>

      {/* Charts + Activity */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Répartition par statut</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={stats.status_distribution} cx="50%" cy="50%"
                innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {stats.status_distribution.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} dossiers`]} />
              <Legend iconType="circle" iconSize={8}
                formatter={(value) => <span className="text-xs text-slate-600">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Activité récente</h2>
          <div className="space-y-3">
            {stats.recent_activity.map((item) => {
              const Icon = activityIcon[item.icon] ?? Plus;
              return (
                <div key={item.id} className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${activityColor[item.icon] ?? activityColor.plus}`}>
                    <Icon size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-800">{item.action}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      <button onClick={() => navigate(`/dossiers/${item.dossier}`)}
                        className="text-blue-500 hover:underline font-medium">
                        {item.dossier}
                      </button>{' '}· {item.time}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent dossiers */}
      {dossiers && dossiers.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Dossiers récents</h2>
            <button onClick={() => navigate('/dossiers')} className="text-xs text-blue-600 hover:underline">Voir tout</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Référence', 'Demandeur', 'Type', 'Statut', 'Confiance IA', 'Instructeur'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dossiers.slice(0, 4).map((d) => (
                  <tr key={d.id}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/dossiers/${d.reference}`)}>
                    <td className="px-5 py-3 font-medium text-blue-600">{d.reference}</td>
                    <td className="px-5 py-3 text-slate-700">{d.demandeur.prenom} {d.demandeur.nom}</td>
                    <td className="px-5 py-3 text-slate-500">{d.type}</td>
                    <td className="px-5 py-3"><StatusBadge type="dossier" status={d.statut} /></td>
                    <td className="px-5 py-3"><ConfidenceBadge value={d.confiance_ia} /></td>
                    <td className="px-5 py-3 text-slate-500">{d.instructeur ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats.signales_ia > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Bell size={18} className="text-purple-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-purple-800">
                {stats.signales_ia} dossier(s) signalé(s) par l'IA
              </p>
              <p className="text-xs text-purple-600 mt-0.5">
                Ces dossiers présentent des incohérences ou un niveau de confiance insuffisant pour une décision automatique.
              </p>
              <button onClick={() => navigate('/dossiers?statut=signale')}
                className="text-xs text-purple-700 font-medium hover:underline mt-1">
                Consulter les dossiers signalés →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
