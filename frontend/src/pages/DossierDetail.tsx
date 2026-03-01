import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, XCircle, Clock,
  AlertTriangle, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown,
  MessageSquare, Download, Upload,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { LoadingSpinner, ErrorMessage } from '../components/ui/LoadingSpinner';
import { StatusBadge } from '../components/ui/Badge';
import type { DocumentItem, AIAnalysisResult, RecommendationDecision } from '../lib/api';

function DocumentIcon({ status }: { status: DocumentItem['statut'] }) {
  if (status === 'valide') return <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />;
  if (status === 'invalide') return <XCircle size={16} className="text-red-500 flex-shrink-0" />;
  if (status === 'manquant') return <Clock size={16} className="text-slate-300 flex-shrink-0" />;
  return <Clock size={16} className="text-amber-400 flex-shrink-0" />;
}

function AnalysisRow({ result }: { result: AIAnalysisResult }) {
  const [open, setOpen] = useState(false);
  const colors = {
    ok: { badge: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, iconColor: 'text-emerald-500' },
    warning: { badge: 'bg-amber-100 text-amber-700', icon: AlertTriangle, iconColor: 'text-amber-500' },
    error: { badge: 'bg-red-100 text-red-700', icon: XCircle, iconColor: 'text-red-500' },
  };
  const cfg = colors[result.statut as keyof typeof colors] ?? colors.ok;
  const Icon = cfg.icon;

  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
        onClick={() => result.details?.length && setOpen(!open)}
      >
        <Icon size={16} className={cfg.iconColor} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800">{result.label}</p>
          <p className="text-xs text-slate-500 mt-0.5">{result.message}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.badge}`}>
          {result.statut === 'ok' ? 'OK' : result.statut === 'warning' ? 'Attention' : 'Erreur'}
        </span>
        {result.details?.length > 0 && (
          open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />
        )}
      </button>
      {open && result.details && (
        <div className="px-4 pb-3 pt-0 border-t border-slate-100 bg-slate-50">
          <ul className="space-y-1 mt-2">
            {result.details.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="text-slate-400 mt-0.5">•</span>{d}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ConfidenceGauge({ value }: { value: number }) {
  const color = value >= 80 ? '#10b981' : value >= 60 ? '#f59e0b' : '#ef4444';
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="10" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold" style={{ color }}>{value}%</span>
        </div>
      </div>
      <p className="text-xs text-slate-500">Indice de confiance IA</p>
    </div>
  );
}

export function DossierDetail() {
  const { reference } = useParams<{ reference: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'completude' | 'regles'>('completude');
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decision, setDecision] = useState<RecommendationDecision | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: dossier, loading, error, refetch } = useApi(
    () => api.getDossier(reference!),
    [reference]
  );

  if (loading) return <div className="p-6"><LoadingSpinner label="Chargement du dossier..." /></div>;
  if (error) return <div className="p-6"><ErrorMessage message={error} /></div>;
  if (!dossier) return null;

  const { recommendation } = dossier;

  const recColor = !recommendation ? null :
    recommendation.decision === 'approuver'
      ? { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Approuver', icon: ThumbsUp }
      : recommendation.decision === 'refuser'
      ? { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Refuser', icon: ThumbsDown }
      : { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Demander complément', icon: MessageSquare };

  const RecIcon = recColor?.icon ?? MessageSquare;

  const selectedDocument = dossier.documents.find((d) => d.id === selectedDoc);

  const handleConfirmDecision = async () => {
    if (!decision) return;
    setSaving(true);
    try {
      await api.patchDecision(dossier.reference, {
        decision,
        commentaire: commentaire || undefined,
        instructeur: 'Marc Dupont',
      });
      setShowDecisionModal(false);
      setDecision(null);
      setCommentaire('');
      await refetch();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dossiers')}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft size={16} className="text-slate-500" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-800">{dossier.reference}</h1>
              <StatusBadge type="dossier" status={dossier.statut} />
            </div>
            <p className="text-xs text-slate-500">
              {dossier.demandeur.prenom} {dossier.demandeur.nom} · {dossier.type} · {dossier.instructeur ?? 'Non assigné'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600">
            <Download size={14} />Exporter
          </button>
          {(dossier.statut === 'en_cours' || dossier.statut === 'en_attente') && (
            <button onClick={() => setShowDecisionModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              <CheckCircle size={14} />Valider la décision
            </button>
          )}
        </div>
      </div>

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Documents */}
        <div className="w-64 border-r border-slate-200 bg-white flex flex-col flex-shrink-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Documents</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {dossier.documents.map((doc) => (
              <button key={doc.id}
                onClick={() => setSelectedDoc(selectedDoc === doc.id ? null : doc.id)}
                className={`w-full flex items-start gap-2.5 p-3 rounded-lg text-left transition-colors ${
                  selectedDoc === doc.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'
                }`}>
                <DocumentIcon status={doc.statut} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 leading-snug">{doc.nom}</p>
                  <p className={`text-xs mt-0.5 ${
                    doc.statut === 'valide' ? 'text-emerald-600' :
                    doc.statut === 'invalide' ? 'text-red-500' :
                    doc.statut === 'manquant' ? 'text-slate-400' : 'text-amber-500'
                  }`}>
                    {doc.statut === 'valide' ? 'Validé' : doc.statut === 'invalide' ? 'Invalide' :
                     doc.statut === 'manquant' ? 'Manquant' : 'En attente'}
                  </p>
                  {doc.file_size && <p className="text-xs text-slate-400">{doc.file_size}</p>}
                </div>
                {!doc.obligatoire && (
                  <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">opt.</span>
                )}
              </button>
            ))}
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-3 text-center mt-2">
              <Upload size={14} className="text-slate-300 mx-auto mb-1" />
              <p className="text-xs text-slate-400">Ajouter un document</p>
            </div>
          </div>
          {selectedDocument && (
            <div className="border-t border-slate-100 p-3 bg-slate-50 flex-shrink-0">
              <p className="text-xs font-semibold text-slate-600 mb-1">{selectedDocument.nom}</p>
              {selectedDocument.validation_message && (
                <p className={`text-xs ${
                  selectedDocument.statut === 'valide' ? 'text-emerald-600' :
                  selectedDocument.statut === 'invalide' ? 'text-red-500' : 'text-slate-500'
                }`}>{selectedDocument.validation_message}</p>
              )}
              {selectedDocument.uploaded_at && (
                <p className="text-xs text-slate-400 mt-1">Déposé le {selectedDocument.uploaded_at}</p>
              )}
            </div>
          )}
        </div>

        {/* Center: AI Analysis */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          <div className="bg-white border-b border-slate-200 px-5 flex-shrink-0">
            <div className="flex gap-0">
              {[
                { id: 'completude' as const, label: 'Complétude documentaire' },
                { id: 'regles' as const, label: 'Validation des règles' },
              ].map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {activeTab === 'completude' && (
              <>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">État des documents</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Reçus', value: dossier.documents.filter(d => d.statut !== 'manquant').length, color: 'text-blue-600' },
                      { label: 'Validés', value: dossier.documents.filter(d => d.statut === 'valide').length, color: 'text-emerald-600' },
                      { label: 'Invalides', value: dossier.documents.filter(d => d.statut === 'invalide').length, color: 'text-red-600' },
                      { label: 'Manquants', value: dossier.documents.filter(d => d.statut === 'manquant').length, color: 'text-slate-400' },
                    ].map((item) => (
                      <div key={item.label} className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500">{item.label}</p>
                        <p className={`text-lg font-bold mt-0.5 ${item.color}`}>
                          {item.value}<span className="text-xs text-slate-400 font-normal">/{dossier.documents.length}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Analyse par document</p>
                  {dossier.analysis_results
                    .filter(r => r.statut !== undefined)
                    .slice(0, 2)
                    .map((r) => <AnalysisRow key={r.id} result={r} />)}
                </div>
              </>
            )}
            {activeTab === 'regles' && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Règles de validation</p>
                {dossier.analysis_results.map((r) => <AnalysisRow key={r.id} result={r} />)}
                {dossier.analysis_results.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-8">Aucun résultat d'analyse disponible.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: AI Recommendation */}
        <div className="w-72 border-l border-slate-200 bg-white flex flex-col flex-shrink-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recommandation IA</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {recommendation ? (
              <>
                <div className="flex justify-center pt-2">
                  <ConfidenceGauge value={recommendation.confidence} />
                </div>

                {recColor && (
                  <div className={`rounded-xl border p-4 ${recColor.bg} ${recColor.border}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <RecIcon size={16} className={recColor.text} />
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Décision suggérée</p>
                    </div>
                    <p className={`text-base font-bold ${recColor.text}`}>{recColor.label}</p>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{recommendation.motif}</p>
                  </div>
                )}

                {recommendation.points_bloquants.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Points bloquants</p>
                    <div className="space-y-1.5">
                      {recommendation.points_bloquants.map((p, i) => (
                        <div key={i} className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                          <XCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-red-700">{p}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {recommendation.points_attention.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Points d'attention</p>
                    <div className="space-y-1.5">
                      {recommendation.points_attention.map((p, i) => (
                        <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                          <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700">{p}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">Aucune recommandation disponible.</p>
            )}

            {(dossier.statut === 'en_cours' || dossier.statut === 'en_attente') && (
              <div className="space-y-2 pt-2">
                <button onClick={() => { setDecision('approuver'); setShowDecisionModal(true); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors">
                  <ThumbsUp size={14} />Approuver
                </button>
                <button onClick={() => { setDecision('refuser'); setShowDecisionModal(true); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
                  <ThumbsDown size={14} />Refuser
                </button>
                <button onClick={() => { setDecision('complement'); setShowDecisionModal(true); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
                  <MessageSquare size={14} />Demander un complément
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Decision modal */}
      {showDecisionModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-1">
              {decision === 'approuver' ? 'Approuver le dossier' :
               decision === 'refuser' ? 'Refuser le dossier' :
               'Demander un complément'}
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              {dossier.reference} — {dossier.demandeur.prenom} {dossier.demandeur.nom}
            </p>

            {!decision && (
              <div className="flex gap-2 mb-4">
                <button onClick={() => setDecision('approuver')}
                  className="flex-1 py-2 text-sm font-medium rounded-lg border-2 border-slate-200 text-slate-600 hover:border-emerald-300 transition-colors">
                  Approuver
                </button>
                <button onClick={() => setDecision('refuser')}
                  className="flex-1 py-2 text-sm font-medium rounded-lg border-2 border-slate-200 text-slate-600 hover:border-red-300 transition-colors">
                  Refuser
                </button>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Commentaire {decision && decision !== 'complement' ? '(optionnel)' : '(motif)'}
              </label>
              <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)}
                rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder={
                  decision === 'approuver' ? 'Dossier conforme, approuvé...' :
                  decision === 'refuser' ? 'Motif du refus...' :
                  'Précisez les documents ou informations manquantes...'
                } />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowDecisionModal(false); setDecision(null); setCommentaire(''); }}
                className="flex-1 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                Annuler
              </button>
              <button
                onClick={handleConfirmDecision}
                disabled={saving}
                className={`flex-1 py-2 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 ${
                  decision === 'approuver' ? 'bg-emerald-600 hover:bg-emerald-700' :
                  decision === 'refuser' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-blue-600 hover:bg-blue-700'
                }`}>
                {saving ? 'Enregistrement...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
