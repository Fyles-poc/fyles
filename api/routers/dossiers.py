from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from api.models.dossier import Dossier, DossierStatus, DecisionPayload
from api.config import get_settings
from api.storage import get_minio_client

router = APIRouter(prefix="/dossiers", tags=["Dossiers"])


@router.get("", response_model=list[Dossier])
async def list_dossiers(
    statut: Optional[DossierStatus] = Query(None),
    q: Optional[str] = Query(None),
):
    query: dict = {}
    if statut:
        query["statut"] = statut
    if q:
        query["$or"] = [
            {"reference": {"$regex": q, "$options": "i"}},
            {"demandeur.nom": {"$regex": q, "$options": "i"}},
            {"demandeur.prenom": {"$regex": q, "$options": "i"}},
            {"type": {"$regex": q, "$options": "i"}},
        ]
    return await Dossier.find(query).sort("-derniere_maj").to_list()


@router.get("/{reference}", response_model=Dossier)
async def get_dossier(reference: str):
    dossier = await Dossier.find_one(Dossier.reference == reference)
    if not dossier:
        raise HTTPException(status_code=404, detail=f"Dossier {reference} introuvable")
    return dossier


@router.get("/{reference}/documents/{doc_id}/content")
async def get_document_content(
    reference: str,
    doc_id: str,
    download: bool = Query(False),
):
    dossier = await Dossier.find_one(Dossier.reference == reference)
    if not dossier:
        raise HTTPException(status_code=404, detail=f"Dossier {reference} introuvable")

    doc = next((d for d in dossier.documents if d.id == doc_id), None)
    if not doc or not doc.minio_key:
        raise HTTPException(status_code=404, detail="Document introuvable ou non disponible")

    cfg = get_settings()
    mc = get_minio_client(cfg)

    try:
        response = mc.get_object(cfg.minio_bucket, doc.minio_key)
    except Exception:
        raise HTTPException(status_code=404, detail="Fichier introuvable dans le stockage")

    content_type = doc.content_type or "application/octet-stream"
    filename = doc.minio_key.split("/")[-1]
    disposition = f'attachment; filename="{filename}"' if download else f'inline; filename="{filename}"'

    return StreamingResponse(
        response,
        media_type=content_type,
        headers={"Content-Disposition": disposition},
    )


@router.patch("/{reference}/decision", response_model=Dossier)
async def patch_decision(reference: str, payload: DecisionPayload):
    dossier = await Dossier.find_one(Dossier.reference == reference)
    if not dossier:
        raise HTTPException(status_code=404, detail=f"Dossier {reference} introuvable")

    status_map = {
        "approuver": DossierStatus.approuve,
        "refuser": DossierStatus.refuse,
        "complement": DossierStatus.en_attente,
    }

    dossier.statut = status_map[payload.decision.value]
    dossier.derniere_maj = datetime.utcnow()
    if payload.instructeur:
        dossier.instructeur = payload.instructeur

    await dossier.save()
    return dossier


@router.post("", response_model=Dossier, status_code=201)
async def create_dossier(dossier: Dossier):
    await dossier.insert()
    return dossier


@router.delete("/{reference}", status_code=204)
async def delete_dossier(reference: str):
    dossier = await Dossier.find_one(Dossier.reference == reference)
    if not dossier:
        raise HTTPException(status_code=404, detail=f"Dossier {reference} introuvable")
    await dossier.delete()
