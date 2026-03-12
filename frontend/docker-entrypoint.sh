#!/bin/sh
# Injecte la variable API_URL dans index.html au démarrage du conteneur.
# Nginx exécute automatiquement les scripts dans /docker-entrypoint.d/.
set -e

INDEX="/usr/share/nginx/html/index.html"
API_URL="${API_URL:-http://localhost:8000}"

echo "[entrypoint] Injection de window.__ENV__.API_URL = $API_URL"

sed -i "s|</head>|<script>window.__ENV__ = { API_URL: \"${API_URL}\" };</script></head>|" "$INDEX"
