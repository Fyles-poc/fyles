import { useState } from 'react';
import {
  Zap, Paperclip, Bot, GitBranch, CheckCircle,
  Plus, Trash2, Settings2, X, ChevronDown, Upload, Files,
  AlignLeft, AlignJustify, Hash, Mail, Phone, Calendar, List,
  ChevronDownSquare, CheckSquare, ShieldAlert,
} from 'lucide-react';
import type { WorkflowNode, FormBlock } from '../lib/api';

// ── Types ───────────────────────────────────────────────────────────────────

type InstructionNodeType = 'trigger' | 'field_extractor' | 'llm_check' | 'condition' | 'set_status';

const NODE_TYPES: { type: InstructionNodeType; label: string; description: string; color: string; icon: React.ElementType }[] = [
  { type: 'field_extractor', label: 'Extracteur de champ', description: 'Récupère une valeur du formulaire de demande', color: 'amber', icon: Paperclip },
  { type: 'llm_check', label: 'Vérification LLM', description: 'Analyse via Claude (texte, images, PDFs)', color: 'blue', icon: Bot },
  { type: 'condition', label: 'Condition / Branche', description: 'Crée deux chemins selon une règle', color: 'violet', icon: GitBranch },
  { type: 'set_status', label: 'Action statut', description: 'Met à jour le statut du dossier', color: 'emerald', icon: CheckCircle },
];

const STATUS_OPTIONS = [
  { value: 'approuve', label: 'Approuvé', color: 'text-emerald-600' },
  { value: 'refuse', label: 'Refusé', color: 'text-red-600' },
  { value: 'signale', label: 'Signalé', color: 'text-orange-600' },
  { value: 'en_attente', label: 'En attente', color: 'text-yellow-600' },
  { value: 'en_cours', label: 'En cours', color: 'text-blue-600' },
];

const OPERATORS = [
  { value: 'equals', label: '= égal à' },
  { value: 'not_equals', label: '≠ différent de' },
  { value: 'greater_than', label: '> supérieur à' },
  { value: 'greater_or_equal', label: '≥ supérieur ou égal à' },
  { value: 'less_than', label: '< inférieur à' },
  { value: 'less_or_equal', label: '≤ inférieur ou égal à' },
  { value: 'contains', label: 'contient' },
];

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
  short_answer: AlignLeft, long_answer: AlignJustify, number: Hash, email: Mail,
  phone: Phone, date: Calendar, multiple_choice: List, dropdown: ChevronDownSquare,
  multiselect: CheckSquare, file_upload: Upload, multifile_upload: Files,
  eligibility: ShieldAlert,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function collectFormFields(blocks: FormBlock[]): FormBlock[] {
  return blocks.flatMap((b) =>
    b.type === 'container' && b.blocks ? collectFormFields(b.blocks) : [b]
  ).filter((b) => !['header', 'text', 'container'].includes(b.type));
}

function collectDeclaredVariables(nodes: WorkflowNode[]): string[] {
  const vars: string[] = [];
  for (const node of nodes) {
    const cfg = node.config as Record<string, unknown> | undefined;
    if (!cfg) continue;
    if (node.type === 'field_extractor' && cfg.variable_name) vars.push(cfg.variable_name as string);
    if (node.type === 'llm_check' && cfg.output_variable) vars.push(cfg.output_variable as string);
  }
  return vars;
}

function defaultConfig(type: InstructionNodeType): Record<string, unknown> {
  switch (type) {
    case 'trigger': return {};
    case 'field_extractor': return { field_id: '', field_label: '', variable_name: '', field_type: '' };
    case 'llm_check': return { model: 'claude-sonnet-4-6', prompt: '', variables: [], output_variable: 'llm_result' };
    case 'condition': return { variable: '', operator: 'greater_than', value: '', true_next: null, false_next: null };
    case 'set_status': return { status: 'approuve', comment: '' };
  }
}

function nodeColorClasses(type: string): { bg: string; border: string; icon: string; badge: string } {
  switch (type) {
    case 'trigger': return { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'bg-violet-100 text-violet-600', badge: 'bg-violet-100 text-violet-700' };
    case 'field_extractor': return { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'bg-amber-100 text-amber-600', badge: 'bg-amber-100 text-amber-700' };
    case 'llm_check': return { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'bg-blue-100 text-blue-600', badge: 'bg-blue-100 text-blue-700' };
    case 'condition': return { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'bg-violet-100 text-violet-600', badge: 'bg-violet-100 text-violet-700' };
    case 'set_status': return { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' };
    default: return { bg: 'bg-slate-50', border: 'border-slate-200', icon: 'bg-slate-100 text-slate-600', badge: 'bg-slate-100 text-slate-700' };
  }
}

function nodeIcon(type: string): React.ElementType {
  switch (type) {
    case 'trigger': return Zap;
    case 'field_extractor': return Paperclip;
    case 'llm_check': return Bot;
    case 'condition': return GitBranch;
    case 'set_status': return CheckCircle;
    default: return Zap;
  }
}

function nodeTypeLabel(type: string): string {
  return NODE_TYPES.find((n) => n.type === type)?.label ?? type;
}

// ── NodeSummary (small text below node title) ───────────────────────────────

function NodeSummary({ node }: { node: WorkflowNode }) {
  const cfg = node.config as Record<string, unknown> | undefined;
  if (!cfg) return null;

  if (node.type === 'field_extractor') {
    const label = (cfg.field_label as string) || (cfg.field_id as string);
    const varName = cfg.variable_name as string;
    if (!label && !varName) return <span className="text-slate-400 text-xs italic">Non configuré</span>;
    return (
      <span className="text-xs text-slate-500">
        {label && <span className="font-medium text-slate-600">"{label}"</span>}
        {varName && <span> → <code className="bg-slate-100 px-1 rounded text-slate-700">{varName}</code></span>}
      </span>
    );
  }

  if (node.type === 'llm_check') {
    const vars = (cfg.variables as string[]) ?? [];
    const outVar = cfg.output_variable as string;
    return (
      <span className="text-xs text-slate-500">
        {vars.length > 0
          ? <span>Variables: <code className="bg-slate-100 px-1 rounded text-slate-700">{vars.join(', ')}</code></span>
          : <span className="italic text-slate-400">Aucune variable</span>}
        {outVar && <span> → <code className="bg-slate-100 px-1 rounded text-slate-700">{outVar}</code></span>}
      </span>
    );
  }

  if (node.type === 'condition') {
    const variable = cfg.variable as string;
    const operator = cfg.operator as string;
    const value = cfg.value as string;
    const op = OPERATORS.find((o) => o.value === operator);
    if (!variable) return <span className="text-slate-400 text-xs italic">Non configuré</span>;
    return (
      <span className="text-xs text-slate-500">
        <code className="bg-slate-100 px-1 rounded text-slate-700">{variable}</code>
        {' '}{op?.label ?? operator}{' '}
        <span className="font-medium text-slate-600">"{value}"</span>
      </span>
    );
  }

  if (node.type === 'set_status') {
    const status = STATUS_OPTIONS.find((s) => s.value === cfg.status);
    return (
      <span className={`text-xs font-medium ${status?.color ?? 'text-slate-500'}`}>
        Statut: {status?.label ?? cfg.status as string}
      </span>
    );
  }

  return null;
}

// ── ConfigModal ──────────────────────────────────────────────────────────────

function ConfigModal({
  node,
  allNodes,
  formFields,
  declaredVars,
  onSave,
  onClose,
}: {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  formFields: FormBlock[];
  declaredVars: string[];
  onSave: (config: Record<string, unknown>, next?: WorkflowNode['next']) => void;
  onClose: () => void;
}) {
  const [cfg, setCfg] = useState<Record<string, unknown>>(
    (node.config as Record<string, unknown>) ?? {}
  );
  const [next, setNext] = useState<WorkflowNode['next']>(node.next ?? null);

  const update = (patch: Record<string, unknown>) => setCfg((prev) => ({ ...prev, ...patch }));

  const otherNodes = allNodes.filter((n) => n.id !== node.id && n.type !== 'trigger');

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(() => { const Icon = nodeIcon(node.type); const colors = nodeColorClasses(node.type); return <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.icon}`}><Icon size={16} /></span>; })()}
              <h3 className="text-base font-semibold text-slate-800">Configurer — {nodeTypeLabel(node.type)}</h3>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* ── TRIGGER ── */}
          {node.type === 'trigger' && (
            <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">
              Ce nœud est automatiquement déclenché lorsqu'un instructeur lance l'analyse d'un dossier.
            </p>
          )}

          {/* ── FIELD EXTRACTOR ── */}
          {node.type === 'field_extractor' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Champ du formulaire de demande</label>
                <select
                  value={cfg.field_id as string ?? ''}
                  onChange={(e) => {
                    const field = formFields.find((f) => f.id === e.target.value);
                    update({
                      field_id: e.target.value,
                      field_label: field?.label ?? '',
                      field_type: field?.type ?? '',
                    });
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Sélectionner un champ…</option>
                  {formFields.map((f) => {
                    const FieldIcon = FIELD_TYPE_ICONS[f.type];
                    return (
                      <option key={f.id} value={f.id}>
                        {f.label || `(${f.type})`} — {f.type}
                      </option>
                    );
                  })}
                </select>
                {cfg.field_type && (
                  <p className="mt-1 text-xs text-slate-400">
                    Type: <span className="font-medium">{cfg.field_type as string}</span>
                    {(cfg.field_type === 'file_upload' || cfg.field_type === 'multifile_upload') && ' (fichier — sera envoyé à Claude si utilisé dans un nœud LLM)'}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nom de la variable</label>
                <input
                  type="text"
                  value={cfg.variable_name as string ?? ''}
                  onChange={(e) => update({ variable_name: e.target.value.replace(/\s/g, '_').toLowerCase() })}
                  placeholder="ex: cni, nom_demandeur, justificatif…"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-slate-400">Cette variable sera réutilisable dans les nœuds LLM et Condition suivants.</p>
              </div>
            </>
          )}

          {/* ── LLM CHECK ── */}
          {node.type === 'llm_check' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Variables à inclure</label>
                {declaredVars.length === 0 ? (
                  <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">Aucune variable déclarée. Ajoutez d'abord des nœuds "Extracteur de champ".</p>
                ) : (
                  <div className="space-y-1.5">
                    {declaredVars.map((v) => {
                      const selected = ((cfg.variables as string[]) ?? []).includes(v);
                      return (
                        <label key={v} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${selected ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {
                              const prev = (cfg.variables as string[]) ?? [];
                              update({ variables: selected ? prev.filter((x) => x !== v) : [...prev, v] });
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <code className="text-sm text-slate-700">{v}</code>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Prompt d'analyse</label>
                <textarea
                  rows={6}
                  value={cfg.prompt as string ?? ''}
                  onChange={(e) => update({ prompt: e.target.value })}
                  placeholder="Ex: Tu es un expert en vérification de documents d'identité. Vérifie l'authenticité de la CNI fournie. Réponds en JSON avec les champs: authentique (boolean), confiance (0-100), coherence_nom (boolean), motif (string)."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="mt-1 text-xs text-slate-400">Le modèle devra répondre en JSON. Précisez les champs attendus dans le prompt.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Variable de sortie</label>
                <input
                  type="text"
                  value={cfg.output_variable as string ?? 'llm_result'}
                  onChange={(e) => update({ output_variable: e.target.value.replace(/\s/g, '_').toLowerCase() })}
                  placeholder="llm_result"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-slate-400">La réponse JSON de Claude sera stockée dans cette variable (ex: <code className="bg-slate-100 px-1 rounded">llm_result.confiance</code>).</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Modèle</label>
                <select
                  value={cfg.model as string ?? 'claude-sonnet-4-6'}
                  onChange={(e) => update({ model: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                  <option value="claude-opus-4-6">Claude Opus 4.6</option>
                  <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                </select>
              </div>
            </>
          )}

          {/* ── CONDITION ── */}
          {node.type === 'condition' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Variable à évaluer</label>
                <input
                  type="text"
                  value={cfg.variable as string ?? ''}
                  onChange={(e) => update({ variable: e.target.value })}
                  placeholder="ex: llm_result.confiance ou nom_demandeur"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {declaredVars.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {declaredVars.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => update({ variable: v })}
                        className="text-xs bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 px-2 py-0.5 rounded font-mono transition-colors"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Opérateur</label>
                  <select
                    value={cfg.operator as string ?? 'equals'}
                    onChange={(e) => update({ operator: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Valeur</label>
                  <input
                    type="text"
                    value={cfg.value as string ?? ''}
                    onChange={(e) => update({ value: e.target.value })}
                    placeholder="ex: 80"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-emerald-700 mb-1.5">→ Si vrai (Oui)</label>
                  <select
                    value={(cfg.true_next as string) ?? ''}
                    onChange={(e) => update({ true_next: e.target.value || null })}
                    className="w-full border border-emerald-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="">Fin du pipeline</option>
                    {otherNodes.map((n) => (
                      <option key={n.id} value={n.id}>{n.label || nodeTypeLabel(n.type)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-red-700 mb-1.5">→ Si faux (Non)</label>
                  <select
                    value={(cfg.false_next as string) ?? ''}
                    onChange={(e) => update({ false_next: e.target.value || null })}
                    className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                  >
                    <option value="">Fin du pipeline</option>
                    {otherNodes.map((n) => (
                      <option key={n.id} value={n.id}>{n.label || nodeTypeLabel(n.type)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* ── SET STATUS ── */}
          {node.type === 'set_status' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nouveau statut du dossier</label>
                <div className="space-y-2">
                  {STATUS_OPTIONS.map((s) => (
                    <label key={s.value} className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${cfg.status === s.value ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                      <input
                        type="radio"
                        name="status"
                        value={s.value}
                        checked={cfg.status === s.value}
                        onChange={() => update({ status: s.value })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className={`text-sm font-medium ${s.color}`}>{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Commentaire (optionnel)</label>
                <textarea
                  rows={3}
                  value={cfg.comment as string ?? ''}
                  onChange={(e) => update({ comment: e.target.value })}
                  placeholder="Ex: Dossier approuvé suite à vérification automatique de la CNI."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </>
          )}

          {/* Next node selector (for non-condition/set_status nodes) */}
          {node.type !== 'trigger' && node.type !== 'condition' && node.type !== 'set_status' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nœud suivant</label>
              <select
                value={(next as string) ?? ''}
                onChange={(e) => setNext(e.target.value || null)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Fin du pipeline</option>
                {otherNodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.label || nodeTypeLabel(n.type)}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 flex justify-end gap-2 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
            Annuler
          </button>
          <button
            onClick={() => {
              // For condition, build next as {true, false}
              let finalNext: WorkflowNode['next'] = next ?? null;
              if (node.type === 'condition') {
                finalNext = { true: (cfg.true_next as string) ?? null, false: (cfg.false_next as string) ?? null } as unknown as WorkflowNode['next'];
              }
              onSave(cfg, finalNext);
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AddNodePicker ────────────────────────────────────────────────────────────

function AddNodePicker({ onAdd, onClose }: { onAdd: (type: InstructionNodeType) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-96 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Ajouter un nœud</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
        </div>
        <div className="p-3">
          {NODE_TYPES.map(({ type, label, description, icon: Icon, color }) => (
            <button
              key={type}
              onClick={() => { onAdd(type); onClose(); }}
              className="w-full flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
            >
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-${color}-100 text-${color}-600`}>
                <Icon size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">{label}</p>
                <p className="text-xs text-slate-500">{description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── NodeCard ─────────────────────────────────────────────────────────────────

function NodeCard({
  node,
  canDelete,
  onConfigure,
  onDelete,
  onLabelChange,
}: {
  node: WorkflowNode;
  canDelete: boolean;
  onConfigure: () => void;
  onDelete: () => void;
  onLabelChange: (v: string) => void;
}) {
  const colors = nodeColorClasses(node.type);
  const Icon = nodeIcon(node.type);

  return (
    <div className={`border rounded-xl p-4 ${colors.bg} ${colors.border}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colors.icon}`}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
              {nodeTypeLabel(node.type)}
            </span>
          </div>
          {node.type === 'trigger' ? (
            <p className="text-sm font-medium text-slate-700">Nouveau dossier soumis</p>
          ) : (
            <input
              type="text"
              value={node.label}
              onChange={(e) => onLabelChange(e.target.value)}
              placeholder="Nom du nœud…"
              className="text-sm font-medium text-slate-700 bg-transparent border-0 border-b border-dashed border-slate-300 focus:outline-none focus:border-blue-400 w-full pb-0.5"
            />
          )}
          <div className="mt-1">
            <NodeSummary node={node} />
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {node.type !== 'trigger' && (
            <button
              onClick={onConfigure}
              className="p-1.5 hover:bg-white/60 rounded-lg transition-colors"
              title="Configurer"
            >
              <Settings2 size={14} className="text-slate-500" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
              title="Supprimer"
            >
              <Trash2 size={14} className="text-red-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Arrow ────────────────────────────────────────────────────────────────────

function Arrow() {
  return (
    <div className="flex justify-center py-1">
      <div className="flex flex-col items-center gap-0">
        <div className="w-px h-5 bg-slate-300" />
        <ChevronDown size={14} className="text-slate-400 -mt-1" />
      </div>
    </div>
  );
}

// ── InstructionWorkflowBuilder ───────────────────────────────────────────────

export function InstructionWorkflowBuilder({
  nodes,
  setNodes,
  demandeBlocks,
}: {
  nodes: WorkflowNode[];
  setNodes: (nodes: WorkflowNode[]) => void;
  demandeBlocks: FormBlock[];
}) {
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [showAddPicker, setShowAddPicker] = useState(false);

  const formFields = collectFormFields(demandeBlocks);

  const addNode = (type: InstructionNodeType) => {
    const newNode: WorkflowNode = {
      id: `node_${crypto.randomUUID()}`,
      type,
      label: nodeTypeLabel(type),
      config: defaultConfig(type),
      next: null,
    };
    // Auto-link last non-terminal node to new one
    const updatedNodes = [...nodes];
    if (updatedNodes.length > 0) {
      const last = updatedNodes[updatedNodes.length - 1];
      if (last.type !== 'set_status' && last.type !== 'condition') {
        updatedNodes[updatedNodes.length - 1] = { ...last, next: newNode.id };
      }
    }
    setNodes([...updatedNodes, newNode]);
  };

  const deleteNode = (id: string) => {
    const filtered = nodes.filter((n) => n.id !== id);
    // Clean up broken next references
    const cleaned = filtered.map((n) => {
      if (n.next === id) return { ...n, next: null };
      if (typeof n.next === 'object' && n.next !== null) {
        const br = n.next as { true: string; false: string };
        return {
          ...n,
          next: {
            true: br.true === id ? null : br.true,
            false: br.false === id ? null : br.false,
          } as unknown as WorkflowNode['next'],
        };
      }
      return n;
    });
    setNodes(cleaned);
  };

  const updateNode = (id: string, config: Record<string, unknown>, next?: WorkflowNode['next']) => {
    setNodes(nodes.map((n) => n.id === id ? { ...n, config, next: next !== undefined ? next : n.next } : n));
  };

  const updateLabel = (id: string, label: string) => {
    setNodes(nodes.map((n) => n.id === id ? { ...n, label } : n));
  };

  const configuringNode = nodes.find((n) => n.id === configuringId) ?? null;
  const declaredVars = collectDeclaredVariables(nodes);

  // Ensure trigger node always exists
  const displayNodes = nodes.length === 0 || nodes[0]?.type !== 'trigger'
    ? [{ id: 'trigger_0', type: 'trigger', label: 'Déclencheur', config: {}, next: nodes[0]?.id ?? null }, ...nodes]
    : nodes;

  return (
    <div className="flex h-full">
      {/* Canvas */}
      <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
        <div className="max-w-lg mx-auto">
          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <Bot size={18} className="text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Pipeline d'automatisation</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Les nœuds s'exécutent de haut en bas. Configurez chaque étape puis sauvegardez le workflow.
                L'analyse peut être lancée manuellement depuis la vue dossier.
              </p>
            </div>
          </div>

          {/* Nodes */}
          {displayNodes.map((node, i) => (
            <div key={node.id}>
              <NodeCard
                node={node}
                canDelete={node.type !== 'trigger'}
                onConfigure={() => setConfiguringId(node.id)}
                onDelete={() => deleteNode(node.id)}
                onLabelChange={(v) => updateLabel(node.id, v)}
              />
              {/* Show "configure" hint for non-trigger nodes with empty config */}
              {node.type !== 'trigger' && !configuringId && i === displayNodes.length - 1 && (
                <div className="mt-2 flex justify-center">
                  <button
                    onClick={() => setConfiguringId(node.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                  >
                    <Settings2 size={11} />
                    Configurer ce nœud
                  </button>
                </div>
              )}
              {i < displayNodes.length - 1 && <Arrow />}
            </div>
          ))}

          {/* Branch visualization for condition nodes */}
          {displayNodes.some((n) => n.type === 'condition') && (
            <div className="mt-3 bg-violet-50 border border-violet-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-violet-700 mb-2">Branchements de conditions</p>
              {displayNodes.filter((n) => n.type === 'condition').map((cond) => {
                const nextCfg = cond.next as { true?: string; false?: string } | null;
                const trueNode = displayNodes.find((n) => n.id === nextCfg?.true);
                const falseNode = displayNodes.find((n) => n.id === nextCfg?.false);
                return (
                  <div key={cond.id} className="text-xs text-slate-600">
                    <span className="font-medium">{cond.label}</span>
                    <div className="flex gap-4 mt-1 ml-3">
                      <span className="text-emerald-600">✓ Oui → {trueNode?.label ?? 'Fin'}</span>
                      <span className="text-red-600">✗ Non → {falseNode?.label ?? 'Fin'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add node button */}
          <div className="mt-4">
            <Arrow />
            <button
              onClick={() => setShowAddPicker(true)}
              className="flex items-center gap-2 text-sm text-blue-600 font-medium hover:text-blue-700 px-4 py-2.5 border-2 border-dashed border-blue-200 rounded-xl w-full justify-center hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              <Plus size={16} />
              Ajouter un nœud
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar: variables */}
      <div className="w-56 shrink-0 border-l border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Variables déclarées</p>
        {declaredVars.length === 0 ? (
          <p className="text-xs text-slate-400">Aucune variable. Ajoutez des nœuds extracteurs ou LLM.</p>
        ) : (
          <div className="space-y-1.5">
            {declaredVars.map((v) => (
              <div key={v} className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                <code className="text-xs text-slate-700 truncate">{v}</code>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-5 mb-3">Nœuds ({displayNodes.length})</p>
        <div className="space-y-1">
          {displayNodes.map((n, i) => {
            const Icon = nodeIcon(n.type);
            const colors = nodeColorClasses(n.type);
            return (
              <div key={n.id} className="flex items-center gap-2 text-xs text-slate-600 py-1">
                <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${colors.icon}`}>
                  <Icon size={11} />
                </span>
                <span className="truncate">{n.label || nodeTypeLabel(n.type)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add node picker modal */}
      {showAddPicker && (
        <AddNodePicker onAdd={addNode} onClose={() => setShowAddPicker(false)} />
      )}

      {/* Config modal */}
      {configuringNode && (
        <ConfigModal
          node={configuringNode}
          allNodes={displayNodes}
          formFields={formFields}
          declaredVars={declaredVars}
          onSave={(config, next) => updateNode(configuringNode.id, config, next)}
          onClose={() => setConfiguringId(null)}
        />
      )}
    </div>
  );
}
