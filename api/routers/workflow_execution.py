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


def _get_nested(variables: dict, path: str) -> Any:
    """Access nested dict value with dot notation (e.g. 'llm_result.confiance')."""
    parts = path.split(".")
    obj: Any = variables
    for part in parts:
        if isinstance(obj, dict):
            obj = obj.get(part)
        else:
            return None
    return obj


def _evaluate_condition(value: Any, operator: str, target: str) -> bool:
    """Evaluate a condition between a runtime value and a target string."""
    if value is None:
        return False
    str_val = str(value)
    try:
        num_val = float(value)
        num_target = float(target)
        if operator == "greater_than":
            return num_val > num_target
        if operator == "less_than":
            return num_val < num_target
        if operator == "greater_or_equal":
            return num_val >= num_target
        if operator == "less_or_equal":
            return num_val <= num_target
    except (ValueError, TypeError):
        pass

    if operator == "equals":
        return str_val.lower() == target.lower()
    if operator == "not_equals":
        return str_val.lower() != target.lower()
    if operator == "contains":
        return target.lower() in str_val.lower()
    return False


async def _fetch_file_from_minio(minio_key: str) -> tuple[bytes, str]:
    """Retrieve file bytes and content_type from MinIO."""
    cfg = get_settings()
    mc = get_minio_client(cfg)
    response = mc.get_object(cfg.minio_bucket, minio_key)
    content = response.read()
    response.close()
    response.release_conn()
    return content, response.headers.get("content-type", "application/octet-stream")


async def _run_nodes(
    nodes: list,
    start_node_id: str,
    dossier: Dossier,
    variables: dict,
    cfg,
) -> list[dict]:
    """Traverse and execute nodes starting from start_node_id."""
    node_map = {n.id: n for n in nodes}
    trace = []
    current_id = start_node_id
    visited = set()

    while current_id and current_id not in visited:
        visited.add(current_id)
        node = node_map.get(current_id)
        if not node:
            break

        config = node.config or {}
        entry: dict = {"node_id": node.id, "type": node.type, "label": node.label, "status": "ok", "output": {}}

        try:
            if node.type == "trigger":
                variables["reponses"] = dossier.reponses
                entry["output"] = {"message": "Déclencheur activé"}
                next_id = node.next if isinstance(node.next, str) else None

            elif node.type == "field_extractor":
                field_id = config.get("field_id", "")
                variable_name = config.get("variable_name", field_id)
                field_type = config.get("field_type", "")

                if field_type in ("file_upload", "multifile_upload"):
                    # Find document by id convention doc_{field_id}
                    doc = next((d for d in dossier.documents if d.id == f"doc_{field_id}"), None)
                    if doc and doc.minio_key:
                        file_bytes, content_type = await _fetch_file_from_minio(doc.minio_key)
                        variables[variable_name] = {
                            "__type__": "file",
                            "bytes": file_bytes,
                            "content_type": doc.content_type or content_type,
                            "filename": doc.nom,
                        }
                        entry["output"] = {"variable": variable_name, "file": doc.nom}
                    else:
                        variables[variable_name] = None
                        entry["output"] = {"variable": variable_name, "file": None, "warning": "Fichier introuvable"}
                else:
                    value = dossier.reponses.get(field_id, "")
                    variables[variable_name] = value
                    entry["output"] = {"variable": variable_name, "value": str(value)[:100]}

                next_id = node.next if isinstance(node.next, str) else None

            elif node.type == "llm_check":
                prompt = config.get("prompt", "Analyse ce dossier.")
                var_names: list[str] = config.get("variables", [])
                output_variable = config.get("output_variable", "llm_result")
                model = config.get("model", "claude-sonnet-4-6")

                if not cfg.anthropic_api_key:
                    raise ValueError("ANTHROPIC_API_KEY non configurée dans les paramètres serveur.")

                client = anthropic.Anthropic(api_key=cfg.anthropic_api_key)

                # Build content parts
                content_parts: list[dict] = []
                text_parts: list[str] = []

                for var_name in var_names:
                    var_val = variables.get(var_name)
                    if var_val is None:
                        text_parts.append(f"[{var_name}]: (non disponible)")
                    elif isinstance(var_val, dict) and var_val.get("__type__") == "file":
                        file_bytes: bytes = var_val["bytes"]
                        ct: str = var_val.get("content_type", "application/octet-stream")
                        b64 = base64.standard_b64encode(file_bytes).decode()
                        if ct.startswith("image/"):
                            media_type = ct if ct in ("image/jpeg", "image/png", "image/gif", "image/webp") else "image/jpeg"
                            content_parts.append({
                                "type": "image",
                                "source": {"type": "base64", "media_type": media_type, "data": b64},
                            })
                            text_parts.append(f"[{var_name}]: (image ci-dessus)")
                        elif ct == "application/pdf":
                            content_parts.append({
                                "type": "document",
                                "source": {"type": "base64", "media_type": "application/pdf", "data": b64},
                            })
                            text_parts.append(f"[{var_name}]: (PDF ci-dessus)")
                        else:
                            text_parts.append(f"[{var_name}]: fichier binaire ({ct})")
                    else:
                        text_parts.append(f"[{var_name}]: {var_val}")

                user_text = "\n".join(text_parts) + "\n\n" + prompt
                user_text += "\n\nRéponds uniquement en JSON valide, sans bloc markdown."
                content_parts.append({"type": "text", "text": user_text})

                response = client.messages.create(
                    model=model,
                    max_tokens=1024,
                    messages=[{"role": "user", "content": content_parts}],
                )
                raw = response.content[0].text.strip()

                # Try to parse JSON response
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    parsed = {"raw_response": raw}

                variables[output_variable] = parsed
                entry["output"] = {output_variable: parsed}
                next_id = node.next if isinstance(node.next, str) else None

            elif node.type == "condition":
                variable_path = config.get("variable", "")
                operator = config.get("operator", "equals")
                target_value = str(config.get("value", ""))
                runtime_value = _get_nested(variables, variable_path)

                result = _evaluate_condition(runtime_value, operator, target_value)
                entry["output"] = {
                    "variable": variable_path,
                    "runtime_value": runtime_value,
                    "operator": operator,
                    "target": target_value,
                    "result": result,
                }

                next_cfg = node.next
                if isinstance(next_cfg, dict):
                    next_id = next_cfg.get("true") if result else next_cfg.get("false")
                else:
                    next_id = None

            elif node.type == "set_status":
                status_str = config.get("status", "en_cours")
                comment = config.get("comment", "")

                status_map = {
                    "approuve": DossierStatus.approuve,
                    "refuse": DossierStatus.refuse,
                    "signale": DossierStatus.signale,
                    "en_attente": DossierStatus.en_attente,
                    "en_cours": DossierStatus.en_cours,
                }
                new_status = status_map.get(status_str, DossierStatus.en_cours)
                dossier.statut = new_status
                dossier.derniere_maj = datetime.utcnow()

                # Append analysis result
                analysis_entry = AIAnalysisResult(
                    id=f"auto_{node.id}",
                    label=node.label or "Résultat automatique",
                    statut="ok" if status_str == "approuve" else ("error" if status_str in ("refuse", "signale") else "warning"),
                    message=comment or f"Statut mis à jour: {status_str}",
                    details=[],
                )
                if not dossier.analysis_results:
                    dossier.analysis_results = []
                dossier.analysis_results.append(analysis_entry)
                await dossier.save()

                entry["output"] = {"new_status": status_str, "comment": comment}
                next_id = None

            else:
                entry["status"] = "skipped"
                entry["output"] = {"reason": f"Type de nœud inconnu: {node.type}"}
                next_id = node.next if isinstance(node.next, str) else None

        except Exception as exc:
            entry["status"] = "error"
            entry["output"] = {"error": str(exc)}
            next_id = None

        trace.append(entry)
        current_id = next_id  # type: ignore[assignment]

    return trace


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

    # Find start node (trigger, or first node)
    start = next((n for n in nodes if n.type == "trigger"), nodes[0])

    variables: dict = {}
    trace = await _run_nodes(nodes, start.id, dossier, variables, cfg)

    success = all(e["status"] != "error" for e in trace)
    return {"success": success, "execution_trace": trace}
