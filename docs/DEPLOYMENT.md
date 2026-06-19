# Deployment Guide - Fly.io (Recommended)

## Overview
This guide deploys the FuelPro Backend to **Fly.io** which provides **$5/month free credits forever** (not a trial) with persistent storage.

## Why Fly.io?
- ✅ $5/month free credits forever (not trial)
- ✅ Persistent volumes for SQLite
- ✅ No cold starts (keeps 1 machine running)
- ✅ Docker native
- ✅ Edge locations globally

## Prerequisites
- Fly.io account: https://fly.io
- GitHub account with access to `fuel-pro/FUEL_APP_MOBILE`

## Quick Deploy (Manual)

### Step 1: Install Flyctl
```bash
curl -L https://fly.io/install.sh | sh
export FLYCTL_INSTALL="$HOME/.fly"
export PATH="$FLYCTL_INSTALL/bin:$PATH"
```

### Step 2: Login to Fly.io
```bash
flyctl auth login
```

### Step 3: Create App & Volume
```bash
cd fuel-pro/FUEL_APP_MOBILE
flyctl apps create fuel-pro-backend
flyctl volumes create fuel_app_data --region ord --size 1
```

### Step 4: Deploy
```bash
flyctl deploy --remote-only
```

## Automated Deploy (GitHub Actions)

The repository has automated deployment via `.github/workflows/deploy-backend.yml`.

### Required Secrets:
1. Go to: https://github.com/fuel-pro/FUEL_APP_MOBILE/settings/secrets/actions
2. Add: **FLY_API_TOKEN**
   - Get from: https://fly.io/dashboard/personal-tokens
   - Create new token with "Create" scope

### Auto-Deploy Triggers:
- Push to `main` branch with changes to `backend/**`, `fly.toml`, or `render.yaml`
- Manual trigger via GitHub Actions

## After Deployment

Get your app's URL:
```bash
flyctl apps list
flyctl info fuel-pro-backend
```

Your backend will be available at:
```
https://fuel-pro-backend.fly.dev
```

Update your mobile app's API endpoint to this URL.

## Health Check

The backend provides a health check at `/` which returns:
```json
{"status":"ok","timestamp":"..."}
```

## Troubleshooting

### Volume Not Mounted
```bash
flyctl volumes list
flyctl ssh console -a fuel-pro-backend
ls /app/data/
```

### Rebuild from Scratch
```bash
flyctl deploy --remote-only --no-cache
```

### View Logs
```bash
flyctl logs fuel-pro-backend
```

---

# Alternative: Render Deployment

Render provides a free tier but with limitations.

## Deploy to Render

### Option A: Connect via Render Blueprint

1. Go to https://dashboard.render.com/blueprints
2. Click **"New Blueprint Instance"**
3. Connect GitHub: `fuel-pro/FUEL_APP_MOBILE`
4. Render detects `render.yaml` automatically
5. Click **"Apply"**

### Option B: Manual Deployment

1. Create **Web Service** on Render
2. Select **Docker**
3. Enter: `ghcr.io/fuel-pro/fuel_app_mobile/fuel-backend:latest`
4. Configure:
   - Region: Oregon
   - Instance: Free
   - Port: `10000`
   - Health Check: `/`

### Make Image Public First

1. Go to: https://github.com/orgs/fuel-pro/packages/container/fuel-backend
2. Package Settings → Danger Zone → Change to public

## Render Limitations

- ⚠️ Sleeps after 15 min inactivity
- ⚠️ No persistent storage (data lost on sleep)
- ⚠️ Not truly "free forever"

**Recommendation:** Use Fly.io for production.
