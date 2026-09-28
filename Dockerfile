# ==============================================================================
# PHARMASTOCK SRI BACKEND — MULTI-STAGE PRODUCTION DOCKERFILE
# Node.js 22 Alpine · Zero Secrets · Non-Root Security · Built-in Healthcheck
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Dependencies
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar dependencias necesarias para compilar paquetes nativos si se requieren
RUN apk add --no-cache python3 make g++

# Copiar manifiestos del monorepo
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/sri-backend/package*.json ./apps/sri-backend/

# Instalar todas las dependencias
RUN npm ci

# Copiar código fuente y esquemas fiscales oficiales
COPY packages/shared ./packages/shared
COPY apps/sri-backend ./apps/sri-backend
COPY schemas ./schemas

# Compilar paquetes
RUN npm run build --workspace=@pharmastock/shared
RUN npm run build --workspace=@pharmastock/sri-backend

# Podar dependencias de desarrollo para un runtime mínimo
RUN npm prune --production

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Usuario no privilegiado por seguridad
USER node

# Copiar dependencias de producción y artefactos compilados
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages/shared ./packages/shared
COPY --chown=node:node --from=builder /app/apps/sri-backend/dist ./apps/sri-backend/dist
COPY --chown=node:node --from=builder /app/apps/sri-backend/package.json ./apps/sri-backend/package.json
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/schemas ./schemas

EXPOSE 3001

# Healthcheck que monitorea el servicio NestJS y el worker 24/7
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["node", "apps/sri-backend/dist/main.js"]
