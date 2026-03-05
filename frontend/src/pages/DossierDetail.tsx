import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, XCircle,
  AlertTriangle, ThumbsUp, ThumbsDown,
  MessageSquare, Download, Eye, X,
  ClipboardList, ExternalLink, FileText, Image, File,
  Sparkles, ShieldAlert, ChevronDown, ChevronUp,
  CheckSquare, Bot, Play,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { LoadingSpinner, ErrorMessage } from '../components/ui/LoadingSpinner';
import { StatusBadge } from '../components/ui/Badge';
import type { DocumentItem, RecommendationDecision, FormBlock, WorkflowExecutionResult } from '../lib/api';

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

function FormatResult({ raw, status }: { raw: string; status: 'ok' | 'warning' | 'error' }) {
  const lower = raw.toLowerCase().trim();
  if (lower === 'true') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold">
      <CheckCircle size={14} /> Oui
    </span>
  );
  if (lower === 'false') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-600 text-sm font-semibold">
      <XCircle size={14} /> Non
    </span>
  );
  const num = Number(raw);
  if (!isNaN(num) && raw.trim() !== '') return (
    <span className={`inline-flex items-center gap-1 text-2xl font-bold ${status === 'ok' ? 'text-emerald-600' : status === 'error' ? 'text-red-500' : 'text-amber-600'}`}>
      {raw}<span className="text-sm font-normal text-slate-400">/ 100</span>
    </span>
  );
  return (
    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${status === 'ok' ? 'bg-emerald-100 text-emerald-700' : status === 'error' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
      {raw}
    </span>
  );
}

function InstructionCard({
  index,
  label,
  result,
  message,
  status,
  isEligibilityKO,
  linkedDocs,
  onViewDoc,
}: {
  index: number;
  label: string;
  result: string;
  message: string;
  status: 'ok' | 'warning' | 'error';
  isEligibilityKO: boolean;
  linkedDocs: DocumentItem[];
  onViewDoc: (doc: DocumentItem) => void;
}) {
  const [analysisOpen, setAnalysisOpen] = useState(true);

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

        {/* Result */}
        <div className={`border rounded-lg px-4 py-3 flex items-center justify-center min-h-14 ${
          status === 'ok'
            ? 'border-emerald-200 bg-emerald-50/50'
            : status === 'error'
            ? 'border-red-200 bg-red-50/50'
            : 'border-amber-200 bg-amber-50/50'
        }`}>
          {result
            ? <FormatResult raw={result} status={status} />
            : <span className="text-slate-400 italic text-sm">Aucun résultat</span>}
        </div>

        {/* Analyse IA */}
        <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-left"
            onClick={() => setAnalysisOpen(!analysisOpen)}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-blue-500" />
              <span className="text-xs font-semibold text-blue-700">Analyse IA</span>
            </div>
            {analysisOpen
              ? <ChevronUp size={12} className="text-blue-400" />
              : <ChevronDown size={12} className="text-blue-400" />}
          </button>
          {analysisOpen && (
            <div className="px-3 pb-3 pt-2 border-t border-blue-100 space-y-2">
              {message
                ? <p className="text-xs text-blue-700 leading-relaxed">{message}</p>
                : <p className="text-xs text-blue-600 italic">Aucun détail disponible</p>}
              {linkedDocs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {linkedDocs.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => onViewDoc(doc)}
                      className="inline-flex items-center gap-1.5 text-xs bg-white border border-blue-200 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors"
                    >
                      <FileIcon contentType={doc.content_type} />
                      <span className="max-w-32 truncate">{doc.nom}</span>
                      <Eye size={10} className="shrink-0 text-blue-400" />
                    </button>
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
  const [showReponsesModal, setShowReponsesModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decision, setDecision] = useState<RecommendationDecision | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [saving, setSaving] = useState(false);
  const [execStatus, setExecStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [execResult, setExecResult] = useState<WorkflowExecutionResult | null>(null);
  const [showExecPanel, setShowExecPanel] = useState(false);

  const { data: dossier, loading, error, refetch } = useApi(
    () => api.getDossier(reference!),
    [reference]
  );

  const { data: workflow } = useApi(
    () => dossier?.workflow_id ? api.getWorkflow(dossier.workflow_id) : Promise.resolve(null),
    [dossier?.workflow_id]
  );

  if (loading) return <div className="p-6"><LoadingSpinner label="Chargement du dossier..." /></div>;
  if (error) return <div className="p-6"><ErrorMessage message={error} /></div>;
  if (!dossier) return null;

  // Build field label map from workflow formulaire_demande
  const fieldLabels: Record<string, string> = {};
  if (workflow?.formulaire_demande) {
    const flattenBlocks = (blocks: FormBlock[]) => {
      for (const b of blocks) {
        fieldLabels[b.id] = b.label;
        if (b.blocks) flattenBlocks(b.blocks);
      }
    };
    for (const page of workflow.formulaire_demande) {
      flattenBlocks(page.blocks);
    }
  }

  // Map analysis_results → instruction questions
  const instructionQuestions = dossier.analysis_results.map((r, i) => {
    const docFieldIds = (r.details ?? [])
      .filter((d) => d.startsWith('doc:'))
      .map((d) => d.slice(4));
    const linkedDocs = docFieldIds
      .map((fieldId) => dossier.documents.find((d) => d.id === `doc_${fieldId}`))
      .filter((d): d is DocumentItem => !!d);
    return {
      id: r.id,
      index: i + 1,
      label: r.label,
      result: r.details?.[0] ?? '',
      message: r.message,
      status: r.statut as 'ok' | 'warning' | 'error',
      isEligibilityKO: r.statut === 'error',
      linkedDocs,
    };
  });

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

  const handleLaunchAnalysis = async () => {
    if (!dossier.workflow_id) return;
    setExecStatus('running');
    setShowExecPanel(true);
    setExecResult(null);
    try {
      const result = await api.executeWorkflow(dossier.workflow_id, dossier.reference);
      setExecResult(result);
      setExecStatus('done');
      await refetch();
    } catch (e) {
      setExecStatus('error');
      setExecResult({ success: false, error: String(e), execution_trace: [] });
    }
  };

  const hasWorkflowNodes = (workflow?.nodes?.length ?? 0) > 0;

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
          {hasWorkflowNodes && (
            <button
              onClick={handleLaunchAnalysis}
              disabled={execStatus === 'running'}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors disabled:opacity-70 ${
                execStatus === 'running'
                  ? 'bg-blue-100 text-blue-600 border border-blue-200'
                  : execStatus === 'done'
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {execStatus === 'running' ? (
                <><Bot size={14} className="animate-pulse" />Analyse en cours…</>
              ) : execStatus === 'done' ? (
                <><CheckCircle size={14} />Voir les résultats</>
              ) : (
                <><Play size={14} />Lancer l'analyse</>
              )}
            </button>
          )}
          {execResult && (
            <button
              onClick={() => setShowExecPanel(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
            >
              <Bot size={14} />Résultats
            </button>
          )}
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
            <button
              onClick={() => setShowReponsesModal(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
            >
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <ClipboardList size={16} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-semibold text-slate-800">Formulaire de demande</p>
                <p className="text-xs text-slate-400">Réponses du demandeur</p>
              </div>
              <ExternalLink size={13} className="text-slate-300 group-hover:text-blue-400 shrink-0" />
            </button>
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
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {instructionQuestions.length > 0 ? (
              instructionQuestions.map((q) => (
                <InstructionCard
                  key={q.id}
                  index={q.index}
                  label={q.label}
                  result={q.result}
                  message={q.message}
                  status={q.status}
                  isEligibilityKO={q.isEligibilityKO}
                  linkedDocs={q.linkedDocs}
                  onViewDoc={setViewerDoc}
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
            {(dossier.statut === 'en_instruction' || dossier.statut === 'en_attente') ? (
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

      {/* Réponses formulaire modal */}
      {showReponsesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-lg" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2">
                <ClipboardList size={16} className="text-blue-600" />
                <p className="text-sm font-bold text-slate-800">Formulaire de demande</p>
              </div>
              <button onClick={() => setShowReponsesModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={16} className="text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {Object.keys(dossier.reponses).length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-8">Aucune réponse enregistrée</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(dossier.reponses).map(([key, val]) => (
                    <div key={key} className="bg-slate-50 rounded-lg px-4 py-3">
                      <p className="text-xs font-semibold text-slate-500 mb-1">
                        {fieldLabels[key] ?? key}
                      </p>
                      <p className="text-sm text-slate-800 wrap-break-word">
                        {Array.isArray(val)
                          ? val.join(', ')
                          : val !== '' && val != null
                          ? String(val)
                          : <span className="text-slate-400 italic">Non renseigné</span>}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* ── Execution results panel ── */}
      {showExecPanel && execResult && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-end">
          <div className="bg-white h-full w-full max-w-xl flex flex-col shadow-2xl">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Bot size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Résultats de l'analyse automatique</p>
                  <p className="text-xs text-slate-500">{dossier.reference}</p>
                </div>
              </div>
              <button onClick={() => setShowExecPanel(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X size={16} className="text-slate-400" />
              </button>
            </div>

            {/* Status banner */}
            <div className={`px-5 py-3 flex items-center gap-2 shrink-0 ${execResult.success ? 'bg-emerald-50 border-b border-emerald-100' : 'bg-red-50 border-b border-red-100'}`}>
              {execResult.success
                ? <><CheckCircle size={15} className="text-emerald-600" /><span className="text-sm font-medium text-emerald-700">Pipeline exécuté avec succès</span></>
                : <><XCircle size={15} className="text-red-600" /><span className="text-sm font-medium text-red-700">{execResult.error ?? 'Erreur lors de l\'exécution'}</span></>
              }
            </div>

            {/* Trace */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {execResult.execution_trace.map((entry, i) => {
                const isOk = entry.status === 'ok';
                const isError = entry.status === 'error';
                return (
                  <div key={entry.node_id} className={`border rounded-xl overflow-hidden ${isError ? 'border-red-200' : 'border-slate-200'}`}>
                    <div className={`px-4 py-2.5 flex items-center gap-2.5 ${isError ? 'bg-red-50' : 'bg-slate-50'}`}>
                      <span className="text-xs font-mono text-slate-400 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                      {isOk
                        ? <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                        : isError
                        ? <XCircle size={14} className="text-red-500 shrink-0" />
                        : <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                      }
                      <span className="text-xs font-semibold text-slate-700 flex-1">{entry.label || entry.type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isOk ? 'bg-emerald-100 text-emerald-700' :
                        isError ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{entry.status}</span>
                    </div>
                    {entry.output && Object.keys(entry.output).length > 0 && (
                      <div className="px-4 py-3 bg-white">
                        <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono overflow-x-auto max-h-48">
                          {JSON.stringify(entry.output, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
              {execResult.execution_trace.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">Aucun nœud exécuté.</p>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 shrink-0">
              <button onClick={() => setShowExecPanel(false)} className="w-full py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
