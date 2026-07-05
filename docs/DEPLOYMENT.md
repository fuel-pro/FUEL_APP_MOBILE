# Deployment Guide

This document covers all deployment options for the FuelPro application.

---

## Architecture Overview

FuelPro has two backends:
1. **Legacy Backend** (`/backend`): Express.js + SQLite - REST API
2. **New Backend** (`/app/api`): Hono + tRPC + MySQL - Type-safe API

The frontend (`/app`) can work with either backend.

---

## Option 1: Zeabur ⭐ (Recommended - No Credit Card)

**Zeabur** is the **best free option** - truly free forever, no credit card required!

### Features:
- ✅ **$0 forever** (not a trial)
- ✅ Persistent storage (1GB)
- ✅ No cold starts
- ✅ Docker support
- ✅ GitHub one-click deploy
- ✅ **No credit card required**
- ✅ Automatic HTTPS

### Quick Deploy:

1. **Create account:** https://zeabur.com (GitHub login)

2. **Deploy:**
   - Go to https://zeabur.com/dashboard
   - New Project → Deploy from GitHub
   - Choose: `fuel-pro/FUEL_APP_MOBILE`
   - Select `backend` folder
   - Set PORT to `8080`
   - Add disk at `/app/data`

3. **Your app:** `https://fuel-pro-backend.zeabur.app`

### Deploying New tRPC Backend to Zeabur:

1. Create new Zeabur project
2. Add PostgreSQL database
3. Add service → Deploy from GitHub
4. Select `app` folder
5. Use `Dockerfile.api`
6. Set environment variables:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `NODE_ENV=production`
   - `PORT=3000`

---

## Option 2: Railway (PostgreSQL + Node.js)

**Railway** offers easy PostgreSQL deployment.

### Backend Deployment:
1. Create project at railway.app
2. Add PostgreSQL database
3. Add Node.js service
4. Connect GitHub repository
5. Set build command: `cd app && npm install && npm run build:api`
6. Set start command: `npm run start:api`
7. Add environment variables

### Railway Configuration:
Use `app/railway.toml` for automatic configuration.

---

## Option 3: Koyeb (Alternative - No Credit Card)

**Koyeb** is also truly free with **no credit card**.

### Features:
- ✅ 2 services free forever
- ✅ 1GB persistent disk
- ✅ Docker support
- ✅ **No credit card**

### Quick Deploy:

1. **Create account:** https://app.koyeb.com

2. **Deploy:**
   - Create App → Deploy from GitHub
   - Use `backend/Dockerfile`
   - Set PORT: `8080`
   - Add disk: `/app/data`

3. **Your app:** `https://fuel-pro-backend-$username.koyeb.app`

---

## Option 4: Northflank (3 Services Free)

**Northflank** offers **3 services free forever**.

### Quick Deploy:

1. **Create account:** https://northflank.com
2. New Service → From Docker image
3. Use: `ghcr.io/fuel-pro/fuel_app_mobile/fuel-backend:latest`
4. Set port: `8080`
5. Add volume: `/app/data`

---

## Fly.io (Requires Credit Card)

⚠️ Fly.io no longer offers free tier without credit card.
- Trial ended: requires credit card for verification
- **Use Zeabur or Koyeb instead**

---

## Frontend Deployment (Vercel)

1. Connect GitHub repository to Vercel
2. Configure settings:
   - Build Command: `cd app && npm run build`
   - Output Directory: `app/dist`
   - Install Command: `cd app && npm install`
3. Add environment variables:
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `VITE_API_URL` (your backend URL)
4. Deploy

### Vercel Routing:
`vercel.json` proxies `/api/*` to the backend:
```json
{
  "routes": [
    { "src": "/api/trpc/(.*)", "dest": "/api/trpc/$1" },
    { "src": "/api/(.*)", "dest": "https://your-backend.up.railway.app/api/$1" }
  ]
}
```

---

## Docker Deployment

### Build API Container:
```bash
cd app
docker build -f Dockerfile.api -t fuelpro-api .
docker run -p 3000:3000 \
  -e DATABASE_URL="mysql://..." \
  -e JWT_SECRET="..." \
  fuelpro-api
```

### Full Stack Container:
```bash
docker build -t fuelpro -f Dockerfile .
docker run -p 3000:3000 fuelpro
```

---

## Environment Variables

### Required for tRPC Backend:
```bash
DATABASE_URL=mysql://user:pass@host:3306/database
JWT_SECRET=your-secure-random-string
NODE_ENV=production
PORT=3000
```

### Optional:
```bash
CLERK_SECRET_KEY=sk_test_...
APP_ID=fuelpro
APP_SECRET=...
KIMI_AUTH_URL=https://auth.kimi.moonshot.cn
KIMI_OPEN_URL=https://api.moonshot.cn
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
```

---

## Comparison

| Feature | Zeabur ⭐ | Railway | Koyeb | Northflank | Fly.io |
|---------|-----------|---------|-------|------------|--------|
| Cost | **$0** | $5+ | $0 | $0 | $5+ |
| CC required | **❌ No** | ⚠️ Yes | **❌ No** | ⚠️ Yes | ⚠️ Yes |
| PostgreSQL | ✅ | ✅ | ✅ | ✅ | ✅ |
| Persistence | ✅ 1GB | ✅ | ✅ 1GB | ✅ 1GB | ✅ |
| Rating | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

---

## GitHub Actions Secrets

| Platform | Secret Name | URL |
|----------|-------------|-----|
| Vercel | `VERCEL_TOKEN` | vercel.com/account/tokens |
| Railway | `RAILWAY_TOKEN` | railway.app/account |
| Zeabur | `ZEABUR_TOKEN` | zeabur.com/dashboard/settings/tokens |
| Koyeb | `KOYEB_TOKEN` | app.koyeb.com/auth_tokens |
| Clerk | `CLERK_SECRET_KEY` | dashboard.clerk.com |
| General | `JWT_SECRET` | Generate secure random string |

---

## After Deployment

### Health Checks:
- Backend: `GET /` → `{"status":"ok"}`
- Health: `GET /health` or `/api/health`
- tRPC: `GET /api/trpc/ping`

### Update Frontend:
Update `app/src/utils/apiConfig.ts` with your backend URL:
```typescript
const TRPC_API_URL = "https://your-new-api.up.railway.app";
```

Or set `VITE_API_URL` environment variable.
