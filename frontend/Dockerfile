# ---- Étape 1 : build Vite ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Étape 2 : servir avec Nginx ----
FROM nginx:alpine

# Copier le build
COPY --from=builder /app/dist /usr/share/nginx/html

# Config Nginx (SPA routing + cache assets)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Script d'injection de l'URL API au runtime
COPY docker-entrypoint.sh /docker-entrypoint.d/40-inject-env.sh
RUN chmod +x /docker-entrypoint.d/40-inject-env.sh

EXPOSE 80
