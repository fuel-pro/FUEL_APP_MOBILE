# Backend Deployment Guide

## Current Status

| Service | Status | URL |
|---------|--------|-----|
| **Frontend (Vercel)** | ✅ Deployed | https://fuel-app-mobile.vercel.app |
| **Backend** | ⚠️ Needs Deployment | - |

---

## 🚂 Option 1: Railway.app (YOUR TOKEN)

### Step-by-Step Deployment:

1. **Login to Railway**: https://railway.com
2. **Click "New Project"** → **"Deploy from GitHub"**
3. **Configure the deployment**:
   - Repository: `fuel-pro/FUEL_APP_MOBILE`
   - Branch: `feature/full-integration` (or `main` after merge)
   - Root Directory: `backend`
4. **Add Environment Variables** (in Railway dashboard):
   ```
   NODE_ENV=production
   PORT=8080
   JWT_SECRET=generate-a-random-64-char-string-here
   DATABASE_PATH=/app/data/fuelpro.db
   ```
5. **Add Persistent Storage**:
   - Go to Settings → Add Volume
   - Mount at: `/app/data`
   - Size: 1GB
6. **Deploy!** Railway will auto-deploy on push

### Railway API Token
Your token: `d1a34559-6a70-4c38-8312-00d8f982f04c`

---

## ☁️ Option 2: Northflank (Free Tier)

1. **Login**: https://app.northflank.com
2. **Create Service** → **Docker + Git**
3. **Connect GitHub**: `fuel-pro/FUEL_APP_MOBILE`
4. **Branch**: `feature/full-integration`
5. **Dockerfile**: `backend/Dockerfile`
6. **Environment Variables**:
   - `NODE_ENV=production`
   - `PORT=8080`
   - `JWT_SECRET=<random-string>`
7. **Add Volume**: `/app/data` (1GB)
8. **Deploy!**

---

## ☁️ Option 3: Render (Already Configured)

1. Go to https://dashboard.render.com/blueprints
2. Connect GitHub repo
3. Render will detect `render.yaml` and deploy

---

## 🦅 Option 4: Fly.io (Already Configured)

1. Install Fly CLI: `fly launch`
2. Deploy: `fly deploy`

---

## Quick Deploy Script

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
cd /workspace/FUEL_APP_MOBILE
railway init
railway link <project-id>

# Add variables
railway variables set NODE_ENV=production
railway variables set PORT=8080
railway variables set JWT_SECRET=your-random-secret
railway variables set DATABASE_PATH=/app/data/fuelpro.db

# Deploy
railway up --path backend
railway open
```

---

## After Backend Deployment

Update frontend on Vercel:
1. Go to: https://vercel.com/fuel-pro/fuel-app-mobile/settings/environment-variables
2. Add: `VITE_API_URL=https://your-backend-url.up.railway.app`
3. Redeploy

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
