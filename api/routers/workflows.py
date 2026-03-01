from datetime import datetime
from fastapi import APIRouter, HTTPException
from api.models.workflow import Workflow, WorkflowUpdate

router = APIRouter(prefix="/workflows", tags=["Workflows"])


def _serialize(w: Workflow) -> dict:
    d = w.model_dump(by_alias=False)
    d["id"] = str(w.id)
    return d


@router.get("", response_model=None)
async def list_workflows():
    workflows = await Workflow.find_all().to_list()
    return [_serialize(w) for w in workflows]


@router.get("/{workflow_id}", response_model=None)
async def get_workflow(workflow_id: str):
    workflow = await Workflow.get(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow introuvable")
    return _serialize(workflow)


@router.put("/{workflow_id}", response_model=None)
async def update_workflow(workflow_id: str, payload: WorkflowUpdate):
    workflow = await Workflow.get(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow introuvable")

    update_data = payload.model_dump(exclude_none=True)
    update_data["updated_at"] = datetime.utcnow()

    await workflow.set(update_data)
    return _serialize(workflow)


@router.post("", response_model=None, status_code=201)
async def create_workflow(workflow: Workflow):
    await workflow.insert()
    return _serialize(workflow)
