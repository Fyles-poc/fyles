import io
import json
import random
import string
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from api.models.dossier import Dossier, DossierStatus, DecisionPayload, Demandeur, DocumentItem, DocumentStatus
from api.models.workflow import Workflow
from api.config import get_settings
from api.storage import get_minio_client, ensure_bucket

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


@router.post("/submit", response_model=None, status_code=201)
async def submit_dossier(request: Request):
    form = await request.form()

    workflow_id = str(form.get("workflow_id", ""))
    reponses_str = str(form.get("reponses", "{}"))

    if not workflow_id:
        raise HTTPException(status_code=422, detail="workflow_id requis")

    try:
        reponses = json.loads(reponses_str)
    except Exception:
        reponses = {}

    workflow = await Workflow.get(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow introuvable")

    prefix = "".join(c for c in workflow.nom.upper()[:3] if c.isalpha()) or "DOS"
    date_part = datetime.now().strftime("%y%m%d")
    rand_part = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    reference = f"{prefix}-{date_part}-{rand_part}"

    documents = []
    mc = None
    cfg = None
    for field_id, field_value in form.multi_items():
        if not hasattr(field_value, "filename") or not field_value.filename:
            continue
        if mc is None:
            cfg = get_settings()
            mc = get_minio_client(cfg)
            ensure_bucket(mc, cfg.minio_bucket)
        content = await field_value.read()
        content_type = field_value.content_type or "application/octet-stream"
        safe_name = field_value.filename.replace(" ", "_")
        minio_key = f"{workflow_id}/{reference}/{field_id}_{safe_name}"
        mc.put_object(cfg.minio_bucket, minio_key, io.BytesIO(content), length=len(content), content_type=content_type)
        size_str = f"{len(content) / 1024:.1f} Ko" if len(content) >= 1024 else f"{len(content)} o"
        documents.append(DocumentItem(
            id=f"doc_{field_id}",
            nom=field_value.filename,
            type=content_type,
            statut=DocumentStatus.en_attente,
            obligatoire=True,
            uploaded_at=datetime.utcnow().isoformat(),
            file_size=size_str,
            minio_key=minio_key,
            content_type=content_type,
        ))

    dossier = Dossier(
        reference=reference,
        demandeur=Demandeur(nom="–", prenom="–", email="–"),
        type=workflow.type,
        workflow_id=str(workflow.id),
        reponses=reponses,
        documents=documents,
    )
    await dossier.insert()
    return {"reference": reference, "id": str(dossier.id)}


@router.patch("/{reference}/reponses", response_model=Dossier)
async def patch_reponses(reference: str, request: Request):
    dossier = await Dossier.find_one(Dossier.reference == reference)
    if not dossier:
        raise HTTPException(status_code=404, detail=f"Dossier {reference} introuvable")
    payload = await request.json()
    dossier.reponses.update(payload)
    dossier.derniere_maj = datetime.utcnow()
    await dossier.save()
    return dossier


@router.put("/{reference}/documents/{doc_id}", response_model=Dossier)
async def replace_document(reference: str, doc_id: str, request: Request):
    dossier = await Dossier.find_one(Dossier.reference == reference)
    if not dossier:
        raise HTTPException(status_code=404, detail=f"Dossier {reference} introuvable")
    doc = next((d for d in dossier.documents if d.id == doc_id), None)
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")

    form = await request.form()
    file = form.get("file")
    if not file or not hasattr(file, "filename") or not file.filename:
        raise HTTPException(status_code=422, detail="Fichier requis")

    cfg = get_settings()
    mc = get_minio_client(cfg)
    ensure_bucket(mc, cfg.minio_bucket)

    content = await file.read()
    content_type = file.content_type or "application/octet-stream"
    safe_name = file.filename.replace(" ", "_")
    minio_key = f"{dossier.workflow_id}/{reference}/{doc_id}_{safe_name}"

    if doc.minio_key and doc.minio_key != minio_key:
        try:
            mc.remove_object(cfg.minio_bucket, doc.minio_key)
        except Exception:
            pass

    mc.put_object(cfg.minio_bucket, minio_key, io.BytesIO(content), length=len(content), content_type=content_type)
    size_str = f"{len(content) / 1024:.1f} Ko" if len(content) >= 1024 else f"{len(content)} o"

    doc.nom = file.filename
    doc.minio_key = minio_key
    doc.content_type = content_type
    doc.file_size = size_str
    doc.statut = DocumentStatus.en_attente
    doc.uploaded_at = datetime.utcnow().isoformat()
    dossier.derniere_maj = datetime.utcnow()
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
