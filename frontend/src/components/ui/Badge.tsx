import type { DossierStatus, DocumentStatus } from '../../types';

type StatusBadgeProps =
  | { type: 'dossier'; status: DossierStatus }
  | { type: 'document'; status: DocumentStatus };

const dossierConfig: Record<DossierStatus, { label: string; className: string }> = {
  boite_reception: { label: 'Boîte de réception', className: 'bg-purple-100 text-purple-700' },
  en_instruction: { label: 'En instruction', className: 'bg-blue-100 text-blue-700' },
  en_attente: { label: 'En attente', className: 'bg-amber-100 text-amber-700' },
  approuve: { label: 'Approuvé', className: 'bg-emerald-100 text-emerald-700' },
  refuse: { label: 'Refusé', className: 'bg-red-100 text-red-700' },
};

const documentConfig: Record<DocumentStatus, { label: string; className: string }> = {
  valide: { label: 'Validé', className: 'bg-emerald-100 text-emerald-700' },
  manquant: { label: 'Manquant', className: 'bg-slate-100 text-slate-500' },
  invalide: { label: 'Invalide', className: 'bg-red-100 text-red-700' },
  en_attente: { label: 'En attente', className: 'bg-amber-100 text-amber-700' },
};

export function StatusBadge(props: StatusBadgeProps) {
  const config =
    props.type === 'dossier'
      ? dossierConfig[props.status]
      : documentConfig[props.status];

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

interface ConfidenceBadgeProps {
  value: number;
}

export function ConfidenceBadge({ value }: ConfidenceBadgeProps) {
  const color =
    value >= 80 ? 'text-emerald-600 bg-emerald-50' :
    value >= 60 ? 'text-amber-600 bg-amber-50' :
    'text-red-600 bg-red-50';

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {value}%
    </span>
  );
}
