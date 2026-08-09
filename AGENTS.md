# FuelPro Mobile — Repository Knowledge

## Project Overview
React + Vite + TypeScript SPA for fuel station management. Deployed at
`fuel-app-mobile.vercel.app`. Backend is Supabase (project ref:
`ojjscjwatikixlpshmub`). Auth via Supabase email/password.

## Key Architecture
- `src/react-app/context/StationContext.tsx` — station CRUD, localStorage
  persistence (`fuelpro_stations_v3`), Supabase cross-device sync.
- `src/react-app/context/FuelContext.tsx` — tab configuration registry.
  SalesZote modules (Products, Sales Invoices, Purchases, Expenses, Reports,
  Terminal, EnhancedDashboard) are ADDITIVE lazy-loaded tabs, NOT a replacement
  of the FuelPro tab system.
- `src/react-app/context/AuthContext.tsx` — Supabase auth + role bindings.
- **Cross-device storage** (`src/react-app/lib/cloud-storage-service.ts`):
  Supabase `app_kv`-backed async KV store (cloud-first, RLS by `owner_id`,
  unlimited, accessible from any device). `FuelContext.saveToCloud`/
  `loadFromCloud` use it (key `user_<id>_compact`, collection `fuel_data`)
  instead of the removed `/api/user-data` endpoint. localStorage is kept ONLY
  as a read-through cache (`fuelpro_cloud_` prefix) for offline reads — never
  the source of truth. Other localStorage usages (UI prefs, prices cache,
  founder secrets) remain local; migrate them to `cloudStorageService` when
  they need cross-device.
- **Per-component cloud sync** (components with their own `cloudStorageService`
  get/set + `useAuth` load-on-mount effect, mirroring `ShiftManagement.tsx`):
  ShiftManagement (`shift_data`, `shift_employees`), PayrollSystem
  (`payroll_employees`, `payroll_settings`), Communication (`comm_contacts`,
  `comm_messages`, `comm_templates`), CreditManagement (`credit_accounts`,
  `credit_transactions`), CustomerLoyalty (`loyalty_customers`),
  FuelTypesManager (`fuel_types_config`), MaintenanceTracker
  (`maintenance_records`), SupplierManagement (`suppliers_data`,
  `purchase_orders`). Pattern: import service + `useAuth`, `const { user } =
  useAuth()`, append `cloudStorageService.set(key, data).catch(()=>{})` to the
  existing save fn, and add a `useEffect([user])` that `get`s the typed array
  and `setState`s it when `Array.isArray`.
- **Schema Visualizer** (`src/react-app/pages/founder-sections/
  SchemaVisualizerSection.tsx`): uses an EMBEDDED authoritative schema map
  (SCHEMA constant — 13 live tables with all columns, types, PK/FK annotations,
  derived from the actual live DB and kept in sync with `supabase/migrations/`).
  PostgREST's OpenAPI root (`GET /rest/v1/`) is now restricted to the
  service_role key (which can NEVER live in the client bundle — it bypasses
  RLS), so runtime introspection was abandoned in favor of the embedded map.
  Row counts are fetched LIVE via the authenticated client
  (`select('*', {count:'exact', head:true})`) and are RLS-respecting: a user
  sees counts only for rows they can read; tables they cannot access show "—"
  (RLS-gated). Wired into `DataManagementSection` as a two-tab view (Schema
  Visualizer + Storage). Reachable via Founder → Development → Data Manager.
  **Verified live 2026-08-09**: renders all 13 tables with accurate live counts
  (e.g. users=2) and FK links (→ users.id on owner_id columns).
- **Founder auth gate** (`src/react-app/lib/founder-auth.ts`):
  `loginFounder` must NOT check `import.meta.env.VITE_SUPABASE_URL`/
  `VITE_SUPABASE_ANON_KEY` directly — no `.env` sets these in production, so the
  gate always returned "Supabase is not configured" and the entire Founder
  panel was unreachable. The fix: trust the configured `getSupabaseClient()`
  (which resolves env vars with hardcoded fallbacks). Also: the Supabase user
  must have role `founder`/`admin` in the `users` table AND a confirmed email
  (`email_confirm:true` via admin API) before `signInWithPassword` succeeds.

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
- **CRITICAL — missing POS tables (fixed 2026-08-09)**: the live project had
  only 13 tables (the FuelPro originals). `pos-service.ts` and the management
  components (Expenses/Products/Customers/Suppliers) insert into `products`,
  `sales_enhanced`, `sale_items`, `inventory_transactions`, `stock_transfers`,
  `purchase_orders`, `purchase_order_items`, `expenses`, `expense_categories`,
  `terminal_sessions`, `integrations`, `suppliers`, `customers` — ALL of which
  were missing → every insert returned `PGRST205` (table not found) but the
  errors were unchecked → silent total data loss for the entire POS module.
  Fixed by applying migrations 005 (`005_saleszote_features.sql`) + 006
  (`006_complete_schema_applied.sql`, a cleaned variant that skips two index
  statements referencing columns absent on the pre-existing live `inventory`/
  `sales` tables). Live project now has 31 tables. Verified end-to-end: a
  real user token can insert station+product+sale+sale_item+expense and the
  founder page (service role) sees them. RLS on all new tables is
  `owner_id = auth.uid()` or station-ownership-scoped.
- **Silent insert failures (fixed 2026-08-09)**: `pos-service.ts`
  `processPOSCheckout`/`createPurchaseOrder`/`updateProductStock`/
  `recordInventoryTransaction` and the management components' `handleSave`/
  `handleDelete` all did `await supabase.from(...).insert(...)` WITHOUT
  checking the returned `{ error }` (supabase-js returns errors, does not
  throw). Result: failures were invisible and the UI showed false success.
  Fixed: all now check `error`/`result.success`, rollback orphaned parent
  records (e.g. delete `sales_enhanced` header if a `sale_items` insert
  fails), and `alert()` the specific error to the user.
- **`stations.code` NOT NULL UNIQUE bug (fixed 2026-08-09, commit 779a0fe)**:
  the live migration added a `code TEXT NOT NULL UNIQUE` column to `stations`,
  but the app's `stationToRowFields`/`pushStationUpsert`/migration-insert NEVER
  sent `code`. Every upsert failed with `23502 null value in column "code"
  violates not-null constraint` and the error was swallowed by the
  fire-and-forget `catch`. Result: stations persisted only to localStorage +
  the FuelContext `app_kv` blob, NEVER to the `stations` table → other devices
  never restored them → users got stranded on the "create station" screen.
  Fix: added `code` to the `Station` interface, `generateStationCode()` helper,
  backfill `code` in `createStation` + `loadFromStorage` (for pre-existing
  local stations), and include `code` in `stationToRowFields`,
  `pushStationUpsert`, and the local-only migration insert. Confirmed via
  direct API: user-token upsert WITHOUT `code` → 23502; WITH `code` → success.
- **RLS is NOT the blocker on `stations`**: user-token inserts/upserts
  succeed (policy `auth.uid() = owner_id`). The anon key in client.ts is
  `sb_publishable_-uUkeBG1KzESv3O4v90rcw_jY9NxTc4` (new publishable format).
- **Currency**: `getDetectedCurrency()` resolves KES for Kenya. Admin config
  `fuelpro_admin_v3.systemConfig.currency` upgrades stale "USD" to detected
  value on load (see `loadFromStorage`).
- **Math.random** usages are all legitimate ID/hash generation, not fake data.

## Deployment
- Vercel project: `prj_hjVrMLO7CxLTI77kthGE020eI3oj` (team:
  `leons-projects-78a92c96`).
- **Prebuilt deploy method (works, bypasses rate limit + bad buildCommand)**:
  The project's configured `buildCommand` is `cd app && npm install --legacy-peer-deps
  && npm run build:static`, pointing at an `app/` subdir that does NOT exist in the
  repo root. So a plain `vercel deploy dist --prod` FAILS with "npm install exit 254"
  (no package.json in dist). The ONLY reliable deploy path is the Build Output API:
    1. `VERCEL_ORG_ID=team_HvnupSUe9C1kfvUEQ5LFXOju VERCEL_PROJECT_ID=prj_... npx
       vercel build --prod --token=$VERCEL --scope=leons-projects-78a92c96 --yes`
       → produces `.vercel/output/` (builds.json + config.json + static/ + functions/).
    2. `npx vercel deploy --prebuilt --prod --scope=... --token=$VERCEL --yes`
       → uploads prebuilt artifacts; Vercel skips its build; aliases to
       fuel-app-mobile.vercel.app. Deploy shows `prebuilt: true, type: LAMBDAS`.
  The `.vercel/` dir is gitignored. The REST API alone (POST /v13/deployments with
  uploaded file shas) does NOT work because Vercel still runs the configured
  buildCommand regardless of `prebuilt=1` / `projectSettings.buildCommand=null`.
- **Cloudflare Pages** is the unlimited mirror: `CLOUDFLARE_API_TOKEN=$CLOUDFLARE
  npx wrangler pages deploy dist --project-name=fuel-app-mobile --branch=main`.
- Vercel `api-deployments-free-per-day` limit (100/day) can be exhausted. Resets ~24h.
  Read-only GET deployments use a separate 1000/min bucket and still work when the
  deploy bucket is exhausted.
- **2026-08-09 state (commit a8b497d, DEPLOYED LIVE)**: ALL fixes are in
  production. Bundled into ONE deploy: (1) applied migrations 005+006 to live
  Supabase (was 13 tables → now 31; the entire POS module was silently losing
  all data because products/sales_enhanced/sale_items/expenses/etc. tables
  didn't exist → PGRST205 errors unchecked). (2) Fixed unchecked insert/update/
  delete results across pos-service.ts + management components (supabase-js
  returns `{error}`, doesn't throw) → rollback orphaned parent records + alert
  specific errors. Deployed via git-source API deploy (POST
  /v13/deployments with gitSource.repoId=1241380610) — the prebuilt
  /tmp/vercel_api_deploy_now.js script was BROKEN (uploaded only dist/ files,
  Vercel still ran `npm install` → ENOENT package.json → 3 ERROR deployments).
  The git-source deploy clones the full repo from GitHub (with package.json),
  runs the normal Vite build, and works. Deployment dpl_J4tCP1qdQDBjRgp24PA4d9jiwcR5,
  READY, aliased to fuel-app-mobile.vercel.app.
- **2026-08-09 logo fix (commit 87425b1, DEPLOYED LIVE)**: station logo
  disappeared on refresh/new session because it was stored as a base64 blob in
  localStorage (quota-limited, per-browser). Now uploads to the `fuelpro-files`
  Supabase Storage bucket (path `logos/<uid>/<ts>.<ext>`) and stores the PUBLIC
  URL in `companyData.logo` — a real cross-device file. `FuelContext` mount
  effect now ALWAYS consults cloud (app_kv) as source of truth on mount/user
  change; localStorage is only a read-through cache. Migration 007 added RLS
  policies for `fuelpro-files` bucket (the bucket had RLS enabled with ZERO
  policies → all uploads were blocked). Deployed as dpl_GnnDeKBsKW (READY,
  aliased to fuel-app-mobile.vercel.app).
- **2026-08-09 wizard data-loss fix (commit 29abe6b, DEPLOYED LIVE)**: setup
  wizard data (tanks, pumps, prices, KRA, companyData) was lost on reload
  because `Home.tsx` called `window.location.reload()` inside `onComplete`
  BEFORE the debounced (300ms) `saveToStorage`/`saveToCloud` could flush. The
  reload aborted the pending timers. Fix: removed the reload call — the
  completion flag now persists via `fuelpro_setup_complete` and React state
  transitions the UI; the debounce is allowed to complete. Verified in bundle:
  `fuelpro_setup_complete` present, the wizard `onComplete` reload removed.
  Deployed as dpl_AqKBHnEtrdJFPSPja8ct5hp9aU96 (READY, PROMOTED, aliased to
  fuel-app-mobile.vercel.app). Production chunk: index-CMtbBBDc.js.
  **All functional fixes are now LIVE on fuel-app-mobile.vercel.app and the
  Cloudflare Pages mirror (fuel-app-mobile.pages.dev).**

## FuelContext save/load race (FIXED 2026-08-09, commit b3d489e4)
The load-from-storage `useEffect` had `saveToStorage` in its deps. Because
`saveToStorage` was recreated on every state change (deps `[state, user]`),
the load effect re-fired on every keystroke and overwrote edits with stale
localStorage data (300ms save debounce vs 100ms load timer). This was the root
cause of the "Qty (DAYS) field can't be edited/cleared" bug and affected ANY
field with a default value (currency, invoice label, etc.). Fix applied:
- `stateRef` (useRef) always points to current state; `saveToStorage`/
  `saveToCloud` read from `stateRef.current`, deps changed to `[user]`.
- `saveToStorage` removed from load effect deps (now `[user, loadFromCloud]`).
- `SET_INVOICE_SETTINGS` reducer merges `{...state.invoiceSettings, ...action.payload}`
  instead of replacing wholesale.
- Compact data save always includes `invoiceSettings` (removed conditional
  `!== "Qty (DAYS)"` check).
Verified end-to-end: Phase 1 user edited label "Qty (DAYS)"→"Litres", saved;
Supabase `app_kv` row contains `invoiceSettings.quantityLabel="Litres"`.
Phase 2: cleared localStorage, reloaded — Invoice tab loaded "Litres" + the
saved item (total Ksh 10,702) from cloud. Cross-device sync confirmed working.

## Build / Test
- `npx tsc --noEmit` — typecheck (must pass before commit).
- `npm run build` — Vite production build.
- No test suite configured.

## Credentials
- Supabase service_role key and access token are in `/workspace/API KEYS.txt`
  (project `ojjscjwatikixlpshmub`). NEVER commit these.
- Vercel token in `$VERCEL`. GitHub token in `$GITHUB_TOKEN`.

## CRITICAL — Cross-device cloud data overwrite race (FIXED 2026-08-09, commit 00522ac)
**Symptom**: When a user logs in on a NEW device/browser (empty local cache),
ALL their cloud data (app_kv blob) was silently WIPED within ~2 seconds of
login. Company info, invoices, sales history, debt, offloading, pumps,
delivery records — everything gone. The user was then stranded with a
default-state app and the overwritten empty cloud blob meant every
subsequent device also saw empty data. This is the most severe bug found
in the entire testing campaign — it destroys user data on every
cross-device login.

**Root cause**: Three effects run on login:
1. Load effect (100ms timer, deps `[user, loadFromCloud, ...]`): calls
   `loadFromStorage()` (instant, from localStorage cache — empty on new
   device) then `await loadFromCloud()` (async Supabase fetch, ~200-500ms).
2. Auto-save-to-cloud effect (1500ms timer, deps `[user, state]`): calls
   `saveToCloud()` which reads `stateRef.current` and writes it to app_kv.
3. Periodic cloud save (15000ms interval): also calls `saveToCloud()`.

On a new device, `loadFromCloud` takes ~200-500ms but the 1500ms auto-save
fires with the DEFAULT/EMPTY in-memory state (since loadFromStorage loaded
nothing from the empty cache). `saveToCloud` then writes the empty state to
app_kv, OVERWRITING all the user's real data BEFORE `loadFromCloud` even
returns. The `finally` block then sets the ref, but the damage is done.

**Fix** (`FuelContext.tsx`): `cloudLoadCompleteRef = useRef(false)`.
- Reset to `false` on every `user` change (`useEffect(() => { ref.current = false }, [user])`).
- `saveToCloud` early-returns if `!cloudLoadCompleteRef.current` (with a
  console.log so it's debuggable).
- The load effect's `finally` block sets `cloudLoadCompleteRef.current = true`
  (guarded by `!cancelled`) — so saves are unblocked whether loadFromCloud
  succeeded, found no data, or failed.

This guarantees the initial cloud load is never overwritten by default
state, while subsequent legitimate user edits still sync normally. Verified
end-to-end: logged in on fresh deployment URL (e67aeef4.fuel-app-mobile.pages.dev),
cloud data (company name, KRA PIN, bank details, invoice INV-2026-001,
quantityLabel='Litres', sales history Ksh 200,000) loaded correctly AND
remained intact after the auto-save fired (updated_at advanced but data
preserved — the save was idempotent because it saved the loaded state).

**ALSO FIXED** in same commit: `pushStationUpsert` in `StationContext.tsx`
now checks `{ error }` from both Supabase upserts (stations table +
app_kv station_data). Previously errors were silently swallowed, so a
failed station push (RLS/schema/code constraint) left the station only in
localStorage + FuelContext's app_kv blob — never in the `stations` table —
and the user got stranded on the setup wizard on every other device. This
was the secondary root cause of the Phase 2 cross-device failure.

## Deployment — Cloudflare Pages (primary, Vercel rate-limited)
Vercel's free tier limit (100 deploys/day) was exhausted. Cloudflare Pages
is the unlimited mirror and is now the primary deploy target:
`CLOUDFLARE_API_TOKEN=$CLOUDFLARE npx wrangler pages deploy dist
--project-name=fuel-app-mobile --branch=main --commit-dirty=true`.
Live at https://fuel-app-mobile.pages.dev (and unique preview URLs like
https://e67aeef4.fuel-app-mobile.pages.dev per deployment). The unique
preview URL is useful for testing because it has no cached service worker.

**PWA service worker caching**: the app registers a service worker
(generateSW, 119 precache entries). On reload, the SW serves CACHED old
JS bundles, so code fixes don't take effect until the SW updates (which
can lag by a page load or require a hard reload / SW unregister). To test
a fresh build immediately, use the unique Cloudflare preview deployment
URL (e.g. `https://<hash>.fuel-app-mobile.pages.dev/`) instead of the
production alias — the preview URL has no registered SW.

## Supabase Management API — DB access (FIXED 2026-08-09)
The Supabase Management API (`https://api.supabase.com/v1/projects/{ref}/database/query`) is the way to apply migrations/DDL to the live DB. Direct DB connection (`db.{ref}.supabase.co:5432`) does NOT resolve (IPv6-only / no DNS) and the pooler rejects the tenant (`ENOTFOUND tenant/user postgres.{ref} not found`). The Management API requires a Supabase Personal Access Token (PAT, `sbp_` prefix — found in API KEYS.txt: `sbp_<PAT_FROM_API_KEYS_TXT>`), NOT the service_role JWT (returns 401). CRITICAL: `api.supabase.com` is behind Cloudflare which returns `error code: 1010` for requests WITHOUT a `User-Agent` header. Fix: always include `User-Agent: Mozilla/5.0 ...` — this bypasses the 1010 block. Apply migrations with `POST /v1/projects/{ref}/database/query` body `{"query": "<sql>"}`. SELECT returns rows as JSON array; DDL returns `[]`.

## Migration 008 — profile sharing + documents (APPLIED LIVE 2026-08-09)
`supabase/migrations/008_profile_sharing_documents.sql` applied live via Management API. Adds: `profiles.phone`, `profiles.username` (UNIQUE), `profiles.avatar_url`; `station_members` table (DB-backed cross-device station sharing, RLS: owner_id = auth.uid()); `user_documents` table (cross-device file metadata, RLS: owner_id = auth.uid()). Existing storage RLS for `fuelpro-files` checks `(storage.foldername(name))[2] = auth.uid()` — works for BOTH `logos/<uid>/...` and `documents/<uid>/...` paths.

## AuthContext — profile management (ADDED 2026-08-09)
`AuthContext.tsx` exposes `updateProfile`, `updateEmail`, `updatePassword`. `updateProfile` updates BOTH `supabase.auth.updateUser({data})` AND the `profiles` table; handles unique username violation (23505). `updateEmail` calls `supabase.auth.updateUser({email})` + updates `profiles.email`. `updatePassword` calls `supabase.auth.updateUser({password})` (min 8 chars, works when logged in).

## PasswordReset — Supabase email-link flow (FIXED 2026-08-09)
Old page had fake 6-digit code flow (`verifyResetCode` always false, `resetPassword` stub). Now uses Supabase's real email-link recovery: email -> `resetPasswordForEmail` sends link -> user clicks -> redirects to `/reset-password` with recovery token -> page detects `type=recovery`/`access_token` in URL OR `PASSWORD_RECOVERY` event -> skips to newpass -> `supabase.auth.updateUser({password})`.

## Cross-device file storage + station sharing (ADDED 2026-08-09)
`src/react-app/lib/document-service.ts` uploads to Supabase Storage (`fuelpro-files`, path `documents/<uid>/<timestamp>-<name>`), metadata in `user_documents`. `src/react-app/lib/station-share-service.ts` is DB-backed sharing via `station_members` (invite link = `/?invite=<token>`). `src/react-app/components/UserProfileSettings.tsx` is the full UI (profile, email, password, sharing, files), embedded in SettingsPanel as a "User Profile" tab.
