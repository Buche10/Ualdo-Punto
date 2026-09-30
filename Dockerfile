# ==============================================================================
# UALDO NEGOCIOS POS - DOCKERFILE DE PRODUCCION UNIFICADO (FRONT + API)
# Node.js 22 Alpine - Mismo origen - Sin secretos - No-root - Healthcheck
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build de paquetes, frontend y backend
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Dependencias nativas para compilacion de paquetes si se requieren
RUN apk add --no-cache python3 make g++

# Copiar manifiestos del monorepo
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/sri-backend/package*.json ./apps/sri-backend/
COPY apps/pos-web/package*.json ./apps/pos-web/

# Instalar todas las dependencias
RUN npm ci

# Copiar codigo fuente y esquemas
COPY packages/shared ./packages/shared
COPY apps/sri-backend ./apps/sri-backend
COPY apps/pos-web ./apps/pos-web
COPY schemas ./schemas

# Variables de entorno de compilacion para el frontend (mismo origen)
ENV VITE_BACKEND_URL=/api
ENV VITE_API_URL=/api

# Compilar paquetes compartidos, frontend estatico y backend NestJS
RUN npm run build --workspace=@pharmastock/shared
RUN npm run build --workspace=@pharmastock/pos-web
RUN npm run build --workspace=@pharmastock/sri-backend

# Podar dependencias de desarrollo para el runtime de produccion
RUN npm prune --production

# ------------------------------------------------------------------------------
# Stage 2: Runtime de Produccion
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Usuario no privilegiado por seguridad
USER node

# Copiar dependencias de produccion y artefactos compilados
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages/shared ./packages/shared
COPY --chown=node:node --from=builder /app/apps/sri-backend/dist ./apps/sri-backend/dist
COPY --chown=node:node --from=builder /app/apps/sri-backend/package.json ./apps/sri-backend/package.json
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/schemas ./schemas

# Copiar build del frontend a la carpeta publica servida por NestJS
COPY --chown=node:node --from=builder /app/apps/pos-web/dist ./public

EXPOSE 3001

# Healthcheck que monitorea el servicio NestJS y el worker
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["node", "apps/sri-backend/dist/main.js"]
