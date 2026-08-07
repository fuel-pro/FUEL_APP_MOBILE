# Changes made in this session

## Fixed

1. **"No Cloud" bug (BUG_REPORT.md Bug #1) — root-caused and fixed.**
   `src/react-app/lib/restApiSync.ts` was checking Firebase Firestore for
   cloud status, even though the rest of the app (auth, station/sales data)
   already runs on Supabase. Its error-fallback path also referenced an
   `API_URL` variable that was **never defined anywhere in the file**, and
   `useCloudSync.ts` imported an `apiRequest` function that was **never
   exported** from it. Both would throw/fail silently at runtime.

   Rewrote the whole module to run on Supabase:
   - `checkApiStatus()` now does a real lightweight query against the
     `stations` table instead of a nonexistent Firestore health doc.
   - `apiRequest()` is now implemented for real, backed by the
     `team_members` table (the two call sites in `FounderAccess.tsx` /
     `useCloudSync.ts` needed `GET /api/users` and `PUT /api/users/:id`).
   - `createRecord` / `getRecord` / `updateRecord` / `deleteRecord` /
     `listRecords` now write to real Postgres tables (`stations`, `sales`,
     `team_members`, `audit_log`) where one exists, and to a new generic
     `app_kv` table for collections that don't have a dedicated table
     (`secrets`, `feature_flags`, `config`, `sales_analytics`).
   - localStorage fallback is preserved for offline resilience, but errors
     are now surfaced in the returned `error` field instead of swallowed.

2. **Added the missing `app_kv` table.** See `supabase/migrations/002_app_kv.sql`
   — **run this once in your Supabase SQL editor** (it's idempotent/safe to
   re-run). It's also folded into `supabase/schema.sql` for fresh installs.

3. **Removed dead code.** `src/react-app/hooks/useFounderAuth.ts` imported
   `@clerk/clerk-react`, which isn't even in `package.json` — it wasn't
   used anywhere else in the app, so it was just confusing debt. Deleted.

4. Set real working env values in `.env.local` (your live Supabase project
   URL/anon key, `VITE_DEMO_MODE=false`) so the app runs against your actual
   backend out of the box.

## Verified working

- `npm install --legacy-peer-deps` — installs clean
- `npm run build` (= `npm run build:static`, the actual Vercel build command)
  — builds clean, no errors
- Production build served locally and returns HTTP 200 with the expected
  HTML shell

## Known issues found but **not** in scope for this pass (flagging for you)

These don't affect the deployed app because nothing imports them, but
they're worth cleaning up or finishing later:

- `src/react-app/lib/open-source/chatwootIntegration.ts`,
  `sentryIntegration.ts`, and `react-query-devtools.tsx` have genuine
  syntax errors (`npx tsc -b` fails on them). They're only referenced by
  `src/react-app/lib/open-source/index.ts`, which nothing in the running
  app imports — so it's dead weight. Either fix them (if you want
  Chatwoot/Sentry wired up) or delete the folder.
- `api/pump-mapping/*.ts` and `db/connection.ts` import from `astro` and
  `../api/queries/connection`, neither of which exist in this project —
  looks like leftover code from a different (Astro-based) iteration of the
  app. Not part of the Vercel build (`vercel.json` only builds the Vite
  frontend), so it's inert, but confusing to have around.
- The app still has a separate, unrelated `src/firebase/` module and a
  `src/react-app/services/FirebaseService.ts` — these are self-contained
  and don't conflict with anything, but you have two backend SDKs in the
  bundle. Worth deciding whether to fully remove Firebase now that
  Supabase is the real backend.
- The `index.html` still has Clerk meta tags (`clerk-publishable-key`,
  `clerk-frontend-api`) left over from an earlier auth approach, unrelated
  to the actual Supabase-based `AuthContext`. Harmless but worth removing
  for clarity.

## Additional pass (this session)

- Re-verified everything above from a clean checkout: `npm install`, `npm run
  build`, and served the production `dist/` output locally — confirmed
  `HTTP 200` with the correct `<title>FuelPro - Fuel Management System</title>`,
  and confirmed the bundle has the real Supabase project URL baked in.
- Removed leftover `clerk-publishable-key` / `clerk-frontend-api` `<meta>`
  tags from `index.html` — Clerk isn't in `package.json` and isn't used by
  `AuthContext` (which is 100% Supabase), so these were just stale metadata
  from an earlier auth approach. Rebuilt clean afterward.

## Still worth doing (not done this pass — flagging so it's not lost)

- Delete or fix `src/react-app/lib/open-source/{chatwootIntegration,
  sentryIntegration}.ts` (`react-query-devtools.tsx` is empty) — these have
  real syntax errors caught by `tsc -b`. Nothing in the running app imports
  them today so the build isn't affected, but it's a landmine for later.
- `api/pump-mapping/*.ts` and `db/connection.ts` reference an `astro`
  import and a `../api/queries/connection` path that don't exist in this
  project — looks like carryover from a different app iteration. Not part
  of the Vercel build (`vercel.json` only builds the Vite frontend), so
  it's inert but confusing.
- Decide whether to fully remove `src/firebase/` and
  `src/react-app/services/FirebaseService.ts` now that Supabase is the
  real backend — currently harmless (self-contained, unused by the active
  auth/data path) but it's dead weight in the bundle.

## To run it

```bash
npm install --legacy-peer-deps
npm run dev            # local dev server
npm run build           # production build -> dist/
```

`.env.local` is already set up with your live Supabase project. If you
haven't already, run `supabase/migrations/002_app_kv.sql` in your
Supabase SQL editor once.
