import React, { useState, useRef } from 'react';
import {
  Zap, Bot, Trash2, Settings2, X, Plus,
  PlusCircle, MinusCircle, Upload, Ban,
} from 'lucide-react';
import type { WorkflowNode, FormBlock } from '../lib/api';
import { uuid } from '../lib/uuid';
import type { LucideIcon } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type OutputType = 'boolean' | 'score' | 'text' | 'classification' | 'structured';

const OUTPUT_TYPES: { value: OutputType; label: string; description: string; emoji: string }[] = [
  { value: 'boolean',        label: 'Oui / Non',      description: 'Décision binaire',    emoji: '✅' },
  { value: 'score',          label: 'Score',           description: 'Valeur 0–100',        emoji: '📊' },
  { value: 'text',           label: 'Texte',           description: 'Réponse libre',        emoji: '💬' },
  { value: 'classification', label: 'Classification',  description: 'Catégories définies', emoji: '🏷️' },
  { value: 'structured',     label: 'Structuré',       description: 'Champs nommés',       emoji: '📋' },
];

interface BreakCondition {
  source_node_id: string;
  operator: string;
  value?: string | number;
}

const OPERATORS: { value: string; label: string; needsValue: boolean; forTypes: OutputType[] }[] = [
  { value: 'is_false',      label: 'est Non (false)',   needsValue: false, forTypes: ['boolean'] },
  { value: 'is_true',       label: 'est Oui (true)',    needsValue: false, forTypes: ['boolean'] },
  { value: 'less_than',     label: 'est inférieur à',   needsValue: true,  forTypes: ['score'] },
  { value: 'greater_than',  label: 'est supérieur à',   needsValue: true,  forTypes: ['score'] },
  { value: 'equals',        label: 'est égal à',        needsValue: true,  forTypes: ['text', 'classification', 'score'] },
  { value: 'not_equals',    label: 'est différent de',  needsValue: true,  forTypes: ['text', 'classification', 'score'] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function collectFormFields(blocks: FormBlock[]): FormBlock[] {
  return blocks
    .flatMap((b) => (b.type === 'container' && b.blocks ? collectFormFields(b.blocks) : [b]))
    .filter((b) => !['header', 'text', 'container'].includes(b.type));
}

function isFileField(type: string) {
  return type === 'file_upload' || type === 'multifile_upload';
}

function nodeColors(type: string) {
  if (type === 'trigger')
    return { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'bg-violet-100 text-violet-600' };
  if (type === 'break')
    return { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'bg-orange-100 text-orange-600' };
  return { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'bg-blue-100 text-blue-600' };
}

function nodeIcon(type: string): LucideIcon {
  if (type === 'trigger') return Zap;
  if (type === 'break') return Ban;
  return Bot;
}

function defaultAnalysisConfig(): Record<string, unknown> {
  return { instruction: '', sources: [], output_type: 'boolean', output_config: {} };
}

function defaultBreakConfig(): Record<string, unknown> {
  return { conditions: [], condition_logic: 'AND' };
}

// ── TypePicker ────────────────────────────────────────────────────────────────

function TypePicker({
  onSelectAnalysis,
  onSelectBreak,
  onClose,
}: {
  onSelectAnalysis: () => void;
  onSelectBreak: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-5 w-76"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-slate-700 mb-4 text-center">Ajouter un nœud</p>
        <div className="flex gap-3">
          <button
            onClick={onSelectAnalysis}
            className="flex-1 flex flex-col items-center gap-2.5 p-4 border-2 border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Bot size={20} className="text-blue-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">Analyse IA</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-snug">Interroge Claude sur les données</p>
            </div>
          </button>
          <button
            onClick={onSelectBreak}
            className="flex-1 flex flex-col items-center gap-2.5 p-4 border-2 border-slate-200 rounded-xl hover:border-orange-300 hover:bg-orange-50 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <Ban size={20} className="text-orange-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">Rupture</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-snug">Arrête selon une condition</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NodeSummary ───────────────────────────────────────────────────────────────

function NodeSummary({
  node,
  formFields,
  allNodes,
}: {
  node: WorkflowNode;
  formFields: FormBlock[];
  allNodes: WorkflowNode[];
}) {
  if (node.type === 'analysis') {
    const cfg = node.config as Record<string, unknown> | undefined;
    if (!cfg) return null;

    const instruction = cfg.instruction as string | undefined;
    const sources = (cfg.sources as string[]) ?? [];
    const outputType = cfg.output_type as OutputType | undefined;
    const outputLabel = OUTPUT_TYPES.find((o) => o.value === outputType)?.label;

    const sourceLabels = sources
      .map((id) => formFields.find((f) => f.id === id)?.label ?? id)
      .slice(0, 3);

    return (
      <div className="space-y-1.5 mt-1">
        {instruction ? (
          <p className="text-xs text-slate-500 line-clamp-2">{instruction}</p>
        ) : (
          <p className="text-xs text-slate-400 italic">Instruction non configurée</p>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          {sourceLabels.map((l) => (
            <span key={l} className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
              {l}
            </span>
          ))}
          {sources.length > 3 && (
            <span className="text-[10px] text-slate-400">+{sources.length - 3}</span>
          )}
          {outputLabel && (
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium ml-auto">
              {outputLabel}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (node.type === 'break') {
    const cfg = node.config as Record<string, unknown> | undefined;
    if (!cfg) return null;
    const conditions = (cfg.conditions as BreakCondition[]) ?? [];
    const logic = (cfg.condition_logic as string) ?? 'AND';

    if (conditions.length === 0) {
      return <p className="text-xs text-slate-400 italic mt-1">Aucune condition configurée</p>;
    }

    return (
      <div className="mt-1 space-y-1">
        {conditions.map((c, i) => {
          const sourceNode = allNodes.find((n) => n.id === c.source_node_id);
          const opLabel = OPERATORS.find((o) => o.value === c.operator)?.label ?? c.operator;
          return (
            <div key={i} className="flex items-center gap-1 flex-wrap">
              {i > 0 && (
                <span className="text-[10px] font-bold text-orange-500">{logic}</span>
              )}
              <span className="text-[10px] text-slate-500 font-medium">
                {sourceNode?.label ?? c.source_node_id}
              </span>
              <span className="text-[10px] bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded font-medium">
                {opLabel}{c.value !== undefined ? ` ${c.value}` : ''}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}

// ── SectionLabel ──────────────────────────────────────────────────────────────

function SectionLabel({ n, label, required, color = 'blue' }: { n: number; label: string; required?: boolean; color?: 'blue' | 'orange' }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={`w-5 h-5 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0 ${color === 'orange' ? 'bg-orange-500' : 'bg-blue-600'}`}>
        {n}
      </span>
      <span className="text-sm font-semibold text-slate-800">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
    </div>
  );
}

// ── ConfigModal (Analysis) ────────────────────────────────────────────────────

function ConfigModal({
  node,
  formFields,
  onSave,
  onClose,
}: {
  node: WorkflowNode;
  formFields: FormBlock[];
  onSave: (label: string, config: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const cfg = (node.config as Record<string, unknown>) ?? {};

  const [name, setName] = useState<string>(node.label ?? '');
  const [instruction, setInstruction] = useState<string>((cfg.instruction as string) ?? '');
  const [sources, setSources] = useState<string[]>((cfg.sources as string[]) ?? []);
  const [outputType, setOutputType] = useState<OutputType>((cfg.output_type as OutputType) ?? 'boolean');
  const [outputConfig, setOutputConfig] = useState<Record<string, unknown>>(
    (cfg.output_config as Record<string, unknown>) ?? {}
  );

  const textFields = formFields.filter((f) => !isFileField(f.type));
  const fileFields = formFields.filter((f) => isFileField(f.type));

  const toggleSource = (id: string) =>
    setSources((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const categories = (outputConfig.categories as string[]) ?? [''];
  const updateCategories = (cats: string[]) => setOutputConfig({ ...outputConfig, categories: cats });

  const structuredFields = (outputConfig.fields as { name: string; description: string }[]) ?? [
    { name: '', description: '' },
  ];
  const updateStructuredFields = (fields: { name: string; description: string }[]) =>
    setOutputConfig({ ...outputConfig, fields });

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave(name.trim(), { instruction, sources, output_type: outputType, output_config: outputConfig });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-155 max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600">
              <Bot size={16} />
            </span>
            <h3 className="text-base font-semibold text-slate-800">Configurer le nœud d'analyse</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto flex-1">
          <section>
            <SectionLabel n={1} label="Nom" required />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Vérification de la CNI, Contrôle d'éligibilité…"
              autoFocus
              className={`w-full border rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !name.trim() ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`}
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Ce nom est visible dans le tableau de bord et l'historique d'exécution.
            </p>
          </section>

          <section>
            <SectionLabel n={2} label="Instruction" />
            <textarea
              rows={4}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Décrivez l'objectif de ce nœud. Ex: Vérifie que le prénom et le nom fournis correspondent à ceux présents sur la pièce d'identité. Assure-toi que le document n'est pas expiré et que la photo est lisible."
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </section>

          <section>
            <SectionLabel n={3} label="Sources" />
            {formFields.length === 0 ? (
              <div className="text-xs text-slate-400 bg-slate-50 rounded-xl p-4 text-center">
                Aucun champ trouvé dans le formulaire de demande.
              </div>
            ) : (
              <div className="space-y-4">
                {textFields.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Champs texte</p>
                    <div className="space-y-1.5">
                      {textFields.map((f) => {
                        const selected = sources.includes(f.id);
                        return (
                          <label
                            key={f.id}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                              selected ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleSource(f.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-700 flex-1">{f.label || `(${f.type})`}</span>
                            <span className="text-xs text-slate-400">{f.type}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                {fileFields.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Fichiers / Documents</p>
                    <div className="space-y-1.5">
                      {fileFields.map((f) => {
                        const selected = sources.includes(f.id);
                        return (
                          <label
                            key={f.id}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                              selected ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleSource(f.id)}
                              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                            />
                            <Upload size={13} className="text-amber-500 shrink-0" />
                            <span className="text-sm text-slate-700 flex-1">{f.label || `(${f.type})`}</span>
                            <span className="text-xs text-amber-600 font-medium">fichier</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section>
            <SectionLabel n={4} label="Action — Format de sortie" />
            <div className="grid grid-cols-5 gap-2 mb-4">
              {OUTPUT_TYPES.map((ot) => (
                <button
                  key={ot.value}
                  type="button"
                  onClick={() => { setOutputType(ot.value); setOutputConfig({}); }}
                  className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-center transition-all ${
                    outputType === ot.value
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-lg">{ot.emoji}</span>
                  <span className={`text-xs font-semibold leading-tight ${outputType === ot.value ? 'text-blue-700' : 'text-slate-700'}`}>
                    {ot.label}
                  </span>
                  <span className="text-[10px] text-slate-400 leading-tight">{ot.description}</span>
                </button>
              ))}
            </div>
            {outputType === 'boolean' && (
              <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 text-xs text-slate-500">
                <span className="text-base">✅ ❌</span>
                <span>L'IA répondra <code className="bg-slate-200 px-1 rounded">true</code> ou <code className="bg-slate-200 px-1 rounded">false</code>.</span>
              </div>
            )}
            {outputType === 'score' && (
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500">
                L'IA retournera un score numérique entre <code className="bg-slate-200 px-1 rounded">0</code> et <code className="bg-slate-200 px-1 rounded">100</code>.
              </div>
            )}
            {outputType === 'text' && (
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500">
                L'IA retournera une réponse textuelle libre selon l'instruction.
              </div>
            )}
            {outputType === 'classification' && (
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-600 mb-3">Catégories possibles</p>
                {categories.map((cat, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={cat}
                      onChange={(e) => {
                        const next = [...categories];
                        next[idx] = e.target.value;
                        updateCategories(next);
                      }}
                      placeholder={`Catégorie ${idx + 1}`}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => updateCategories(categories.filter((_, i) => i !== idx))}
                      disabled={categories.length <= 1}
                      className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                    >
                      <MinusCircle size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => updateCategories([...categories, ''])}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors mt-1"
                >
                  <PlusCircle size={14} /> Ajouter une catégorie
                </button>
              </div>
            )}
            {outputType === 'structured' && (
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-600 mb-3">Champs de sortie JSON</p>
                {structuredFields.map((sf, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={sf.name}
                      onChange={(e) => {
                        const next = [...structuredFields];
                        next[idx] = { ...sf, name: e.target.value.replace(/\s/g, '_').toLowerCase() };
                        updateStructuredFields(next);
                      }}
                      placeholder="nom_champ"
                      className="w-36 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <input
                      type="text"
                      value={sf.description}
                      onChange={(e) => {
                        const next = [...structuredFields];
                        next[idx] = { ...sf, description: e.target.value };
                        updateStructuredFields(next);
                      }}
                      placeholder="Description…"
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => updateStructuredFields(structuredFields.filter((_, i) => i !== idx))}
                      disabled={structuredFields.length <= 1}
                      className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                    >
                      <MinusCircle size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => updateStructuredFields([...structuredFields, { name: '', description: '' }])}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors mt-1"
                >
                  <PlusCircle size={14} /> Ajouter un champ
                </button>
              </div>
            )}
          </section>
        </div>

        <div className="px-6 py-4 flex justify-end gap-2 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── BreakConfigModal ──────────────────────────────────────────────────────────

function BreakConfigModal({
  node,
  analysisNodes,
  onSave,
  onClose,
}: {
  node: WorkflowNode;
  analysisNodes: WorkflowNode[];
  onSave: (label: string, config: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const cfg = (node.config as Record<string, unknown>) ?? {};
  const [name, setName] = useState<string>(node.label ?? '');
  const [conditions, setConditions] = useState<BreakCondition[]>(
    (cfg.conditions as BreakCondition[]) ?? []
  );
  const [conditionLogic, setConditionLogic] = useState<'AND' | 'OR'>(
    (cfg.condition_logic as 'AND' | 'OR') ?? 'AND'
  );

  const canSave = name.trim().length > 0;

  const addCondition = () =>
    setConditions((prev) => [...prev, { source_node_id: analysisNodes[0]?.id ?? '', operator: 'is_false' }]);

  const removeCondition = (idx: number) =>
    setConditions((prev) => prev.filter((_, i) => i !== idx));

  const updateCondition = (idx: number, patch: Partial<BreakCondition>) =>
    setConditions((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));

  const handleSave = () => {
    if (!canSave) return;
    onSave(name.trim(), { conditions, condition_logic: conditionLogic });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-135 max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-100 text-orange-600">
              <Ban size={16} />
            </span>
            <h3 className="text-base font-semibold text-slate-800">Configurer la rupture conditionnelle</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <section>
            <SectionLabel n={1} label="Nom" required color="orange" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Arrêt si CNI invalide…"
              autoFocus
              className={`w-full border rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                !name.trim() ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`}
            />
          </section>

          <section>
            <SectionLabel n={2} label="Conditions de rupture" color="orange" />
            <p className="text-xs text-slate-400 mb-3">
              Si les conditions sont remplies, le pipeline s'arrête immédiatement et les nœuds suivants ne sont pas exécutés.
            </p>
            {analysisNodes.length === 0 && (
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                Aucun nœud d'analyse disponible. Ajoutez d'abord des nœuds d'analyse avant de définir des conditions.
              </div>
            )}
            {conditions.length === 0 ? (
              <div className="text-xs text-slate-400 bg-slate-50 rounded-xl p-4 text-center">
                Aucune condition — le nœud ne déclenchera jamais de rupture.
              </div>
            ) : (
              <div className="space-y-3">
                {conditions.map((cond, idx) => {
                  const sourceNode = analysisNodes.find((n) => n.id === cond.source_node_id);
                  const sourceOutputType = (sourceNode?.config as Record<string, unknown> | undefined)?.output_type as OutputType | undefined;
                  const availableOps = OPERATORS.filter(
                    (op) => !sourceOutputType || op.forTypes.includes(sourceOutputType)
                  );
                  const selectedOp = OPERATORS.find((o) => o.value === cond.operator);
                  const isNumber = cond.operator === 'less_than' || cond.operator === 'greater_than';

                  return (
                    <div key={idx} className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2.5">
                      {idx > 0 && (
                        <div className="flex items-center gap-2 -mt-1 mb-1">
                          <div className="flex-1 h-px bg-orange-200" />
                          <div className="flex gap-1">
                            {(['AND', 'OR'] as const).map((l) => (
                              <button
                                key={l}
                                type="button"
                                onClick={() => setConditionLogic(l)}
                                className={`px-2.5 py-0.5 text-xs font-bold rounded-full border transition-colors ${
                                  conditionLogic === l
                                    ? 'bg-orange-500 text-white border-orange-500'
                                    : 'bg-white text-orange-600 border-orange-300 hover:bg-orange-100'
                                }`}
                              >
                                {l}
                              </button>
                            ))}
                          </div>
                          <div className="flex-1 h-px bg-orange-200" />
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-orange-600 whitespace-nowrap w-5">Si</span>
                        <select
                          value={cond.source_node_id}
                          onChange={(e) => updateCondition(idx, { source_node_id: e.target.value, operator: 'is_false', value: undefined })}
                          className="flex-1 border border-orange-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                        >
                          <option value="">— Sélectionner un nœud d'analyse —</option>
                          {analysisNodes.map((n) => (
                            <option key={n.id} value={n.id}>{n.label || n.id}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeCondition(idx)}
                          className="p-1 text-orange-400 hover:text-red-500 transition-colors shrink-0"
                        >
                          <MinusCircle size={16} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 pl-7">
                        <select
                          value={cond.operator}
                          onChange={(e) => updateCondition(idx, { operator: e.target.value, value: undefined })}
                          className="flex-1 border border-orange-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                        >
                          {availableOps.map((op) => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                          ))}
                        </select>
                        {selectedOp?.needsValue && (
                          <input
                            type={isNumber ? 'number' : 'text'}
                            value={cond.value ?? ''}
                            onChange={(e) => updateCondition(idx, { value: isNumber ? Number(e.target.value) : e.target.value })}
                            placeholder={isNumber ? '0' : 'Valeur…'}
                            className="w-24 border border-orange-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={addCondition}
              className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-800 font-medium transition-colors mt-3"
            >
              <PlusCircle size={14} /> Ajouter une condition
            </button>
          </section>
        </div>

        <div className="px-6 py-4 flex justify-end gap-2 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NodeCard ──────────────────────────────────────────────────────────────────

function NodeCard({
  node,
  canDelete,
  onConfigure,
  onDelete,
  formFields,
  allNodes,
}: {
  node: WorkflowNode;
  canDelete: boolean;
  onConfigure: () => void;
  onDelete: () => void;
  formFields: FormBlock[];
  allNodes: WorkflowNode[];
}) {
  const colors = nodeColors(node.type);
  const cfg = node.config as Record<string, unknown> | undefined;
  const outputType = cfg?.output_type as OutputType | undefined;
  const outputMeta = OUTPUT_TYPES.find((o) => o.value === outputType);

  return (
    <div className={`border rounded-xl p-4 ${colors.bg} ${colors.border}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colors.icon}`}>
          {React.createElement(nodeIcon(node.type), { size: 18 })}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {node.type === 'trigger' ? (
              <p className="text-sm font-semibold text-slate-800">Déclencheur</p>
            ) : node.label ? (
              <p className="text-sm font-semibold text-slate-800">{node.label}</p>
            ) : (
              <p className="text-sm italic text-slate-400">Nœud sans nom</p>
            )}
            {outputMeta && (
              <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                {outputMeta.emoji} {outputMeta.label}
              </span>
            )}
            {node.type === 'break' && (
              <span className="text-[10px] font-semibold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
                Rupture conditionnelle
              </span>
            )}
          </div>
          {node.type === 'trigger' ? (
            <p className="text-xs text-slate-500 mt-0.5">L'instructeur lance l'analyse manuellement.</p>
          ) : (
            <NodeSummary node={node} formFields={formFields} allNodes={allNodes} />
          )}
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

// ── Arrow ─────────────────────────────────────────────────────────────────────

function Arrow({ onInsert }: { onInsert?: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex justify-center relative"
      style={{ height: '36px' }}
      onMouseEnter={() => onInsert && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg width="32" height="36" viewBox="0 0 32 36" fill="none">
        <defs>
          <linearGradient id="arrowGrad" x1="16" y1="0" x2="16" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#64748b" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <line x1="16" y1="0" x2="16" y2="26" stroke="url(#arrowGrad)" strokeWidth="1.5" />
        <path d="M9 22 L16 33 L23 22" fill="#64748b" fillOpacity="0.85" />
      </svg>
      {onInsert && hovered && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onInsert(); }}
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-blue-400 text-blue-500 flex items-center justify-center hover:bg-blue-50 hover:border-blue-500 transition-all shadow-sm z-10"
          title="Insérer un nœud ici"
        >
          <Plus size={10} />
        </button>
      )}
    </div>
  );
}

// ── InstructionWorkflowBuilder ────────────────────────────────────────────────

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
  const [showAddModal, setShowAddModal] = useState<false | 'analysis' | 'break'>(false);
  // typePicker: null = closed; afterNodeId = where to insert (null = end, string = after that node id)
  const [typePicker, setTypePicker] = useState<{ afterNodeId: string | null } | null>(null);
  const [insertAfterNodeId, setInsertAfterNodeId] = useState<string | null>(null);

  // ── Pan / Zoom ──────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 60, y: 40 });
  const [transform, setTransform] = useState({ zoom: 1, pan: { x: 60, y: 40 } });
  const [isCursorGrabbing, setIsCursorGrabbing] = useState(false);
  const { zoom, pan } = transform;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const scaleBy = 1.09;
    const direction = e.deltaY < 0 ? scaleBy : 1 / scaleBy;
    const prevZoom = zoomRef.current;
    const newZoom = Math.min(Math.max(prevZoom * direction, 0.2), 3);
    const rect = canvasRef.current.getBoundingClientRect();
    const newPan = {
      x: (e.clientX - rect.left) - ((e.clientX - rect.left) - panRef.current.x) * (newZoom / prevZoom),
      y: (e.clientY - rect.top) - ((e.clientY - rect.top) - panRef.current.y) * (newZoom / prevZoom),
    };
    zoomRef.current = newZoom;
    panRef.current = newPan;
    setTransform({ zoom: newZoom, pan: newPan });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, input, textarea, select, a')) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { ...panRef.current };
    setIsCursorGrabbing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const newPan = {
      x: panOrigin.current.x + e.clientX - panStart.current.x,
      y: panOrigin.current.y + e.clientY - panStart.current.y,
    };
    panRef.current = newPan;
    setTransform((t) => ({ ...t, pan: newPan }));
  };

  const handleMouseUp = () => {
    if (!isPanning.current) return;
    isPanning.current = false;
    setIsCursorGrabbing(false);
  };

  // ── Node operations ─────────────────────────────────────────────────────────

  const formFields = collectFormFields(demandeBlocks);
  const analysisNodes = nodes.filter((n) => n.type === 'analysis');

  const handleAddNode = (label: string, config: Record<string, unknown>) => {
    const nodeType = showAddModal === 'break' ? 'break' : 'analysis';
    const newNode: WorkflowNode = {
      id: `node_${uuid()}`,
      type: nodeType,
      label,
      config,
      next: null,
    };

    const afterId = insertAfterNodeId;

    if (afterId === null) {
      // Append at end
      const updated = [...nodes];
      if (updated.length > 0) {
        updated[updated.length - 1] = { ...updated[updated.length - 1], next: newNode.id };
      }
      setNodes([...updated, newNode]);
    } else if (afterId === 'trigger_0') {
      // Insert at beginning (after virtual trigger, before first real node)
      newNode.next = nodes[0]?.id ?? null;
      setNodes([newNode, ...nodes]);
    } else {
      // Insert after a specific real node
      const afterIdx = nodes.findIndex((n) => n.id === afterId);
      if (afterIdx === -1) {
        setNodes([...nodes, newNode]);
      } else {
        newNode.next = (nodes[afterIdx].next as string | null);
        const updated = nodes.map((n, i) =>
          i === afterIdx ? { ...n, next: newNode.id } : n
        );
        updated.splice(afterIdx + 1, 0, newNode);
        setNodes(updated);
      }
    }
  };

  const openTypePicker = (afterNodeId: string | null) => {
    setTypePicker({ afterNodeId });
  };

  const selectType = (type: 'analysis' | 'break') => {
    if (!typePicker) return;
    setInsertAfterNodeId(typePicker.afterNodeId);
    setShowAddModal(type);
    setTypePicker(null);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setInsertAfterNodeId(null);
  };

  const deleteNode = (id: string) => {
    const filtered = nodes.filter((n) => n.id !== id);
    const cleaned = filtered.map((n) =>
      n.next === id ? { ...n, next: null } : n
    );
    setNodes(cleaned);
  };

  const updateNode = (id: string, label: string, config: Record<string, unknown>) => {
    setNodes(nodes.map((n) => (n.id === id ? { ...n, label, config } : n)));
  };

  const configuringNode = nodes.find((n) => n.id === configuringId) ?? null;

  const displayNodes =
    nodes.length === 0 || nodes[0]?.type !== 'trigger'
      ? [{ id: 'trigger_0', type: 'trigger', label: 'Déclencheur', config: {}, next: nodes[0]?.id ?? null }, ...nodes]
      : nodes;

  return (
    <div className="flex h-full">
      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-hidden relative select-none"
        style={{
          backgroundColor: '#dce6f5',
          backgroundImage: 'radial-gradient(circle, #a0b4cc 1px, transparent 1px)',
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          cursor: isCursorGrabbing ? 'grabbing' : 'grab',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', width: 'max-content' }}>
          <div style={{ width: '480px', padding: '40px 24px' }}>

            {/* Nodes */}
            {displayNodes.map((node, i) => (
              <div key={node.id}>
                <NodeCard
                  node={node}
                  canDelete={node.type !== 'trigger'}
                  onConfigure={() => setConfiguringId(node.id)}
                  onDelete={() => deleteNode(node.id)}
                  formFields={formFields}
                  allNodes={nodes}
                />
                {i < displayNodes.length - 1 && (
                  <Arrow onInsert={() => openTypePicker(displayNodes[i].id)} />
                )}
              </div>
            ))}

            {/* Add node button */}
            <div className="mt-4">
              <Arrow />
              <button
                onClick={() => openTypePicker(null)}
                className="flex items-center gap-2 text-sm text-slate-500 font-medium hover:text-blue-600 px-4 py-2.5 border-2 border-dashed border-slate-200 rounded-xl w-full justify-center hover:border-blue-300 hover:bg-blue-50/50 transition-all"
              >
                <Plus size={16} />
                Ajouter un nœud
              </button>
            </div>
          </div>
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 flex flex-col items-center gap-0.5 bg-white rounded-xl shadow-lg border border-slate-200 p-1 z-10">
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => { const nz = Math.min(zoomRef.current * 1.25, 3); zoomRef.current = nz; setTransform((t) => ({ ...t, zoom: nz })); }}
            className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-600 text-xl font-light leading-none transition-colors"
          >+</button>
          <span className="text-[11px] text-slate-400 px-1 tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => { const nz = Math.max(zoomRef.current / 1.25, 0.2); zoomRef.current = nz; setTransform((t) => ({ ...t, zoom: nz })); }}
            className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-600 text-xl font-light leading-none transition-colors"
          >−</button>
          <div className="w-5 h-px bg-slate-200 my-0.5" />
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => { zoomRef.current = 1; panRef.current = { x: 60, y: 40 }; setTransform({ zoom: 1, pan: { x: 60, y: 40 } }); }}
            className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-400 text-base transition-colors"
            title="Réinitialiser la vue"
          >⊙</button>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-52 shrink-0 border-l border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Nœuds ({displayNodes.length})
        </p>
        <div className="space-y-1">
          {displayNodes.map((n) => {
            const colors = nodeColors(n.type);
            return (
              <div key={n.id} className="flex items-center gap-2 text-xs text-slate-600 py-1">
                <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${colors.icon}`}>
                  {React.createElement(nodeIcon(n.type), { size: 11 })}
                </span>
                <span className="truncate">
                  {n.type === 'trigger' ? 'Déclencheur' : n.label || <span className="italic text-slate-400">Sans nom</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Type picker popup */}
      {typePicker !== null && (
        <TypePicker
          onSelectAnalysis={() => selectType('analysis')}
          onSelectBreak={() => selectType('break')}
          onClose={() => setTypePicker(null)}
        />
      )}

      {/* Add analysis modal */}
      {showAddModal === 'analysis' && (
        <ConfigModal
          node={{ id: 'new', type: 'analysis', label: '', config: defaultAnalysisConfig(), next: null }}
          formFields={formFields}
          onSave={handleAddNode}
          onClose={closeAddModal}
        />
      )}

      {/* Add break modal */}
      {showAddModal === 'break' && (
        <BreakConfigModal
          node={{ id: 'new', type: 'break', label: '', config: defaultBreakConfig(), next: null }}
          analysisNodes={analysisNodes}
          onSave={handleAddNode}
          onClose={closeAddModal}
        />
      )}

      {/* Edit modals */}
      {configuringNode && configuringNode.type === 'analysis' && (
        <ConfigModal
          node={configuringNode}
          formFields={formFields}
          onSave={(label, config) => { updateNode(configuringNode.id, label, config); }}
          onClose={() => setConfiguringId(null)}
        />
      )}
      {configuringNode && configuringNode.type === 'break' && (
        <BreakConfigModal
          node={configuringNode}
          analysisNodes={analysisNodes.filter((n) => n.id !== configuringNode.id)}
          onSave={(label, config) => { updateNode(configuringNode.id, label, config); }}
          onClose={() => setConfiguringId(null)}
        />
      )}
    </div>
  );
}
