# FuelPro Backend Dockerfile - Production Ready with SQLite
# Express.js backend with SQLite and Socket.io

FROM node:20-alpine

# Install build tools and Python for native modules (better-sqlite3)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    sqlite-dev \
    node-gyp

# Add labels
LABEL maintainer="FuelPro <support@fuelpro.app>"
LABEL description="FuelPro Backend API with SQLite"

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001 -G nodejs

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install ALL dependencies (including devDependencies for native module compilation)
RUN npm ci

# Copy source code
COPY backend/server.js ./
COPY backend/routes/ ./routes/
COPY backend/models/ ./models/
COPY backend/middleware/ ./middleware/
COPY backend/database/ ./database/
COPY backend/services/ ./services/
COPY backend/utils/ ./utils/

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R nodeuser:nodejs /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=10000

# Expose port
EXPOSE 10000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:10000/health || exit 1

# Switch to non-root user
USER nodeuser

# Start server
CMD ["node", "server.js"]