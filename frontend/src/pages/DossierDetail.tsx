import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, XCircle,
  AlertTriangle, ThumbsUp, ThumbsDown,
  MessageSquare, Download, Eye, X,
  ClipboardList, ExternalLink, FileText, Image, File,
  Sparkles, ShieldAlert, ChevronDown, ChevronUp,
  CheckSquare,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { LoadingSpinner, ErrorMessage } from '../components/ui/LoadingSpinner';
import { StatusBadge } from '../components/ui/Badge';
import type { DocumentItem, RecommendationDecision } from '../lib/api';

// ── File tree icon ─────────────────────────────────────────────────────────

function FileIcon({ contentType }: { contentType?: string }) {
  if (!contentType) return <File size={14} className="text-slate-400" />;
  if (contentType.startsWith('image/')) return <Image size={14} className="text-blue-400" />;
  if (contentType === 'application/pdf') return <FileText size={14} className="text-red-400" />;
  return <File size={14} className="text-slate-400" />;
}

function DocStatusDot({ status }: { status: DocumentItem['statut'] }) {
  if (status === 'valide') return <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />;
  if (status === 'invalide') return <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />;
  if (status === 'manquant') return <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />;
  return <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />;
}

// ── Instruction question card (center) ────────────────────────────────────

function InstructionCard({
  index,
  label,
  answer,
  status,
  reasoning,
  isEligibilityKO,
  sources,
}: {
  index: number;
  label: string;
  answer: string;
  status: 'ok' | 'warning' | 'error';
  reasoning: string[];
  isEligibilityKO: boolean;
  sources: string[];
}) {
  const [reasoningOpen, setReasoningOpen] = useState(true);

  return (
    <div className={`bg-white border rounded-xl overflow-hidden mb-4 ${
      isEligibilityKO ? 'border-red-200' : 'border-slate-200'
    }`}>
      {isEligibilityKO && (
        <div className="bg-red-50 border-b border-red-100 px-4 py-2 flex items-center gap-2">
          <ShieldAlert size={13} className="text-red-500" />
          <span className="text-xs text-red-600 font-semibold">Point bloquant — dossier KO</span>
        </div>
      )}
      <div className="p-4">
        {/* Question label */}
        <div className="flex items-start gap-2 mb-3">
          <span className="text-xs font-bold text-slate-400 mt-0.5 shrink-0">Q{index}</span>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
        </div>

        {/* Answer field */}
        <div className={`border rounded-lg px-3 py-2.5 text-sm min-h-40 ${
          status === 'ok'
            ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800'
            : status === 'error'
            ? 'border-red-200 bg-red-50/50 text-red-800'
            : 'border-amber-200 bg-amber-50/50 text-amber-800'
        }`}>
          {answer || <span className="text-slate-400 italic">Non renseigné</span>}
        </div>

        {/* AI Reasoning block */}
        <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-left"
            onClick={() => setReasoningOpen(!reasoningOpen)}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-blue-500" />
              <span className="text-xs font-semibold text-blue-700">Analyse IA</span>
            </div>
            {reasoningOpen
              ? <ChevronUp size={12} className="text-blue-400" />
              : <ChevronDown size={12} className="text-blue-400" />}
          </button>
          {reasoningOpen && (
            <div className="px-3 pb-3 space-y-2 border-t border-blue-100">
              {reasoning.length > 0 ? (
                <ul className="space-y-1 pt-2">
                  {reasoning.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-blue-700">
                      <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-blue-600 pt-2 italic">Aucun détail disponible</p>
              )}
              {sources.length > 0 && (
                <div className="pt-1">
                  {sources.map((src, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full mr-1 mb-1"
                    >
                      <FileText size={10} />
                      {src}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── DossierDetail ──────────────────────────────────────────────────────────

export function DossierDetail() {
  const { reference } = useParams<{ reference: string }>();
  const navigate = useNavigate();
  const [viewerDoc, setViewerDoc] = useState<DocumentItem | null>(null);
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

  // Map analysis_results → instruction questions
  const instructionQuestions = dossier.analysis_results.map((r, i) => ({
    id: r.id,
    index: i + 1,
    label: r.label,
    answer: r.message,
    status: r.statut as 'ok' | 'warning' | 'error',
    reasoning: r.details ?? [],
    isEligibilityKO: r.statut === 'error',
    sources: dossier.documents
      .filter((d) => d.statut !== 'manquant')
      .slice(0, 2)
      .map((d) => d.nom),
  }));

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

  const hasKO = instructionQuestions.some((q) => q.isEligibilityKO);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dossiers')}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={16} className="text-slate-500" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-800">{dossier.reference}</h1>
              <StatusBadge type="dossier" status={dossier.statut} />
              {hasKO && (
                <span className="flex items-center gap-1 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">
                  <XCircle size={11} />KO
                </span>
              )}
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
        </div>
      </div>

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT (20%) — Form link + file tree ── */}
        <div className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b border-slate-100">
            {/* Formulaire de demande card */}
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
            >
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <ClipboardList size={16} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800">Formulaire de demande</p>
                <p className="text-xs text-slate-400">Réponses du demandeur</p>
              </div>
              <ExternalLink size={13} className="text-slate-300 group-hover:text-blue-400 shrink-0" />
            </a>
          </div>

          {/* File tree */}
          <div className="px-4 py-2.5 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Documents déposés</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
            {dossier.documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => doc.minio_key ? setViewerDoc(doc) : null}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                  doc.minio_key
                    ? 'hover:bg-slate-50 cursor-pointer'
                    : 'cursor-default opacity-60'
                }`}
              >
                <FileIcon contentType={doc.content_type} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 truncate">{doc.nom}</p>
                  {doc.file_size && (
                    <p className="text-xs text-slate-400">{doc.file_size}</p>
                  )}
                </div>
                <DocStatusDot status={doc.statut} />
                {doc.minio_key && (
                  <Eye size={11} className="text-slate-300 hover:text-blue-400 shrink-0" />
                )}
              </button>
            ))}
            {dossier.documents.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6 italic">Aucun document</p>
            )}
          </div>
        </div>

        {/* ── CENTER (50%) — Instruction form ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          <div className="bg-white border-b border-slate-200 px-5 py-3 shrink-0 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Formulaire d'instruction</p>
              <p className="text-xs text-slate-500">{instructionQuestions.length} question(s) à instruire</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Sparkles size={13} className="text-blue-500" />
              Pré-rempli par IA
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {instructionQuestions.length > 0 ? (
              instructionQuestions.map((q) => (
                <InstructionCard
                  key={q.id}
                  index={q.index}
                  label={q.label}
                  answer={q.answer}
                  status={q.status}
                  reasoning={q.reasoning}
                  isEligibilityKO={q.isEligibilityKO}
                  sources={q.sources}
                />
              ))
            ) : (
              <div className="text-center py-16">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <CheckSquare size={20} className="text-slate-300" />
                </div>
                <p className="text-sm text-slate-400 font-medium">Aucune question d'instruction</p>
                <p className="text-xs text-slate-400 mt-1">Configurez le formulaire d'instruction dans le workflow</p>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT (30%) — Progress + validate ── */}
        <div className="w-80 border-l border-slate-200 bg-white flex flex-col shrink-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Avancement de l'instruction</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {instructionQuestions.length > 0 ? (
              <div className="space-y-1">
                {instructionQuestions.map((q) => (
                  <div
                    key={q.id}
                    className={`flex items-start gap-3 px-3 py-2.5 rounded-lg ${
                      q.isEligibilityKO ? 'bg-red-50' : q.status === 'warning' ? 'bg-amber-50' : 'bg-slate-50'
                    }`}
                  >
                    {q.isEligibilityKO ? (
                      <XCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                    ) : q.status === 'ok' ? (
                      <CheckCircle size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 leading-snug truncate">{q.label}</p>
                    </div>
                    {q.isEligibilityKO && (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold shrink-0">KO</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-8 italic">Aucune question</p>
            )}
          </div>

          {/* Validate button — sticky bottom */}
          <div className="border-t border-slate-200 p-4 shrink-0 space-y-2">
            {hasKO && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-2">
                <XCircle size={13} className="text-red-500 shrink-0" />
                <p className="text-xs text-red-600">Point bloquant détecté</p>
              </div>
            )}
            {(dossier.statut === 'en_cours' || dossier.statut === 'en_attente') ? (
              <>
                <button
                  onClick={() => { setDecision('approuver'); setShowDecisionModal(true); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <ThumbsUp size={14} />Approuver
                </button>
                <button
                  onClick={() => { setDecision('refuser'); setShowDecisionModal(true); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  <ThumbsDown size={14} />Refuser
                </button>
                <button
                  onClick={() => { setDecision('complement'); setShowDecisionModal(true); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <MessageSquare size={14} />Demander un complément
                </button>
              </>
            ) : (
              <div className="text-center py-2">
                <p className="text-xs text-slate-400">Dossier {dossier.statut}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Document viewer modal */}
      {viewerDoc && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl" style={{ height: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
              <div>
                <p className="text-sm font-semibold text-slate-800">{viewerDoc.nom}</p>
                <p className="text-xs text-slate-400">{viewerDoc.file_size} · {viewerDoc.content_type}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={api.getDocumentContentUrl(dossier.reference, viewerDoc.id, true)}
                  download
                  className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Download size={13} />Télécharger
                </a>
                <button
                  onClick={() => setViewerDoc(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={16} className="text-slate-500" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden rounded-b-2xl bg-slate-100">
              {viewerDoc.content_type?.startsWith('image/') ? (
                <div className="w-full h-full flex items-center justify-center p-6">
                  <img
                    src={api.getDocumentContentUrl(dossier.reference, viewerDoc.id)}
                    alt={viewerDoc.nom}
                    className="max-w-full max-h-full object-contain rounded-lg shadow"
                  />
                </div>
              ) : viewerDoc.content_type === 'application/pdf' ? (
                <iframe
                  src={api.getDocumentContentUrl(dossier.reference, viewerDoc.id)}
                  className="w-full h-full"
                  title={viewerDoc.nom}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-400">
                  <p className="text-sm">Prévisualisation non disponible pour ce type de fichier.</p>
                  <a
                    href={api.getDocumentContentUrl(dossier.reference, viewerDoc.id, true)}
                    download
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Download size={14} />Télécharger le fichier
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                <button
                  onClick={() => setDecision('approuver')}
                  className="flex-1 py-2 text-sm font-medium rounded-lg border-2 border-slate-200 text-slate-600 hover:border-emerald-300 transition-colors"
                >
                  Approuver
                </button>
                <button
                  onClick={() => setDecision('refuser')}
                  className="flex-1 py-2 text-sm font-medium rounded-lg border-2 border-slate-200 text-slate-600 hover:border-red-300 transition-colors"
                >
                  Refuser
                </button>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Commentaire {decision && decision !== 'complement' ? '(optionnel)' : '(motif)'}
              </label>
              <textarea
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder={
                  decision === 'approuver' ? 'Dossier conforme, approuvé...' :
                  decision === 'refuser' ? 'Motif du refus...' :
                  'Précisez les documents ou informations manquantes...'
                }
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowDecisionModal(false); setDecision(null); setCommentaire(''); }}
                className="flex-1 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDecision}
                disabled={saving}
                className={`flex-1 py-2 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 ${
                  decision === 'approuver' ? 'bg-emerald-600 hover:bg-emerald-700' :
                  decision === 'refuser' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {saving ? 'Enregistrement...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
