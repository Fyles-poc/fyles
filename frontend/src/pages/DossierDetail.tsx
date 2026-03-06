import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, XCircle,
  AlertTriangle, ThumbsUp, ThumbsDown,
  MessageSquare, Download, Eye, X,
  ClipboardList, ExternalLink, FileText, Image, File,
  Sparkles, ShieldAlert, ChevronDown, ChevronUp,
  CheckSquare, Bot, Play, Pencil, Save, ArrowLeftRight, Loader2, Trash2, Ban,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { LoadingSpinner, ErrorMessage } from '../components/ui/LoadingSpinner';
import { StatusBadge } from '../components/ui/Badge';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import type { DocumentItem, RecommendationDecision, FormBlock, WorkflowExecutionResult, AIAnalysisResult, NodeExecutionEntry, WorkflowNode } from '../lib/api';

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

// ── Pipeline helpers ───────────────────────────────────────────────────────

interface BreakCondition {
  source_node_id: string;
  operator: string;
  value?: string | number;
}

const OP_LABELS: Record<string, string> = {
  is_false: 'est Non',
  is_true: 'est Oui',
  less_than: 'inférieur à',
  greater_than: 'supérieur à',
  equals: 'égal à',
  not_equals: 'différent de',
};

function buildOrderedPipeline(nodes: WorkflowNode[]): WorkflowNode[] {
  if (!nodes.length) return [];
  const map = new Map(nodes.map((n) => [n.id, n]));
  const start = nodes.find((n) => n.type === 'trigger') ?? nodes[0];
  const ordered: WorkflowNode[] = [];
  const visited = new Set<string>();
  let cur: WorkflowNode | undefined = start;
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id);
    ordered.push(cur);
    const nextId = typeof cur.next === 'string' ? cur.next : null;
    cur = nextId ? map.get(nextId) : undefined;
  }
  return ordered;
}

// ── AnalysisPipelineCard ───────────────────────────────────────────────────

function AnalysisPipelineCard({
  displayLabel,
  nodeLabel,
  sources,
  fieldDefs,
  reponses,
  documents,
  result,
  isRunning,
  onViewDoc,
  onRun,
}: {
  displayLabel: string;
  nodeLabel: string;
  sources: string[];
  fieldDefs: Record<string, { label: string; type: string }>;
  reponses: Record<string, unknown>;
  documents: DocumentItem[];
  result?: AIAnalysisResult;
  isRunning: boolean;
  onViewDoc: (doc: DocumentItem) => void;
  onRun: () => void;
}) {
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const hasResult = !!result;

  const sourceEntries = sources.map((id) => {
    const def = fieldDefs[id] ?? { label: id, type: 'short_answer' };
    const isFile = def.type === 'file_upload' || def.type === 'multifile_upload';
    const doc = isFile ? documents.find((d) => d.id === `doc_${id}`) : undefined;
    const value = !isFile ? reponses[id] : undefined;
    return { id, label: def.label || id, isFile, doc, value };
  });

  return (
    <div className={`bg-white border rounded-xl overflow-hidden mb-4 ${
      hasResult && result.statut === 'error' ? 'border-red-200' : 'border-slate-200'
    }`}>
      {hasResult && result.statut === 'error' && (
        <div className="bg-red-50 border-b border-red-100 px-4 py-2 flex items-center gap-2">
          <ShieldAlert size={13} className="text-red-500" />
          <span className="text-xs text-red-600 font-semibold">Point bloquant — dossier KO</span>
        </div>
      )}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-2 mb-3">
          <span className="text-xs font-bold text-blue-400 mt-0.5 shrink-0">{displayLabel}</span>
          <p className="text-sm font-semibold text-slate-800 flex-1">{nodeLabel || <span className="italic text-slate-400">Nœud sans nom</span>}</p>
          <button
            onClick={onRun}
            disabled={isRunning}
            title={hasResult ? 'Relancer ce nœud' : 'Exécuter ce nœud'}
            className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? <Bot size={11} className="animate-pulse" /> : <Play size={11} className="ml-px" />}
          </button>
        </div>

        {/* Sources */}
        {sourceEntries.length > 0 && (
          <div className="mb-3 border border-slate-100 rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-3 py-1.5 text-left bg-slate-50 hover:bg-slate-100 transition-colors"
              onClick={() => setSourcesOpen((o) => !o)}
            >
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Sources ({sourceEntries.length})
              </span>
              {sourcesOpen ? <ChevronUp size={11} className="text-slate-400" /> : <ChevronDown size={11} className="text-slate-400" />}
            </button>
            {sourcesOpen && (
              <div className="px-3 py-2 space-y-1.5 border-t border-slate-100">
                {sourceEntries.map(({ id, label, isFile, doc, value }) => (
                  <div key={id} className="flex items-start gap-2">
                    <span className="text-xs text-slate-400 w-28 shrink-0 truncate pt-0.5" title={label}>{label}</span>
                    {isFile ? (
                      doc?.minio_key ? (
                        <button
                          onClick={() => doc && onViewDoc(doc)}
                          className="inline-flex items-center gap-1.5 text-xs bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 px-2 py-0.5 rounded transition-colors"
                        >
                          <FileIcon contentType={doc.content_type} />
                          <span className="max-w-28 truncate">{doc.nom}</span>
                          <Eye size={10} />
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Aucun fichier</span>
                      )
                    ) : (
                      <span className="text-xs text-slate-700 flex-1 break-words">
                        {value !== undefined && value !== '' && value !== null
                          ? (Array.isArray(value) ? value.join(', ') : String(value))
                          : <span className="italic text-slate-400">Non renseigné</span>}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Result — only shown after analysis has run */}
        {hasResult ? (
          <>
            <div className={`border rounded-lg px-4 py-3 flex items-center justify-center min-h-12 mb-3 ${
              result.statut === 'ok' ? 'border-emerald-200 bg-emerald-50/50'
              : result.statut === 'error' ? 'border-red-200 bg-red-50/50'
              : 'border-amber-200 bg-amber-50/50'
            }`}>
              {result.details?.[0]
                ? <FormatResult raw={result.details[0]} status={result.statut} />
                : <span className="text-slate-400 italic text-sm">Aucun résultat</span>}
            </div>
            {result.message && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-3 py-2 text-left"
                  onClick={() => setAnalysisOpen((o) => !o)}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={13} className="text-blue-500" />
                    <span className="text-xs font-semibold text-blue-700">Analyse IA</span>
                  </div>
                  {analysisOpen ? <ChevronUp size={12} className="text-blue-400" /> : <ChevronDown size={12} className="text-blue-400" />}
                </button>
                {analysisOpen && (
                  <div className="px-3 pb-3 pt-2 border-t border-blue-100">
                    <p className="text-xs text-blue-700 leading-relaxed">{result.message}</p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-lg px-4 py-2.5 text-center">
            <p className="text-xs text-slate-400 italic">Lancez l'analyse pour voir le résultat</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── BreakPipelineCard ──────────────────────────────────────────────────────

function BreakPipelineCard({
  displayLabel,
  nodeLabel,
  conditions,
  conditionLogic,
  nodeDisplayInfo,
  traceEntry,
}: {
  displayLabel: string;
  nodeLabel: string;
  conditions: BreakCondition[];
  conditionLogic: string;
  nodeDisplayInfo: Map<string, { label: string }>;
  traceEntry?: NodeExecutionEntry;
}) {
  const triggered = traceEntry?.status === 'break';
  const notExecuted = !traceEntry || traceEntry.status === 'not_run';
  const passed = traceEntry && !triggered && !notExecuted;

  return (
    <div className={`border rounded-xl overflow-hidden mb-4 ${
      triggered ? 'border-orange-300 bg-orange-50'
      : notExecuted ? 'border-dashed border-slate-200 bg-slate-50/50 opacity-60'
      : 'border-orange-200 bg-orange-50/40'
    }`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold text-orange-400 shrink-0">{displayLabel}</span>
          <Ban size={13} className="text-orange-500 shrink-0" />
          <p className="text-sm font-semibold text-slate-700 flex-1">{nodeLabel || 'Rupture conditionnelle'}</p>
        </div>

        {/* Conditions */}
        {conditions.length > 0 ? (
          <div className="space-y-1.5 mb-3">
            {conditions.map((cond, i) => {
              const sourceInfo = nodeDisplayInfo.get(cond.source_node_id);
              const opLabel = OP_LABELS[cond.operator] ?? cond.operator;
              return (
                <div key={i} className="flex items-center gap-1.5 flex-wrap text-xs">
                  {i > 0 && <span className="font-bold text-orange-500 text-[10px]">{conditionLogic}</span>}
                  <span className="text-slate-500">Si</span>
                  <span className="font-semibold text-slate-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                    {sourceInfo?.label ?? cond.source_node_id}
                  </span>
                  <span className="bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded font-medium">
                    {opLabel}{cond.value !== undefined ? ` ${cond.value}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic mb-3">Aucune condition configurée</p>
        )}

        {/* Status */}
        {triggered ? (
          <div className="flex items-center gap-2 bg-orange-100 border border-orange-200 rounded-lg px-3 py-2">
            <Ban size={13} className="text-orange-600 shrink-0" />
            <span className="text-xs font-semibold text-orange-700">Pipeline interrompu ici</span>
          </div>
        ) : passed ? (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <CheckCircle size={13} className="text-emerald-500 shrink-0" />
            <span className="text-xs font-semibold text-emerald-700">Conditions non remplies — pipeline continue</span>
          </div>
        ) : (
          <div className="bg-white/60 border border-dashed border-slate-200 rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-slate-400 italic">Non exécuté</p>
          </div>
        )}
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
  const [runningNodeIds, setRunningNodeIds] = useState<Set<string>>(new Set());
  const [editingReponses, setEditingReponses] = useState(false);
  const [editedReponses, setEditedReponses] = useState<Record<string, unknown>>({});
  const [savingReponses, setSavingReponses] = useState(false);
  const [replacingDocId, setReplacingDocId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingDocIdRef = useRef<string | null>(null);

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

  // Build field label + def maps from workflow formulaire_demande
  const fieldLabels: Record<string, string> = {};
  const fieldDefs: Record<string, { label: string; type: string; options?: string[] }> = {};
  if (workflow?.formulaire_demande) {
    const flattenBlocks = (blocks: FormBlock[]) => {
      for (const b of blocks) {
        fieldLabels[b.id] = b.label;
        if (!['header', 'text', 'container'].includes(b.type)) {
          fieldDefs[b.id] = { label: b.label, type: b.type, options: b.options };
        }
        if (b.blocks) flattenBlocks(b.blocks);
      }
    };
    for (const page of workflow.formulaire_demande) {
      flattenBlocks(page.blocks);
    }
  }

  // Map analysis_results → instruction questions (for right panel)
  const instructionQuestions = dossier.analysis_results.map((r, i) => {
    const nodeId = r.id.startsWith('auto_') ? r.id.slice(5) : null;
    return {
      id: r.id,
      nodeId,
      index: i + 1,
      label: r.label,
      status: r.statut as 'ok' | 'warning' | 'error',
      isEligibilityKO: r.statut === 'error',
    };
  });

  // Build ordered pipeline from workflow nodes
  const orderedNodes = workflow?.nodes ? buildOrderedPipeline(workflow.nodes) : [];
  const nonTriggerNodes = orderedNodes.filter((n) => n.type !== 'trigger');
  let qCount = 0, breakCount = 0;
  const nodeDisplayInfo = new Map<string, { label: string }>();
  for (const n of nonTriggerNodes) {
    if (n.type === 'analysis') { qCount++; nodeDisplayInfo.set(n.id, { label: `Q${qCount}` }); }
    else if (n.type === 'break') { breakCount++; nodeDisplayInfo.set(n.id, { label: `Break ${breakCount}` }); }
  }
  const analysisResultMap = new Map(
    (dossier.analysis_results ?? []).map((r) => [r.id, r])
  );

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

  const handleLaunchSingleNode = async (nodeId: string) => {
    if (!dossier.workflow_id) return;
    setRunningNodeIds((prev) => new Set(prev).add(nodeId));
    try {
      await api.executeWorkflowNode(dossier.workflow_id, dossier.reference, nodeId);
      await refetch();
    } catch (e) {
      console.error(e);
    } finally {
      setRunningNodeIds((prev) => { const s = new Set(prev); s.delete(nodeId); return s; });
    }
  };

  const handleSaveReponses = async () => {
    setSavingReponses(true);
    try {
      await api.updateDossierReponses(dossier.reference, editedReponses);
      await refetch();
      setEditingReponses(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingReponses(false);
    }
  };

  const handleReplaceDocument = async (file: File) => {
    const docId = pendingDocIdRef.current;
    if (!docId) return;
    setReplacingDocId(docId);
    try {
      await api.replaceDossierDocument(dossier.reference, docId, file);
      await refetch();
    } catch (e) {
      console.error(e);
    } finally {
      setReplacingDocId(null);
      pendingDocIdRef.current = null;
    }
  };

  const doDelete = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await api.deleteDossier(dossier.reference);
      navigate('/dossiers');
    } catch (e) {
      console.error(e);
      setDeleting(false);
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
                <><Play size={14} />Lancer l'analyse complète</>
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
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            title="Supprimer le dossier"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-red-500 disabled:opacity-50"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Supprimer
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

          {/* Hidden file input for document replacement */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleReplaceDocument(file);
              e.target.value = '';
            }}
          />

          {/* File tree */}
          <div className="px-4 py-2.5 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Documents déposés</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
            {dossier.documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-1 group/doc">
                <button
                  onClick={() => doc.minio_key ? setViewerDoc(doc) : undefined}
                  className={`flex-1 flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                    doc.minio_key ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default opacity-60'
                  }`}
                >
                  <FileIcon contentType={doc.content_type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 truncate" title={doc.nom}>{doc.nom.length > 20 ? `${doc.nom.slice(0, 20)}…` : doc.nom}</p>
                    {doc.file_size && <p className="text-xs text-slate-400">{doc.file_size}</p>}
                  </div>
                  <DocStatusDot status={doc.statut} />
                  {doc.minio_key && <Eye size={11} className="text-slate-300 hover:text-blue-400 shrink-0" />}
                </button>
                <button
                  title="Remplacer le fichier"
                  onClick={() => { pendingDocIdRef.current = doc.id; fileInputRef.current?.click(); }}
                  disabled={replacingDocId === doc.id}
                  className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                    replacingDocId === doc.id
                      ? 'text-blue-400 bg-blue-50'
                      : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  {replacingDocId === doc.id
                    ? <Loader2 size={11} className="animate-spin" />
                    : <ArrowLeftRight size={11} />}
                </button>
              </div>
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
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-800">Formulaire d'instruction</p>
                {workflow && (
                  <button
                    onClick={() => navigate(`/workflows/${workflow.id}`)}
                    className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 hover:underline transition-colors"
                  >
                    <ExternalLink size={11} />
                    {workflow.nom}
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {nonTriggerNodes.length > 0
                  ? `${qCount} analyse${qCount !== 1 ? 's' : ''}${breakCount > 0 ? ` · ${breakCount} rupture${breakCount !== 1 ? 's' : ''}` : ''}`
                  : 'Aucune étape configurée'}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {nonTriggerNodes.length > 0 ? (
              nonTriggerNodes.map((node) => {
                const cfg = (node.config as Record<string, unknown>) ?? {};
                const displayInfo = nodeDisplayInfo.get(node.id);
                if (node.type === 'analysis') {
                  const sources = (cfg.sources as string[]) ?? [];
                  return (
                    <AnalysisPipelineCard
                      key={node.id}
                      displayLabel={displayInfo?.label ?? '?'}
                      nodeLabel={node.label}
                      sources={sources}
                      fieldDefs={fieldDefs}
                      reponses={dossier.reponses}
                      documents={dossier.documents}
                      result={analysisResultMap.get(`auto_${node.id}`)}
                      isRunning={runningNodeIds.has(node.id)}
                      onViewDoc={setViewerDoc}
                      onRun={() => handleLaunchSingleNode(node.id)}
                    />
                  );
                }
                if (node.type === 'break') {
                  const conditions = (cfg.conditions as BreakCondition[]) ?? [];
                  const conditionLogic = (cfg.condition_logic as string) ?? 'AND';
                  return (
                    <BreakPipelineCard
                      key={node.id}
                      displayLabel={displayInfo?.label ?? 'Break'}
                      nodeLabel={node.label}
                      conditions={conditions}
                      conditionLogic={conditionLogic}
                      nodeDisplayInfo={nodeDisplayInfo}
                      traceEntry={execResult?.execution_trace.find((e) => e.node_id === node.id)}
                    />
                  );
                }
                return null;
              })
            ) : (
              <div className="text-center py-16">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <CheckSquare size={20} className="text-slate-300" />
                </div>
                <p className="text-sm text-slate-400 font-medium">Aucune étape d'analyse</p>
                <p className="text-xs text-slate-400 mt-1">Configurez le workflow d'instruction pour automatiser l'analyse</p>
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
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-lg" style={{ maxHeight: '85vh' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2">
                <ClipboardList size={16} className="text-blue-600" />
                <p className="text-sm font-bold text-slate-800">Formulaire de demande</p>
              </div>
              <div className="flex items-center gap-1">
                {!editingReponses ? (
                  <button
                    onClick={() => { setEditedReponses({ ...dossier.reponses }); setEditingReponses(true); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Pencil size={12} />Modifier
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setEditingReponses(false)}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSaveReponses}
                      disabled={savingReponses}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
                    >
                      {savingReponses ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Enregistrer
                    </button>
                  </>
                )}
                <button onClick={() => { setShowReponsesModal(false); setEditingReponses(false); }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors ml-1">
                  <X size={16} className="text-slate-500" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {Object.keys(dossier.reponses).length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-8">Aucune réponse enregistrée</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(editingReponses ? editedReponses : dossier.reponses).map(([key, val]) => {
                    const def = fieldDefs[key];
                    const isFile = def?.type === 'file_upload' || def?.type === 'multifile_upload';
                    const label = fieldLabels[key] ?? key;

                    if (!editingReponses || isFile) {
                      // Read-only row
                      return (
                        <div key={key} className="bg-slate-50 rounded-lg px-4 py-3">
                          <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5">
                            {label}
                            {isFile && editingReponses && (
                              <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium">Modifier via les documents ↑</span>
                            )}
                          </p>
                          <p className="text-sm text-slate-800 wrap-break-word">
                            {Array.isArray(val)
                              ? val.join(', ')
                              : val !== '' && val != null
                              ? String(val)
                              : <span className="text-slate-400 italic">Non renseigné</span>}
                          </p>
                        </div>
                      );
                    }

                    // Edit row
                    const strVal = Array.isArray(val) ? val : String(val ?? '');
                    const type = def?.type ?? 'short_answer';
                    const opts = def?.options ?? [];

                    return (
                      <div key={key} className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600">{label}</label>
                        {type === 'long_answer' ? (
                          <textarea
                            rows={3}
                            value={String(strVal)}
                            onChange={(e) => setEditedReponses((p) => ({ ...p, [key]: e.target.value }))}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                        ) : type === 'dropdown' && opts.length > 0 ? (
                          <select
                            value={String(strVal)}
                            onChange={(e) => setEditedReponses((p) => ({ ...p, [key]: e.target.value }))}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">— Choisir —</option>
                            {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (type === 'multiple_choice' || type === 'multiselect') && opts.length > 0 ? (
                          <div className="space-y-1.5">
                            {opts.map((o) => {
                              const checked = Array.isArray(strVal) ? strVal.includes(o) : String(strVal) === o;
                              return (
                                <label key={o} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type={type === 'multiselect' ? 'checkbox' : 'radio'}
                                    name={key}
                                    value={o}
                                    checked={checked}
                                    onChange={() => {
                                      if (type === 'multiselect') {
                                        const arr = Array.isArray(strVal) ? [...strVal] : [];
                                        setEditedReponses((p) => ({ ...p, [key]: checked ? arr.filter((x) => x !== o) : [...arr, o] }));
                                      } else {
                                        setEditedReponses((p) => ({ ...p, [key]: o }));
                                      }
                                    }}
                                    className="rounded border-slate-300 text-blue-600"
                                  />
                                  <span className="text-sm text-slate-700">{o}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <input
                            type={type === 'number' ? 'number' : type === 'date' ? 'date' : type === 'email' ? 'email' : type === 'phone' ? 'tel' : 'text'}
                            value={String(strVal)}
                            onChange={(e) => setEditedReponses((p) => ({ ...p, [key]: e.target.value }))}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        )}
                      </div>
                    );
                  })}
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
                const isOk = entry.status === 'ok' || entry.status === 'skipped';
                const isError = entry.status === 'error';
                const isBreak = entry.status === 'break';
                const isNotRun = entry.status === 'not_run';
                const isWarning = entry.status === 'warning';

                const borderColor = isError ? 'border-red-200' : isBreak ? 'border-orange-300' : isNotRun ? 'border-dashed border-slate-200' : 'border-slate-200';
                const bgColor = isError ? 'bg-red-50' : isBreak ? 'bg-orange-50' : isNotRun ? 'bg-slate-50/50' : 'bg-slate-50';

                return (
                  <div key={entry.node_id} className={`border rounded-xl overflow-hidden ${borderColor} ${isNotRun ? 'opacity-50' : ''}`}>
                    <div className={`px-4 py-2.5 flex items-center gap-2.5 ${bgColor}`}>
                      <span className="text-xs font-mono text-slate-400 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                      {isOk && <CheckCircle size={14} className="text-emerald-500 shrink-0" />}
                      {isWarning && <AlertTriangle size={14} className="text-amber-500 shrink-0" />}
                      {isError && <XCircle size={14} className="text-red-500 shrink-0" />}
                      {isBreak && <ShieldAlert size={14} className="text-orange-500 shrink-0" />}
                      {isNotRun && <Ban size={14} className="text-slate-300 shrink-0" />}
                      <span className={`text-xs font-semibold flex-1 ${isNotRun ? 'text-slate-400' : 'text-slate-700'}`}>
                        {entry.label || entry.type}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isOk      ? 'bg-emerald-100 text-emerald-700' :
                        isWarning ? 'bg-amber-100 text-amber-700' :
                        isError   ? 'bg-red-100 text-red-700' :
                        isBreak   ? 'bg-orange-100 text-orange-700' :
                                    'bg-slate-100 text-slate-400'
                      }`}>
                        {isBreak ? 'Rupture' : isNotRun ? 'Non exécuté' : entry.status}
                      </span>
                    </div>
                    {!isNotRun && entry.output && Object.keys(entry.output).length > 0 && (
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

      {showDeleteConfirm && (
        <ConfirmModal
          title="Supprimer le dossier"
          message={`Le dossier ${dossier.reference} et tous ses fichiers seront définitivement supprimés. Cette action est irréversible.`}
          confirmLabel="Supprimer définitivement"
          loading={deleting}
          onConfirm={doDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
