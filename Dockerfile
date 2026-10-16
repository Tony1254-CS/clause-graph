# Multi-stage production Dockerfile for ClauseGraph
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source
COPY . .

# Build application bundle
ENV NODE_ENV=production
RUN npm run build

# Stage 2: Production Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy output build and dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/public/health || exit 1

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
