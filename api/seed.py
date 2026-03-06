"""
Script de peuplement de la base MongoDB + upload des fichiers dans MinIO.
Usage : poetry run python -m api.seed
"""

import asyncio
import mimetypes
import time
from datetime import datetime
from pathlib import Path

from minio import Minio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from api.config import get_settings
from api.models.dossier import (
    Dossier, Demandeur, DocumentItem, AIAnalysisResult,
    AIRecommendation, DossierStatus, DocumentStatus, RecommendationDecision,
)
from api.models.workflow import Workflow, WorkflowNode, AIConfig, FormPage, FormBlock, FormCondition
from api.models.user import User, UserRole
from api.models.organization import Organization
from api.storage import get_minio_client, ensure_bucket

DATA_DIR = Path(__file__).parent.parent / "data"

# ── Mapping dossier par email ────────────────────────────────────────────────

DOSSIERS_META = [
    {
        "folder": "tisseo.aam.test@yopmail.com",
        "reference": "DOS-2026-00001",
        "nom": "Harkfell", "prenom": "Jean",
        "email": "tisseo.aam.test@yopmail.com",
        "type": "Tarif Préférentiel",
        "workflow": "tarif",
        "statut": DossierStatus.en_instruction,
        "confiance_ia": 72,
        "instructeur": "Dupont M.",
    },
    {
        "folder": "dom.thomas@orange.fr",
        "reference": "DOS-2026-00002",
        "nom": "Thomas", "prenom": "Dom",
        "email": "dom.thomas@orange.fr",
        "type": "Tarif Préférentiel",
        "workflow": "tarif",
        "statut": DossierStatus.en_attente,
        "confiance_ia": 58,
        "instructeur": "Leroy A.",
    },
    {
        "folder": "toisonthierry@gmail.com",
        "reference": "DOS-2026-00003",
        "nom": "Toison", "prenom": "Thierry",
        "email": "toisonthierry@gmail.com",
        "type": "Tarif Préférentiel",
        "workflow": "tarif",
        "statut": DossierStatus.approuve,
        "confiance_ia": 91,
        "instructeur": "Dupont M.",
    },
    {
        "folder": "emma31lucio@yahoo.com",
        "reference": "DOS-2026-00004",
        "nom": "Lucio", "prenom": "Emma",
        "email": "emma31lucio@yahoo.com",
        "type": "Tarif Préférentiel",
        "workflow": "tarif",
        "statut": DossierStatus.en_instruction,
        "confiance_ia": 65,
        "instructeur": None,
    },
    {
        "folder": "hamrat.haidi@outlook.fr",
        "reference": "DOS-2026-00005",
        "nom": "Hamrat", "prenom": "Haidi",
        "email": "hamrat.haidi@outlook.fr",
        "type": "Aide logement",
        "workflow": "logement",
        "statut": DossierStatus.boite_reception,
        "confiance_ia": 41,
        "instructeur": "Leroy A.",
    },
    {
        "folder": "eglantine1331@gmail.com",
        "reference": "DOS-2026-00006",
        "nom": "Durand", "prenom": "Eglantine",
        "email": "eglantine1331@gmail.com",
        "type": "Tarif Préférentiel",
        "workflow": "tarif",
        "statut": DossierStatus.refuse,
        "confiance_ia": 85,
        "instructeur": "Dupont M.",
    },
    {
        "folder": "paololautaro@gmail.com",
        "reference": "DOS-2026-00007",
        "nom": "Lautaro", "prenom": "Paolo",
        "email": "paololautaro@gmail.com",
        "type": "Aide logement",
        "workflow": "logement",
        "statut": DossierStatus.en_instruction,
        "confiance_ia": 53,
        "instructeur": None,
    },
]


def classify_file(filename: str) -> tuple[str, str, bool]:
    """Returns (doc_type, nom_affiche, obligatoire)."""
    stem = Path(filename).stem.lower()
    if stem.startswith("demande_"):
        return "formulaire_demande", "Formulaire de demande", True
    if "cni" in stem:
        return "piece_identite", "Pièce d'identité (CNI)", True
    if "photo" in stem:
        return "photo_identite", "Photo d'identité", False
    if "psh" in stem:
        return "justificatif_psh", "Justificatif PSH", True
    if stem.endswith("_da"):
        return "demande_aide", "Demande d'aide complémentaire", True
    if "ame" in stem:
        return "attestation_ame", "Attestation AME", True
    return "document", filename, False


def format_size(path: Path) -> str:
    size = path.stat().st_size
    if size < 1024:
        return f"{size} o"
    if size < 1024 * 1024:
        return f"{size // 1024} Ko"
    return f"{size / (1024 * 1024):.1f} Mo"


def wait_for_minio(mc: Minio, retries: int = 15) -> None:
    for i in range(retries):
        try:
            mc.list_buckets()
            return
        except Exception:
            print(f"   MinIO pas encore prêt, attente... ({i + 1}/{retries})")
            time.sleep(2)
    raise RuntimeError("MinIO inaccessible après plusieurs tentatives")


def upload_dossier_files(
    mc: Minio,
    bucket: str,
    meta: dict,
) -> list[DocumentItem]:
    """Upload les fichiers d'un dossier dans MinIO, retourne les DocumentItems."""
    folder_path = DATA_DIR / meta["folder"]
    if not folder_path.exists():
        return []

    items: list[DocumentItem] = []
    for i, file_path in enumerate(sorted(folder_path.iterdir())):
        if not file_path.is_file() or file_path.name.startswith("."):
            continue

        content_type, _ = mimetypes.guess_type(file_path.name)
        content_type = content_type or "application/octet-stream"

        minio_key = f"dossiers/{meta['reference']}/{file_path.name}"
        mc.fput_object(bucket, minio_key, str(file_path), content_type=content_type)

        doc_type, nom, obligatoire = classify_file(file_path.name)
        statut = DocumentStatus.valide if doc_type != "document" else DocumentStatus.en_attente

        items.append(DocumentItem(
            id=f"doc-{meta['reference']}-{i}",
            nom=nom,
            type=doc_type,
            statut=statut,
            obligatoire=obligatoire,
            uploaded_at=datetime.utcnow().strftime("%Y-%m-%d"),
            file_size=format_size(file_path),
            minio_key=minio_key,
            content_type=content_type,
        ))
        print(f"      ↑ {file_path.name} → {minio_key}")

    return items


async def seed():
    cfg = get_settings()

    # ── MinIO ──────────────────────────────────────────────────────────────────
    print("🗄  Connexion à MinIO...")
    mc = get_minio_client(cfg)
    wait_for_minio(mc)
    ensure_bucket(mc, cfg.minio_bucket)
    print(f"   Bucket « {cfg.minio_bucket} » prêt.")

    # ── MongoDB ────────────────────────────────────────────────────────────────
    print("🍃 Connexion à MongoDB...")
    client = AsyncIOMotorClient(cfg.mongodb_url)
    await init_beanie(
        database=client[cfg.mongodb_db],
        document_models=[Dossier, Workflow, User, Organization],
    )

    # ── Skip si données déjà présentes ────────────────────────────────────────
    if await Workflow.count() > 0:
        print("⏭  Données déjà présentes, seed ignoré.")
        client.close()
        return

    # ── Workflows ──────────────────────────────────────────────────────────────
    print("📋 Insertion des workflows...")

    # Workflow 1 — Personnes en situation de handicap (tarif préférentiel)
    wf_tarif = Workflow(
        nom="Personnes en situation de handicap",
        description="Ce workflow permet de vérifier si l'usager est éligible aux tarifs pour les personnes en situation d'handicap.",
        type="Tarif Préférentiel",
        dossiers_count=0,
        created_at=datetime(2026, 3, 6, 16, 41),
        updated_at=datetime(2026, 3, 6, 17, 13),
        ai_config=AIConfig(
            model="claude-sonnet-4-6", temperature=0.1, seuil_confiance_auto=90,
            prompt_systeme="",
        ),
        documents=[],
        nodes=[
            WorkflowNode(
                id="node_cbfcdcda-1724-48af-bb8a-f70ab29e9b80",
                type="analysis",
                label="Vérification de la pièce d'identité",
                config={
                    "instruction": "Vérifie que la pièce d'identité téléversée a ses informations correctes avec ce qu'a rentré l'utilisateur dans le formulaire. ",
                    "sources": [
                        "b11a5748b-ecc6-46eb-ad13-31b548dae69c",
                        "bc45e5dd4-55d9-4146-8245-07e0bce63c10",
                        "b4ff4e96d-83b1-4f6b-8c0b-164d609169c3",
                    ],
                    "output_type": "boolean",
                    "output_config": {},
                },
                next="node_82443149-9897-4d17-8656-f1d339ca3f35",
            ),
            WorkflowNode(
                id="node_82443149-9897-4d17-8656-f1d339ca3f35",
                type="analysis",
                label="Vérification du justificatif d'handicap",
                config={
                    "instruction": "Vérifie par rapport à la date d'aujourd'hui que le document est valide. Et en fonction du choix du niveau d'invalidité sélectionné par l'utilisateur dans le formulaire, vérifier que le justificatif correspond au cas sélectionner. ",
                    "sources": [
                        "b30fd895e-5cfa-4f25-bd9f-c7af66ed0f8d",
                        "b2d86cd20-eddb-4bb5-8b86-1ab18efd0263",
                        "bcc4ced4a-80b0-4860-8a67-249c0c8eb883",
                    ],
                    "output_type": "boolean",
                    "output_config": {},
                },
                next=None,
            ),
        ],
        formulaire_demande=[
            FormPage(
                id="page_1",
                title="Informations personnelles",
                blocks=[
                    FormBlock(
                        id="bed44c7d1-02dd-4fb4-b4f2-9175b7a66a4d",
                        type="multiple_choice",
                        label="Civilité",
                        required=True,
                        options=["Monsieur", "Madame", "Autre"],
                    ),
                    FormBlock(id="b11a5748b-ecc6-46eb-ad13-31b548dae69c", type="short_answer", label="Prénom", required=True),
                    FormBlock(id="bc45e5dd4-55d9-4146-8245-07e0bce63c10", type="short_answer", label="Nom", required=True),
                    FormBlock(id="bb06b9286-d378-438b-9c1d-e5ecc6df13c7", type="short_answer", label="Né", required=True),
                    FormBlock(id="bb502c66b-a5c1-4d6b-88d3-a4ce4c96841d", type="short_answer", label="Nom de la voie", required=True),
                    FormBlock(id="b5854c197-85ae-4866-8a84-c2a6def0edae", type="short_answer", label="Code postal - Ville", required=True),
                    FormBlock(id="bc0cd95b3-f56e-4cc5-880d-1e4c464fae55", type="phone", label="Téléphone", required=True),
                ],
            ),
            FormPage(
                id="page_c320e284-d9f4-4f86-b6f9-cd564f025cb7",
                title="Photo identité couleur récente",
                blocks=[
                    FormBlock(
                        id="bb4eb52c6-e098-41b9-909f-c0d3da120cb4",
                        type="header",
                        label="Photo identité couleur récente (visage dégagé sans lunettes, 35-45mm)",
                        required=False,
                    ),
                    FormBlock(
                        id="ba96ee28e-ea16-45fd-8d47-cc340bd139b6",
                        type="text",
                        label=" Les champs marqués d'un astérisque (*) sont obligatoires.",
                        required=False,
                    ),
                    FormBlock(
                        id="b4a0ad5ef-e7d4-4b54-8665-30fa86e555b0",
                        type="file_upload",
                        label="Merci de télécharger votre photo d'identité",
                        required=True,
                    ),
                    FormBlock(
                        id="b72b28a66-7f06-4ae2-8f3e-c2a2d3b8adcd",
                        type="text",
                        label="Formats autorisés : png, jpg, jpeg  Taille max : 3Mo",
                        required=False,
                    ),
                ],
            ),
            FormPage(
                id="page_316ba29b-d15e-4edc-961e-8902727c3b0d",
                title="Carte identité",
                blocks=[
                    FormBlock(
                        id="bfd650d07-4c0e-44e6-aff0-c5c8497f4c48",
                        type="header",
                        label="Pièce d'identité (Carte Nationale, Passeport, ...)",
                        required=False,
                    ),
                    FormBlock(
                        id="bebfe0342-a715-47aa-b80f-1fef048f5ec9",
                        type="text",
                        label="Merci de télécharger votre pièce d'identité, recto verso (carte nationale d'identité, passeport, etc.)",
                        required=False,
                    ),
                    FormBlock(
                        id="b4ff4e96d-83b1-4f6b-8c0b-164d609169c3",
                        type="file_upload",
                        label="Pièce d'identité, recto verso (carte nationale d'identité, passeport, etc.)",
                        required=True,
                    ),
                    FormBlock(
                        id="ba0aeebc8-94cc-4676-b25b-1ea0cb7eb8b3",
                        type="text",
                        label="Formats autorisés : pdf, png, jpg, jpeg  Taille max : 3Mo",
                        required=False,
                    ),
                ],
            ),
            FormPage(
                id="page_9bd4b218-637f-4f68-9abe-c512df004395",
                title="Justificatif Invalidité",
                blocks=[
                    FormBlock(
                        id="b30fd895e-5cfa-4f25-bd9f-c7af66ed0f8d",
                        type="multiple_choice",
                        label="Sélectionnez votre niveau d'invalidité",
                        required=True,
                        options=["Invalide de 50 à 79%", "Invalide de +80%"],
                    ),
                    FormBlock(
                        id="c4ca465b8-cab9-4d0f-83ae-43141bb9a1a9",
                        type="container",
                        label="Niveau d'invalidité de 50 à 79%",
                        required=False,
                        conditions=[
                            FormCondition(
                                field_id="b30fd895e-5cfa-4f25-bd9f-c7af66ed0f8d",
                                operator="equals",
                                value="Invalide de 50 à 79%",
                            ),
                        ],
                        blocks=[
                            FormBlock(
                                id="b2d86cd20-eddb-4bb5-8b86-1ab18efd0263",
                                type="file_upload",
                                label="Téléchargez votre justificatif de 50 à 79%",
                                required=True,
                            ),
                        ],
                    ),
                    FormBlock(
                        id="c2f73a5af-655f-4b8e-bdf3-2757597867af",
                        type="container",
                        label="Niveau d'invalidité de +80%",
                        required=False,
                        conditions=[
                            FormCondition(
                                field_id="b30fd895e-5cfa-4f25-bd9f-c7af66ed0f8d",
                                operator="equals",
                                value="Invalide de +80%",
                            ),
                        ],
                        blocks=[
                            FormBlock(
                                id="bcc4ced4a-80b0-4860-8a67-249c0c8eb883",
                                type="file_upload",
                                label="Téléchargez votre justificatif de de +80%",
                                required=True,
                            ),
                        ],
                    ),
                ],
            ),
        ],
    )

    # Workflow 2 — Vérification de la CNI (aide logement)
    wf_logement = Workflow(
        nom="Vérification de la CNI",
        description="Workflow d'instruction pour les demandes d'aide au logement social",
        type="Aide logement",
        dossiers_count=0,
        created_at=datetime(2026, 1, 20, 9, 0),
        updated_at=datetime(2026, 3, 6, 16, 21),
        ai_config=AIConfig(
            model="claude-sonnet-4-6", temperature=0.1, seuil_confiance_auto=85,
            prompt_systeme="Tu es un expert en aides sociales au logement.",
        ),
        documents=[],
        nodes=[
            WorkflowNode(
                id="node_3782911d-e434-4a96-b12b-1954b6d17acf",
                type="analysis",
                label="Est-ce que les infos du form sont cohérentes avec la CNI ?",
                config={
                    "instruction": "Vérifie que les informations 'Nom', 'Prénom' et 'Date de naissance' du formulaire de demande soient cohérents avec la CNI.",
                    "sources": [
                        "bac5249c2-3f6e-4b25-b58a-29c79eb094d2",
                        "b28d8cc12-ac16-4e19-bd39-d1edccfdd64a",
                        "be9ef4e85-81e2-4897-bf64-446fb202cdbf",
                        "b9ca1dc0f-0213-4e58-9f03-7243bb5735f4",
                    ],
                    "output_type": "boolean",
                    "output_config": {},
                },
                next="node_4e138496-cd8b-48f4-910c-4570080540b4",
            ),
            WorkflowNode(
                id="node_4e138496-cd8b-48f4-910c-4570080540b4",
                type="break",
                label="Break 1",
                config={
                    "conditions": [
                        {
                            "source_node_id": "node_3782911d-e434-4a96-b12b-1954b6d17acf",
                            "operator": "is_false",
                        }
                    ],
                    "condition_logic": "AND",
                },
                next="node_fdb6d95e-58db-4ba2-9c11-0de2c9ef8de4",
            ),
            WorkflowNode(
                id="node_fdb6d95e-58db-4ba2-9c11-0de2c9ef8de4",
                type="analysis",
                label="Vérification",
                config={
                    "instruction": "Je veux que tu vérifies la cohérence entre les informations fournies par l'utilisateur dans le formulaire et le document fourni.",
                    "sources": [
                        "bdd3d3b8e-b0c9-486e-9dfb-c272a537ef71",
                        "b72558fa5-da1d-4a38-8931-a15b86f74ea7",
                        "b267ae4a0-b484-4dc6-888c-c2bfdc36588f",
                        "b69325e7a-4f8b-45d9-8c07-bc4f3cb1cc30",
                    ],
                    "output_type": "boolean",
                    "output_config": {},
                },
                next=None,
            ),
        ],
        formulaire_demande=[
            FormPage(
                id="main",
                title="Renseignements personnels",
                blocks=[
                    FormBlock(id="bac5249c2-3f6e-4b25-b58a-29c79eb094d2", type="short_answer", label="Nom", required=True),
                    FormBlock(id="be9ef4e85-81e2-4897-bf64-446fb202cdbf", type="short_answer", label="Prénom", required=True),
                    FormBlock(id="b28d8cc12-ac16-4e19-bd39-d1edccfdd64a", type="date", label="Date de naissance", required=True),
                    FormBlock(
                        id="b9ca1dc0f-0213-4e58-9f03-7243bb5735f4",
                        type="file_upload",
                        label="Téléchargez votre Carte Nationale D'identité pour la vérification.",
                        required=True,
                    ),
                ],
            ),
            FormPage(
                id="page_c73815dc-2f6b-42b9-b3ef-7ee8eacceef2",
                title="Verif logement",
                blocks=[
                    FormBlock(id="bdd3d3b8e-b0c9-486e-9dfb-c272a537ef71", type="short_answer", label="Adresse complète", required=True),
                    FormBlock(id="b72558fa5-da1d-4a38-8931-a15b86f74ea7", type="short_answer", label="Code postal", required=True),
                    FormBlock(id="b267ae4a0-b484-4dc6-888c-c2bfdc36588f", type="short_answer", label="Ville", required=True),
                    FormBlock(id="b69325e7a-4f8b-45d9-8c07-bc4f3cb1cc30", type="file_upload", label="Document", required=True),
                ],
            ),
        ],
    )

    await wf_tarif.insert()
    await wf_logement.insert()
    wf_ids = {"tarif": str(wf_tarif.id), "logement": str(wf_logement.id)}
    print(f"   2 workflows insérés.")

    # ── Dossiers + upload MinIO ────────────────────────────────────────────────
    print("📁 Upload des fichiers et insertion des dossiers...")
    for meta in DOSSIERS_META:
        print(f"   {meta['reference']} — {meta['prenom']} {meta['nom']}")
        docs = upload_dossier_files(mc, cfg.minio_bucket, meta)

        dossier = Dossier(
            reference=meta["reference"],
            demandeur=Demandeur(nom=meta["nom"], prenom=meta["prenom"], email=meta["email"]),
            type=meta["type"],
            workflow_id=wf_ids[meta["workflow"]],
            statut=meta["statut"],
            derniere_maj=datetime.utcnow(),
            instructeur=meta["instructeur"],
            documents=docs,
            analysis_results=[
                AIAnalysisResult(
                    id=f"a-{meta['reference']}-1",
                    label="Complétude documentaire",
                    statut="ok" if len(docs) >= 2 else "warning",
                    message=f"{len(docs)} document(s) fourni(s)",
                    details=[f"• {d.nom} ({d.statut.value})" for d in docs],
                )
            ],
            recommendation=AIRecommendation(
                decision=RecommendationDecision.approuver if meta["confiance_ia"] >= 80
                    else RecommendationDecision.complement if meta["confiance_ia"] >= 50
                    else RecommendationDecision.refuser,
                confidence=meta["confiance_ia"],
                motif="Analyse automatique basée sur les documents fournis.",
                points_bloquants=[],
                points_attention=[],
            ),
            created_at=datetime.utcnow(),
        )
        await dossier.insert()

    print(f"   {len(DOSSIERS_META)} dossiers insérés.")

    # ── Users ──────────────────────────────────────────────────────────────────
    print("👤 Insertion des utilisateurs...")
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

    # ── Organisation ───────────────────────────────────────────────────────────
    print("🏢 Insertion de l'organisation...")
    await Organization(
        nom="Office Municipal de l'Énergie",
        siret="12345678900012",
        adresse="12 rue de la Mairie, 31000 Toulouse",
        email="contact@ome-toulouse.fr",
        telephone="05 61 00 00 00",
    ).insert()

    print("✅ Base de données et stockage peuplés avec succès !")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
