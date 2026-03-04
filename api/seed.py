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
from api.models.workflow import Workflow, WorkflowDocument, WorkflowValidation, WorkflowNode, AIConfig
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
        "type": "Tarif préférentiel",
        "workflow": "tarif",
        "statut": DossierStatus.en_cours,
        "confiance_ia": 72,
        "instructeur": "Dupont M.",
    },
    {
        "folder": "dom.thomas@orange.fr",
        "reference": "DOS-2026-00002",
        "nom": "Thomas", "prenom": "Dom",
        "email": "dom.thomas@orange.fr",
        "type": "Tarif préférentiel",
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
        "type": "Tarif préférentiel",
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
        "type": "Tarif préférentiel",
        "workflow": "tarif",
        "statut": DossierStatus.en_cours,
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
        "statut": DossierStatus.signale,
        "confiance_ia": 41,
        "instructeur": "Leroy A.",
    },
    {
        "folder": "eglantine1331@gmail.com",
        "reference": "DOS-2026-00006",
        "nom": "Durand", "prenom": "Eglantine",
        "email": "eglantine1331@gmail.com",
        "type": "Tarif préférentiel",
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
        "statut": DossierStatus.en_cours,
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
    wf_tarif = Workflow(
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
                ],
            ),
            WorkflowDocument(
                id="doc-4", nom="Avis d'imposition",
                description="Avis d'imposition sur les revenus N-1", statut="OBLIGATOIRE",
                validations=[
                    WorkflowValidation(id="v7", type="llm_check", label="Plafond de revenus",
                                       prompt="Vérifie que le revenu fiscal de référence est inférieur au plafond de 22 000 €"),
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
    )
    wf_logement = Workflow(
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
            confiance_ia=meta["confiance_ia"],
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
