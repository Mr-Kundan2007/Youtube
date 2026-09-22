# ==============================================================================
# Production Dockerfile for YouTube Clone Express Backend
# Node.js 20 LTS on Alpine Linux
# ==============================================================================

FROM node:20-alpine AS base
WORKDIR /app

# Install curl for container health checks
RUN apk add --no-cache curl

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy server application code
COPY . .

# Create uploads directory and ensure non-root node user permissions
RUN mkdir -p uploads/recordings uploads/chat && \
    chown -R node:node /app

USER node

ENV PORT=5000 \
    NODE_ENV=production

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["node", "index.js"]
