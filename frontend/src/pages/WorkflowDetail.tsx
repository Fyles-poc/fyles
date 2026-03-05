import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp,
  FileText, GitBranch, Save, GripVertical, ExternalLink,
  Type, AlignLeft, AlignJustify, List, ChevronDownSquare,
  CheckSquare, Hash, Mail, Phone, Calendar,
  Upload, Files, Heading1, X, ShieldAlert, Search, Layers, MoreHorizontal, Pencil,
} from 'lucide-react';
import { api } from '../lib/api';
import type { WorkflowNode } from '../lib/api';
import { useApi } from '../lib/useApi';
import { LoadingSpinner, ErrorMessage } from '../components/ui/LoadingSpinner';
import { InstructionWorkflowBuilder } from '../components/InstructionWorkflowBuilder';

// ── Types ──────────────────────────────────────────────────────────────────

type TabId = 'formulaire_demande' | 'workflow';

type FieldType =
  | 'header' | 'text'
  | 'short_answer' | 'long_answer' | 'number' | 'email' | 'phone' | 'date'
  | 'multiple_choice' | 'dropdown' | 'multiselect'
  | 'file_upload' | 'multifile_upload'
  | 'eligibility'
  | 'container';

interface FormCondition {
  field_id: string;
  operator: string;
  value: string;
}

interface FormBlock {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  eligibility?: boolean;
  options?: string[];
  conditions?: FormCondition[];
  conditionLogic?: 'AND' | 'OR';
  blocks?: FormBlock[];
}

interface FormPage {
  id: string;
  title: string;
  blocks: FormBlock[];
}

// ── Field meta ─────────────────────────────────────────────────────────────

const FIELD_GROUPS: { label: string; fields: { type: FieldType; label: string; icon: React.ElementType }[] }[] = [
  {
    label: 'Contenu',
    fields: [
      { type: 'header', label: 'Titre', icon: Heading1 },
      { type: 'text', label: 'Texte', icon: Type },
    ],
  },
  {
    label: 'Réponses',
    fields: [
      { type: 'short_answer', label: 'Réponse courte', icon: AlignLeft },
      { type: 'long_answer', label: 'Réponse longue', icon: AlignJustify },
      { type: 'number', label: 'Nombre', icon: Hash },
      { type: 'email', label: 'Email', icon: Mail },
      { type: 'phone', label: 'Téléphone', icon: Phone },
      { type: 'date', label: 'Date', icon: Calendar },
    ],
  },
  {
    label: 'Choix',
    fields: [
      { type: 'multiple_choice', label: 'Choix multiple', icon: List },
      { type: 'dropdown', label: 'Liste déroulante', icon: ChevronDownSquare },
      { type: 'multiselect', label: 'Sélection multiple', icon: CheckSquare },
    ],
  },
  {
    label: 'Fichiers',
    fields: [
      { type: 'file_upload', label: 'Fichier', icon: Upload },
      { type: 'multifile_upload', label: 'Fichiers multiples', icon: Files },
    ],
  },
];

const INSTRUCTION_EXTRA: { type: FieldType; label: string; icon: React.ElementType } = {
  type: 'eligibility', label: 'Éligibilité (KO si Non)', icon: ShieldAlert,
};

const OPERATOR_LABELS: Record<string, string> = {
  equals: '=',
  not_equals: '≠',
  greater_than: '>',
  greater_or_equal: '≥',
  less_than: '<',
  less_or_equal: '≤',
  contains: 'contient',
};

const NUMBER_FIELD_TYPES = new Set(['number', 'date']);
const TEXT_FIELD_TYPES = new Set(['short_answer', 'long_answer', 'email', 'phone']);

function getOperators(type: string): { value: string; label: string }[] {
  if (NUMBER_FIELD_TYPES.has(type)) {
    return [
      { value: 'equals', label: '= — égal à' },
      { value: 'not_equals', label: '≠ — différent de' },
      { value: 'greater_than', label: '> — supérieur à' },
      { value: 'greater_or_equal', label: '≥ — supérieur ou égal à' },
      { value: 'less_than', label: '< — inférieur à' },
      { value: 'less_or_equal', label: '≤ — inférieur ou égal à' },
    ];
  }
  if (TEXT_FIELD_TYPES.has(type)) {
    return [
      { value: 'equals', label: '= — est égal à' },
      { value: 'not_equals', label: '≠ — est différent de' },
      { value: 'contains', label: 'contient' },
    ];
  }
  // eligibility, multiple_choice, dropdown, multiselect
  return [
    { value: 'equals', label: '= — est égal à' },
    { value: 'not_equals', label: '≠ — est différent de' },
  ];
}

const fieldMeta = (type: FieldType): { label: string; icon: React.ElementType; color: string } => {
  const map: Record<FieldType, { label: string; icon: React.ElementType; color: string }> = {
    header: { label: 'Titre', icon: Heading1, color: 'bg-slate-100 text-slate-600' },
    text: { label: 'Texte', icon: Type, color: 'bg-slate-100 text-slate-600' },
    short_answer: { label: 'Réponse courte', icon: AlignLeft, color: 'bg-blue-50 text-blue-600' },
    long_answer: { label: 'Réponse longue', icon: AlignJustify, color: 'bg-blue-50 text-blue-600' },
    number: { label: 'Nombre', icon: Hash, color: 'bg-purple-50 text-purple-600' },
    email: { label: 'Email', icon: Mail, color: 'bg-purple-50 text-purple-600' },
    phone: { label: 'Téléphone', icon: Phone, color: 'bg-purple-50 text-purple-600' },
    date: { label: 'Date', icon: Calendar, color: 'bg-purple-50 text-purple-600' },
    multiple_choice: { label: 'Choix multiple', icon: List, color: 'bg-emerald-50 text-emerald-600' },
    dropdown: { label: 'Liste déroulante', icon: ChevronDownSquare, color: 'bg-emerald-50 text-emerald-600' },
    multiselect: { label: 'Sélection multiple', icon: CheckSquare, color: 'bg-emerald-50 text-emerald-600' },
    file_upload: { label: 'Fichier', icon: Upload, color: 'bg-amber-50 text-amber-600' },
    multifile_upload: { label: 'Fichiers multiples', icon: Files, color: 'bg-amber-50 text-amber-600' },
    eligibility: { label: 'Éligibilité', icon: ShieldAlert, color: 'bg-red-50 text-red-600' },
    container: { label: 'Container', icon: Layers, color: 'bg-blue-50 text-blue-600' },
  };
  return map[type];
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function collectFields(blocks: FormBlock[]): FormBlock[] {
  return blocks
    .flatMap((b) =>
      b.type === 'container' && b.blocks ? collectFields(b.blocks) : [b]
    )
    .filter((b) => b.type !== 'header' && b.type !== 'text' && b.type !== 'container');
}

function updateInList(list: FormBlock[], id: string, patch: Partial<FormBlock>): FormBlock[] {
  return list.map((b) => {
    if (b.id === id) return { ...b, ...patch };
    if (b.type === 'container' && b.blocks)
      return { ...b, blocks: updateInList(b.blocks, id, patch) };
    return b;
  });
}

function deleteFromList(list: FormBlock[], id: string): FormBlock[] {
  return list
    .filter((b) => b.id !== id)
    .map((b) =>
      b.type === 'container' && b.blocks
        ? { ...b, blocks: deleteFromList(b.blocks, id) }
        : b
    );
}

function addToContainer(list: FormBlock[], containerId: string, newBlock: FormBlock): FormBlock[] {
  return list.map((b) => {
    if (b.id === containerId) return { ...b, blocks: [...(b.blocks ?? []), newBlock] };
    if (b.type === 'container' && b.blocks)
      return { ...b, blocks: addToContainer(b.blocks, containerId, newBlock) };
    return b;
  });
}

// ── AddFieldMenu ────────────────────────────────────────────────────────────

function AddFieldMenu({
  isInstruction,
  onAdd,
  small,
}: {
  isInstruction: boolean;
  onAdd: (type: FieldType) => void;
  small?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState('');

  const groups = isInstruction
    ? [...FIELD_GROUPS, { label: 'Instruction', fields: [INSTRUCTION_EXTRA] }]
    : FIELD_GROUPS;

  const add = (type: FieldType) => {
    onAdd(type);
    setShowMenu(false);
    setSearch('');
  };

  return (
    <>
      <button
        onClick={() => setShowMenu(true)}
        className={
          small
            ? 'flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 px-3 py-1.5 border border-dashed border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all'
            : 'flex items-center gap-2 text-sm text-blue-600 font-medium hover:text-blue-700 px-4 py-2.5 border-2 border-dashed border-blue-200 rounded-xl w-full justify-center hover:border-blue-400 hover:bg-blue-50 transition-all'
        }
      >
        <Plus size={small ? 12 : 16} />
        Ajouter un champ
      </button>

      {showMenu && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center"
          onClick={() => { setShowMenu(false); setSearch(''); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-80 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-semibold text-slate-800">Ajouter un champ</h3>
                <button
                  onClick={() => { setShowMenu(false); setSearch(''); }}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={16} className="text-slate-400" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-3">Sélectionnez le type de champ à ajouter</p>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <Search size={13} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un champ..."
                  className="flex-1 text-sm bg-transparent outline-none text-slate-700 placeholder-slate-400"
                  autoFocus
                />
                {search && (
                  <button onClick={() => setSearch('')}>
                    <X size={12} className="text-slate-400 hover:text-slate-600" />
                  </button>
                )}
              </div>
            </div>

            <div className="py-2 overflow-y-auto max-h-96">
              {groups.map((group) => {
                const filtered = group.fields.filter(({ label }) =>
                  !search || label.toLowerCase().includes(search.toLowerCase())
                );
                if (filtered.length === 0) return null;
                return (
                  <div key={group.label}>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 pt-3 pb-1">
                      {group.label}
                    </p>
                    {filtered.map(({ type, label, icon: Icon }) => {
                      const meta = fieldMeta(type);
                      return (
                        <button
                          key={type}
                          onClick={() => add(type)}
                          className="flex items-center gap-3 w-full px-5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                        >
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                            <Icon size={14} />
                          </span>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {search &&
                groups.every((g) =>
                  g.fields.every(({ label }) => !label.toLowerCase().includes(search.toLowerCase()))
                ) && (
                  <p className="text-xs text-slate-400 text-center py-6 px-4">
                    Aucun champ trouvé pour « {search} »
                  </p>
                )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── ConditionEditor ─────────────────────────────────────────────────────────

function ConditionEditor({
  conditions: initialConditions,
  conditionLogic: initialLogic,
  allFields,
  onSave,
  onRemoveAll,
  onClose,
}: {
  conditions?: FormCondition[];
  conditionLogic?: 'AND' | 'OR';
  allFields: FormBlock[];
  onSave: (conditions: FormCondition[], logic: 'AND' | 'OR') => void;
  onRemoveAll: () => void;
  onClose: () => void;
}) {
  const [logic, setLogic] = useState<'AND' | 'OR'>(initialLogic ?? 'AND');
  const [rows, setRows] = useState<FormCondition[]>(
    initialConditions?.length ? initialConditions : [{ field_id: '', operator: 'equals', value: '' }]
  );

  const updateRow = (i: number, patch: Partial<FormCondition>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const handleFieldChange = (i: number, newId: string) => {
    const newField = allFields.find((f) => f.id === newId);
    const newOps = getOperators(newField?.type ?? '');
    const currentOp = rows[i].operator;
    const validOp = newOps.find((op) => op.value === currentOp) ? currentOp : (newOps[0]?.value ?? 'equals');
    updateRow(i, { field_id: newId, operator: validOp });
  };

  const addRow = () => setRows((prev) => [...prev, { field_id: '', operator: 'equals', value: '' }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, j) => j !== i));
  const canSave = rows.length > 0 && rows.every((r) => r.field_id);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-120 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
              <GitBranch size={14} />
            </div>
            <h3 className="text-base font-semibold text-slate-800">Conditions d'affichage</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-4 bg-slate-50 px-3 py-2 rounded-lg">
          Ce container s'affichera uniquement si les conditions ci-dessous sont vérifiées.
        </p>

        {/* AND / OR toggle — affiché seulement si > 1 condition */}
        {rows.length > 1 && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-slate-500 font-medium shrink-0">Logique :</span>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
              <button
                onClick={() => setLogic('AND')}
                className={`px-3 py-1.5 transition-colors ${logic === 'AND' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Toutes (ET)
              </button>
              <button
                onClick={() => setLogic('OR')}
                className={`px-3 py-1.5 transition-colors ${logic === 'OR' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Au moins une (OU)
              </button>
            </div>
          </div>
        )}

        {/* Lignes de conditions */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {rows.map((row, i) => {
            const selectedField = allFields.find((f) => f.id === row.field_id);
            const operators = getOperators(selectedField?.type ?? '');
            return (
              <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                {rows.length > 1 && (
                  <span className="text-xs text-slate-400 font-mono w-4 text-center shrink-0">{i + 1}</span>
                )}
                <select
                  value={row.field_id}
                  onChange={(e) => handleFieldChange(i, e.target.value)}
                  className="flex-1 border border-slate-200 rounded-md px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-violet-500 bg-white min-w-0"
                >
                  <option value="">Champ…</option>
                  {allFields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label || `(${fieldMeta(f.type).label})`}
                    </option>
                  ))}
                </select>
                <select
                  value={row.operator}
                  onChange={(e) => updateRow(i, { operator: e.target.value })}
                  disabled={!row.field_id}
                  className="border border-slate-200 rounded-md px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-violet-500 bg-white disabled:opacity-50 shrink-0"
                >
                  {operators.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={row.value}
                  onChange={(e) => updateRow(i, { value: e.target.value })}
                  placeholder="Valeur…"
                  className="w-24 border border-slate-200 rounded-md px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-violet-500 shrink-0"
                />
                <button
                  onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                  className="p-1 hover:bg-red-50 rounded transition-colors disabled:opacity-30 shrink-0"
                >
                  <X size={13} className="text-slate-400 hover:text-red-400" />
                </button>
              </div>
            );
          })}
        </div>

        <button
          onClick={addRow}
          className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 mt-3 font-medium transition-colors"
        >
          <Plus size={12} />
          Ajouter une condition
        </button>

        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100">
          {initialConditions?.length ? (
            <button
              onClick={() => { onRemoveAll(); onClose(); }}
              className="text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              Tout supprimer
            </button>
          ) : null}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => { if (canSave) { onSave(rows, logic); onClose(); } }}
              disabled={!canSave}
              className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── BlockCard ──────────────────────────────────────────────────────────────

function BlockCard({
  block, isInstruction,
  onDelete, onLabelChange, onToggleRequired, onToggleEligibility, onOptionsChange,
  onDragStart, onDragOver, onDrop,
}: {
  block: FormBlock;
  isInstruction: boolean;
  onDelete: () => void;
  onLabelChange: (v: string) => void;
  onToggleRequired: () => void;
  onToggleEligibility: () => void;
  onOptionsChange: (options: string[]) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const meta = fieldMeta(block.type);
  const Icon = meta.icon;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="bg-white border border-slate-200 rounded-xl overflow-hidden group hover:border-blue-300 transition-colors"
    >
      {block.type === 'eligibility' && (
        <div className="bg-red-50 border-b border-red-100 px-4 py-1.5 flex items-center gap-1.5">
          <ShieldAlert size={12} className="text-red-500" />
          <span className="text-xs text-red-600 font-medium">KO si réponse Non</span>
        </div>
      )}
      {block.type !== 'header' && block.type !== 'text' && block.type !== 'eligibility' && (
        <button
          onClick={onToggleRequired}
          className={`w-full border-b px-4 py-1.5 flex items-center gap-1.5 transition-colors ${
            block.required
              ? 'bg-amber-50 border-amber-100 hover:bg-amber-100'
              : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
          }`}
        >
          <Icon size={12} className={block.required ? 'text-amber-500' : 'text-slate-400'} />
          <span className={`text-xs font-semibold ${block.required ? 'text-amber-700' : 'text-slate-500'}`}>
            {block.required
              ? (block.type === 'file_upload' || block.type === 'multifile_upload' ? 'Document obligatoire' : 'Obligatoire')
              : (block.type === 'file_upload' || block.type === 'multifile_upload' ? 'Document optionnel' : 'Optionnel')
            }
          </span>
          <span className="ml-auto text-xs text-slate-300">cliquer pour modifier</span>
        </button>
      )}

      <div className="flex items-start gap-3 px-4 py-3">
        <div className="mt-1 cursor-grab text-slate-300 hover:text-slate-500 shrink-0">
          <GripVertical size={16} />
        </div>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${meta.color}`}>
          <Icon size={14} />
        </div>

        <div className="flex-1 min-w-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium mb-1.5 inline-block ${meta.color}`}>
            {meta.label}
          </span>

          {block.type === 'header' ? (
            <input
              type="text"
              value={block.label}
              onChange={(e) => onLabelChange(e.target.value)}
              className="w-full text-base font-bold text-slate-800 border-0 border-b border-dashed border-slate-200 focus:outline-none focus:border-blue-400 bg-transparent pb-0.5"
              placeholder="Titre de section"
            />
          ) : block.type === 'text' ? (
            <input
              type="text"
              value={block.label}
              onChange={(e) => onLabelChange(e.target.value)}
              className="w-full text-sm text-slate-600 border-0 border-b border-dashed border-slate-200 focus:outline-none focus:border-blue-400 bg-transparent pb-0.5 italic"
              placeholder="Texte d'explication..."
            />
          ) : (
            <input
              type="text"
              value={block.label}
              onChange={(e) => onLabelChange(e.target.value)}
              className="w-full text-sm font-medium text-slate-800 border-0 border-b border-dashed border-slate-200 focus:outline-none focus:border-blue-400 bg-transparent pb-0.5"
              placeholder="Intitulé de la question"
            />
          )}

          <div className="mt-2">
            {block.type === 'short_answer' && <div className="h-8 bg-slate-50 border border-slate-200 rounded-lg" />}
            {block.type === 'long_answer' && <div className="h-16 bg-slate-50 border border-slate-200 rounded-lg" />}
            {block.type === 'number' && <div className="h-8 w-32 bg-slate-50 border border-slate-200 rounded-lg" />}
            {block.type === 'email' && (
              <div className="h-8 bg-slate-50 border border-slate-200 rounded-lg flex items-center px-3">
                <span className="text-xs text-slate-300">exemple@email.fr</span>
              </div>
            )}
            {block.type === 'phone' && (
              <div className="h-8 w-40 bg-slate-50 border border-slate-200 rounded-lg flex items-center px-3">
                <span className="text-xs text-slate-300">06 XX XX XX XX</span>
              </div>
            )}
            {block.type === 'date' && (
              <div className="h-8 w-40 bg-slate-50 border border-slate-200 rounded-lg flex items-center px-3">
                <span className="text-xs text-slate-300">JJ/MM/AAAA</span>
              </div>
            )}
            {(block.type === 'multiple_choice' || block.type === 'multiselect') && (
              <div className="space-y-1 mt-1">
                {(block.options ?? []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 group/opt py-0.5">
                    <div className={`w-3.5 h-3.5 border-2 border-slate-300 shrink-0 ${block.type === 'multiselect' ? 'rounded' : 'rounded-full'}`} />
                    <input
                      type="text"
                      value={opt}
                      autoFocus={opt === '' && i === (block.options?.length ?? 0) - 1}
                      onChange={(e) => {
                        const next = [...(block.options ?? [])];
                        next[i] = e.target.value;
                        onOptionsChange(next);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); onOptionsChange([...(block.options ?? []), '']); }
                        if (e.key === 'Backspace' && opt === '' && (block.options?.length ?? 0) > 1) {
                          e.preventDefault();
                          onOptionsChange((block.options ?? []).filter((_, j) => j !== i));
                        }
                      }}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 text-xs text-slate-700 bg-transparent border-0 border-b border-dashed border-transparent focus:border-blue-400 focus:outline-none py-0.5 min-w-0"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); onOptionsChange((block.options ?? []).filter((_, j) => j !== i)); }}
                      className="opacity-0 group-hover/opt:opacity-100 p-0.5 hover:bg-red-50 rounded transition-all shrink-0"
                    >
                      <X size={11} className="text-slate-300 hover:text-red-400" />
                    </button>
                  </div>
                ))}
                {(block.options ?? []).length === 0 && (
                  <p className="text-xs text-slate-300 italic py-1">Aucune option — ajoutez-en ci-dessous</p>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onOptionsChange([...(block.options ?? []), '']); }}
                  className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 mt-1 transition-colors"
                >
                  <Plus size={11} />
                  Ajouter une option
                </button>
              </div>
            )}
            {block.type === 'dropdown' && (
              <div className="mt-1">
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="h-7 bg-slate-50 border-b border-slate-100 flex items-center justify-between px-3">
                    <span className="text-xs text-slate-400">Sélectionner…</span>
                    <ChevronDown size={11} className="text-slate-300" />
                  </div>
                  {(block.options ?? []).map((opt, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 group/opt hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <span className="text-xs text-slate-300 font-mono shrink-0">{i + 1}.</span>
                      <input
                        type="text"
                        value={opt}
                        autoFocus={opt === '' && i === (block.options?.length ?? 0) - 1}
                        onChange={(e) => {
                          const next = [...(block.options ?? [])];
                          next[i] = e.target.value;
                          onOptionsChange(next);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); onOptionsChange([...(block.options ?? []), '']); }
                          if (e.key === 'Backspace' && opt === '' && (block.options?.length ?? 0) > 1) {
                            e.preventDefault();
                            onOptionsChange((block.options ?? []).filter((_, j) => j !== i));
                          }
                        }}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 text-xs text-slate-700 bg-transparent border-0 focus:outline-none min-w-0"
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); onOptionsChange((block.options ?? []).filter((_, j) => j !== i)); }}
                        className="opacity-0 group-hover/opt:opacity-100 p-0.5 hover:bg-red-50 rounded transition-all shrink-0"
                      >
                        <X size={11} className="text-slate-300 hover:text-red-400" />
                      </button>
                    </div>
                  ))}
                  {(block.options ?? []).length === 0 && (
                    <div className="px-3 py-2">
                      <p className="text-xs text-slate-300 italic">Aucune option</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onOptionsChange([...(block.options ?? []), '']); }}
                  className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 mt-2 transition-colors"
                >
                  <Plus size={11} />
                  Ajouter une option
                </button>
              </div>
            )}
            {block.type === 'eligibility' && (
              <div className="flex gap-2 mt-1">
                <div className="flex-1 h-8 border border-emerald-200 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <span className="text-xs text-emerald-600 font-medium">Oui</span>
                </div>
                <div className="flex-1 h-8 border border-red-200 bg-red-50 rounded-lg flex items-center justify-center">
                  <span className="text-xs text-red-600 font-medium">Non → KO</span>
                </div>
              </div>
            )}
            {(block.type === 'file_upload' || block.type === 'multifile_upload') && (
              <div className="border-2 border-dashed border-slate-200 rounded-lg h-10 flex items-center justify-center">
                <span className="text-xs text-slate-300">
                  {block.type === 'multifile_upload' ? 'Déposer des fichiers...' : 'Déposer un fichier...'}
                </span>
              </div>
            )}
          </div>

          {block.type !== 'header' && block.type !== 'text' && (
            <div className="flex items-center mt-3 pt-2 border-t border-slate-100">
              {isInstruction && block.type !== 'eligibility' && (
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!block.eligibility}
                    onChange={onToggleEligibility}
                    className="accent-red-500 w-3.5 h-3.5"
                  />
                  <span className="text-xs text-red-500 font-medium">Éligibilité (KO si Non)</span>
                </label>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded-lg transition-all shrink-0"
        >
          <Trash2 size={14} className="text-slate-300 hover:text-red-400" />
        </button>
      </div>
    </div>
  );
}

// ── ContainerCard ──────────────────────────────────────────────────────────

function ContainerCard({
  container, isInstruction, allFields,
  onDelete, onLabelChange, onSaveConditions, onClearConditions,
  onAddBlock, onDeleteBlock, onUpdateBlock,
  onDragStart, onDragOver, onDrop,
}: {
  container: FormBlock;
  isInstruction: boolean;
  allFields: FormBlock[];
  onDelete: () => void;
  onLabelChange: (v: string) => void;
  onSaveConditions: (conditions: FormCondition[], logic: 'AND' | 'OR') => void;
  onClearConditions: () => void;
  onAddBlock: (type: FieldType) => void;
  onDeleteBlock: (id: string) => void;
  onUpdateBlock: (id: string, patch: Partial<FormBlock>) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const [showCondEditor, setShowCondEditor] = useState(false);
  const innerDragRef = useRef<number | null>(null);
  const innerBlocks = container.blocks ?? [];

  const handleInnerDrop = (targetIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (innerDragRef.current === null || innerDragRef.current === targetIndex) return;
    const newBlocks = [...innerBlocks];
    const [moved] = newBlocks.splice(innerDragRef.current!, 1);
    newBlocks.splice(targetIndex, 0, moved);
    onUpdateBlock(container.id, { blocks: newBlocks });
    innerDragRef.current = null;
  };

  const conditions = container.conditions ?? [];
  const conditionLogic = container.conditionLogic ?? 'AND';
  const hasConditions = conditions.length > 0;
  const conditionText = conditions
    .map((c) => {
      const fl = allFields.find((f) => f.id === c.field_id)?.label ?? 'champ';
      return `${fl} ${OPERATOR_LABELS[c.operator] ?? c.operator} «${c.value}»`;
    })
    .join(conditionLogic === 'OR' ? '  OU  ' : '  ET  ');

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e); }}
      onDrop={onDrop}
      className="border-2 border-blue-100 rounded-xl overflow-hidden group bg-white"
    >
      {/* Condition badge */}
      {hasConditions && (
        <div className="bg-violet-50 border-b border-violet-100 px-4 py-2 flex items-start gap-2">
          <GitBranch size={11} className="text-violet-500 mt-0.5 shrink-0" />
          <span className="text-xs text-violet-600 font-medium flex-1 min-w-0 leading-relaxed">
            {conditionText}
          </span>
          <button
            onClick={() => setShowCondEditor(true)}
            className="text-xs text-violet-500 hover:text-violet-700 transition-colors shrink-0"
          >
            Modifier
          </button>
          <button
            onClick={onClearConditions}
            className="p-0.5 hover:bg-violet-100 rounded transition-colors shrink-0"
          >
            <X size={11} className="text-violet-400" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="cursor-grab text-slate-300 hover:text-slate-500 shrink-0">
          <GripVertical size={16} />
        </div>
        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
          <Layers size={14} />
        </div>
        <input
          type="text"
          value={container.label}
          onChange={(e) => onLabelChange(e.target.value)}
          className="flex-1 text-sm font-semibold text-slate-700 bg-transparent border-0 border-b border-dashed border-slate-200 focus:outline-none focus:border-blue-400"
          placeholder="Nom du groupe / section"
        />
        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium shrink-0">
          {innerBlocks.length} champ{innerBlocks.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setShowCondEditor(true)}
          className={`flex items-center gap-1 text-xs transition-colors shrink-0 ${
            hasConditions
              ? 'text-violet-500 hover:text-violet-700'
              : 'text-slate-400 hover:text-violet-600'
          }`}
        >
          <GitBranch size={12} />
          {hasConditions ? `${conditions.length} condition${conditions.length > 1 ? 's' : ''}` : 'Condition'}
        </button>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded-lg transition-all shrink-0"
        >
          <Trash2 size={14} className="text-slate-300 hover:text-red-400" />
        </button>
      </div>

      {/* Inner blocks */}
      <div className="p-4 space-y-2 bg-slate-50/40">
        {innerBlocks.length === 0 && (
          <div className="text-center py-4">
            <p className="text-xs text-slate-400 italic">
              Container vide — ajoutez un champ ci-dessous
            </p>
          </div>
        )}
        {innerBlocks.map((block, bi) => (
          <BlockCard
            key={block.id}
            block={block}
            isInstruction={isInstruction}
            onDelete={() => onDeleteBlock(block.id)}
            onLabelChange={(v) => onUpdateBlock(block.id, { label: v })}
            onToggleRequired={() => onUpdateBlock(block.id, { required: !block.required })}
            onToggleEligibility={() => onUpdateBlock(block.id, { eligibility: !block.eligibility })}
            onOptionsChange={(opts) => onUpdateBlock(block.id, { options: opts })}
            onDragStart={(e) => {
              e.stopPropagation();
              innerDragRef.current = bi;
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => handleInnerDrop(bi, e)}
          />
        ))}
        <AddFieldMenu isInstruction={isInstruction} onAdd={onAddBlock} small />
      </div>

      {showCondEditor && (
        <ConditionEditor
          conditions={conditions}
          conditionLogic={conditionLogic}
          allFields={allFields}
          onSave={onSaveConditions}
          onRemoveAll={onClearConditions}
          onClose={() => setShowCondEditor(false)}
        />
      )}
    </div>
  );
}

// ── FormTree ───────────────────────────────────────────────────────────────

function FormTree({ blocks }: { blocks: FormBlock[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderBlocks = (items: FormBlock[], depth = 0): React.ReactNode =>
    items.map((block) => {
      if (block.type === 'container') {
        const isCollapsed = collapsed.has(block.id);
        return (
          <div key={block.id}>
            <button
              onClick={() => toggleCollapse(block.id)}
              className="w-full flex items-center gap-2 py-1 hover:bg-blue-50 rounded px-1 transition-colors"
              style={{ paddingLeft: depth * 12 }}
            >
              <Layers size={11} className="text-blue-400 shrink-0" />
              <span className="text-xs text-blue-600 font-semibold truncate flex-1 text-left">
                {block.label || '(container)'}
              </span>
              {block.conditions && <GitBranch size={10} className="text-violet-400 shrink-0" />}
              {isCollapsed
                ? <ChevronDown size={10} className="text-slate-400 shrink-0" />
                : <ChevronUp size={10} className="text-slate-400 shrink-0" />}
            </button>
            {!isCollapsed && renderBlocks(block.blocks ?? [], depth + 1)}
          </div>
        );
      }
      const meta = fieldMeta(block.type);
      const Icon = meta.icon;
      return (
        <div
          key={block.id}
          className="flex items-center gap-2 py-1 px-1"
          style={{ paddingLeft: depth * 12 + 4 }}
        >
          <Icon size={11} className="text-slate-400 shrink-0" />
          <span className="text-xs text-slate-600 truncate flex-1">
            {block.label || '(sans titre)'}
          </span>
          {block.type === 'eligibility' && (
            <span className="text-xs text-red-500 font-bold">KO</span>
          )}
          {block.eligibility && block.type !== 'eligibility' && (
            <ShieldAlert size={10} className="text-red-400 shrink-0" />
          )}
        </div>
      );
    });

  return (
    <div className="h-full flex flex-col border-l border-slate-200 bg-slate-50">
      <div className="px-4 py-3 border-b border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Structure</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {blocks.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Formulaire vide</p>
        ) : (
          renderBlocks(blocks)
        )}
      </div>
    </div>
  );
}

// ── FormBuilder ────────────────────────────────────────────────────────────

function FormBuilder({
  blocks, isInstruction, setBlocks,
}: {
  blocks: FormBlock[];
  isInstruction: boolean;
  setBlocks: React.Dispatch<React.SetStateAction<FormBlock[]>>;
}) {
  const dragRef = useRef<number | null>(null);

  const addBlock = (type: FieldType, containerId?: string) => {
    const isChoice = type === 'multiple_choice' || type === 'dropdown' || type === 'multiselect';
    const newBlock: FormBlock = {
      id: `b${crypto.randomUUID()}`,
      type,
      label: '',
      required: type !== 'header' && type !== 'text' && type !== 'container',
      options: isChoice ? ['Option 1', 'Option 2'] : undefined,
    };
    if (containerId) {
      setBlocks((prev) => addToContainer(prev, containerId, newBlock));
    } else {
      setBlocks((prev) => [...prev, newBlock]);
    }
  };

  const addContainer = () => {
    const newContainer: FormBlock = {
      id: `c${crypto.randomUUID()}`,
      type: 'container',
      label: '',
      required: false,
      blocks: [],
    };
    setBlocks((prev) => [...prev, newContainer]);
  };

  const deleteBlock = (id: string) => {
    setBlocks((prev) => deleteFromList(prev, id));
  };

  const updateBlock = (id: string, patch: Partial<FormBlock>) => {
    setBlocks((prev) => updateInList(prev, id, patch));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragRef.current === null || dragRef.current === targetIndex) return;
    const newBlocks = [...blocks];
    const [moved] = newBlocks.splice(dragRef.current!, 1);
    newBlocks.splice(targetIndex, 0, moved);
    setBlocks(newBlocks);
    dragRef.current = null;
  };

  const allFields = collectFields(blocks);

  return (
    <div className="flex h-full">
      {/* Canvas (70%) */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ width: '70%' }}>
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50">
          {blocks.length === 0 && (
            <div className="text-center py-16">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <AlignLeft size={20} className="text-slate-300" />
              </div>
              <p className="text-sm text-slate-400 font-medium">Formulaire vide</p>
              <p className="text-xs text-slate-400 mt-1">
                Ajoutez un champ ou un container pour commencer
              </p>
            </div>
          )}

          {blocks.map((block, idx) =>
            block.type === 'container' ? (
              <ContainerCard
                key={block.id}
                container={block}
                isInstruction={isInstruction}
                allFields={allFields}
                onDelete={() => deleteBlock(block.id)}
                onLabelChange={(v) => updateBlock(block.id, { label: v })}
                onSaveConditions={(conditions, logic) => updateBlock(block.id, { conditions, conditionLogic: logic })}
                onClearConditions={() => updateBlock(block.id, { conditions: undefined })}
                onAddBlock={(type) => addBlock(type, block.id)}
                onDeleteBlock={deleteBlock}
                onUpdateBlock={updateBlock}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, idx)}
              />
            ) : (
              <BlockCard
                key={block.id}
                block={block}
                isInstruction={isInstruction}
                onDelete={() => deleteBlock(block.id)}
                onLabelChange={(v) => updateBlock(block.id, { label: v })}
                onToggleRequired={() => updateBlock(block.id, { required: !block.required })}
                onToggleEligibility={() => updateBlock(block.id, { eligibility: !block.eligibility })}
                onOptionsChange={(opts) => updateBlock(block.id, { options: opts })}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, idx)}
              />
            )
          )}

          <AddFieldMenu isInstruction={isInstruction} onAdd={addBlock} />
          <button
            onClick={addContainer}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 font-medium px-4 py-2.5 border-2 border-dashed border-slate-200 rounded-xl w-full justify-center hover:border-blue-300 hover:bg-blue-50/50 transition-all"
          >
            <Layers size={16} />
            Ajouter un container conditionnel
          </button>
        </div>
      </div>

      {/* Tree (30%) */}
      <div className="shrink-0" style={{ width: '30%' }}>
        <FormTree blocks={blocks} />
      </div>
    </div>
  );
}

// ── WorkflowDetail ─────────────────────────────────────────────────────────

export function WorkflowDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('formulaire_demande');

  const [demandePages, setDemandePages] = useState<FormPage[]>([{ id: 'page_1', title: 'Page 1', blocks: [] }]);
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [instructionNodes, setInstructionNodes] = useState<WorkflowNode[]>([]);

  const [renamingPageIdx, setRenamingPageIdx] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [pageMenuIdx, setPageMenuIdx] = useState<number | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null);

  const addPage = () => {
    const newPage: FormPage = { id: `page_${crypto.randomUUID()}`, title: `Page ${demandePages.length + 1}`, blocks: [] };
    setDemandePages((prev) => [...prev, newPage]);
    setActivePageIdx(demandePages.length);
  };

  const deletePage = (idx: number) => {
    setDemandePages((prev) => prev.filter((_, i) => i !== idx));
    setActivePageIdx((prev) => Math.min(prev, demandePages.length - 2));
  };

  const confirmRename = () => {
    if (renamingPageIdx === null) return;
    const trimmed = renameValue.trim() || `Page ${renamingPageIdx + 1}`;
    setDemandePages((prev) => {
      const pages = [...prev];
      pages[renamingPageIdx] = { ...pages[renamingPageIdx], title: trimmed };
      return pages;
    });
    setRenamingPageIdx(null);
  };

  useEffect(() => {
    if (pageMenuIdx === null) return;
    const close = () => setPageMenuIdx(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [pageMenuIdx]);

  const [workflowNom, setWorkflowNom] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const startEditName = () => {
    setNameValue(workflowNom);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  };

  const saveNameEdit = async () => {
    if (!editingName) return;
    setEditingName(false);
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === workflowNom) return;
    setWorkflowNom(trimmed);
    await api.updateWorkflow(id!, { nom: trimmed });
  };

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const { data: workflow, loading, error } = useApi(
    () => api.getWorkflow(id!),
    [id]
  );

  useEffect(() => {
    if (!workflow) return;
    setWorkflowNom(workflow.nom);
    if (workflow.formulaire_demande && workflow.formulaire_demande.length > 0) {
      setDemandePages(workflow.formulaire_demande as unknown as FormPage[]);
    }
    if (workflow.nodes && workflow.nodes.length > 0) {
      setInstructionNodes(workflow.nodes as unknown as WorkflowNode[]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow?.id]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      await api.updateWorkflow(id!, {
        formulaire_demande: demandePages,
        nodes: instructionNodes,
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-6"><LoadingSpinner label="Chargement du workflow..." /></div>;
  if (error) return <div className="p-6"><ErrorMessage message={error} /></div>;
  if (!workflow) return null;

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'formulaire_demande', label: 'Formulaire de demande', icon: FileText },
    { id: 'workflow', label: 'Workflow', icon: GitBranch },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-0 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/workflows')}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={16} className="text-slate-500" />
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                {editingName ? (
                  <input
                    ref={nameInputRef}
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onBlur={saveNameEdit}
                    onKeyDown={(e) => { if (e.key === 'Enter') nameInputRef.current?.blur(); if (e.key === 'Escape') setEditingName(false); }}
                    className="text-xl font-bold text-slate-800 bg-transparent border-b-2 border-blue-500 outline-none w-72"
                    autoFocus
                  />
                ) : (
                  <>
                    <h1 className="text-xl font-bold text-slate-800">{workflowNom}</h1>
                    <button
                      onClick={startEditName}
                      className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                  </>
                )}
              </div>
              <p className="text-sm text-slate-500">{workflow.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full font-medium">
              {workflow.type}
            </span>
            <button
              onClick={() => window.open(`/forms/${id}`, '_blank')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ExternalLink size={14} />
              Prévisualiser
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-70 ${
                saveStatus === 'saved'
                  ? 'bg-emerald-600 text-white'
                  : saveStatus === 'error'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Save size={14} />
              {isSaving ? 'Enregistrement…' : saveStatus === 'saved' ? 'Enregistré !' : saveStatus === 'error' ? 'Erreur' : 'Enregistrer'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'formulaire_demande' && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Page tabs strip */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-200 bg-white shrink-0 overflow-x-auto">
              {demandePages.map((page, idx) => (
                <div
                  key={page.id}
                  className={`group flex items-center gap-1 pl-3 pr-1 py-1.5 rounded-lg text-sm cursor-pointer shrink-0 transition-colors ${idx === activePageIdx ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
                  onClick={() => { setActivePageIdx(idx); setPageMenuIdx(null); setMenuAnchor(null); }}
                >
                  {renamingPageIdx === idx ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={confirmRename}
                      onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenamingPageIdx(null); }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-24 text-sm font-medium bg-white border border-blue-400 rounded px-1.5 py-0.5 outline-none ring-1 ring-blue-400 text-blue-700"
                    />
                  ) : (
                    <span>{page.title || `Page ${idx + 1}`}</span>
                  )}

                  {/* Three dots button */}
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (pageMenuIdx === idx) {
                        setPageMenuIdx(null);
                        setMenuAnchor(null);
                      } else {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMenuAnchor({ top: rect.bottom + 4, left: rect.left });
                        setPageMenuIdx(idx);
                      }
                    }}
                    className={`p-0.5 rounded transition-all ${idx === activePageIdx ? 'opacity-50 hover:opacity-100 hover:bg-blue-100' : 'opacity-0 group-hover:opacity-60 hover:opacity-100! hover:bg-slate-200'}`}
                  >
                    <MoreHorizontal size={13} />
                  </button>
                </div>
              ))}
              <button
                onClick={addPage}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shrink-0 ml-1"
              >
                <Plus size={13} />
                Page
              </button>
            </div>

            {/* Page dropdown menu — fixed to avoid overflow clipping */}
            {pageMenuIdx !== null && menuAnchor && (
              <div
                style={{ position: 'fixed', top: menuAnchor.top, left: menuAnchor.left }}
                className="bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 w-40"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    setRenameValue(demandePages[pageMenuIdx]?.title || `Page ${pageMenuIdx + 1}`);
                    setRenamingPageIdx(pageMenuIdx);
                    setActivePageIdx(pageMenuIdx);
                    setPageMenuIdx(null);
                    setMenuAnchor(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Pencil size={13} className="text-slate-400" />
                  Renommer
                </button>
                {demandePages.length > 1 && (
                  <button
                    onClick={() => { deletePage(pageMenuIdx); setPageMenuIdx(null); setMenuAnchor(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={13} />
                    Supprimer la page
                  </button>
                )}
              </div>
            )}
            <FormBuilder
              blocks={demandePages[activePageIdx]?.blocks ?? []}
              isInstruction={false}
              setBlocks={(action) => {
                setDemandePages((prev) => {
                  const pages = [...prev];
                  const cur = pages[activePageIdx].blocks;
                  pages[activePageIdx] = { ...pages[activePageIdx], blocks: typeof action === 'function' ? (action as (p: FormBlock[]) => FormBlock[])(cur) : action };
                  return pages;
                });
              }}
            />
          </div>
        )}
        {activeTab === 'workflow' && (
          <InstructionWorkflowBuilder
            nodes={instructionNodes}
            setNodes={setInstructionNodes}
            demandeBlocks={demandePages.flatMap((p) => p.blocks)}
          />
        )}
      </div>
    </div>
  );
}
