import { FileText, Upload, Search, Filter } from 'lucide-react';

const mockDocs = [
  { id: 'x1', nom: 'Formulaire_Martin_Sophie.pdf', type: 'Formulaire de demande', dossier: 'DOS-2026-00127', taille: '245 Ko', date: '25/02/2026', statut: 'valide' },
  { id: 'x2', nom: 'CNI_Martin_Sophie.jpg', type: "Pièce d'identité", dossier: 'DOS-2026-00127', taille: '1.2 Mo', date: '25/02/2026', statut: 'valide' },
  { id: 'x3', nom: 'Facture_EDF_Oct2025.pdf', type: 'Justificatif de domicile', dossier: 'DOS-2026-00127', taille: '890 Ko', date: '25/02/2026', statut: 'invalide' },
  { id: 'x4', nom: 'Avis_Imposition_2025.pdf', type: "Avis d'imposition", dossier: 'DOS-2026-00127', taille: '1.8 Mo', date: '26/02/2026', statut: 'valide' },
  { id: 'x5', nom: 'Formulaire_Bernard_Lucas.pdf', type: 'Formulaire de demande', dossier: 'DOS-2026-00126', taille: '198 Ko', date: '24/02/2026', statut: 'valide' },
];

const statusColors: Record<string, string> = {
  valide: 'bg-emerald-100 text-emerald-700',
  invalide: 'bg-red-100 text-red-700',
  en_attente: 'bg-amber-100 text-amber-700',
};

const statusLabels: Record<string, string> = {
  valide: 'Validé',
  invalide: 'Invalide',
  en_attente: 'En attente',
};

export function Documents() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Documents</h1>
          <p className="text-slate-500 text-sm mt-0.5">Tous les documents reçus sur la plateforme</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Upload size={16} />
          Importer
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un document..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          <Filter size={14} />
          Filtres
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nom du fichier</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Dossier</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Taille</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Statut</th>
            </tr>
          </thead>
          <tbody>
            {mockDocs.map((doc) => (
              <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-slate-400 flex-shrink-0" />
                    <span className="text-slate-800 font-medium text-xs">{doc.nom}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-slate-500 text-xs">{doc.type}</td>
                <td className="px-5 py-3">
                  <span className="text-blue-600 text-xs font-medium">{doc.dossier}</span>
                </td>
                <td className="px-5 py-3 text-slate-400 text-xs">{doc.taille}</td>
                <td className="px-5 py-3 text-slate-400 text-xs">{doc.date}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColors[doc.statut]}`}>
                    {statusLabels[doc.statut]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
