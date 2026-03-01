from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from api.config import get_settings
from api.models.dossier import Dossier
from api.models.workflow import Workflow
from api.models.user import User
from api.models.organization import Organization
from api.routers import dossiers, workflows, settings, dashboard


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dossiers.router, prefix="/api")
app.include_router(workflows.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
