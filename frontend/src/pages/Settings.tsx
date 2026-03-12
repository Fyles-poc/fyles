import { useState } from 'react';
import {
  Building2, Users, Cpu, Database, ScrollText,
  Save, Plus, Trash2, Shield, CheckCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import type { Organization, User } from '../lib/api';

type SettingsSection = 'organisation' | 'utilisateurs' | 'ia' | 'retention' | 'journaux';

const sections: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
  { id: 'organisation', label: 'Organisation', icon: Building2 },
  { id: 'utilisateurs', label: 'Utilisateurs & Rôles', icon: Users },
  { id: 'ia', label: 'Configuration IA', icon: Cpu },
  { id: 'retention', label: 'Rétention des données', icon: Database },
  { id: 'journaux', label: "Journaux d'audit", icon: ScrollText },
];

const roleLabels: Record<string, string> = {
  admin: 'Administrateur',
  instructeur: 'Instructeur',
  superviseur: 'Superviseur',
};

const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  instructeur: 'bg-blue-100 text-blue-700',
  superviseur: 'bg-emerald-100 text-emerald-700',
};

const auditLogs = [
  { id: 'l1', action: 'Dossier DOS-2026-00126 approuvé', user: 'Anne Leroy', time: '27/02/2026 14:15', type: 'decision' },
  { id: 'l2', action: 'Workflow "Tarif préférentiel" modifié', user: 'Marc Dupont', time: '27/02/2026 11:02', type: 'config' },
  { id: 'l3', action: 'Dossier DOS-2026-00124 refusé', user: 'Marc Dupont', time: '25/02/2026 11:20', type: 'decision' },
  { id: 'l4', action: 'Utilisateur Claire Moreau ajouté', user: 'Admin Système', time: '24/02/2026 09:30', type: 'user' },
  { id: 'l5', action: 'Configuration IA mise à jour', user: 'Admin Système', time: '20/02/2026 16:45', type: 'config' },
  { id: 'l6', action: 'Dossier DOS-2026-00123 signalé par IA', user: 'Système IA', time: '24/02/2026 09:05', type: 'ia' },
];

const logTypeColors: Record<string, string> = {
  decision: 'bg-blue-100 text-blue-600',
  config: 'bg-amber-100 text-amber-600',
  user: 'bg-purple-100 text-purple-600',
  ia: 'bg-emerald-100 text-emerald-600',
};

const logTypeLabels: Record<string, string> = {
  decision: 'Décision',
  config: 'Configuration',
  user: 'Utilisateur',
  ia: 'Moteur IA',
};

export function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('organisation');
  const [saved, setSaved] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);

  const { data: orgData, loading: orgLoading } = useApi(() => api.getOrganization());
  const { data: usersData, loading: usersLoading, refetch: refetchUsers } = useApi(() => api.getUsers());
  const { data: meData } = useApi(() => api.getMe());

  const [org, setOrg] = useState<Omit<Organization, 'id'>>({
    nom: '', siret: '', adresse: '', email: '', telephone: '',
  });

  // Sync org state when API data arrives
  if (orgData && !org.nom && orgData.nom) {
    setOrg({ nom: orgData.nom, siret: orgData.siret, adresse: orgData.adresse, email: orgData.email, telephone: orgData.telephone });
  }

  const handleSave = async () => {
    try {
      await api.updateOrganization(org);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveApiKey = async () => {
    try {
      await api.saveApiKey(apiKey);
      setApiKeySaved(true);
      setApiKey('');
      setTimeout(() => setApiKeySaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await api.deleteUser(userId);
      await refetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const users: User[] = usersData ?? [];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Settings sidebar */}
      <div className="w-56 border-r border-slate-200 bg-white shrink-0">
        <div className="px-4 py-4 border-b border-slate-100">
          <h1 className="text-base font-bold text-slate-800">Paramètres</h1>
        </div>
        <nav className="p-3 space-y-1">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                activeSection === id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Organisation */}
        {activeSection === 'organisation' && (
          <div className="max-w-lg space-y-5">
            {orgLoading && <LoadingSpinner label="Chargement..." />}
            <div>
              <h2 className="text-lg font-bold text-slate-800">Organisation</h2>
              <p className="text-sm text-slate-500 mt-0.5">Informations générales de votre organisation</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              {[
                { label: "Nom de l'organisation", key: 'nom' as const, placeholder: "Office Municipal..." },
                { label: 'SIRET', key: 'siret' as const, placeholder: '12345678900012' },
                { label: 'Adresse', key: 'adresse' as const, placeholder: '12 rue de la Mairie...' },
                { label: 'Email de contact', key: 'email' as const, placeholder: 'contact@organisation.fr', type: 'email' },
                { label: 'Téléphone', key: 'telephone' as const, placeholder: '05 61 00 00 00', type: 'tel' },
              ].map(({ label, key, placeholder, type = 'text' }) => (
                <div key={key} className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">{label}</label>
                  <input
                    type={type}
                    value={org[key]}
                    onChange={(e) => setOrg({ ...org, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                saved ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {saved ? <CheckCircle size={14} /> : <Save size={14} />}
              {saved ? 'Enregistré !' : 'Enregistrer'}
            </button>
          </div>
        )}

        {/* Utilisateurs */}
        {activeSection === 'utilisateurs' && (
          <div className="max-w-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Utilisateurs & Rôles</h2>
                <p className="text-sm text-slate-500 mt-0.5">{users.length} utilisateur(s)</p>
              </div>
              <button className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                <Plus size={14} />
                Inviter
              </button>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Utilisateur</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Rôle</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Statut</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    <tr><td colSpan={5} className="py-6"><LoadingSpinner label="Chargement..." /></td></tr>
                  ) : users.map((user) => (
                    <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {user.prenom[0]}{user.nom[0]}
                          </div>
                          <span className="font-medium text-slate-800">{user.prenom} {user.nom}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{user.email}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleColors[user.role]}`}>
                          {roleLabels[user.role]}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs flex items-center gap-1 ${user.actif ? 'text-emerald-600' : 'text-slate-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.actif ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          {user.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button onClick={() => handleDeleteUser(user.id)} className="p-1 hover:bg-red-50 rounded transition-colors">
                          <Trash2 size={13} className="text-slate-300 hover:text-red-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Roles description */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Description des rôles</h3>
              {[
                { role: 'admin', label: 'Administrateur', desc: 'Accès complet à toutes les fonctionnalités, gestion des utilisateurs et de la configuration.' },
                { role: 'superviseur', label: 'Superviseur', desc: "Peut consulter tous les dossiers, valider les décisions et accéder aux rapports. Pas d'accès à la configuration système." },
                { role: 'instructeur', label: 'Instructeur', desc: 'Peut instruire et valider les dossiers qui lui sont assignés.' },
              ].map((r) => (
                <div key={r.role} className="flex items-start gap-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${roleColors[r.role]}`}>
                    {r.label}
                  </span>
                  <p className="text-xs text-slate-500">{r.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* IA */}
        {activeSection === 'ia' && (
          <div className="max-w-lg space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Configuration IA globale</h2>
              <p className="text-sm text-slate-500 mt-0.5">Paramètres par défaut appliqués à tous les workflows</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">Modèle IA par défaut</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                  <option value="claude-opus-4-6">Claude Opus 4.6</option>
                  <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">Clé API Anthropic</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={meData?.has_api_key ? '••••••••••••••••••••• (clé enregistrée)' : 'sk-ant-...'}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="text-xs text-slate-400">
                  {meData?.has_api_key
                    ? 'Une clé est déjà enregistrée. Saisissez-en une nouvelle pour la remplacer.'
                    : 'Requise pour lancer les analyses IA sur les dossiers.'}
                </p>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">Seuil de confiance global par défaut</label>
                <div className="flex items-center gap-3">
                  <input type="range" min="0" max="100" defaultValue="90" className="flex-1 accent-blue-600" />
                  <span className="text-sm font-bold text-slate-700 w-10 text-right">90%</span>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <p className="text-xs font-semibold text-slate-600">Options avancées</p>
                {[
                  { label: 'Activer la journalisation des requêtes IA', defaultChecked: true },
                  { label: "Permettre l'auto-approbation si confiance ≥ seuil", defaultChecked: true },
                  { label: 'Notifier les instructeurs par email pour les dossiers signalés', defaultChecked: false },
                ].map((opt) => (
                  <label key={opt.label} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" defaultChecked={opt.defaultChecked} className="accent-blue-600 w-4 h-4" />
                    <span className="text-sm text-slate-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <button
              onClick={handleSaveApiKey}
              disabled={!apiKey}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${apiKeySaved ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              {apiKeySaved ? <CheckCircle size={14} /> : <Save size={14} />}
              {apiKeySaved ? 'Clé enregistrée !' : 'Enregistrer la clé'}
            </button>
          </div>
        )}

        {/* Retention */}
        {activeSection === 'retention' && (
          <div className="max-w-lg space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Rétention des données</h2>
              <p className="text-sm text-slate-500 mt-0.5">Configurez la durée de conservation des données</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              {[
                { label: 'Dossiers approuvés', hint: 'Conservation légale recommandée : 5 ans', default: '5' },
                { label: 'Dossiers refusés', hint: 'Conservation légale recommandée : 3 ans', default: '3' },
                { label: "Journaux d'audit", hint: 'Conservation légale minimale : 1 an', default: '2' },
                { label: 'Documents bruts', hint: 'Fichiers uploadés par les demandeurs', default: '3' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{item.label}</p>
                    <p className="text-xs text-slate-400">{item.hint}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      defaultValue={item.default}
                      min="1"
                      className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-500">ans</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-2">
              <Shield size={14} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                La suppression automatique est effectuée chaque nuit. Les données supprimées ne peuvent pas être récupérées.
              </p>
            </div>
            <button onClick={handleSave} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${saved ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              {saved ? <CheckCircle size={14} /> : <Save size={14} />}
              {saved ? 'Enregistré !' : 'Enregistrer'}
            </button>
          </div>
        )}

        {/* Journaux */}
        {activeSection === 'journaux' && (
          <div className="max-w-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Journaux d'audit</h2>
                <p className="text-sm text-slate-500 mt-0.5">Historique des actions effectuées sur la plateforme</p>
              </div>
              <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Exporter CSV
              </button>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Utilisateur</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-slate-700 text-xs">{log.action}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{log.user}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${logTypeColors[log.type]}`}>
                          {logTypeLabels[log.type]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs font-mono">{log.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
