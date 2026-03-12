from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from api.config import get_settings
from api.auth import AuthMiddleware
from api.models.dossier import Dossier
from api.models.workflow import Workflow
from api.models.user import User
from api.models.organization import Organization
from api.routers import dossiers, workflows, settings, dashboard, workflow_execution
from api.routers import auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    cfg = get_settings()
    client = AsyncIOMotorClient(cfg.mongodb_url)
    await init_beanie(
        database=client[cfg.mongodb_db],
        document_models=[Dossier, Workflow, User, Organization],
    )
    yield
    client.close()


app = FastAPI(
    title="Fyles API",
    description="API d'instruction de dossiers administratifs avec IA",
    version="1.0.0",
    lifespan=lifespan,
)

cfg = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in cfg.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Le middleware auth doit être ajouté APRÈS CORS
app.add_middleware(AuthMiddleware)

app.include_router(auth.router, prefix="/api")
app.include_router(dossiers.router, prefix="/api")
app.include_router(workflows.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(workflow_execution.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
