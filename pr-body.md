## Summary

This PR fixes TypeScript errors, deployment configuration, and founder authentication.

### Changes

#### 1. TypeScript Fixes ✅
- All TypeScript errors resolved
- `npm run check` passes
- `npm run build` completes successfully

#### 2. Deployment Infrastructure ✅
- `vercel.json` - Fixed routing with proper CORS headers
- `backend/railway.json` - Added default founder credentials (ADMIN/ADMIN)
- `.github/workflows/deploy-backend.yml` - Added Railway deployment job

#### 3. Founder Authentication Fix ✅
- Backend: Uses default ADMIN/ADMIN credentials when env vars not set
- Frontend: Fixed API routing to use Vercel proxy on deployment
- `getBackendUrl()` now returns empty string on Vercel for proper proxying

#### 4. Documentation ✅
- `AGENTS.md` - Agent knowledge base with deployment URLs
- `DEPLOYMENT.md` - Full deployment guide
- `backend/railway-update.sh` - Setup script

### Testing

| Test | Result |
|------|--------|
| TypeScript Check (`npm run check`) | ✅ Passes |
| Frontend Build (`npm run build`) | ✅ Passes |
| Backend Syntax | ✅ Passes |
| Frontend Health | ✅ Returns 200 |
| Backend Health | ✅ Returns healthy |

### Known Issues to Address

1. **Railway Backend Token**: The `RAILWAY_TOKEN` secret may need verification. After merge, verify the GitHub Actions workflow can access Railway.

2. **tRPC API Not Deployed**: The tRPC API (`fuel-pro-tprc-api`) returns 404. May need separate Railway deployment.

### After Merge Checklist

1. Trigger GitHub Actions `Deploy Backend` workflow
2. Verify Railway deployment sets FOUNDER_USER and FOUNDER_PASS
3. Test founder login at https://fuel-app-mobile.vercel.app/#/founder
4. Verify Vercel proxy routes work correctly

### URLs

- **Frontend**: https://fuel-app-mobile.vercel.app
- **Backend**: https://fuel-pro-backend-v2-production-7c2b.up.railway.app
- **Founder Page**: https://fuel-app-mobile.vercel.app/#/founder
- **Founder Credentials**: ADMIN / ADMIN
