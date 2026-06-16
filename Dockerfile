# FuelPro Backend Dockerfile - Production Ready
# Express.js backend with MongoDB and Socket.io

FROM node:20-alpine AS production

# Add labels
LABEL maintainer="FuelPro <support@fuelpro.app>"
LABEL description="FuelPro Backend API"
LABEL version="1.0.0"

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001 -G nodejs

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY backend/server.js ./
COPY backend/routes/ ./routes/
COPY backend/models/ ./models/
COPY backend/middleware/ ./middleware/

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Switch to non-root user
USER nodeuser

# Start server
CMD ["node", "server.js"]