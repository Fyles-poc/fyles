#!/bin/bash
set -e

echo "🐳 Démarrage de MongoDB..."
docker compose up -d

echo "⏳ Attente que MongoDB soit prêt..."
until docker compose exec mongodb mongosh --eval "db.adminCommand('ping')" --quiet 2>/dev/null; do
  sleep 1
done
echo "✅ MongoDB prêt !"

echo "🌱 Peuplement de la base de données..."
poetry run python -m api.seed

echo "🚀 Démarrage de l'API FastAPI sur :8000..."
poetry run uvicorn api.main:app --reload --port 8000
