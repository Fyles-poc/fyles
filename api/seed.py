"""
Script de peuplement de la base MongoDB avec les données de démonstration.
Usage : poetry run python -m api.seed
"""

import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from api.config import get_settings
from api.models.dossier import (
    Dossier, Demandeur, DocumentItem, AIAnalysisResult,
    AIRecommendation, DossierStatus, DocumentStatus, RecommendationDecision,
)
from api.models.workflow import Workflow, WorkflowDocument, WorkflowValidation, WorkflowNode, AIConfig
from api.models.user import User, UserRole
from api.models.organization import Organization


async def seed():
    cfg = get_settings()
    client = AsyncIOMotorClient(cfg.mongodb_url)
    await init_beanie(
        database=client[cfg.mongodb_db],
        document_models=[Dossier, Workflow, User, Organization],
    )

    print("Nettoyage des collections existantes...")
    await Dossier.delete_all()
    await Workflow.delete_all()
    await User.delete_all()
    await Organization.delete_all()

    # ── Dossiers ─────────────────────────────────────────────────────────────
    print("Insertion des dossiers...")
    dossiers = [
        Dossier(
            reference="DOS-2026-00127",
            demandeur=Demandeur(nom="Martin", prenom="Sophie", email="sophie.martin@email.fr"),
            type="Tarif préférentiel", workflow_id="wf-1",
            statut=DossierStatus.en_cours, confiance_ia=67,
            derniere_maj=datetime(2026, 2, 28, 10, 30), instructeur="Dupont M.",
            created_at=datetime(2026, 2, 25, 9, 0),
            documents=[
                DocumentItem(id="d1", nom="Formulaire de demande", type="formulaire_demande",
                             statut=DocumentStatus.valide, obligatoire=True,
                             uploaded_at="2026-02-25", file_size="245 Ko",
                             validation_message="Tous les champs obligatoires sont remplis"),
                DocumentItem(id="d2", nom="Pièce d'identité", type="piece_identite",
                             statut=DocumentStatus.valide, obligatoire=True,
                             uploaded_at="2026-02-25", file_size="1.2 Mo",
                             validation_message="CNI valide détectée"),
                DocumentItem(id="d3", nom="Justificatif de domicile", type="justificatif_domicile",
                             statut=DocumentStatus.invalide, obligatoire=True,
                             uploaded_at="2026-02-25", file_size="890 Ko",
                             validation_message="Document daté de plus de 3 mois"),
                DocumentItem(id="d4", nom="Avis d'imposition", type="avis_imposition",
                             statut=DocumentStatus.valide, obligatoire=True,
                             uploaded_at="2026-02-26", file_size="1.8 Mo",
                             validation_message="Avis 2025 validé"),
                DocumentItem(id="d5", nom="RIB", type="rib",
                             statut=DocumentStatus.manquant, obligatoire=False,
                             validation_message="Document non fourni"),
            ],
            analysis_results=[
                AIAnalysisResult(id="a1", label="Complétude documentaire", statut="warning",
                                 message="4/5 documents fournis",
                                 details=["RIB manquant (optionnel)", "Justificatif de domicile invalide"]),
                AIAnalysisResult(id="a2", label="Correspondance identité", statut="ok",
                                 message="Identité cohérente entre les documents",
                                 details=["Nom et prénom identiques sur formulaire et CNI"]),
                AIAnalysisResult(id="a3", label="Validité de l'avis d'imposition", statut="ok",
                                 message="Revenu fiscal de référence : 18 240 €",
                                 details=["Plafond éligibilité : 22 000 €", "Condition revenus : VALIDÉE"]),
                AIAnalysisResult(id="a4", label="Règle domicile", statut="error",
                                 message="Justificatif de domicile refusé",
                                 details=["Date du document : 15/10/2025", "Délai maximum : 3 mois", "Document expiré"]),
            ],
            recommendation=AIRecommendation(
                decision=RecommendationDecision.complement, confidence=67,
                motif="Le dossier présente des conditions de revenus favorables mais contient un point bloquant sur le justificatif de domicile.",
                points_bloquants=["Justificatif de domicile daté de plus de 3 mois (15/10/2025)"],
                points_attention=["RIB non fourni (document optionnel)",
                                  "Vérifier la cohérence de l'adresse entre les documents"],
            ),
        ),
        Dossier(
            reference="DOS-2026-00126",
            demandeur=Demandeur(nom="Bernard", prenom="Lucas", email="lucas.bernard@email.fr"),
            type="Tarif préférentiel", workflow_id="wf-1",
            statut=DossierStatus.approuve, confiance_ia=94,
            derniere_maj=datetime(2026, 2, 27, 14, 15), instructeur="Leroy A.",
            created_at=datetime(2026, 2, 24, 11, 0),
            documents=[
                DocumentItem(id="d6", nom="Formulaire de demande", type="formulaire_demande",
                             statut=DocumentStatus.valide, obligatoire=True,
                             uploaded_at="2026-02-24", file_size="198 Ko"),
                DocumentItem(id="d7", nom="Pièce d'identité", type="piece_identite",
                             statut=DocumentStatus.valide, obligatoire=True,
                             uploaded_at="2026-02-24", file_size="980 Ko"),
                DocumentItem(id="d8", nom="Justificatif de domicile", type="justificatif_domicile",
                             statut=DocumentStatus.valide, obligatoire=True,
                             uploaded_at="2026-02-24", file_size="750 Ko"),
                DocumentItem(id="d9", nom="Avis d'imposition", type="avis_imposition",
                             statut=DocumentStatus.valide, obligatoire=True,
                             uploaded_at="2026-02-24", file_size="2.1 Mo"),
            ],
            analysis_results=[
                AIAnalysisResult(id="a5", label="Complétude documentaire", statut="ok",
                                 message="4/4 documents fournis et valides"),
                AIAnalysisResult(id="a6", label="Correspondance identité", statut="ok",
                                 message="Identité validée"),
                AIAnalysisResult(id="a7", label="Validité de l'avis d'imposition", statut="ok",
                                 message="Revenu fiscal de référence : 15 800 €",
                                 details=["Condition revenus : VALIDÉE"]),
            ],
            recommendation=AIRecommendation(
                decision=RecommendationDecision.approuver, confidence=94,
                motif="Dossier complet et conforme à toutes les règles.",
                points_bloquants=[], points_attention=[],
            ),
        ),
        Dossier(
            reference="DOS-2026-00125",
            demandeur=Demandeur(nom="Petit", prenom="Marie", email="marie.petit@email.fr"),
            type="Aide logement", workflow_id="wf-2",
            statut=DossierStatus.en_attente, confiance_ia=45,
            derniere_maj=datetime(2026, 2, 26, 16, 45), instructeur=None,
            created_at=datetime(2026, 2, 23, 8, 30),
            documents=[
                DocumentItem(id="d10", nom="Formulaire de demande", type="formulaire_demande",
                             statut=DocumentStatus.invalide, obligatoire=True,
                             uploaded_at="2026-02-23", file_size="312 Ko",
                             validation_message="Champs obligatoires manquants : téléphone, adresse"),
                DocumentItem(id="d11", nom="Pièce d'identité", type="piece_identite",
                             statut=DocumentStatus.valide, obligatoire=True,
                             uploaded_at="2026-02-23", file_size="1.4 Mo"),
                DocumentItem(id="d12", nom="Justificatif de domicile", type="justificatif_domicile",
                             statut=DocumentStatus.manquant, obligatoire=True),
                DocumentItem(id="d13", nom="Avis d'imposition", type="avis_imposition",
                             statut=DocumentStatus.manquant, obligatoire=True),
            ],
            analysis_results=[
                AIAnalysisResult(id="a8", label="Complétude documentaire", statut="error",
                                 message="2/4 documents valides",
                                 details=["Formulaire incomplet", "Justificatif de domicile manquant",
                                          "Avis d'imposition manquant"]),
            ],
            recommendation=AIRecommendation(
                decision=RecommendationDecision.complement, confidence=45,
                motif="Dossier incomplet, pièces manquantes.",
                points_bloquants=["Formulaire incomplet", "Documents manquants"],
                points_attention=[],
            ),
        ),
        Dossier(
            reference="DOS-2026-00124",
            demandeur=Demandeur(nom="Durand", prenom="Thomas", email="thomas.durand@email.fr"),
            type="Tarif préférentiel", workflow_id="wf-1",
            statut=DossierStatus.refuse, confiance_ia=88,
            derniere_maj=datetime(2026, 2, 25, 11, 20), instructeur="Dupont M.",
            created_at=datetime(2026, 2, 22, 10, 0),
            documents=[],
            analysis_results=[
                AIAnalysisResult(id="a9", label="Validité de l'avis d'imposition", statut="error",
                                 message="Revenu fiscal de référence : 35 200 € — dépasse le plafond",
                                 details=["Plafond éligibilité : 22 000 €", "Condition revenus : REFUSÉE"]),
            ],
            recommendation=AIRecommendation(
                decision=RecommendationDecision.refuser, confidence=88,
                motif="Revenus supérieurs au plafond d'éligibilité.",
                points_bloquants=["Revenus (35 200 €) > plafond (22 000 €)"],
                points_attention=[],
            ),
        ),
        Dossier(
            reference="DOS-2026-00123",
            demandeur=Demandeur(nom="Leroy", prenom="Emma", email="emma.leroy@email.fr"),
            type="Aide logement", workflow_id="wf-2",
            statut=DossierStatus.signale, confiance_ia=38,
            derniere_maj=datetime(2026, 2, 24, 9, 5), instructeur="Leroy A.",
            created_at=datetime(2026, 2, 21, 14, 0),
            documents=[], analysis_results=[],
            recommendation=AIRecommendation(
                decision=RecommendationDecision.complement, confidence=38,
                motif="Incohérences détectées dans le dossier.",
                points_bloquants=["Adresse différente entre CNI et justificatif de domicile"],
                points_attention=[],
            ),
        ),
    ]
    for d in dossiers:
        await d.insert()
    print(f"   {len(dossiers)} dossiers insérés.")

    # ── Workflows ─────────────────────────────────────────────────────────────
    print("Insertion des workflows...")
    workflows = [
        Workflow(
            nom="Instruction — demande de tarif préférentiel",
            description="Workflow d'instruction pour les demandes de tarif préférentiel énergie",
            type="Tarif préférentiel", dossiers_count=127,
            created_at=datetime(2026, 1, 15, 10, 0),
            updated_at=datetime(2026, 2, 20, 14, 30),
            ai_config=AIConfig(
                model="claude-sonnet-4-6", temperature=0.1, seuil_confiance_auto=90,
                prompt_systeme=(
                    "Tu es un expert en instruction de dossiers administratifs. "
                    "Analyse les documents fournis et vérifie leur conformité aux règles définies."
                ),
            ),
            documents=[
                WorkflowDocument(
                    id="doc-1", nom="Formulaire de demande",
                    description="Formulaire officiel de demande de tarif préférentiel rempli et signé",
                    statut="OBLIGATOIRE",
                    validations=[
                        WorkflowValidation(id="v1", type="required_fields", label="Champs obligatoires",
                                           prompt="Vérifie que le formulaire contient nom, prénom, date de naissance, adresse, téléphone"),
                        WorkflowValidation(id="v2", type="llm_check", label="Cohérence des informations",
                                           prompt="Vérifie la cohérence globale des informations saisies"),
                    ],
                ),
                WorkflowDocument(
                    id="doc-2", nom="Pièce d'identité",
                    description="CNI ou passeport en cours de validité", statut="OBLIGATOIRE",
                    validations=[
                        WorkflowValidation(id="v3", type="doc_type", label="Type de document",
                                           prompt="Vérifie que le document est une CNI ou un passeport"),
                        WorkflowValidation(id="v4", type="llm_check", label="Validité",
                                           prompt="Vérifie que la pièce d'identité est en cours de validité"),
                    ],
                ),
                WorkflowDocument(
                    id="doc-3", nom="Justificatif de domicile",
                    description="Justificatif de domicile de moins de 3 mois", statut="OBLIGATOIRE",
                    validations=[
                        WorkflowValidation(id="v5", type="llm_check", label="Date du document",
                                           prompt="Vérifie que le justificatif date de moins de 3 mois"),
                        WorkflowValidation(id="v6", type="llm_check", label="Cohérence adresse",
                                           prompt="Vérifie que l'adresse correspond à celle du formulaire"),
                    ],
                ),
                WorkflowDocument(
                    id="doc-4", nom="Avis d'imposition",
                    description="Avis d'imposition sur les revenus N-1", statut="OBLIGATOIRE",
                    validations=[
                        WorkflowValidation(id="v7", type="llm_check", label="Plafond de revenus",
                                           prompt="Vérifie que le revenu fiscal de référence est inférieur au plafond de 22 000 €"),
                        WorkflowValidation(id="v8", type="llm_check", label="Année de référence",
                                           prompt="Vérifie que l'avis d'imposition est bien celui de l'année N-1"),
                    ],
                ),
                WorkflowDocument(
                    id="doc-5", nom="RIB", description="Relevé d'identité bancaire", statut="OPTIONNEL",
                    validations=[
                        WorkflowValidation(id="v9", type="llm_check", label="Format RIB",
                                           prompt="Vérifie que le document est un RIB valide avec IBAN"),
                    ],
                ),
            ],
            nodes=[
                WorkflowNode(id="n1", type="document_check", label="Vérification complétude", next="n2"),
                WorkflowNode(id="n2", type="identity_match", label="Correspondance identité", next="n3"),
                WorkflowNode(id="n3", type="condition", label="Revenus ≤ plafond ?",
                             next=[{"condition": "oui", "node": "n4"}, {"condition": "non", "node": "n5"}]),
                WorkflowNode(id="n4", type="decision", label="Recommander approbation"),
                WorkflowNode(id="n5", type="decision", label="Recommander refus"),
            ],
        ),
        Workflow(
            nom="Instruction — demande d'aide au logement",
            description="Workflow d'instruction pour les demandes d'aide au logement social",
            type="Aide logement", dossiers_count=43,
            created_at=datetime(2026, 1, 20, 9, 0),
            updated_at=datetime(2026, 2, 15, 11, 0),
            ai_config=AIConfig(
                model="claude-sonnet-4-6", temperature=0.1, seuil_confiance_auto=85,
                prompt_systeme="Tu es un expert en aides sociales au logement.",
            ),
            documents=[], nodes=[],
        ),
    ]
    for w in workflows:
        await w.insert()
    print(f"   {len(workflows)} workflows insérés.")

    # ── Users ─────────────────────────────────────────────────────────────────
    print("Insertion des utilisateurs...")
    users = [
        User(nom="Dupont", prenom="Marc", email="marc.dupont@organisation.fr",
             role=UserRole.instructeur, actif=True),
        User(nom="Leroy", prenom="Anne", email="anne.leroy@organisation.fr",
             role=UserRole.instructeur, actif=True),
        User(nom="Moreau", prenom="Claire", email="claire.moreau@organisation.fr",
             role=UserRole.superviseur, actif=True),
        User(nom="Admin", prenom="Système", email="admin@organisation.fr",
             role=UserRole.admin, actif=True),
    ]
    for u in users:
        await u.insert()
    print(f"   {len(users)} utilisateurs insérés.")

    # ── Organisation ─────────────────────────────────────────────────────────
    print("Insertion de l'organisation...")
    await Organization(
        nom="Office Municipal de l'Énergie",
        siret="12345678900012",
        adresse="12 rue de la Mairie, 31000 Toulouse",
        email="contact@ome-toulouse.fr",
        telephone="05 61 00 00 00",
    ).insert()

    print("Base de données peuplée avec succès !")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
