# FuelPro Backend API Dockerfile
# Production-ready Node.js backend with Express and MongoDB

FROM node:20-alpine AS production

# Labels
LABEL maintainer="FuelPro <support@fuelpro.app>"
LABEL description="FuelPro Backend API - Express.js with MongoDB"
LABEL version="1.0.0"

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY server.js ./
COPY routes/ ./routes/
COPY models/ ./models/
COPY middleware/ ./middleware/

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

# ─── Development Stage ───
FROM node:20-alpine AS development

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]
