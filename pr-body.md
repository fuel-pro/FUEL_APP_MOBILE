## Summary

This PR fixes TypeScript errors, deployment configuration, and founder authentication.

### Changes

#### 1. TypeScript Fixes
- POS hardware modules (USB/Bluetooth types)
- Import path corrections  
- Schema property fixes

#### 2. Deployment Infrastructure
- `vercel.json` - Fixed routing with proper CORS headers
- `.github/workflows/vercel-deploy.yml` - Updated Vercel deployment workflow
- `app/railway.toml` - Railway deployment config for tRPC API
- `backend/railway.json` - Railway deployment config for legacy backend

#### 3. Founder Authentication Fix
- Backend: Uses default ADMIN/ADMIN credentials when env vars not set
- Frontend: Fixed API routing to use Vercel proxy on deployment

#### 4. Documentation
- `AGENTS.md` - Agent knowledge base with deployment URLs
- `DEPLOYMENT.md` - Full deployment guide

### Testing

1. **TypeScript**: `npm run check` ✅ Passes
2. **Build**: `npm run build` ✅ Passes  
3. **Backend**: Health check ✅ Returns healthy

### Manual Steps Required After Merge

To enable founder login on Railway, run:

```bash
# Install Railway CLI
curl -fsSL https://railway.app/install.sh | sh

# Login with token (use: d1a34559-6a70-4c38-8312-00d8f982f04c)
railway login

# Link project
railway link 226c5567-8377-4520-8088-1e4c019b984a

# Set founder credentials
railway variables set FOUNDER_USER=ADMIN
railway variables set FOUNDER_PASS=ADMIN
```

Or run: `bash backend/railway-update.sh`

### URLs

- **Frontend**: https://fuel-app-mobile.vercel.app
- **Backend**: https://fuel-pro-backend-v2-production-7c2b.up.railway.app
- **Founder Page**: https://fuel-app-mobile.vercel.app/#/founder
