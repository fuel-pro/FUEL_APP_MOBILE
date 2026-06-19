# Deployment Guide

This document covers all deployment options for the FuelPro Backend.

---

## Option 1: Zeabur (NEW - Recommended!)

**Zeabur** is the newest free hosting platform - like Railway but actually free!

### Features:
- ✅ **$0 forever** (truly free, not trial)
- ✅ Persistent storage (1GB)
- ✅ No cold starts (keeps running)
- ✅ Docker support
- ✅ GitHub one-click deploy
- ✅ **No credit card required**
- ✅ Custom domains
- ✅ Automatic HTTPS

### Quick Deploy:

**Step 1:** Create account at https://zeabur.com (GitHub login)

**Step 2:** Deploy:
1. Go to https://zeabur.com/dashboard
2. Click **"New Project"**
3. Select **"Deploy from GitHub"**
4. Choose: `fuel-pro/FUEL_APP_MOBILE`
5. Select `backend` service
6. Set PORT to `8080`
7. Add persistent disk at `/app/data`

**Step 3:** (Optional) Add GitHub Secret for auto-deploy:
- Go to: https://github.com/fuel-pro/FUEL_APP_MOBILE/settings/secrets/actions
- Add: **ZEABUR_TOKEN** (from https://zeabur.com/dashboard/settings/tokens)

Your app will be at: `https://fuel-pro-backend.zeabur.app`

### CLI Deploy:
```bash
npm install -g @zeabur/cli
zb login
zb deploy --template zeabur.json
```

---

## Option 2: Koyeb

**Koyeb** is a mature Fly.io alternative with **free tier that never expires**.

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
- Add: **KOYEB_TOKEN** (from https://app.koyeb.com/auth_tokens)

**Step 3:** Connect GitHub:
1. Go to https://app.koyeb.com
2. Create App → Deploy from GitHub
3. Connect: `fuel-pro/FUEL_APP_MOBILE`
4. Use `backend/Dockerfile`
5. Set PORT to `8080`
6. Add persistent disk at `/app/data`

Your app will be at: `https://fuel-pro-backend-$username.koyeb.app`

---

## Option 3: Fly.io

**Fly.io** provides **$5/month free credits forever** with persistent volumes.

### Features:
- ✅ $5/mo free credits (stays active forever)
- ✅ Persistent volumes
- ✅ No cold starts
- ✅ Docker native
- ⚠️ Requires credit card for verification

### Quick Deploy:

```bash
curl -L https://fly.io/install.sh | sh
flyctl auth login
cd fuel-pro/FUEL_APP_MOBILE
flyctl apps create fuel-pro-backend
flyctl volumes create fuel_app_data --region ord --size 1
flyctl deploy --remote-only
```

Your app will be at: `https://fuel-pro-backend.fly.dev`

---

## Option 4: Northflank

**Northflank** offers **3 services free forever** with persistent storage.

### Features:
- ✅ 3 services free
- ✅ 1GB storage per service
- ✅ Persistent volumes
- ⚠️ Requires credit card for verification

### Quick Deploy:

1. Create account at https://northflank.com
2. New Service → From Docker image
3. Use: `ghcr.io/fuel-pro/fuel_app_mobile/fuel-backend:latest`
4. Set port: `8080`
5. Add volume: `/app/data` (persistent)

---

## Option 5: Render (Limited)

⚠️ **Not recommended** - no persistent storage, sleeps after 15 min.

---

## Comparison

| Feature | Zeabur | Koyeb | Fly.io | Northflank | Render |
|---------|--------|-------|--------|------------|--------|
| Cost | **$0** | $0 | $5 credits | $0 | $0 |
| Persistence | ✅ 1GB | ✅ 1GB | ✅ 1GB+ | ✅ 1GB | ❌ None |
| Cold starts | ✅ None | ✅ None | ✅ None | ✅ None | ⚠️ 15 min |
| Docker | ✅ | ✅ | ✅ | ✅ | ✅ |
| GitHub | ✅ | ✅ | ✅ | ✅ | ✅ |
| Credit card | **❌ No** | **❌ No** | ⚠️ Yes | ⚠️ Yes | **❌ No** |
| **Rating** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

**Recommendation:** Use **Zeabur** first (truly free, no CC), then **Koyeb** as backup.

---

## GitHub Actions Setup

### Required Secrets:

| Platform | Secret Name | Get from |
|----------|-------------|----------|
| Zeabur | `ZEABUR_TOKEN` | https://zeabur.com/dashboard/settings/tokens |
| Koyeb | `KOYEB_TOKEN` | https://app.koyeb.com/auth_tokens |
| Fly.io | `FLY_API_TOKEN` | https://fly.io/dashboard/personal-tokens |

### Workflows:
- `.github/workflows/deploy-zeabur.yml` - Zeabur deployment ⭐
- `.github/workflows/deploy-koyeb.yml` - Koyeb deployment
- `.github/workflows/deploy-backend.yml` - Fly.io deployment
- `.github/workflows/deploy-container.yml` - Render (backup)

---

## After Deployment

Update your mobile app's API endpoint:

```
https://fuel-pro-backend.[zeabur|koyeb|fly|northflank].app
```

Health check: `/` returns `{"status":"ok"}`
