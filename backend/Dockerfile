# FuelPro Backend API Dockerfile
# Production-ready Node.js backend with Express and SQLite

FROM node:20-alpine AS production

# Labels
LABEL maintainer="FuelPro <support@fuelpro.app>"
LABEL description="FuelPro Backend API - Express.js with SQLite"
LABEL version="2.0.0"

# Install build tools and Python for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    sqlite-dev \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY server.js ./
COPY routes/ ./routes/
COPY models/ ./models/
COPY middleware/ ./middleware/
COPY database/ ./database/

# Create data directory for SQLite and set permissions
RUN mkdir -p /app/data && \
    chown -R node:node /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check using wget (available in alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Run as node user
USER node

# Start server
CMD ["node", "server.js"]
