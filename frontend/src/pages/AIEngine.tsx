import { Zap, Activity, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

const recentJobs = [
  { id: 'j1', dossier: 'DOS-2026-00127', statut: 'running', debut: 'Il y a 2 min', duree: '—', tokens: '—' },
  { id: 'j2', dossier: 'DOS-2026-00126', statut: 'completed', debut: 'Il y a 1h', duree: '14s', tokens: '4 201' },
  { id: 'j3', dossier: 'DOS-2026-00125', statut: 'completed', debut: 'Il y a 2h', duree: '9s', tokens: '2 850' },
  { id: 'j4', dossier: 'DOS-2026-00124', statut: 'completed', debut: 'Hier 11h', duree: '11s', tokens: '3 640' },
  { id: 'j5', dossier: 'DOS-2026-00123', statut: 'error', debut: 'Hier 09h', duree: '22s', tokens: '1 200' },
];

const jobStatusConfig = {
  running: { label: 'En cours', color: 'bg-blue-100 text-blue-700', icon: Activity },
  completed: { label: 'Terminé', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  error: { label: 'Erreur', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
};

export function AIEngine() {
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Moteur IA</h1>
        <p className="text-slate-500 text-sm mt-0.5">Supervision des analyses IA en temps réel</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Analyses aujourd\'hui', value: '23', icon: Zap, color: 'bg-blue-500' },
          { label: 'En cours', value: '1', icon: Activity, color: 'bg-amber-500' },
          { label: 'Temps moyen', value: '12s', icon: Clock, color: 'bg-purple-500' },
          { label: 'Taux de succès', value: '96%', icon: CheckCircle, color: 'bg-emerald-500' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</p>
              </div>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.color}`}>
                <stat.icon size={16} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Jobs list */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Analyses récentes</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Dossier</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Statut</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Début</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Durée</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tokens</th>
            </tr>
          </thead>
          <tbody>
            {recentJobs.map((job) => {
              const cfg = jobStatusConfig[job.statut as keyof typeof jobStatusConfig];
              const Icon = cfg.icon;
              return (
                <tr key={job.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-blue-600 font-medium">{job.dossier}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${cfg.color}`}>
                      <Icon size={11} />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs">{job.debut}</td>
                  <td className="px-5 py-3 text-slate-500 text-xs font-mono">{job.duree}</td>
                  <td className="px-5 py-3 text-slate-500 text-xs font-mono">{job.tokens}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
