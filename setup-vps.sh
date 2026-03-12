#!/bin/bash
# =============================================================================
# setup-vps.sh — À lancer UNE SEULE FOIS sur un VPS Ubuntu 22/24 LTS vierge.
#
# Usage (depuis ton poste local) :
#   ssh root@<IP_VPS> 'bash -s' < setup-vps.sh
#
# Ou directement sur le VPS :
#   chmod +x setup-vps.sh && sudo ./setup-vps.sh
# =============================================================================
set -e

REPO_URL="https://github.com/Fyles-poc/fyles.git"   # ← adapte si besoin
APP_DIR="/opt/fyles"

echo "========================================"
echo "  Fyles — Setup VPS"
echo "========================================"

# ── 1. Mise à jour du système ────────────────────────────────────────────────
echo ""
echo "→ Mise à jour des paquets..."
apt-get update -qq
apt-get upgrade -y -qq

# ── 2. Installation de Docker ────────────────────────────────────────────────
echo ""
echo "→ Installation de Docker..."
if command -v docker &> /dev/null; then
  echo "   Docker déjà installé ($(docker --version))"
else
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "   Docker installé."
fi

# ── 3. Installation de git ───────────────────────────────────────────────────
echo ""
echo "→ Installation de git..."
apt-get install -y -qq git curl
echo "   git installé."

# ── 4. Configuration du firewall (UFW) ──────────────────────────────────────
echo ""
echo "→ Configuration du firewall..."
apt-get install -y -qq ufw
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment "SSH"
ufw allow 80/tcp   comment "HTTP"
ufw allow 443/tcp  comment "HTTPS"
ufw --force enable
echo "   Firewall configuré (ports ouverts : 22, 80, 443)."

# ── 5. Clonage du dépôt ──────────────────────────────────────────────────────
echo ""
echo "→ Clonage du dépôt dans $APP_DIR..."
if [ -d "$APP_DIR/.git" ]; then
  echo "   Dépôt déjà cloné, mise à jour..."
  cd "$APP_DIR" && git pull
else
  git clone "$REPO_URL" "$APP_DIR"
fi

# ── 6. Instructions suivantes ────────────────────────────────────────────────
echo ""
echo "========================================"
echo "  Setup terminé !"
echo "========================================"
echo ""
echo "Prochaines étapes :"
echo ""
echo "  1. Crée le fichier de secrets :"
echo "       cd $APP_DIR"
echo "       cp .env.prod.example .env.prod"
echo "       nano .env.prod"
echo ""
echo "  2. Lance le déploiement initial :"
echo "       docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build"
echo ""
echo "  3. Crée le premier compte utilisateur :"
echo "       docker compose -f docker-compose.prod.yml exec api python -m api.cli create-user"
echo ""
