# FuelPro Backend API Dockerfile
# Production-ready Node.js backend with Express and SQLite

FROM node:20-alpine AS production

# Labels
LABEL maintainer="FuelPro <support@fuelpro.app>"
LABEL description="FuelPro Backend API - Express.js with SQLite"
LABEL version="1.0.0"

# Install build tools and Python for native modules (better-sqlite3)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    sqlite-dev \
    node-gyp

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for native module compilation)
RUN npm ci

# Copy source code
COPY --chown=nodeuser:nodejs server.js ./
COPY --chown=nodeuser:nodejs routes/ ./routes/
COPY --chown=nodeuser:nodejs models/ ./models/
COPY --chown=nodeuser:nodejs middleware/ ./middleware/
COPY --chown=nodeuser:nodejs database/ ./database/

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R nodeuser:nodejs /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Switch to non-root user
USER nodeuser

# Start server
CMD ["sh", "-c", "node server.js"]
