import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp,
  FileText, CheckSquare, GitBranch, Cpu, Save, AlertCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { LoadingSpinner, ErrorMessage } from '../components/ui/LoadingSpinner';
import type { Workflow, WorkflowDocument, WorkflowValidation } from '../lib/api';

type TabId = 'documents' | 'arbre' | 'ia';

function ValidationRow({ v, onDelete }: { v: WorkflowValidation; onDelete: () => void }) {
  const typeLabels: Record<string, string> = {
    required_fields: 'Champs requis',
    doc_type: 'Type de document',
    crosscheck: 'Vérification croisée',
    llm_check: 'Analyse IA',
  };
  return (
    <div className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-lg">
      <CheckSquare size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-slate-800">{v.label}</span>
          <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
            {typeLabels[v.type] ?? v.type}
          </span>
        </div>
        {v.prompt && <p className="text-xs text-slate-500 leading-relaxed">{v.prompt}</p>}
      </div>
      <button onClick={onDelete} className="p-1 hover:bg-red-50 rounded transition-colors flex-shrink-0">
        <Trash2 size={12} className="text-slate-300 hover:text-red-400" />
      </button>
    </div>
  );
}

function DocumentCard({ doc, expanded, onToggle }: {
  doc: WorkflowDocument; expanded: boolean; onToggle: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <FileText size={14} className="text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-800">{doc.nom}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              doc.statut === 'OBLIGATOIRE' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
            }`}>
              {doc.statut === 'OBLIGATOIRE' ? 'Obligatoire' : 'Optionnel'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{doc.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{doc.validations.length} règle(s)</span>
          <button onClick={onToggle} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Règles de validation</p>
          {doc.validations.map((v) => (
            <ValidationRow key={v.id} v={v} onDelete={() => {}} />
          ))}
          <button className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 mt-2 font-medium">
            <Plus size={12} />Ajouter une règle
          </button>
        </div>
      )}
    </div>
  );
}

function TreeView({ workflow }: { workflow: Workflow }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nœuds du workflow</p>
      <div className="relative">
        {workflow.nodes.map((node, index) => {
          const nodeColor: Record<string, string> = {
            document_check: 'bg-blue-100 border-blue-200 text-blue-700',
            identity_match: 'bg-purple-100 border-purple-200 text-purple-700',
            condition: 'bg-amber-100 border-amber-200 text-amber-700',
            decision: 'bg-emerald-100 border-emerald-200 text-emerald-700',
          };
          const color = nodeColor[node.type] ?? 'bg-slate-100 border-slate-200 text-slate-700';
          const isArrayNext = Array.isArray(node.next);

          return (
            <div key={node.id} className="flex flex-col items-start mb-2">
              <div className={`border rounded-xl px-4 py-3 text-sm font-medium ${color} flex items-center gap-2`}>
                {node.type === 'document_check' && <FileText size={14} />}
                {node.type === 'identity_match' && <CheckSquare size={14} />}
                {node.type === 'condition' && <GitBranch size={14} />}
                {node.type === 'decision' && <CheckSquare size={14} />}
                {node.label}
              </div>
              {index < workflow.nodes.length - 1 && !isArrayNext && (
                <div className="w-px h-6 bg-slate-300 ml-6 my-1" />
              )}
              {isArrayNext && (
                <div className="ml-6 mt-1 flex gap-6">
                  {(node.next as { condition: string; node: string }[]).map((branch) => {
                    const targetNode = workflow.nodes.find(n => n.id === branch.node);
                    return (
                      <div key={branch.node} className="flex flex-col items-center">
                        <div className="h-5 w-px bg-slate-300" />
                        <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full mb-1">{branch.condition}</span>
                        <div className="h-3 w-px bg-slate-300" />
                        {targetNode && (
                          <div className="border rounded-xl px-4 py-3 text-sm font-medium bg-emerald-100 border-emerald-200 text-emerald-700 flex items-center gap-2">
                            <CheckSquare size={14} />{targetNode.label}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WorkflowDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('documents');
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());

  const { data: workflow, loading, error } = useApi(
    () => api.getWorkflow(id!),
    [id]
  );

  const toggleDoc = (docId: string) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  if (loading) return <div className="p-6"><LoadingSpinner label="Chargement du workflow..." /></div>;
  if (error) return <div className="p-6"><ErrorMessage message={error} /></div>;
  if (!workflow) return null;

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'documents', label: 'Documents & Validations', icon: FileText },
    { id: 'arbre', label: 'Arbre logique du workflow', icon: GitBranch },
    { id: 'ia', label: 'Configuration IA', icon: Cpu },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/workflows')}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft size={16} className="text-slate-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{workflow.nom}</h1>
            <p className="text-sm text-slate-500">{workflow.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full font-medium">{workflow.type}</span>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Save size={14} />Enregistrer
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex border-b border-slate-100">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                <Icon size={14} />{tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {activeTab === 'documents' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500">{workflow.documents.length} document(s) configuré(s)</p>
                <button className="flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:text-blue-700">
                  <Plus size={14} />Ajouter un document
                </button>
              </div>
              {workflow.documents.map((doc) => (
                <DocumentCard key={doc.id} doc={doc}
                  expanded={expandedDocs.has(doc.id)}
                  onToggle={() => toggleDoc(doc.id)} />
              ))}
              {workflow.documents.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">Aucun document configuré.</p>
              )}
            </div>
          )}

          {activeTab === 'arbre' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2">
                <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  L'arbre logique est généré automatiquement à partir des documents et règles configurés.
                </p>
              </div>
              {workflow.nodes.length > 0
                ? <TreeView workflow={workflow} />
                : <p className="text-sm text-slate-400 text-center py-8">Aucun nœud configuré.</p>
              }
            </div>
          )}

          {activeTab === 'ia' && (
            <div className="space-y-5 max-w-lg">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">Modèle IA</label>
                <select defaultValue={workflow.ai_config.model}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (recommandé)</option>
                  <option value="claude-opus-4-6">Claude Opus 4.6 (haute précision)</option>
                  <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (rapide)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Seuil de confiance pour auto-approbation
                  <span className="text-slate-400 font-normal ml-1">(0 – 100 %)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input type="range" min="0" max="100"
                    defaultValue={workflow.ai_config.seuil_confiance_auto}
                    className="flex-1 accent-blue-600" />
                  <span className="text-sm font-bold text-slate-700 w-10 text-right">
                    {workflow.ai_config.seuil_confiance_auto}%
                  </span>
                </div>
                <p className="text-xs text-slate-400">Au-dessus de ce seuil, la décision IA sera appliquée automatiquement.</p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Température
                  <span className="text-slate-400 font-normal ml-1">(0 = déterministe · 1 = créatif)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input type="range" min="0" max="1" step="0.05"
                    defaultValue={workflow.ai_config.temperature}
                    className="flex-1 accent-blue-600" />
                  <span className="text-sm font-bold text-slate-700 w-10 text-right">
                    {workflow.ai_config.temperature}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">Prompt système</label>
                <textarea defaultValue={workflow.ai_config.prompt_systeme}
                  rows={5}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono" />
                <p className="text-xs text-slate-400">Ce prompt sera fourni à l'IA avant chaque analyse de dossier.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
