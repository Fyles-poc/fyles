import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp,
  FileText, GitBranch, Save, GripVertical, ExternalLink,
  Type, AlignLeft, AlignJustify, List, ChevronDownSquare,
  CheckSquare, Hash, Mail, Phone, Calendar,
  Upload, Files, Heading1, AlertCircle, X, ShieldAlert, Search,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { LoadingSpinner, ErrorMessage } from '../components/ui/LoadingSpinner';
import type { Workflow } from '../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

type TabId = 'formulaire_demande' | 'formulaire_instruction';

type FieldType =
  | 'header' | 'text'
  | 'short_answer' | 'long_answer' | 'number' | 'email' | 'phone' | 'date'
  | 'multiple_choice' | 'dropdown' | 'multiselect'
  | 'file_upload' | 'multifile_upload'
  | 'eligibility';

interface FormBlock {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  eligibility?: boolean;
  options?: string[];
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
  };
  return map[type];
};

// ── BlockCard ──────────────────────────────────────────────────────────────

function BlockCard({
  block, isInstruction,
  onDelete, onLabelChange, onToggleRequired, onToggleEligibility,
  onDragStart, onDragOver, onDrop,
}: {
  block: FormBlock;
  isInstruction: boolean;
  onDelete: () => void;
  onLabelChange: (v: string) => void;
  onToggleRequired: () => void;
  onToggleEligibility: () => void;
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
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Drag handle */}
        <div className="mt-1 cursor-grab text-slate-300 hover:text-slate-500 flex-shrink-0">
          <GripVertical size={16} />
        </div>

        {/* Icon */}
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${meta.color}`}>
          <Icon size={14} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Type badge */}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium mb-1.5 inline-block ${meta.color}`}>
            {meta.label}
          </span>

          {/* Label input */}
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

          {/* Preview input */}
          <div className="mt-2">
            {block.type === 'short_answer' && (
              <div className="h-8 bg-slate-50 border border-slate-200 rounded-lg" />
            )}
            {block.type === 'long_answer' && (
              <div className="h-16 bg-slate-50 border border-slate-200 rounded-lg" />
            )}
            {block.type === 'number' && (
              <div className="h-8 w-32 bg-slate-50 border border-slate-200 rounded-lg" />
            )}
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
              <div className="space-y-1.5 mt-1">
                {['Option 1', 'Option 2', 'Option 3'].map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-4 h-4 border border-slate-300 ${block.type === 'multiselect' ? 'rounded' : 'rounded-full'} flex-shrink-0`} />
                    <span className="text-xs text-slate-400">{o}</span>
                  </div>
                ))}
              </div>
            )}
            {block.type === 'dropdown' && (
              <div className="h-8 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between px-3">
                <span className="text-xs text-slate-300">Sélectionner...</span>
                <ChevronDown size={12} className="text-slate-300" />
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

          {/* Footer controls */}
          {block.type !== 'header' && block.type !== 'text' && (
            <div className="flex items-center gap-4 mt-3 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={block.required}
                  onChange={onToggleRequired}
                  className="accent-blue-600 w-3.5 h-3.5"
                />
                <span className="text-xs text-slate-500">Requis</span>
              </label>
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
              <button className="text-xs text-slate-400 hover:text-slate-600 transition-colors ml-auto">
                + Ajouter une condition
              </button>
            </div>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
        >
          <Trash2 size={14} className="text-slate-300 hover:text-red-400" />
        </button>
      </div>
    </div>
  );
}

// ── FormTree ───────────────────────────────────────────────────────────────

function FormTree({ pages, currentPage }: { pages: FormPage[]; currentPage: number }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = (pageId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col border-l border-slate-200 bg-slate-50">
      <div className="px-4 py-3 border-b border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Structure du formulaire</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {pages.map((page, idx) => {
          const isCollapsed = collapsed.has(page.id);
          const isCurrent = idx === currentPage;
          const meta_list = page.blocks.map((b) => fieldMeta(b.type));
          return (
            <div key={page.id} className={`rounded-lg border ${isCurrent ? 'border-blue-200 bg-white' : 'border-slate-200 bg-white'}`}>
              <button
                onClick={() => toggleCollapse(page.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <FileText size={12} className={isCurrent ? 'text-blue-500' : 'text-slate-400'} />
                  <span className={`text-xs font-semibold ${isCurrent ? 'text-blue-600' : 'text-slate-600'}`}>
                    {page.title}
                  </span>
                  <span className="text-xs text-slate-400">({page.blocks.length})</span>
                </div>
                {isCollapsed
                  ? <ChevronDown size={12} className="text-slate-400" />
                  : <ChevronUp size={12} className="text-slate-400" />}
              </button>
              {!isCollapsed && page.blocks.length > 0 && (
                <div className="border-t border-slate-100 px-3 py-2 space-y-1">
                  {page.blocks.map((block, bi) => {
                    const m = meta_list[bi];
                    const Icon = m.icon;
                    return (
                      <div key={block.id} className="flex items-center gap-2 py-1">
                        <Icon size={11} className="text-slate-400 flex-shrink-0" />
                        <span className="text-xs text-slate-600 truncate flex-1">{block.label || '(sans titre)'}</span>
                        {block.type === 'eligibility' && (
                          <span className="text-xs text-red-500 font-bold">KO</span>
                        )}
                        {block.eligibility && block.type !== 'eligibility' && (
                          <ShieldAlert size={10} className="text-red-400 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {!isCollapsed && page.blocks.length === 0 && (
                <div className="border-t border-slate-100 px-3 py-2">
                  <p className="text-xs text-slate-400 italic">Aucun champ</p>
                </div>
              )}
            </div>
          );
        })}
        {pages.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-4">Aucune page</p>
        )}
      </div>
    </div>
  );
}

// ── FormBuilder ────────────────────────────────────────────────────────────

function FormBuilder({
  pages, currentPage, isInstruction,
  setPages, setCurrentPage,
}: {
  pages: FormPage[];
  currentPage: number;
  isInstruction: boolean;
  setPages: React.Dispatch<React.SetStateAction<FormPage[]>>;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [search, setSearch] = useState('');
  const dragRef = useRef<number | null>(null);

  const page = pages[currentPage];

  const addPage = () => {
    const newPage: FormPage = {
      id: `p${Date.now()}`,
      title: `Page ${pages.length + 1}`,
      blocks: [],
    };
    setPages((prev) => [...prev, newPage]);
    setCurrentPage(pages.length);
  };

  const addBlock = (type: FieldType) => {
    const newBlock: FormBlock = {
      id: `b${Date.now()}`,
      type,
      label: '',
      required: type !== 'header' && type !== 'text',
    };
    setPages((prev) =>
      prev.map((p, i) =>
        i === currentPage ? { ...p, blocks: [...p.blocks, newBlock] } : p
      )
    );
    setShowAddMenu(false);
  };

  const deleteBlock = (blockId: string) => {
    setPages((prev) =>
      prev.map((p, i) =>
        i === currentPage ? { ...p, blocks: p.blocks.filter((b) => b.id !== blockId) } : p
      )
    );
  };

  const updateBlock = (blockId: string, patch: Partial<FormBlock>) => {
    setPages((prev) =>
      prev.map((p, i) =>
        i === currentPage
          ? { ...p, blocks: p.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) }
          : p
      )
    );
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
    setPages((prev) =>
      prev.map((p, i) => {
        if (i !== currentPage) return p;
        const blocks = [...p.blocks];
        const [moved] = blocks.splice(dragRef.current!, 1);
        blocks.splice(targetIndex, 0, moved);
        return { ...p, blocks };
      })
    );
    dragRef.current = null;
  };

  const groups = isInstruction
    ? [...FIELD_GROUPS, { label: 'Instruction', fields: [INSTRUCTION_EXTRA] }]
    : FIELD_GROUPS;

  return (
    <div className="flex h-full">
      {/* Canvas (70%) */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ width: '70%' }}>
        {/* Page tabs */}
        <div className="flex items-center gap-1 px-5 pt-4 pb-0 border-b border-slate-100 bg-white flex-shrink-0">
          {pages.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => setCurrentPage(idx)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                idx === currentPage
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {p.title}
            </button>
          ))}
          <button
            onClick={addPage}
            className="flex items-center gap-1 px-3 py-2 text-xs text-slate-400 hover:text-blue-600 transition-colors border-b-2 border-transparent"
          >
            <Plus size={12} />
          </button>
        </div>

        {/* Blocks */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50">
          {page?.blocks.length === 0 && (
            <div className="text-center py-16">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <AlignLeft size={20} className="text-slate-300" />
              </div>
              <p className="text-sm text-slate-400 font-medium">Formulaire vide</p>
              <p className="text-xs text-slate-400 mt-1">Ajoutez un champ pour commencer</p>
            </div>
          )}
          {page?.blocks.map((block, bi) => (
            <BlockCard
              key={block.id}
              block={block}
              isInstruction={isInstruction}
              onDelete={() => deleteBlock(block.id)}
              onLabelChange={(v) => updateBlock(block.id, { label: v })}
              onToggleRequired={() => updateBlock(block.id, { required: !block.required })}
              onToggleEligibility={() => updateBlock(block.id, { eligibility: !block.eligibility })}
              onDragStart={(e) => handleDragStart(e, bi)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, bi)}
            />
          ))}

          {/* Add field button */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-2 text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors px-4 py-2.5 border-2 border-dashed border-blue-200 rounded-xl w-full justify-center hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              <Plus size={16} />
              Ajouter un champ
            </button>

            {showAddMenu && (
              <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center"
                onClick={() => { setShowAddMenu(false); setSearch(''); }}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl w-80 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="px-5 pt-5 pb-4 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-base font-semibold text-slate-800">Ajouter un champ</h3>
                      <button
                        onClick={() => { setShowAddMenu(false); setSearch(''); }}
                        className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <X size={16} className="text-slate-400" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">Sélectionnez le type de champ à ajouter au formulaire</p>
                    {/* Search */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <Search size={13} className="text-slate-400 flex-shrink-0" />
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

                  {/* Groups */}
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
                                onClick={() => addBlock(type)}
                                className="flex items-center gap-3 w-full px-5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                              >
                                <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                                  <Icon size={14} />
                                </span>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                    {search && groups.every((g) => g.fields.every(({ label }) => !label.toLowerCase().includes(search.toLowerCase()))) && (
                      <p className="text-xs text-slate-400 text-center py-6 px-4">Aucun champ trouvé pour « {search} »</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Add page */}
          <button
            onClick={addPage}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors mx-auto pt-2"
          >
            <Plus size={12} />
            Ajouter une page
          </button>
        </div>
      </div>

      {/* Tree (30%) */}
      <div className="flex-shrink-0" style={{ width: '30%' }}>
        <FormTree pages={pages} currentPage={currentPage} />
      </div>
    </div>
  );
}

// ── WorkflowDetail ─────────────────────────────────────────────────────────

export function WorkflowDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('formulaire_demande');

  const [demandePage, setDemandePage] = useState(0);
  const [demandePages, setDemandePages] = useState<FormPage[]>([
    { id: 'p1', title: 'Page 1', blocks: [] },
  ]);

  const [instructionPage, setInstructionPage] = useState(0);
  const [instructionPages, setInstructionPages] = useState<FormPage[]>([
    { id: 'p1', title: 'Page 1', blocks: [] },
  ]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const { data: workflow, loading, error } = useApi(
    () => api.getWorkflow(id!),
    [id]
  );

  useEffect(() => {
    if (!workflow) return;
    if (workflow.formulaire_demande?.length > 0) {
      setDemandePages(workflow.formulaire_demande as unknown as FormPage[]);
    }
    if (workflow.formulaire_instruction?.length > 0) {
      setInstructionPages(workflow.formulaire_instruction as unknown as FormPage[]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow?.id]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      await api.updateWorkflow(id!, {
        formulaire_demande: demandePages,
        formulaire_instruction: instructionPages,
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
    { id: 'formulaire_instruction', label: "Formulaire d'instruction", icon: GitBranch },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-0 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/workflows')}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={16} className="text-slate-500" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">{workflow.nom}</h1>
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
          <FormBuilder
            pages={demandePages}
            currentPage={demandePage}
            isInstruction={false}
            setPages={setDemandePages}
            setCurrentPage={setDemandePage}
          />
        )}
        {activeTab === 'formulaire_instruction' && (
          <FormBuilder
            pages={instructionPages}
            currentPage={instructionPage}
            isInstruction={true}
            setPages={setInstructionPages}
            setCurrentPage={setInstructionPage}
          />
        )}
      </div>
    </div>
  );
}
