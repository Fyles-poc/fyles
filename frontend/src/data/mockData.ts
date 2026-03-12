import type { Dossier, Workflow, User, Organization } from '../types';

export const mockDossiers: Dossier[] = [
  {
    id: '1',
    reference: 'DOS-2026-00127',
    demandeur: { nom: 'Martin', prenom: 'Sophie', email: 'sophie.martin@email.fr' },
    type: 'Tarif préférentiel',
    workflowId: 'wf-1',
    statut: 'en_instruction',
    confianceIA: 67,
    derniereMaj: '2026-02-28T10:30:00',
    instructeur: 'Dupont M.',
    createdAt: '2026-02-25T09:00:00',
    documents: [
      {
        id: 'd1', nom: 'Formulaire de demande', type: 'formulaire_demande',
        statut: 'valide', obligatoire: true, uploadedAt: '2026-02-25',
        fileSize: '245 Ko', validationMessage: 'Tous les champs obligatoires sont remplis'
      },
      {
        id: 'd2', nom: "Pièce d'identité", type: 'piece_identite',
        statut: 'valide', obligatoire: true, uploadedAt: '2026-02-25',
        fileSize: '1.2 Mo', validationMessage: 'CNI valide détectée'
      },
      {
        id: 'd3', nom: 'Justificatif de domicile', type: 'justificatif_domicile',
        statut: 'invalide', obligatoire: true, uploadedAt: '2026-02-25',
        fileSize: '890 Ko', validationMessage: 'Document daté de plus de 3 mois'
      },
      {
        id: 'd4', nom: "Avis d'imposition", type: 'avis_imposition',
        statut: 'valide', obligatoire: true, uploadedAt: '2026-02-26',
        fileSize: '1.8 Mo', validationMessage: 'Avis 2025 validé'
      },
      {
        id: 'd5', nom: 'RIB', type: 'rib',
        statut: 'manquant', obligatoire: false,
        validationMessage: 'Document non fourni'
      },
    ],
    analysisResults: [
      {
        id: 'a1', label: 'Complétude documentaire', statut: 'warning',
        message: '4/5 documents fournis', details: ['RIB manquant (optionnel)', 'Justificatif de domicile invalide']
      },
      {
        id: 'a2', label: 'Correspondance identité', statut: 'ok',
        message: 'Identité cohérente entre les documents', details: ['Nom et prénom identiques sur formulaire et CNI']
      },
      {
        id: 'a3', label: "Validité de l'avis d'imposition", statut: 'ok',
        message: 'Revenu fiscal de référence : 18 240 €', details: ['Plafond éligibilité : 22 000 €', 'Condition revenus : VALIDÉE']
      },
      {
        id: 'a4', label: 'Règle domicile', statut: 'error',
        message: 'Justificatif de domicile refusé', details: ['Date du document : 15/10/2025', 'Délai maximum : 3 mois', 'Document expiré']
      },
    ],
    recommendation: {
      decision: 'complement',
      confidence: 67,
      motif: 'Le dossier présente des conditions de revenus favorables mais contient un point bloquant sur le justificatif de domicile.',
      pointsBloquants: [
        'Justificatif de domicile daté de plus de 3 mois (15/10/2025)'
      ],
      pointsAttention: [
        'RIB non fourni (document optionnel)',
        'Vérifier la cohérence de l\'adresse entre les documents'
      ]
    }
  },
  {
    id: '2',
    reference: 'DOS-2026-00126',
    demandeur: { nom: 'Bernard', prenom: 'Lucas', email: 'lucas.bernard@email.fr' },
    type: 'Tarif préférentiel',
    workflowId: 'wf-1',
    statut: 'approuve',
    confianceIA: 94,
    derniereMaj: '2026-02-27T14:15:00',
    instructeur: 'Leroy A.',
    createdAt: '2026-02-24T11:00:00',
    documents: [
      {
        id: 'd6', nom: 'Formulaire de demande', type: 'formulaire_demande',
        statut: 'valide', obligatoire: true, uploadedAt: '2026-02-24', fileSize: '198 Ko'
      },
      {
        id: 'd7', nom: "Pièce d'identité", type: 'piece_identite',
        statut: 'valide', obligatoire: true, uploadedAt: '2026-02-24', fileSize: '980 Ko'
      },
      {
        id: 'd8', nom: 'Justificatif de domicile', type: 'justificatif_domicile',
        statut: 'valide', obligatoire: true, uploadedAt: '2026-02-24', fileSize: '750 Ko'
      },
      {
        id: 'd9', nom: "Avis d'imposition", type: 'avis_imposition',
        statut: 'valide', obligatoire: true, uploadedAt: '2026-02-24', fileSize: '2.1 Mo'
      },
    ],
    analysisResults: [
      { id: 'a5', label: 'Complétude documentaire', statut: 'ok', message: '4/4 documents fournis et valides', details: [] },
      { id: 'a6', label: 'Correspondance identité', statut: 'ok', message: 'Identité validée', details: [] },
      { id: 'a7', label: "Validité de l'avis d'imposition", statut: 'ok', message: 'Revenu fiscal de référence : 15 800 €', details: ['Condition revenus : VALIDÉE'] },
    ],
    recommendation: { decision: 'approuver', confidence: 94, motif: 'Dossier complet et conforme', pointsBloquants: [], pointsAttention: [] }
  },
  {
    id: '3',
    reference: 'DOS-2026-00125',
    demandeur: { nom: 'Petit', prenom: 'Marie', email: 'marie.petit@email.fr' },
    type: 'Aide logement',
    workflowId: 'wf-2',
    statut: 'en_attente',
    confianceIA: 45,
    derniereMaj: '2026-02-26T16:45:00',
    instructeur: undefined,
    createdAt: '2026-02-23T08:30:00',
    documents: [
      {
        id: 'd10', nom: 'Formulaire de demande', type: 'formulaire_demande',
        statut: 'invalide', obligatoire: true, uploadedAt: '2026-02-23', fileSize: '312 Ko',
        validationMessage: 'Champs obligatoires manquants : téléphone, adresse'
      },
      {
        id: 'd11', nom: "Pièce d'identité", type: 'piece_identite',
        statut: 'valide', obligatoire: true, uploadedAt: '2026-02-23', fileSize: '1.4 Mo'
      },
      { id: 'd12', nom: 'Justificatif de domicile', type: 'justificatif_domicile', statut: 'manquant', obligatoire: true },
      { id: 'd13', nom: "Avis d'imposition", type: 'avis_imposition', statut: 'manquant', obligatoire: true },
    ],
    analysisResults: [
      { id: 'a8', label: 'Complétude documentaire', statut: 'error', message: '2/4 documents valides', details: ['Formulaire incomplet', 'Justificatif de domicile manquant', "Avis d'imposition manquant"] },
    ],
    recommendation: { decision: 'complement', confidence: 45, motif: 'Dossier incomplet, pièces manquantes', pointsBloquants: ['Formulaire incomplet', 'Documents manquants'], pointsAttention: [] }
  },
  {
    id: '4',
    reference: 'DOS-2026-00124',
    demandeur: { nom: 'Durand', prenom: 'Thomas', email: 'thomas.durand@email.fr' },
    type: 'Tarif préférentiel',
    workflowId: 'wf-1',
    statut: 'refuse',
    confianceIA: 88,
    derniereMaj: '2026-02-25T11:20:00',
    instructeur: 'Dupont M.',
    createdAt: '2026-02-22T10:00:00',
    documents: [],
    analysisResults: [
      { id: 'a9', label: "Validité de l'avis d'imposition", statut: 'error', message: 'Revenu fiscal de référence : 35 200 € — dépasse le plafond', details: ['Plafond éligibilité : 22 000 €', 'Condition revenus : REFUSÉE'] },
    ],
    recommendation: { decision: 'refuser', confidence: 88, motif: 'Revenus supérieurs au plafond d\'éligibilité', pointsBloquants: ['Revenus (35 200 €) > plafond (22 000 €)'], pointsAttention: [] }
  },
  {
    id: '5',
    reference: 'DOS-2026-00123',
    demandeur: { nom: 'Leroy', prenom: 'Emma', email: 'emma.leroy@email.fr' },
    type: 'Aide logement',
    workflowId: 'wf-2',
    statut: 'signale',
    confianceIA: 38,
    derniereMaj: '2026-02-24T09:05:00',
    instructeur: 'Leroy A.',
    createdAt: '2026-02-21T14:00:00',
    documents: [],
    analysisResults: [],
    recommendation: { decision: 'complement', confidence: 38, motif: 'Incohérences détectées dans le dossier', pointsBloquants: ['Adresse différente entre CNI et justificatif de domicile'], pointsAttention: [] }
  },
];

export const mockWorkflows: Workflow[] = [
  {
    id: 'wf-1',
    nom: 'Instruction — demande de tarif préférentiel',
    description: 'Workflow d\'instruction pour les demandes de tarif préférentiel énergie',
    type: 'Tarif préférentiel',
    documents: [
      {
        id: 'doc-1',
        nom: 'Formulaire de demande',
        description: 'Formulaire officiel de demande de tarif préférentiel rempli et signé',
        statut: 'OBLIGATOIRE',
        validations: [
          { id: 'v1', type: 'required_fields', label: 'Champs obligatoires', prompt: 'Vérifie que le formulaire contient nom, prénom, date de naissance, adresse, téléphone' },
          { id: 'v2', type: 'llm_check', label: 'Cohérence des informations', prompt: 'Vérifie la cohérence globale des informations saisies' }
        ]
      },
      {
        id: 'doc-2',
        nom: "Pièce d'identité",
        description: "CNI ou passeport en cours de validité",
        statut: 'OBLIGATOIRE',
        validations: [
          { id: 'v3', type: 'doc_type', label: 'Type de document', prompt: 'Vérifie que le document est une CNI ou un passeport' },
          { id: 'v4', type: 'llm_check', label: 'Validité', prompt: "Vérifie que la pièce d'identité est en cours de validité" }
        ]
      },
      {
        id: 'doc-3',
        nom: 'Justificatif de domicile',
        description: 'Justificatif de domicile de moins de 3 mois',
        statut: 'OBLIGATOIRE',
        validations: [
          { id: 'v5', type: 'llm_check', label: 'Date du document', prompt: 'Vérifie que le justificatif date de moins de 3 mois' },
          { id: 'v6', type: 'llm_check', label: 'Cohérence adresse', prompt: "Vérifie que l'adresse correspond à celle du formulaire" }
        ]
      },
      {
        id: 'doc-4',
        nom: "Avis d'imposition",
        description: "Avis d'imposition sur les revenus N-1",
        statut: 'OBLIGATOIRE',
        validations: [
          { id: 'v7', type: 'llm_check', label: 'Plafond de revenus', prompt: 'Vérifie que le revenu fiscal de référence est inférieur au plafond de 22 000 €' },
          { id: 'v8', type: 'llm_check', label: 'Année de référence', prompt: "Vérifie que l'avis d'imposition est bien celui de l'année N-1" }
        ]
      },
      {
        id: 'doc-5',
        nom: 'RIB',
        description: 'Relevé d\'identité bancaire',
        statut: 'OPTIONNEL',
        validations: [
          { id: 'v9', type: 'llm_check', label: 'Format RIB', prompt: 'Vérifie que le document est un RIB valide avec IBAN' }
        ]
      },
    ],
    nodes: [
      { id: 'n1', type: 'document_check', label: 'Vérification complétude', next: 'n2' },
      { id: 'n2', type: 'identity_match', label: 'Correspondance identité', next: 'n3' },
      { id: 'n3', type: 'condition', label: 'Revenus ≤ plafond ?', next: [{ condition: 'oui', node: 'n4' }, { condition: 'non', node: 'n5' }] },
      { id: 'n4', type: 'decision', label: 'Recommander approbation' },
      { id: 'n5', type: 'decision', label: 'Recommander refus' },
    ],
    aiConfig: {
      model: 'claude-sonnet-4-6',
      temperature: 0.1,
      seuilConfianceAuto: 90,
      promptSysteme: 'Tu es un expert en instruction de dossiers administratifs. Analyse les documents fournis et vérifie leur conformité aux règles définies. Sois précis et exhaustif dans ton analyse.'
    },
    createdAt: '2026-01-15T10:00:00',
    updatedAt: '2026-02-20T14:30:00',
    dossiersCount: 127
  },
  {
    id: 'wf-2',
    nom: "Instruction — demande d'aide au logement",
    description: "Workflow d'instruction pour les demandes d'aide au logement social",
    type: 'Aide logement',
    documents: [],
    nodes: [],
    aiConfig: {
      model: 'claude-sonnet-4-6',
      temperature: 0.1,
      seuilConfianceAuto: 85,
      promptSysteme: "Tu es un expert en aides sociales au logement. Analyse rigoureusement les dossiers selon les critères d'éligibilité."
    },
    createdAt: '2026-01-20T09:00:00',
    updatedAt: '2026-02-15T11:00:00',
    dossiersCount: 43
  }
];

export const mockUsers: User[] = [
  { id: 'u1', nom: 'Dupont', prenom: 'Marc', email: 'marc.dupont@organisation.fr', role: 'instructeur', actif: true },
  { id: 'u2', nom: 'Leroy', prenom: 'Anne', email: 'anne.leroy@organisation.fr', role: 'instructeur', actif: true },
  { id: 'u3', nom: 'Moreau', prenom: 'Claire', email: 'claire.moreau@organisation.fr', role: 'superviseur', actif: true },
  { id: 'u4', nom: 'Admin', prenom: 'Système', email: 'admin@organisation.fr', role: 'admin', actif: true },
];

export const mockOrganization: Organization = {
  nom: 'Office Municipal de l\'Énergie',
  siret: '12345678900012',
  adresse: '12 rue de la Mairie, 31000 Toulouse',
  email: 'contact@ome-toulouse.fr',
  telephone: '05 61 00 00 00',
};

export const dashboardStats = {
  dossiersEnCours: 12,
  enAttenteValidation: 3,
  autoApprouves: 18,
  signalesIA: 5,
  statusDistribution: [
    { name: 'En cours', value: 12, color: '#3b82f6' },
    { name: 'En attente', value: 3, color: '#f59e0b' },
    { name: 'Approuvés', value: 18, color: '#10b981' },
    { name: 'Refusés', value: 7, color: '#ef4444' },
    { name: 'Signalés', value: 5, color: '#8b5cf6' },
  ],
  recentActivity: [
    { id: 'r1', type: 'decision', dossier: 'DOS-2026-00126', action: 'Dossier approuvé par Leroy A.', time: 'Il y a 2h', icon: 'check' },
    { id: 'r2', type: 'signal', dossier: 'DOS-2026-00123', action: 'Dossier signalé par l\'IA (confiance 38%)', time: 'Il y a 3h', icon: 'alert' },
    { id: 'r3', type: 'new', dossier: 'DOS-2026-00127', action: 'Nouveau dossier reçu — analyse en cours', time: 'Il y a 5h', icon: 'plus' },
    { id: 'r4', type: 'decision', dossier: 'DOS-2026-00124', action: 'Dossier refusé par Dupont M.', time: 'Hier 11h20', icon: 'x' },
    { id: 'r5', type: 'new', dossier: 'DOS-2026-00125', action: 'Nouveau dossier reçu — en attente de pièces', time: 'Hier 08h30', icon: 'plus' },
  ]
};
