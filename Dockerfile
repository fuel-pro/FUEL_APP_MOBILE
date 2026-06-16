# FuelPro Backend Dockerfile - Production Ready
# Express.js backend with MongoDB and Socket.io

FROM node:20-alpine

# Add labels
LABEL maintainer="FuelPro <support@fuelpro.app>"
LABEL description="FuelPro Backend API"

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001 -G nodejs

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install production dependencies only
RUN npm install --only=production && npm cache clean --force

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

# Switch to non-root user
USER nodeuser

# Start server
CMD ["node", "server.js"]