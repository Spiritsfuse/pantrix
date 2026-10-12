# syntax=docker/dockerfile:1

# ---- build stage: Node compiles the React app into static files -------------
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# ---- runtime stage: unprivileged Nginx serves dist/ and proxies /api --------
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
LABEL org.opencontainers.image.title="pantrix-frontend" \
      org.opencontainers.image.description="Pantrix React frontend served by Nginx" \
      org.opencontainers.image.authors="Dhruv Sharma (Spiritsfuse)" \
      org.opencontainers.image.source="https://github.com/spiritsfuse"

# Upstream for /api; Compose uses the "backend" service, Helm sets the Service name.
ENV API_UPSTREAM=backend:8000

USER root
RUN apk upgrade --no-cache && rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /src/dist /usr/share/nginx/html
USER 101

EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
