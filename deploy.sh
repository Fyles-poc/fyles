#!/bin/bash
# =============================================================================
# deploy.sh — Déploie la dernière version de Fyles sur le VPS.
#
# Usage :
#   ./deploy.sh <IP_VPS>
#   ./deploy.sh <IP_VPS> root          # si l'utilisateur SSH n'est pas root
#
# Prérequis :
#   - Clé SSH configurée pour accéder au VPS sans mot de passe
#   - setup-vps.sh déjà exécuté sur le VPS
#   - .env.prod présent sur le VPS dans /opt/fyles/
# =============================================================================
set -e

VPS_HOST="${1:-$VPS_HOST}"
VPS_USER="${2:-${VPS_USER:-root}}"
APP_DIR="/opt/fyles"

if [ -z "$VPS_HOST" ]; then
  echo "Usage : ./deploy.sh <IP_VPS> [utilisateur_ssh]"
  echo "  ex : ./deploy.sh 1.2.3.4"
  exit 1
fi

echo "========================================"
echo "  Fyles — Déploiement"
echo "  Cible : $VPS_USER@$VPS_HOST"
echo "========================================"

ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" bash << REMOTE
set -e
cd "$APP_DIR"

echo ""
echo "→ Mise à jour du code..."
git pull

if [ ! -f .env.prod ]; then
  echo ""
  echo "⚠️  Fichier .env.prod introuvable dans $APP_DIR !"
  echo "   Crée-le depuis .env.prod.example avant de redéployer."
  exit 1
fi

echo ""
echo "→ Build des images Docker..."
docker compose -f docker-compose.prod.yml --env-file .env.prod build

echo ""
echo "→ Redémarrage des services..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

echo ""
echo "→ Nettoyage des images obsolètes..."
docker image prune -f

echo ""
echo "========================================"
echo "  Déploiement terminé !"
echo "  Application disponible : http://$VPS_HOST"
echo "========================================"
REMOTE
