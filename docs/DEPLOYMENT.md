# Deployment Guide

This document covers all deployment options for the FuelPro Backend.

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

---

## Option 2: Koyeb (Alternative - No Credit Card)

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

## Option 3: Northflank (3 Services Free)

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

## Comparison

| Feature | Zeabur ⭐ | Koyeb | Northflank | Fly.io | Render |
|---------|-----------|-------|------------|--------|--------|
| Cost | **$0** | $0 | $0 | $5+ | $0 |
| CC required | **❌ No** | **❌ No** | ⚠️ Yes | ⚠️ Yes | **❌ No** |
| Persistence | ✅ 1GB | ✅ 1GB | ✅ 1GB | ✅ | ❌ |
| Rating | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ |

---

## GitHub Actions Secrets

| Platform | Secret Name | URL |
|----------|-------------|-----|
| Zeabur | `ZEABUR_TOKEN` | zeabur.com/dashboard/settings/tokens |
| Koyeb | `KOYEB_TOKEN` | app.koyeb.com/auth_tokens |

---

## After Deployment

Health check: `GET /` → `{"status":"ok"}`

Update your app's API endpoint to your deployed backend URL.
