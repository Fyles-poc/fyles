# Fyles — Instruction de dossiers administratifs avec IA

Fyles est une application web permettant d'instruire des dossiers administratifs assistée par l'IA. L'IA analyse les documents fournis, évalue leur conformité selon des workflows configurables, et propose une pré-décision (approbation, refus, demande de complément) que l'instructeur valide ou corrige.

---

## Architecture

```
frontend/          React 19 + Vite + TypeScript + Tailwind CSS v4
api/               FastAPI (Python) — API REST
  ├── models/      Documents Beanie (ODM MongoDB)
  ├── routers/     Endpoints REST
  ├── config.py    Configuration via .env
  └── seed.py      Peuplement initial de la base
docker-compose.yml MongoDB 7
```

### Flux de données

```
Navigateur :5173  →  FastAPI :8000/api/...  →  MongoDB :27017
```

---

## Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Python 3.11–3.13](https://www.python.org/) + [Poetry](https://python-poetry.org/)
- [Node.js 20+](https://nodejs.org/) + npm

---

## Installation

### 1. Dépendances Python

```bash
poetry install
```

### 2. Variables d'environnement

Créer un fichier `.env` à la racine :

```env
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB=fyles
```

### 3. Dépendances frontend

```bash
npm install --prefix frontend
```

---

## Lancement

### Tout en une commande (recommandé)

```bash
./start.sh
```

Ce script :
1. Démarre MongoDB via Docker Compose
2. Attend que MongoDB soit prêt
3. Peuple la base avec les données initiales (`api/seed.py`)
4. Lance le serveur FastAPI sur `http://localhost:8000`

Lancer le frontend dans un second terminal :

```bash
npm run dev --prefix frontend
```

### Lancement manuel

```bash
# 1. MongoDB
docker compose up -d

# 2. Seed (première fois ou pour réinitialiser)
poetry run python -m api.seed

# 3. Backend
poetry run uvicorn api.main:app --reload --port 8000

# 4. Frontend (autre terminal)
npm run dev --prefix frontend
```

---

## URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| API REST | http://localhost:8000/api |
| Swagger UI | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |

---

## Endpoints API

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/dossiers` | Liste des dossiers (filtrable par `statut`, `q`) |
| GET | `/api/dossiers/{reference}` | Détail d'un dossier |
| PATCH | `/api/dossiers/{reference}/decision` | Valider une décision (approuver / refuser / demander un complément) |
| GET | `/api/workflows` | Liste des workflows |
| GET | `/api/workflows/{id}` | Détail d'un workflow |
| PUT | `/api/workflows/{id}` | Mettre à jour la configuration d'un workflow |
| GET | `/api/dashboard/stats` | Statistiques du tableau de bord |
| GET | `/api/settings/organization` | Informations de l'organisation |
| PUT | `/api/settings/organization` | Mettre à jour l'organisation |
| GET | `/api/settings/users` | Liste des utilisateurs |

---

## Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Vue d'ensemble : statistiques clés, répartition des dossiers, activité récente |
| **Dossiers** | Liste filtrée par statut, recherche textuelle |
| **Dossier (détail)** | Documents reçus, analyse IA, recommandation, formulaire de décision |
| **Workflows** | Liste des workflows configurés |
| **Workflow (détail)** | Documents requis, règles de validation, arbre logique, configuration IA |
| **Paramètres** | Organisation, gestion des utilisateurs |

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router v7, Recharts, Lucide React |
| Backend | FastAPI, Beanie (ODM), Motor (driver async MongoDB), Pydantic Settings |
| Base de données | MongoDB 7 |
| Infrastructure | Docker Compose |
| Gestion dépendances | Poetry (Python), npm (Node) |
