# Deployment Guide

This document covers all deployment options for the FuelPro Backend.

---

## Option 1: Koyeb (Recommended Alternative)

**Koyeb** is a great Fly.io alternative with **free tier that never expires** and persistent storage.

### Features:
- ✅ 2 services free forever
- ✅ 1GB disk per service
- ✅ Persistent storage
- ✅ Docker support
- ✅ GitHub integration
- ✅ No credit card required

### Quick Deploy:

**Step 1:** Create account at https://app.koyeb.com

**Step 2:** Add GitHub Secret:
- Go to: https://github.com/fuel-pro/FUEL_APP_MOBILE/settings/secrets/actions
- Add: **KOYEB_TOKEN**
- Get from: https://app.koyeb.com/auth_tokens

**Step 3:** Connect GitHub:
1. Go to https://app.koyeb.com
2. Click **"Create App"**
3. Select **"Deploy from GitHub"**
4. Connect: `fuel-pro/FUEL_APP_MOBILE`
5. Use `backend/Dockerfile`
6. Set PORT to `8080`

**Step 4:** Add persistent disk:
1. In Koyeb app settings → **Disks**
2. Create 1GB volume mounted at `/app/data`

Your app will be at: `https://fuel-pro-backend-$username.koyeb.app`

### Manual CLI Deploy:
```bash
curl -sL https://github.com/koyeb/cli/releases/download/v2.2.2/koyeb-cli-linux_amd64.tar.gz | tar xz
./koyeb login -t $KOYEB_TOKEN
./koyeb app create fuel-pro-backend -f koyeb.toml
```

---

## Option 2: Fly.io

**Fly.io** provides **$5/month free credits forever** (not trial) with persistent volumes.

### Features:
- ✅ $5/mo free credits (stays active forever)
- ✅ Persistent volumes
- ✅ No cold starts
- ✅ Docker native
- ⚠️ Requires credit card for verification (but credits are truly free)

### Quick Deploy:

**Step 1:** Create account at https://fly.io

**Step 2:** Install CLI:
```bash
curl -L https://fly.io/install.sh | sh
flyctl auth login
```

**Step 3:** Deploy:
```bash
cd fuel-pro/FUEL_APP_MOBILE
flyctl apps create fuel-pro-backend
flyctl volumes create fuel_app_data --region ord --size 1
flyctl deploy --remote-only
```

**Step 4:** Add GitHub Secret:
- Add: **FLY_API_TOKEN** (from https://fly.io/dashboard/personal-tokens)
- Auto-deploy triggers on push to main

Your app will be at: `https://fuel-pro-backend.fly.dev`

---

## Option 3: Northflank

**Northflank** offers **3 services free forever** with persistent storage.

### Features:
- ✅ 3 services free
- ✅ 1GB storage per service
- ✅ Persistent volumes
- ✅ Docker support
- ✅ GitHub integration

### Quick Deploy:

**Step 1:** Create account at https://northflank.com

**Step 2:** Create service:
1. New Service → From Docker image
2. Use: `ghcr.io/fuel-pro/fuel_app_mobile/fuel-backend:latest`
3. Set port: `8080`
4. Add volume: `/app/data` (persistent)

**Step 3:** Add GitHub Secret:
- Add: **NORTHFLANK_TOKEN** (from https://app.northflank.com/settings/tokens)

---

## Option 4: Render (Limited)

Render has a free tier but with significant limitations.

### Limitations:
- ⚠️ Sleeps after 15 min inactivity
- ⚠️ No persistent storage
- ⚠️ Not truly "free forever"
- ⚠️ Data lost on sleep

### Deploy:
1. Go to https://dashboard.render.com/blueprints
2. Connect: `fuel-pro/FUEL_APP_MOBILE`
3. Render detects `render.yaml`

**Not recommended for production.**

---

## Comparison

| Feature | Koyeb | Fly.io | Northflank | Render |
|---------|-------|--------|------------|--------|
| Free tier | 2 services | $5/mo credits | 3 services | 1 service |
| Persistence | ✅ 1GB | ✅ 1GB+ | ✅ 1GB | ❌ None |
| Cold starts | ✅ None | ✅ None | ✅ None | ⚠️ 15 min |
| Docker | ✅ | ✅ | ✅ | ✅ |
| GitHub CI/CD | ✅ | ✅ | ✅ | ✅ |
| Credit card | ❌ No | ⚠️ Yes | ⚠️ Yes | ❌ No |
| Best for | Small apps | Production | Multi-service | Testing |

---

## GitHub Actions Setup

### Required Secrets:

| Platform | Secret Name | Where to get |
|----------|-------------|--------------|
| Koyeb | `KOYEB_TOKEN` | https://app.koyeb.com/auth_tokens |
| Fly.io | `FLY_API_TOKEN` | https://fly.io/dashboard/personal-tokens |
| Northflank | `NORTHFLANK_TOKEN` | https://app.northflank.com/settings/tokens |

### Workflows:
- `.github/workflows/deploy-koyeb.yml` - Koyeb deployment
- `.github/workflows/deploy-backend.yml` - Fly.io deployment
- `.github/workflows/deploy-container.yml` - Render deployment (backup)

---

## After Deployment

Update your mobile app's API endpoint to point to your deployed backend:

```
https://fuel-pro-backend.[koyeb|fly|northflank].app
```

Health check endpoint: `/` returns `{"status":"ok"}`
