import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Copy, Check, Code2, Paperclip, X } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import type { FormPage } from '../lib/api';

// ── FileUploadField ─────────────────────────────────────────────────────────

function FileUploadField() {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  if (file) {
    return (
      <div className="border border-slate-200 rounded-lg px-4 py-3 flex items-center gap-3 bg-slate-50">
        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <Paperclip size={15} className="text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
          <p className="text-xs text-slate-400">{formatSize(file.size)}</p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
        >
          Modifier
        </button>
        <button
          onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ''; }}
          className="p-1 hover:bg-red-50 rounded transition-colors"
        >
          <X size={14} className="text-slate-400 hover:text-red-400" />
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
    );
  }

  return (
    <label className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-blue-300 transition-colors cursor-pointer block">
      <p className="text-sm text-slate-400">Cliquez ou déposez un fichier ici</p>
      <input
        type="file"
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

// ── Field renderer ──────────────────────────────────────────────────────────

function FieldInput({ block }: { block: FormPage['blocks'][number] }) {
  const base = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white';

  if (block.type === 'header') {
    return <h2 className="text-lg font-bold text-slate-800 pt-2">{block.label || 'Titre de section'}</h2>;
  }
  if (block.type === 'text') {
    return <p className="text-sm text-slate-500 italic">{block.label || 'Texte d\'explication'}</p>;
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">
        {block.label || 'Question'}
        {block.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {block.type === 'short_answer' && (
        <input type="text" placeholder="Votre réponse" className={base} />
      )}
      {block.type === 'long_answer' && (
        <textarea rows={4} placeholder="Votre réponse" className={`${base} resize-none`} />
      )}
      {block.type === 'number' && (
        <input type="number" placeholder="0" className={`${base} w-40`} />
      )}
      {block.type === 'email' && (
        <input type="email" placeholder="exemple@email.fr" className={base} />
      )}
      {block.type === 'phone' && (
        <input type="tel" placeholder="06 XX XX XX XX" className={`${base} w-52`} />
      )}
      {block.type === 'date' && (
        <input type="date" className={`${base} w-48`} />
      )}
      {block.type === 'multiple_choice' && (
        <div className="space-y-2">
          {(block.options?.length ? block.options : ['Option 1', 'Option 2', 'Option 3']).map((opt, i) => (
            <label key={i} className="flex items-center gap-2.5 cursor-pointer">
              <input type="radio" name={block.id} className="accent-blue-600" />
              <span className="text-sm text-slate-700">{opt}</span>
            </label>
          ))}
        </div>
      )}
      {block.type === 'dropdown' && (
        <select className={base}>
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
      {block.type === 'file_upload' && <FileUploadField />}
      {block.type === 'multifile_upload' && (
        <label className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-blue-300 transition-colors cursor-pointer block">
          <p className="text-sm text-slate-400">Cliquez ou déposez des fichiers ici</p>
          <input type="file" multiple className="hidden" />
        </label>
      )}
      {block.type === 'eligibility' && (
        <div className="flex gap-3">
          <label className="flex-1 border border-emerald-200 rounded-lg py-2.5 flex items-center justify-center gap-2 cursor-pointer hover:bg-emerald-50 transition-colors">
            <input type="radio" name={block.id} className="accent-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">Oui</span>
          </label>
          <label className="flex-1 border border-red-200 rounded-lg py-2.5 flex items-center justify-center gap-2 cursor-pointer hover:bg-red-50 transition-colors">
            <input type="radio" name={block.id} className="accent-red-600" />
            <span className="text-sm font-medium text-red-700">Non</span>
          </label>
        </div>
      )}
    </div>
  );
}

// ── EmbedSnippet ────────────────────────────────────────────────────────────

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

// ── FormPreview ─────────────────────────────────────────────────────────────

export function FormPreview() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const [currentPage, setCurrentPage] = useState(0);

  const { data: workflow, loading, error } = useApi(
    () => api.getWorkflow(workflowId!),
    [workflowId]
  );

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

  const pages: FormPage[] = workflow.formulaire_demande ?? [];

  if (pages.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 font-medium">Ce formulaire est vide.</p>
          <p className="text-sm text-slate-400 mt-1">Ajoutez des champs dans le builder pour les voir ici.</p>
        </div>
      </div>
    );
  }

  const page = pages[currentPage];
  const isFirst = currentPage === 0;
  const isLast = currentPage === pages.length - 1;

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50/30 py-10 px-4">
      <div className="max-w-xl mx-auto">

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-6 mb-4">
          <h1 className="text-xl font-bold text-slate-800">{workflow.nom}</h1>
          {workflow.description && (
            <p className="text-sm text-slate-500 mt-1">{workflow.description}</p>
          )}
          {pages.length > 1 && (
            <div className="mt-4 flex items-center gap-2">
              {pages.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === currentPage ? 'bg-blue-600 flex-1' : 'bg-slate-200 w-6'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Page card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-6">
          {pages.length > 1 && (
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-4">
              {page.title}
            </p>
          )}

          <div className="space-y-5">
            {page.blocks.map((block) => (
              <FieldInput key={block.id} block={block} />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-100">
            <button
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={isFirst}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
              Précédent
            </button>

            {isLast ? (
              <button className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Soumettre
              </button>
            ) : (
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Suivant
                <ChevronRight size={16} />
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
