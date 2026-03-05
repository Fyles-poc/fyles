import base64
import json
from datetime import datetime
from typing import Any

import anthropic
from fastapi import APIRouter, HTTPException

from api.config import get_settings
from api.models.dossier import Dossier, DossierStatus, AIAnalysisResult
from api.models.workflow import Workflow
from api.storage import get_minio_client

router = APIRouter(prefix="/workflows", tags=["Workflow Execution"])

SYSTEM_PROMPT = (
    "Tu es un assistant d'instruction administrative. "
    "Analyse les données fournies de façon factuelle et objective. "
    "Réponds UNIQUEMENT en JSON valide, sans texte avant ni après, sans bloc markdown."
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _collect_form_fields(blocks: list) -> dict[str, dict]:
    """Recursively collect {field_id: {label, type}} from form blocks."""
    result: dict[str, dict] = {}
    for b in blocks:
        if not isinstance(b, dict):
            b = b.model_dump() if hasattr(b, "model_dump") else {}
        btype = b.get("type", "")
        if btype == "container":
            result.update(_collect_form_fields(b.get("blocks") or []))
        elif btype not in ("header", "text", "container", ""):
            result[b["id"]] = {"label": b.get("label") or b["id"], "type": btype}
    return result


async def _fetch_file_from_minio(minio_key: str) -> tuple[bytes, str]:
    cfg = get_settings()
    mc = get_minio_client(cfg)
    response = mc.get_object(cfg.minio_bucket, minio_key)
    content = response.read()
    response.close()
    response.release_conn()
    return content, response.headers.get("content-type", "application/octet-stream")


def _format_instructions(output_type: str, output_config: dict) -> str:
    if output_type == "boolean":
        return (
            'Réponds en JSON avec exactement cette structure :\n'
            '{\n  "result": true,\n  "justification": "..."\n}\n'
            '"result" doit être un booléen JSON (true ou false).'
        )
    if output_type == "score":
        return (
            'Réponds en JSON avec exactement cette structure :\n'
            '{\n  "result": 85,\n  "justification": "..."\n}\n'
            '"result" doit être un entier entre 0 et 100.'
        )
    if output_type == "text":
        return (
            'Réponds en JSON avec exactement cette structure :\n'
            '{\n  "result": "ta réponse ici",\n  "justification": "..."\n}'
        )
    if output_type == "classification":
        categories: list[str] = [c for c in output_config.get("categories", []) if c]
        cats = ", ".join(f'"{c}"' for c in categories)
        return (
            f'Réponds en JSON avec exactement cette structure :\n'
            f'{{\n  "result": "{categories[0] if categories else "catégorie"}",\n  "justification": "..."\n}}\n'
            f'"result" doit être exactement l\'une de ces valeurs : {cats}.'
        )
    if output_type == "structured":
        fields: list[dict] = [f for f in output_config.get("fields", []) if f.get("name")]
        lines = "\n".join(
            f'  "{f["name"]}": ...  // {f.get("description", "")}'
            for f in fields
        )
        return (
            'Réponds en JSON avec exactement cette structure :\n'
            '{\n' + lines + '\n  "justification": "..."\n}'
        )
    return 'Réponds uniquement en JSON valide avec un champ "result" et "justification".'


async def _run_analysis_node(
    node: Any,
    config: dict,
    dossier: Dossier,
    form_fields_map: dict[str, dict],
    api_key: str,
) -> dict:
    """Execute a unified 'analysis' node: resolve sources, call Claude, store result."""
    instruction: str = config.get("instruction", "")
    sources: list[str] = config.get("sources", [])
    output_type: str = config.get("output_type", "boolean")
    output_config: dict = config.get("output_config", {})

    # ── Resolve sources into content parts ───────────────────────────────────
    text_lines: list[str] = []
    media_parts: list[dict] = []  # images/PDFs added before the text block

    for field_id in sources:
        meta = form_fields_map.get(field_id, {"label": field_id, "type": ""})
        label = meta["label"]
        ftype = meta["type"]

        if ftype in ("file_upload", "multifile_upload"):
            doc = next((d for d in dossier.documents if d.id == f"doc_{field_id}"), None)
            if doc and doc.minio_key:
                file_bytes, raw_ct = await _fetch_file_from_minio(doc.minio_key)
                ct = doc.content_type or raw_ct
                b64 = base64.standard_b64encode(file_bytes).decode()
                if ct.startswith("image/"):
                    media_type = ct if ct in ("image/jpeg", "image/png", "image/gif", "image/webp") else "image/jpeg"
                    media_parts.append({
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": b64},
                    })
                    text_lines.append(f"- {label} : (image ci-dessus)")
                elif ct == "application/pdf":
                    media_parts.append({
                        "type": "document",
                        "source": {"type": "base64", "media_type": "application/pdf", "data": b64},
                    })
                    text_lines.append(f"- {label} : (PDF ci-dessus)")
                else:
                    text_lines.append(f"- {label} : fichier binaire ({ct})")
            else:
                text_lines.append(f"- {label} : (fichier non disponible)")
        else:
            value = dossier.reponses.get(field_id, "")
            text_lines.append(f"- {label} : {value}")

    # ── Build user message ────────────────────────────────────────────────────
    data_section = "\n".join(text_lines) if text_lines else "(aucune donnée fournie)"
    user_text = (
        f"## Tâche : {node.label}\n\n"
        f"{instruction}\n\n"
        f"## Données fournies\n\n{data_section}\n\n"
        f"## Format de sortie\n\n{_format_instructions(output_type, output_config)}"
    )
    content_parts = media_parts + [{"type": "text", "text": user_text}]

    # ── Call Claude ───────────────────────────────────────────────────────────
    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content_parts}],
    )
    raw = response.content[0].text.strip()

    try:
        parsed: dict = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {"raw_response": raw}

    # ── Derive statut for analysis_results ───────────────────────────────────
    statut = "ok"
    result_val = parsed.get("result")
    if output_type == "boolean":
        statut = "ok" if result_val is True else "warning"
    elif output_type == "score" and isinstance(result_val, (int, float)):
        statut = "ok" if result_val >= 70 else ("warning" if result_val >= 40 else "error")

    # ── Persist into dossier.analysis_results ────────────────────────────────
    # Build details: [result_value, "doc:field_id", ...]
    details: list[str] = [str(result_val)] if result_val is not None else []
    for field_id in sources:
        meta = form_fields_map.get(field_id, {"type": ""})
        if meta["type"] in ("file_upload", "multifile_upload"):
            details.append(f"doc:{field_id}")

    entry_id = f"auto_{node.id}"
    ai_entry = AIAnalysisResult(
        id=entry_id,
        label=node.label or "Analyse automatique",
        statut=statut,
        message=parsed.get("justification") or "",
        details=details,
    )
    if dossier.analysis_results is None:
        dossier.analysis_results = []
    idx = next((i for i, r in enumerate(dossier.analysis_results) if r.id == entry_id), None)
    if idx is not None:
        dossier.analysis_results[idx] = ai_entry
    else:
        dossier.analysis_results.append(ai_entry)
    dossier.derniere_maj = datetime.utcnow()
    await dossier.save()

    return {
        "result": result_val,
        "justification": parsed.get("justification", ""),
        "full": parsed,
        "statut": statut,
    }


async def _run_nodes(
    nodes: list,
    start_node_id: str,
    dossier: Dossier,
    form_fields_map: dict[str, dict],
    variables: dict,
    cfg: Any,
) -> list[dict]:
    node_map = {n.id: n for n in nodes}
    trace: list[dict] = []
    current_id: str | None = start_node_id
    visited: set[str] = set()

    while current_id and current_id not in visited:
        visited.add(current_id)
        node = node_map.get(current_id)
        if not node:
            break

        config = node.config or {}
        entry: dict = {
            "node_id": node.id,
            "type": node.type,
            "label": node.label,
            "status": "ok",
            "output": {},
        }

        try:
            if node.type == "trigger":
                variables["reponses"] = dossier.reponses
                entry["output"] = {"message": "Déclencheur activé"}
                next_id = node.next if isinstance(node.next, str) else None

            elif node.type == "analysis":
                if not cfg.anthropic_api_key:
                    raise ValueError("ANTHROPIC_API_KEY non configurée dans les paramètres serveur.")
                output = await _run_analysis_node(node, config, dossier, form_fields_map, cfg.anthropic_api_key)
                entry["output"] = output
                if output.get("statut") == "error":
                    entry["status"] = "warning"
                next_id = node.next if isinstance(node.next, str) else None

            else:
                entry["status"] = "skipped"
                entry["output"] = {"reason": f"Type de nœud non supporté : {node.type}"}
                next_id = node.next if isinstance(node.next, str) else None

        except Exception as exc:
            entry["status"] = "error"
            entry["output"] = {"error": str(exc)}
            next_id = None

        trace.append(entry)
        current_id = next_id  # type: ignore[assignment]

    return trace


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/{workflow_id}/execute/{dossier_reference}")
async def execute_workflow(workflow_id: str, dossier_reference: str):
    cfg = get_settings()

    workflow = await Workflow.get(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow introuvable")

    dossier = await Dossier.find_one(Dossier.reference == dossier_reference)
    if not dossier:
        raise HTTPException(status_code=404, detail=f"Dossier {dossier_reference} introuvable")

    nodes = workflow.nodes
    if not nodes:
        return {"success": False, "error": "Aucun nœud défini dans ce workflow.", "execution_trace": []}

    # Build field map from all pages of formulaire_demande
    all_blocks: list = []
    for page in workflow.formulaire_demande:
        page_dict = page.model_dump() if hasattr(page, "model_dump") else page
        all_blocks.extend(page_dict.get("blocks", []))
    form_fields_map = _collect_form_fields(all_blocks)

    # Clear all automatic analysis results from previous runs so the re-run starts clean
    dossier.analysis_results = [r for r in (dossier.analysis_results or []) if not r.id.startswith("auto_")]
    await dossier.save()

    start = next((n for n in nodes if n.type == "trigger"), nodes[0])
    variables: dict = {}
    trace = await _run_nodes(nodes, start.id, dossier, form_fields_map, variables, cfg)

    success = all(e["status"] != "error" for e in trace)

    # After execution, move dossier to "En instruction" so the instructor can review
    dossier.statut = DossierStatus.en_instruction
    dossier.derniere_maj = datetime.utcnow()
    await dossier.save()

    return {"success": success, "execution_trace": trace}


@router.post("/{workflow_id}/execute/{dossier_reference}/node/{node_id}")
async def execute_single_node(workflow_id: str, dossier_reference: str, node_id: str):
    cfg = get_settings()

    workflow = await Workflow.get(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow introuvable")

    dossier = await Dossier.find_one(Dossier.reference == dossier_reference)
    if not dossier:
        raise HTTPException(status_code=404, detail=f"Dossier {dossier_reference} introuvable")

    node = next((n for n in workflow.nodes if n.id == node_id), None)
    if not node:
        raise HTTPException(status_code=404, detail=f"Nœud {node_id} introuvable dans ce workflow")

    if node.type != "analysis":
        raise HTTPException(status_code=400, detail="Seuls les nœuds d'analyse peuvent être exécutés individuellement")

    if not cfg.anthropic_api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY non configurée dans les paramètres serveur")

    all_blocks: list = []
    for page in workflow.formulaire_demande:
        page_dict = page.model_dump() if hasattr(page, "model_dump") else page
        all_blocks.extend(page_dict.get("blocks", []))
    form_fields_map = _collect_form_fields(all_blocks)

    try:
        output = await _run_analysis_node(node, node.config or {}, dossier, form_fields_map, cfg.anthropic_api_key)
        return {"success": True, "node_id": node_id, "output": output}
    except Exception as exc:
        return {"success": False, "node_id": node_id, "error": str(exc), "output": {}}
