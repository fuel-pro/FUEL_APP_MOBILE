# FuelPro Mobile — Repository Knowledge

## Project Overview
React + Vite + TypeScript SPA for fuel station management. Deployed at
`fuel-app-mobile.vercel.app`. Backend is Supabase (project ref:
`ojjscjwatikixlpshmub`). Auth via Supabase email/password.

## Key Architecture
- `src/react-app/context/StationContext.tsx` — station CRUD, localStorage
  persistence (`fuelpro_stations_v3`), Supabase cross-device sync.
- `src/react-app/context/FuelContext.tsx` — tab configuration registry.
- `src/react-app/pages/Home.tsx` — main app shell with tab system.
  SalesZote modules (Products, Sales Invoices, Purchases, Expenses, Reports,
  Terminal, EnhancedDashboard) are ADDITIVE lazy-loaded tabs, NOT a replacement
  of the FuelPro tab system.
- `src/react-app/context/AuthContext.tsx` — Supabase auth + role bindings.

## Critical Patterns / Gotchas
- **Persist-effect race**: `StationProvider` has a persist `useEffect` that
  runs on the first render when `stations` is still the initial `[]`. Without
  the `didHydrateRef` guard it overwrites a non-empty `fuelpro_stations_v3`
  with `[]` before the load-from-storage effect hydrates state. DO NOT remove
  that guard.
- **Supabase schema**: the live project was missing `owner_id` (and several
  other columns) on `stations`, and the `app_kv` table did not exist. Migration
  applied 2026-08-08 (see `/tmp/migration.sql` + `supabase/migrations/`).
  `pushStationUpsert` fails silently if these are missing — check schema if
  cross-device sync stops working.
- **Currency**: `getDetectedCurrency()` resolves KES for Kenya. Admin config
  `fuelpro_admin_v3.systemConfig.currency` upgrades stale "USD" to detected
  value on load (see `loadFromStorage`).
- **Math.random** usages are all legitimate ID/hash generation, not fake data.

## Deployment
- Vercel project: `prj_hjVrMLO7CxLTI77kthGE020eI3oj` (team:
  `leons-projects-78a92c96`).
- GitHub→Vercel push webhook created 2026-08-08 (hook id 663051160) pointing
  at deploy hook `JMTnTAENkY`. Before this, pushes did NOT auto-deploy.
- Vercel `api-deployments-free-per-day` limit (100/day) can be exhausted.
  Resets ~24h. Deploy hooks and CLI deploys hit the same limit. Read-only
  API calls (GET deployments) use a separate 1000/min bucket and still work.
- **2026-08-08 state**: rate limit exhausted; resets ~2026-08-09 17:15 UTC.
  An autodeploy watcher (`/tmp/fuelpro_autodeploy.sh`, PID 4189) fires the
  deploy hook ~5 min after reset. The GitHub webhook also deploys on the next
  push once the limit clears. Pending undeployed commits on main: 40da883
  (persist-guard), 6931731 (catch-block + AI-URL fixes). Production is still
  on 57c35e2 (old code without these fixes).

## Build / Test
- `npx tsc --noEmit` — typecheck (must pass before commit).
- `npm run build` — Vite production build.
- No test suite configured.

## Credentials
- Supabase service_role key and access token are in `/workspace/API KEYS.txt`
  (project `ojjscjwatikixlpshmub`). NEVER commit these.
- Vercel token in `$VERCEL`. GitHub token in `$GITHUB_TOKEN`.
