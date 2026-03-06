import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Copy, Check, Code2, Paperclip, X, ChevronLeft, ChevronRight,
  AlertCircle, ClipboardCheck,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import type { FormBlock, FormCondition, FormPage } from '../lib/api';

// ── Helpers ─────────────────────────────────────────────────────────────────

function evaluateCondition(condition: FormCondition, values: Record<string, string>): boolean {
  const fieldValue = values[condition.field_id] ?? '';
  const condValue = condition.value;
  switch (condition.operator) {
    case 'equals': return fieldValue.toLowerCase() === condValue.toLowerCase();
    case 'not_equals': return fieldValue.toLowerCase() !== condValue.toLowerCase();
    case 'contains': return fieldValue.toLowerCase().includes(condValue.toLowerCase());
    case 'greater_than': {
      const n = parseFloat(fieldValue); const c = parseFloat(condValue);
      return !isNaN(n) && !isNaN(c) && n > c;
    }
    case 'greater_or_equal': {
      const n = parseFloat(fieldValue); const c = parseFloat(condValue);
      return !isNaN(n) && !isNaN(c) && n >= c;
    }
    case 'less_than': {
      const n = parseFloat(fieldValue); const c = parseFloat(condValue);
      return !isNaN(n) && !isNaN(c) && n < c;
    }
    case 'less_or_equal': {
      const n = parseFloat(fieldValue); const c = parseFloat(condValue);
      return !isNaN(n) && !isNaN(c) && n <= c;
    }
    default: return true;
  }
}

function evaluateConditions(
  conditions: FormCondition[],
  logic: string,
  values: Record<string, string>
): boolean {
  if (!conditions.length) return true;
  return logic === 'OR'
    ? conditions.some((c) => evaluateCondition(c, values))
    : conditions.every((c) => evaluateCondition(c, values));
}

/** Returns IDs of required fields that are empty/missing on this page. */
function validatePage(
  blocks: FormBlock[],
  values: Record<string, string>,
  files: Record<string, File | null>
): string[] {
  const missing: string[] = [];
  for (const block of blocks) {
    if (block.type === 'container') {
      const visible = evaluateConditions(block.conditions ?? [], block.conditionLogic ?? 'AND', values);
      if (visible) missing.push(...validatePage(block.blocks ?? [], values, files));
    } else if (block.required && !['header', 'text'].includes(block.type)) {
      if (block.type === 'file_upload') {
        if (!files[block.id]) missing.push(block.id);
      } else if (!values[block.id]?.trim()) {
        missing.push(block.id);
      }
    }
  }
  return missing;
}

// ── Summary helpers ──────────────────────────────────────────────────────────

type SummaryItem =
  | { kind: 'section'; label: string }
  | { kind: 'field'; id: string; label: string; value: string | null; fileName: string | null; required: boolean; isFile: boolean };

function collectSummaryItems(
  blocks: FormBlock[],
  values: Record<string, string>,
  files: Record<string, File | null>
): SummaryItem[] {
  const items: SummaryItem[] = [];
  for (const block of blocks) {
    if (block.type === 'header' || block.type === 'text') continue;
    if (block.type === 'container') {
      const visible = evaluateConditions(block.conditions ?? [], block.conditionLogic ?? 'AND', values);
      if (visible) {
        if (block.label) items.push({ kind: 'section', label: block.label });
        items.push(...collectSummaryItems(block.blocks ?? [], values, files));
      }
      continue;
    }
    const isFile = block.type === 'file_upload';
    items.push({
      kind: 'field',
      id: block.id,
      label: block.label || block.id,
      value: !isFile ? (values[block.id] || null) : null,
      fileName: isFile ? (files[block.id]?.name ?? null) : null,
      required: block.required,
      isFile,
    });
  }
  return items;
}

// ── AnimatedContainer ────────────────────────────────────────────────────────

function AnimatedContainer({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-in-out ${
        visible ? 'max-h-500 opacity-100' : 'max-h-0 opacity-0 mt-0!'
      }`}
    >
      <div className={`transition-transform duration-300 ${visible ? 'translate-y-0' : '-translate-y-2'}`}>
        {children}
      </div>
    </div>
  );
}

// ── FileUploadField ──────────────────────────────────────────────────────────

function FileUploadField({
  file, onChange, hasError,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
  hasError?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  if (file) {
    return (
      <div className={`border rounded-lg px-4 py-3 flex items-center gap-3 bg-slate-50 ${hasError ? 'border-red-300' : 'border-slate-200'}`}>
        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <Paperclip size={15} className="text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
          <p className="text-xs text-slate-400">{formatSize(file.size)}</p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
        >
          Modifier
        </button>
        <button
          type="button"
          onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ''; }}
          className="p-1 hover:bg-red-50 rounded transition-colors"
        >
          <X size={14} className="text-slate-400 hover:text-red-400" />
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </div>
    );
  }

  return (
    <label className={`border-2 border-dashed rounded-lg p-6 text-center hover:border-blue-300 transition-colors cursor-pointer block ${
      hasError ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
    }`}>
      <p className="text-sm text-slate-400">Cliquez ou déposez un fichier ici</p>
      <input
        type="file"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

// ── FieldInput ───────────────────────────────────────────────────────────────

function FieldInput({
  block, value, onChange, fileValue = null, onFileChange, hasError,
}: {
  block: FormBlock;
  value: string;
  onChange: (v: string) => void;
  fileValue?: File | null;
  onFileChange?: (f: File | null) => void;
  hasError?: boolean;
}) {
  const base = `w-full border rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:border-transparent bg-white ${
    hasError ? 'border-red-400 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500'
  }`;

  if (block.type === 'header') {
    return <h2 className="text-lg font-bold text-slate-800 pt-2">{block.label || 'Titre de section'}</h2>;
  }
  if (block.type === 'text') {
    return <p className="text-sm text-slate-500 italic">{block.label || "Texte d'explication"}</p>;
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">
        {block.label || 'Question'}
        {block.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {block.type === 'short_answer' && (
        <input type="text" placeholder="Votre réponse" value={value} onChange={(e) => onChange(e.target.value)} className={base} />
      )}
      {block.type === 'long_answer' && (
        <textarea rows={4} placeholder="Votre réponse" value={value} onChange={(e) => onChange(e.target.value)} className={`${base} resize-none`} />
      )}
      {block.type === 'number' && (
        <input type="number" placeholder="0" value={value} onChange={(e) => onChange(e.target.value)} className={`${base} w-40`} />
      )}
      {block.type === 'email' && (
        <input type="email" placeholder="exemple@email.fr" value={value} onChange={(e) => onChange(e.target.value)} className={base} />
      )}
      {block.type === 'phone' && (
        <input type="tel" placeholder="06 XX XX XX XX" value={value} onChange={(e) => onChange(e.target.value)} className={`${base} w-52`} />
      )}
      {block.type === 'date' && (
        <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={`${base} w-48`} />
      )}
      {block.type === 'multiple_choice' && (
        <div className="space-y-2">
          {(block.options?.length ? block.options : ['Option 1', 'Option 2', 'Option 3']).map((opt, i) => (
            <label key={i} className="flex items-center gap-2.5 cursor-pointer">
              <input type="radio" name={block.id} checked={value === opt} onChange={() => onChange(opt)} className="accent-blue-600" />
              <span className="text-sm text-slate-700">{opt}</span>
            </label>
          ))}
        </div>
      )}
      {block.type === 'dropdown' && (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">Sélectionner…</option>
          {(block.options?.length ? block.options : ['Option 1', 'Option 2', 'Option 3']).map((opt, i) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
      )}
      {block.type === 'multiselect' && (
        <div className="space-y-2">
          {(block.options?.length ? block.options : ['Option 1', 'Option 2', 'Option 3']).map((opt, i) => (
            <label key={i} className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" className="accent-blue-600 w-4 h-4 rounded" />
              <span className="text-sm text-slate-700">{opt}</span>
            </label>
          ))}
        </div>
      )}
      {block.type === 'file_upload' && (
        <FileUploadField file={fileValue} onChange={onFileChange ?? (() => {})} hasError={hasError} />
      )}
      {block.type === 'eligibility' && (
        <div className="flex gap-3">
          <label className={`flex-1 border rounded-lg py-2.5 flex items-center justify-center gap-2 cursor-pointer transition-colors ${
            value === 'Oui' ? 'border-emerald-400 bg-emerald-50' : hasError ? 'border-red-300' : 'border-emerald-200 hover:bg-emerald-50'
          }`}>
            <input type="radio" name={block.id} checked={value === 'Oui'} onChange={() => onChange('Oui')} className="accent-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">Oui</span>
          </label>
          <label className={`flex-1 border rounded-lg py-2.5 flex items-center justify-center gap-2 cursor-pointer transition-colors ${
            value === 'Non' ? 'border-red-400 bg-red-50' : hasError ? 'border-red-300' : 'border-red-200 hover:bg-red-50'
          }`}>
            <input type="radio" name={block.id} checked={value === 'Non'} onChange={() => onChange('Non')} className="accent-red-600" />
            <span className="text-sm font-medium text-red-700">Non</span>
          </label>
        </div>
      )}

      {hasError && (
        <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
          <AlertCircle size={11} /> Ce champ est obligatoire
        </p>
      )}
    </div>
  );
}

// ── renderItem ───────────────────────────────────────────────────────────────

function renderItem(
  block: FormBlock,
  values: Record<string, string>,
  onChange: (id: string, v: string) => void,
  files: Record<string, File | null>,
  onFileChange: (id: string, f: File | null) => void,
  fieldErrors: Set<string>,
): React.ReactNode {
  if (block.type === 'container') {
    const visible = evaluateConditions(block.conditions ?? [], block.conditionLogic ?? 'AND', values);
    return (
      <AnimatedContainer key={block.id} visible={visible}>
        <div className="rounded-xl border border-blue-100 bg-blue-50/20 px-6 py-5 space-y-5">
          {block.label && (
            <h3 className="text-sm font-semibold text-slate-700 pb-2 border-b border-blue-100">
              {block.label}
            </h3>
          )}
          {(block.blocks ?? []).map((inner) => renderItem(inner, values, onChange, files, onFileChange, fieldErrors))}
        </div>
      </AnimatedContainer>
    );
  }
  return (
    <FieldInput
      key={block.id}
      block={block}
      value={values[block.id] ?? ''}
      onChange={(v) => onChange(block.id, v)}
      fileValue={files[block.id] ?? null}
      onFileChange={(f) => onFileChange(block.id, f)}
      hasError={fieldErrors.has(block.id)}
    />
  );
}

// ── SummaryPage ──────────────────────────────────────────────────────────────

function SummaryPage({
  pages, values, files, onGoToPage,
}: {
  pages: FormPage[];
  values: Record<string, string>;
  files: Record<string, File | null>;
  onGoToPage: (idx: number) => void;
}) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
          <ClipboardCheck size={16} className="text-blue-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">Récapitulatif</h2>
          <p className="text-xs text-slate-500">Vérifiez vos informations avant de soumettre</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {pages.map((page, pageIdx) => {
          const items = collectSummaryItems(page.blocks, values, files);
          if (items.length === 0) return null;
          const hasMissing = items.some(
            (it) => it.kind === 'field' && it.required && !it.value && !it.fileName
          );
          return (
            <div key={page.id} className={`border rounded-xl overflow-hidden ${hasMissing ? 'border-amber-300' : 'border-slate-200'}`}>
              {/* Section header */}
              <div className={`flex items-center justify-between px-4 py-2.5 border-b ${hasMissing ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center gap-2">
                  {hasMissing
                    ? <AlertCircle size={13} className="text-amber-500" />
                    : <Check size={13} className="text-emerald-500" />}
                  <p className="text-xs font-semibold text-slate-700">
                    {page.title || `Étape ${pageIdx + 1}`}
                  </p>
                </div>
                <button
                  onClick={() => onGoToPage(pageIdx)}
                  className="text-xs text-blue-500 hover:text-blue-700 hover:underline font-medium transition-colors"
                >
                  Modifier
                </button>
              </div>

              {/* Fields */}
              <div className="divide-y divide-slate-50">
                {items.map((item, i) => {
                  if (item.kind === 'section') {
                    return (
                      <div key={i} className="px-4 py-1.5 bg-slate-50/50">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{item.label}</p>
                      </div>
                    );
                  }
                  const isEmpty = !item.value && !item.fileName;
                  const isMissing = isEmpty && item.required;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 px-4 py-2.5 ${isMissing ? 'bg-amber-50/60' : ''}`}
                    >
                      <span
                        className="text-xs text-slate-400 w-36 shrink-0 pt-0.5 truncate"
                        title={item.label}
                      >
                        {item.label}
                        {item.required && <span className="text-red-400 ml-0.5">*</span>}
                      </span>
                      <div className="flex-1">
                        {item.isFile ? (
                          item.fileName ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                              <Paperclip size={10} className="text-slate-500" />
                              {item.fileName}
                            </span>
                          ) : (
                            <span className={`text-xs font-medium flex items-center gap-1 ${isMissing ? 'text-amber-600' : 'text-slate-400 italic'}`}>
                              {isMissing && <AlertCircle size={11} />}
                              {isMissing ? 'Fichier requis' : 'Aucun fichier'}
                            </span>
                          )
                        ) : (
                          item.value ? (
                            <span className="text-xs text-slate-800 wrap-break-word">{item.value}</span>
                          ) : (
                            <span className={`text-xs font-medium flex items-center gap-1 ${isMissing ? 'text-amber-600' : 'text-slate-400 italic'}`}>
                              {isMissing && <AlertCircle size={11} />}
                              {isMissing ? 'Champ requis — non renseigné' : 'Non renseigné'}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── EmbedSnippet ─────────────────────────────────────────────────────────────

function EmbedSnippet({ workflowId }: { workflowId: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/forms/${workflowId}`;
  const snippet = `<iframe\n  src="${url}"\n  width="100%"\n  height="700"\n  frameborder="0"\n  style="border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08)"\n></iframe>`;

  const copy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-8 border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Code2 size={14} className="text-slate-500" />
          <span className="text-xs font-semibold text-slate-600">Code d'intégration</span>
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 transition-colors"
        >
          {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
          {copied ? 'Copié !' : 'Copier'}
        </button>
      </div>
      <pre className="px-4 py-3 text-xs text-slate-600 bg-white overflow-x-auto font-mono leading-relaxed">
        {snippet}
      </pre>
    </div>
  );
}

// ── FormPreview ───────────────────────────────────────────────────────────────

export function FormPreview() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submitRef, setSubmitRef] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [slideDir, setSlideDir] = useState<'forward' | 'backward' | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set());

  const { data: workflow, loading, error } = useApi(
    () => api.getWorkflow(workflowId!),
    [workflowId]
  );

  const handleChange = (id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
    // Clear error on change
    setFieldErrors((prev) => { const s = new Set(prev); s.delete(id); return s; });
  };

  const handleFileChange = (id: string, f: File | null) => {
    setFiles((prev) => ({ ...prev, [id]: f }));
    setFieldErrors((prev) => { const s = new Set(prev); s.delete(id); return s; });
  };

  const handleSubmit = async () => {
    setSubmitStatus('submitting');
    setSubmitError('');
    try {
      const formData = new FormData();
      formData.append('workflow_id', workflowId!);
      formData.append('reponses', JSON.stringify(values));
      for (const [fieldId, file] of Object.entries(files)) {
        if (file) formData.append(fieldId, file);
      }
      const result = await api.submitDossier(formData);
      setSubmitRef(result.reference);
      setSubmitStatus('success');
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Erreur lors de la soumission');
      setSubmitStatus('error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner label="Chargement du formulaire…" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Formulaire introuvable.</p>
      </div>
    );
  }

  const pages = workflow.formulaire_demande ?? [];
  const totalPages = pages.length;
  const isSummaryPage = currentPage === totalPages;
  const pageBlocks: FormBlock[] = !isSummaryPage ? (pages[currentPage]?.blocks ?? []) : [];

  const allEmpty = pages.every((p) => p.blocks.length === 0);
  if (allEmpty) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 font-medium">Ce formulaire est vide.</p>
          <p className="text-sm text-slate-400 mt-1">Ajoutez des champs dans le builder pour les voir ici.</p>
        </div>
      </div>
    );
  }

  if (submitStatus === 'success') {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50/30 py-10 px-4 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-10 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Dossier soumis !</h2>
          <p className="text-sm text-slate-500 mb-4">
            Votre demande a bien été enregistrée. Conservez votre référence de dossier.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 font-mono text-base font-semibold text-slate-800">
            {submitRef}
          </div>
        </div>
      </div>
    );
  }

  // Validate current page and advance
  const handleNext = () => {
    const missing = validatePage(pageBlocks, values, files);
    if (missing.length > 0) {
      setFieldErrors(new Set(missing));
      // Scroll to first error
      setTimeout(() => {
        document.getElementById(`field-error-${missing[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }
    setFieldErrors(new Set());
    setSlideDir('forward');
    setCurrentPage((p) => p + 1);
  };

  const handlePrev = () => {
    setFieldErrors(new Set());
    setSlideDir('backward');
    setCurrentPage((p) => p - 1);
  };

  const handleGoToPage = (idx: number) => {
    setFieldErrors(new Set());
    setSlideDir('backward');
    setCurrentPage(idx);
  };

  // Check if summary has missing required fields across all pages
  const allMissing = pages.flatMap((p) => validatePage(p.blocks, values, files));
  const summaryHasMissing = allMissing.length > 0;

  const totalSteps = totalPages + 1; // real pages + summary

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50/30 py-10 px-4">
      <style>{`
        @keyframes slideFromRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideFromLeft  { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
        .slide-forward  { animation: slideFromRight 0.32s cubic-bezier(0.4,0,0.2,1); }
        .slide-backward { animation: slideFromLeft  0.32s cubic-bezier(0.4,0,0.2,1); }
      `}</style>

      <div className="max-w-xl mx-auto">

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-6 mb-6">
          <h1 className="text-xl font-bold text-slate-800">{workflow.nom}</h1>
          {workflow.description && (
            <p className="text-sm text-slate-500 mt-1">{workflow.description}</p>
          )}
        </div>

        {/* Progress dots — real pages + summary step */}
        {totalSteps > 1 && (
          <div className="flex items-center justify-center gap-2 mb-5">
            {Array.from({ length: totalSteps }, (_, idx) => (
              <div
                key={idx}
                className={`rounded-full transition-all duration-300 ${
                  idx === currentPage
                    ? 'w-6 h-2 bg-blue-500'
                    : idx < currentPage
                    ? 'w-2 h-2 bg-blue-300'
                    : idx === totalPages
                    ? 'w-2 h-2 bg-slate-300'  // summary not yet reached
                    : 'w-2 h-2 bg-slate-200'
                }`}
              />
            ))}
          </div>
        )}

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-6 overflow-hidden">

          {/* Page title (not on summary) */}
          {!isSummaryPage && totalPages > 1 && pages[currentPage]?.title && (
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-5">
              {pages[currentPage].title}
            </p>
          )}

          {/* Animated content */}
          <div
            key={currentPage}
            className={slideDir === 'forward' ? 'slide-forward' : slideDir === 'backward' ? 'slide-backward' : ''}
          >
            {isSummaryPage ? (
              <SummaryPage
                pages={pages}
                values={values}
                files={files}
                onGoToPage={handleGoToPage}
              />
            ) : (
              <div className="space-y-5">
                {pageBlocks.map((block) =>
                  renderItem(block, values, handleChange, files, handleFileChange, fieldErrors)
                )}
              </div>
            )}
          </div>

          {submitStatus === 'error' && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {submitError}
            </p>
          )}

          {/* Validation error banner */}
          {fieldErrors.size > 0 && !isSummaryPage && (
            <div className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertCircle size={15} className="shrink-0" />
              {fieldErrors.size === 1
                ? 'Un champ obligatoire n\'est pas renseigné.'
                : `${fieldErrors.size} champs obligatoires ne sont pas renseignés.`}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between">
            {currentPage > 0 ? (
              <button
                onClick={handlePrev}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft size={15} />
                Précédent
              </button>
            ) : <div />}

            {isSummaryPage ? (
              <button
                onClick={handleSubmit}
                disabled={submitStatus === 'submitting' || summaryHasMissing}
                title={summaryHasMissing ? 'Des champs obligatoires sont manquants' : undefined}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitStatus === 'submitting' ? 'Envoi en cours…' : 'Soumettre ma demande'}
                {!summaryHasMissing && <Check size={15} />}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                {currentPage === totalPages - 1 ? 'Vérifier & soumettre' : 'Suivant'}
                <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Embed snippet */}
        <EmbedSnippet workflowId={workflowId!} />

        <p className="text-center text-xs text-slate-400 mt-6">Propulsé par Fyles</p>
      </div>
    </div>
  );
}
