# Backend Deployment Guide

## Current Status

The backend is **NOT YET deployed**. The frontend is live at: https://fuel-app-mobile.vercel.app

## Deployment Options

### Option 1: Northflank (Recommended - Free Tier)

1. **Login to Northflank**: https://app.northflank.com
2. **Create new Service** → **Docker Registry**
3. **Connect GitHub** repo: `fuel-pro/FUEL_APP_MOBILE`
4. **Select branch**: `feature/full-integration`
5. **Dockerfile path**: `backend/Dockerfile`
6. **Add Environment Variables**:
   ```
   NODE_ENV=production
   PORT=8080
   JWT_SECRET=<generate-random-64-char-string>
   CLERK_SECRET_KEY=<from-clerk-dashboard>
   DATABASE_PATH=/app/data/fuelpro.db
   ```
7. **Add Volume** (for SQLite persistence):
   - Mount: `/app/data`
   - Size: 1GB
8. **Deploy!**

### Option 2: Render (Already Configured)

The `render.yaml` file is already in the repo but needs:
1. A Docker image built and pushed to GHCR
2. Render API key added to GitHub secrets

### Option 3: Fly.io (Already Configured)

The `fly.toml` file exists but may need updating.

### Option 4: Railway.app

1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Select `FUEL_APP_MOBILE`
4. Set root directory: `backend`
5. Add env vars
6. Deploy!

---

## Quick Deploy with Northflank API

```bash
# Using Northflank API token
curl -X POST "https://api.northflank.com/v1/services" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "fuel-pro-backend",
    "project_id": "<PROJECT_ID>",
    "build_config": {
      "dockerfile_path": "backend/Dockerfile",
      "branch": "feature/full-integration"
    },
    "port": 8080
  }'
```

---

## After Backend Deployment

Update frontend environment variable:
1. Go to Vercel Dashboard
2. Settings → Environment Variables
3. Add: `VITE_API_URL=https://your-backend-url.com`
4. Redeploy

---

## Backend API Endpoints

Once deployed, your backend will be available at:
- `https://your-backend-url.com/` - Health check
- `https://your-backend-url.com/api/auth/*` - Authentication
- `https://your-backend-url.com/api/mpesa/callback` - M-PESA callbacks
- `https://your-backend-url.com/health` - Status

---

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Random 64-char string |
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | No | Default: 8080 |
| `DATABASE_PATH` | Yes | SQLite path: `/app/data/fuelpro.db` |
| `CLERK_SECRET_KEY` | Optional | For Clerk auth |
| `EMAIL_HOST` | Optional | SMTP for password reset |
| `EMAIL_USER` | Optional | SMTP username |
| `EMAIL_PASS` | Optional | SMTP password |
| `GROQ_API_KEY` | Optional | For AI features |

---

## Manual Deployment (Local Docker)

```bash
# Build locally
docker build -t fuel-pro-backend ./backend

# Run
docker run -p 8080:8080 \
  -e JWT_SECRET=your-secret \
  -e NODE_ENV=production \
  fuel-pro-backend
```

---

## Docker Compose (Full Stack)

```bash
docker-compose -f docker-compose.full.yml up -d
```

This will start:
- Frontend on port 3000
- Backend on port 8080
- AI Service on port 8000
