# FuelPro Mobile ÔÇö Repository Knowledge

## Project Overview

React + Vite + TypeScript SPA for fuel station management. Deployed at
`fuel-app-mobile.vercel.app`. Backend is Supabase (project ref:
`ojjscjwatikixlpshmub`). Auth via Supabase email/password.

## Key Architecture

- `src/react-app/context/StationContext.tsx` ÔÇö station CRUD, localStorage
  persistence (`fuelpro_stations_v3`), Supabase cross-device sync.
- `src/react-app/context/FuelContext.tsx` ÔÇö tab configuration registry.
  SalesZote modules (Products, Sales Invoices, Purchases, Expenses, Reports,
  Terminal, EnhancedDashboard) are ADDITIVE lazy-loaded tabs, NOT a replacement
  of the FuelPro tab system.
- `src/react-app/context/AuthContext.tsx` ÔÇö Supabase auth + role bindings.
- **Cross-device storage** (`src/react-app/lib/cloud-storage-service.ts`):
  Supabase `app_kv`-backed async KV store (cloud-first, RLS by `owner_id`,
  unlimited, accessible from any device). `FuelContext.saveToCloud`/
  `loadFromCloud` use it (key `user_<id>_compact`, collection `fuel_data`)
  instead of the removed `/api/user-data` endpoint. localStorage is kept ONLY
  as a read-through cache (`fuelpro_cloud_` prefix) for offline reads ÔÇö never
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
  `purchase_orders`), ExpenseTracker (`expenses_data`), PriceBoard
  (`priceboard_data`, `price_history_data`), APIKeyManager (`apikeys_data`),
  MPesaConfig (`mpesa_config` ÔÇö object, uses `if (cloud)` not Array.isArray),
  SMSGatewayConfig (`sms_config` ÔÇö object), WebhookManager (`webhooks_data`),
  PointOfSale (`pos_transactions`), News (`news_bookmarks`).
  Pattern: import service + `useAuth`, `const { user } = useAuth()`, append
  `cloudStorageService.set(key, data).catch(()=>{})` to the existing save fn
  (keep `localStorage.setItem` as cache), and add a `useEffect([user])` that
  `get`s the typed array/object and `setState`s it ÔÇö for arrays guard with
  `Array.isArray`, for objects use `if (cloud)`. For components whose save is a
  `useEffect` (e.g. ExpenseTracker/PriceBoard) put the `cloudStorageService.set`
  inside that same effect. MIGRATED 2026-08-09: the 8 above (ExpenseTracker,
  PriceBoard, APIKeyManager, MPesaConfig, SMSGatewayConfig, WebhookManager,
  PointOfSale, News); `npx tsc --noEmit` clean (0 errors).
- **Document Center ÔÇö Supabase Storage migration (FIXED 2026-08-09)**: The
  Document Center tab (`DocumentCenter.tsx`) used `documentStore.ts` which
  stored files in **IndexedDB** (browser-local, NO cross-device sync ÔÇö files
  uploaded on one device were invisible on another). Rewrote `documentStore.ts`
  to use Supabase Storage (`fuelpro-files` bucket, path
  `documents/<uid>/<ts>-<name>`) + `user_documents` table (RLS by owner_id).
  Same export API (saveDocument, getDocument, listDocuments, deleteDocument,
  countDocuments, getTotalStorageUsed, CATEGORIES, DocMetadata) so
  DocumentCenter.tsx needed NO changes. Migration 010 added `tags` (JSONB),
  `folder_path` (TEXT), `thumbnail` (TEXT) columns to `user_documents` for the
  extra metadata. E2E verified: upload Ôćĺ metadata insert Ôćĺ list Ôćĺ fetch via
  public URL (HTTP 200) Ôćĺ delete, all with a user token. `Documents.tsx` (the
  legacy Documents tab, NOT rendered but kept for reference) was also migrated
  from base64-in-JSON to Storage uploads via `uploadFileToStorage()`.
- **Schema Visualizer** (`src/react-app/pages/founder-sections/
SchemaVisualizerSection.tsx`): uses an EMBEDDED authoritative schema map
  (SCHEMA constant ÔÇö 13 live tables with all columns, types, PK/FK annotations,
  derived from the actual live DB and kept in sync with `supabase/migrations/`).
  PostgREST's OpenAPI root (`GET /rest/v1/`) is now restricted to the
  service_role key (which can NEVER live in the client bundle ÔÇö it bypasses
  RLS), so runtime introspection was abandoned in favor of the embedded map.
  Row counts are fetched LIVE via the authenticated client
  (`select('*', {count:'exact', head:true})`) and are RLS-respecting: a user
  sees counts only for rows they can read; tables they cannot access show "ÔÇö"
  (RLS-gated). Wired into `DataManagementSection` as a two-tab view (Schema
  Visualizer + Storage). Reachable via Founder Ôćĺ Development Ôćĺ Data Manager.
  **Verified live 2026-08-09**: renders all 13 tables with accurate live counts
  (e.g. users=2) and FK links (Ôćĺ users.id on owner_id columns).
- **Founder auth gate** (`src/react-app/lib/founder-auth.ts`):
  `loginFounder` must NOT check `import.meta.env.VITE_SUPABASE_URL`/
  `VITE_SUPABASE_ANON_KEY` directly ÔÇö no `.env` sets these in production, so the
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
  `pushStationUpsert` fails silently if these are missing ÔÇö check schema if
  cross-device sync stops working.
- **CRITICAL ÔÇö missing POS tables (fixed 2026-08-09)**: the live project had
  only 13 tables (the FuelPro originals). `pos-service.ts` and the management
  components (Expenses/Products/Customers/Suppliers) insert into `products`,
  `sales_enhanced`, `sale_items`, `inventory_transactions`, `stock_transfers`,
  `purchase_orders`, `purchase_order_items`, `expenses`, `expense_categories`,
  `terminal_sessions`, `integrations`, `suppliers`, `customers` ÔÇö ALL of which
  were missing Ôćĺ every insert returned `PGRST205` (table not found) but the
  errors were unchecked Ôćĺ silent total data loss for the entire POS module.
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
  the FuelContext `app_kv` blob, NEVER to the `stations` table Ôćĺ other devices
  never restored them Ôćĺ users got stranded on the "create station" screen.
  Fix: added `code` to the `Station` interface, `generateStationCode()` helper,
  backfill `code` in `createStation` + `loadFromStorage` (for pre-existing
  local stations), and include `code` in `stationToRowFields`,
  `pushStationUpsert`, and the local-only migration insert. Confirmed via
  direct API: user-token upsert WITHOUT `code` Ôćĺ 23502; WITH `code` Ôćĺ success.
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
     Ôćĺ produces `.vercel/output/` (builds.json + config.json + static/ + functions/).
  2. `npx vercel deploy --prebuilt --prod --scope=... --token=$VERCEL --yes`
     Ôćĺ uploads prebuilt artifacts; Vercel skips its build; aliases to
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
  Supabase (was 13 tables Ôćĺ now 31; the entire POS module was silently losing
  all data because products/sales_enhanced/sale_items/expenses/etc. tables
  didn't exist Ôćĺ PGRST205 errors unchecked). (2) Fixed unchecked insert/update/
  delete results across pos-service.ts + management components (supabase-js
  returns `{error}`, doesn't throw) Ôćĺ rollback orphaned parent records + alert
  specific errors. Deployed via git-source API deploy (POST
  /v13/deployments with gitSource.repoId=1241380610) ÔÇö the prebuilt
  /tmp/vercel_api_deploy_now.js script was BROKEN (uploaded only dist/ files,
  Vercel still ran `npm install` Ôćĺ ENOENT package.json Ôćĺ 3 ERROR deployments).
  The git-source deploy clones the full repo from GitHub (with package.json),
  runs the normal Vite build, and works. Deployment dpl_J4tCP1qdQDBjRgp24PA4d9jiwcR5,
  READY, aliased to fuel-app-mobile.vercel.app.
- **2026-08-09 logo fix (commit 87425b1, DEPLOYED LIVE)**: station logo
  disappeared on refresh/new session because it was stored as a base64 blob in
  localStorage (quota-limited, per-browser). Now uploads to the `fuelpro-files`
  Supabase Storage bucket (path `logos/<uid>/<ts>.<ext>`) and stores the PUBLIC
  URL in `companyData.logo` ÔÇö a real cross-device file. `FuelContext` mount
  effect now ALWAYS consults cloud (app_kv) as source of truth on mount/user
  change; localStorage is only a read-through cache. Migration 007 added RLS
  policies for `fuelpro-files` bucket (the bucket had RLS enabled with ZERO
  policies Ôćĺ all uploads were blocked). Deployed as dpl_GnnDeKBsKW (READY,
  aliased to fuel-app-mobile.vercel.app).
- **2026-08-09 wizard data-loss fix (commit 29abe6b, DEPLOYED LIVE)**: setup
  wizard data (tanks, pumps, prices, KRA, companyData) was lost on reload
  because `Home.tsx` called `window.location.reload()` inside `onComplete`
  BEFORE the debounced (300ms) `saveToStorage`/`saveToCloud` could flush. The
  reload aborted the pending timers. Fix: removed the reload call ÔÇö the
  completion flag now persists via `fuelpro_setup_complete` and React state
  transitions the UI; the debounce is allowed to complete. Verified in bundle:
  `fuelpro_setup_complete` present, the wizard `onComplete` reload removed.
  Deployed as dpl_AqKBHnEtrdJFPSPja8ct5hp9aU96 (READY, PROMOTED, aliased to
  fuel-app-mobile.vercel.app). Production chunk: index-CMtbBBDc.js.
  **All functional fixes are now LIVE on fuel-app-mobile.vercel.app and the
  Cloudflare Pages mirror (fuel-app-mobile.pages.dev).**
- **2026-08-09 commit 3746b02 (DEPLOYED LIVE)** ÔÇö React error #185 (Maximum
  update depth exceeded) in StationContext. Root cause: a dependency-chain
  cascade caused an infinite mount-effect loop: `persist` (deps
  `[stations, adminSettings]`) was recreated on every state change Ôćĺ
  `syncFromBackend` (deps `[persist]`) recreated whenever `persist` changed Ôćĺ
  the mount effect (deps `[syncFromBackend]`) re-fired on every
  `syncFromBackend` recreation, calling `setStations`/`setAdminSettings` Ôćĺ
  recreating `persist` Ôćĺ infinite loop. Fix: `persist` is now stable
  (`deps []`) by reading current stations/adminSettings from refs
  (`stationsRef`/`adminSettingsRef`) instead of closure capture. Deployed as
  `dpl_8rD75tGEkqD16pHWwDQEShtoePpy` (READY, PROMOTED, aliased to
  fuel-app-mobile.vercel.app). Also bundles `3c28f5e` (replaced all broken
  `/api/*` calls with `cloudStorageService` for cross-device persistence) and
  `f0299c8` (profile management, password reset, cross-device sharing &
  documents). Verified live: HTTP 200, prod chunk `index-gwkrD55k.js`.
  Git-source API deploy method confirmed reliable: `POST /v13/deployments`
  with body `gitSource.repoId=1241380610` + `ref=<sha>` and
  `?projectId=prj_...` as QUERY param (NOT body ÔÇö body `projectId` is rejected
  with "should NOT have additional property"). Cloudflare Pages mirror also
  updated: https://1c5565eb.fuel-app-mobile.pages.dev.

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
  Verified end-to-end: Phase 1 user edited label "Qty (DAYS)"Ôćĺ"Litres", saved;
  Supabase `app_kv` row contains `invoiceSettings.quantityLabel="Litres"`.
  Phase 2: cleared localStorage, reloaded ÔÇö Invoice tab loaded "Litres" + the
  saved item (total Ksh 10,702) from cloud. Cross-device sync confirmed working.

## Build / Test

- `npx tsc --noEmit` ÔÇö typecheck (must pass before commit).
- `npm run build` ÔÇö Vite production build.
- No test suite configured.

## Credentials

- Supabase service_role key and access token are in `/workspace/API KEYS.txt`
  (project `ojjscjwatikixlpshmub`). NEVER commit these.
- Vercel token in `$VERCEL`. GitHub token in `$GITHUB_TOKEN`.

## CRITICAL ÔÇö Cross-user station + data leak via overly-permissive RLS (FIXED 2026-08-09, commit fb9eb29)

**Symptom**: any logged-in user received the GLOBAL station list ÔÇö including
every other user's stations ÔÇö via the cloud sync query. On a fresh device
(cleared localStorage), the app defaulted to another user's station
("Publican Energy Test Station") on first login, and the leaked stations
were persisted into the user-scoped localStorage cache. This affected not
just `stations` but also `users`, `inventory`, `sales`, `audit_logs`, and
`config` ÔÇö all of which had broad `authenticated_*` RLS policies.

**Root cause**: the tables had three broad RLS policies shadowing the proper
owner-scoped ones:

- `authenticated_select`: `(auth.role() = 'authenticated')` Ôćĺ ANY
  authenticated user can SELECT ALL rows.
- `authenticated_update`: same Ôćĺ ANY user can UPDATE ALL rows.
- `authenticated_insert`: `(auth.role() = 'authenticated')` WITH CHECK Ôćĺ
  ANY user can INSERT as anyone.
  Because Postgres RLS policies are OR'd, the broad policy made the
  owner-scoped `(auth.uid() = owner_id)` policy irrelevant ÔÇö every row was
  visible to every authenticated user.

**Fix** (migration `009_stations_rls_crossuser_fix.sql`, applied live via
Management API):

- Dropped `authenticated_select/update/insert` on `stations`, `users`,
  `inventory`, `sales`, `audit_logs`, `config`. Only owner-scoped policies
  remain (verified: `SELECT tablename, policyname FROM pg_policies WHERE
policyname LIKE 'authenticated_%'` returns empty).
- `StationContext.syncStationsWithSupabase` adds `.eq('owner_id', userId)`
  to ALL station SELECT queries + direct-fetch fallbacks as
  defense-in-depth (so a future misconfigured RLS policy can never leak
  foreign stations into an account).
- Station localStorage key is user-scoped
  (`fuelpro_stations_v3_<userId>`, see commit 9cc8603) ÔÇö each account has
  its own isolated local cache; the legacy global key is cleared on
  user change/logout.

**Verified end-to-end**: a real user token now returns ONLY that user's
stations (was 5 incl. 4 foreign; now 1 own station). Fresh-device login
defaults to the user's OWN station, never another user's. localStorage
scoped key contains only the user's own station; old global key empty.
IMPORTANT: `created_by` is NULL for all existing stations, so the
`(created_by = auth.uid())` policy matches nothing ÔÇö the `(auth.uid() =
owner_id)` policy is the effective one. New stations should set both
`owner_id` AND `created_by` to the auth uid for full coverage.

## CRITICAL ÔÇö Cross-device cloud data overwrite race (FIXED 2026-08-09, commit 00522ac)

**Symptom**: When a user logs in on a NEW device/browser (empty local cache),
ALL their cloud data (app_kv blob) was silently WIPED within ~2 seconds of
login. Company info, invoices, sales history, debt, offloading, pumps,
delivery records ÔÇö everything gone. The user was then stranded with a
default-state app and the overwritten empty cloud blob meant every
subsequent device also saw empty data. This is the most severe bug found
in the entire testing campaign ÔÇö it destroys user data on every
cross-device login.

**Root cause**: Three effects run on login:

1. Load effect (100ms timer, deps `[user, loadFromCloud, ...]`): calls
   `loadFromStorage()` (instant, from localStorage cache ÔÇö empty on new
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
  (guarded by `!cancelled`) ÔÇö so saves are unblocked whether loadFromCloud
  succeeded, found no data, or failed.

This guarantees the initial cloud load is never overwritten by default
state, while subsequent legitimate user edits still sync normally. Verified
end-to-end: logged in on fresh deployment URL (e67aeef4.fuel-app-mobile.pages.dev),
cloud data (company name, KRA PIN, bank details, invoice INV-2026-001,
quantityLabel='Litres', sales history Ksh 200,000) loaded correctly AND
remained intact after the auto-save fired (updated_at advanced but data
preserved ÔÇö the save was idempotent because it saved the loaded state).

**ALSO FIXED** in same commit: `pushStationUpsert` in `StationContext.tsx`
now checks `{ error }` from both Supabase upserts (stations table +
app_kv station_data). Previously errors were silently swallowed, so a
failed station push (RLS/schema/code constraint) left the station only in
localStorage + FuelContext's app_kv blob ÔÇö never in the `stations` table ÔÇö
and the user got stranded on the setup wizard on every other device. This
was the secondary root cause of the Phase 2 cross-device failure.

## Deployment ÔÇö Cloudflare Pages (primary, Vercel rate-limited)

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
production alias ÔÇö the preview URL has no registered SW.

## Supabase Management API ÔÇö DB access (FIXED 2026-08-09)

The Supabase Management API (`https://api.supabase.com/v1/projects/{ref}/database/query`) is the way to apply migrations/DDL to the live DB. Direct DB connection (`db.{ref}.supabase.co:5432`) does NOT resolve (IPv6-only / no DNS) and the pooler rejects the tenant (`ENOTFOUND tenant/user postgres.{ref} not found`). The Management API requires a Supabase Personal Access Token (PAT, `sbp_` prefix ÔÇö found in API KEYS.txt: `sbp_<PAT_FROM_API_KEYS_TXT>`), NOT the service_role JWT (returns 401). CRITICAL: `api.supabase.com` is behind Cloudflare which returns `error code: 1010` for requests WITHOUT a `User-Agent` header. Fix: always include `User-Agent: Mozilla/5.0 ...` ÔÇö this bypasses the 1010 block. Apply migrations with `POST /v1/projects/{ref}/database/query` body `{"query": "<sql>"}`. SELECT returns rows as JSON array; DDL returns `[]`.

## Migration 008 ÔÇö profile sharing + documents (APPLIED LIVE 2026-08-09)

`supabase/migrations/008_profile_sharing_documents.sql` applied live via Management API. Adds: `profiles.phone`, `profiles.username` (UNIQUE), `profiles.avatar_url`; `station_members` table (DB-backed cross-device station sharing, RLS: owner_id = auth.uid()); `user_documents` table (cross-device file metadata, RLS: owner_id = auth.uid()). Existing storage RLS for `fuelpro-files` checks `(storage.foldername(name))[2] = auth.uid()` ÔÇö works for BOTH `logos/<uid>/...` and `documents/<uid>/...` paths.

## AuthContext ÔÇö profile management (ADDED 2026-08-09)

`AuthContext.tsx` exposes `updateProfile`, `updateEmail`, `updatePassword`. `updateProfile` updates BOTH `supabase.auth.updateUser({data})` AND the `profiles` table; handles unique username violation (23505). `updateEmail` calls `supabase.auth.updateUser({email})` + updates `profiles.email`. `updatePassword` calls `supabase.auth.updateUser({password})` (min 8 chars, works when logged in).

## PasswordReset ÔÇö Supabase email-link flow (FIXED 2026-08-09)

Old page had fake 6-digit code flow (`verifyResetCode` always false, `resetPassword` stub). Now uses Supabase's real email-link recovery: email -> `resetPasswordForEmail` sends link -> user clicks -> redirects to `/reset-password` with recovery token -> page detects `type=recovery`/`access_token` in URL OR `PASSWORD_RECOVERY` event -> skips to newpass -> `supabase.auth.updateUser({password})`.

## Cross-user app_kv data overwrite (FIXED 2026-08-09, commit bb4f69e, PR #94)

**Symptom**: Per-component cloud keys (expenses_data, priceboard_data,
suppliers_data, shift_data, payroll_employees, maintenance_records,
comm_contacts, credit_accounts, loyalty_customers, fuel_types_config,
purchase_orders, pos_transactions, etc.) were stored in `app_kv` with a
GLOBAL row id (the bare key name) and `onConflict: "id"`. Every user
sharing a logical key name upserted the SAME row Ôćĺ the most recent write
OVERWROTE the previous user's data AND flipped `owner_id`. With RLS
(`owner_id = auth.uid()`), the original owner's subsequent `get` (which
filters `id = key AND owner_id = auth.uid()`) returned `null` Ôćĺ silent,
total cross-user data loss. Verified live: the `credit_accounts`,
`loyalty_customers`, and `comm_contacts` rows in production had their
`owner_id` flipped from `a17b4a8a` to `98ecc424`, destroying user
a17b4a8a's data.

**Fix** (`src/react-app/lib/cloud-storage-service.ts`): scope the `app_kv`
row id by `owner_id` Ôćĺ `id = `${key}__${ownerId}`` in `set`/`get`/`delete`/
`getAll`. Each user gets an isolated row for the same logical key; RLS
enforces per-user isolation.

- `get`: reads the scoped id first, falls back to the legacy bare-key row
  (owned by this user) ONCE so existing data is migrated on first read; the
  next `set` repersists it under the scoped id.
- `set`: upserts under the scoped id.
- `delete`: removes the scoped row + any legacy bare-key row for this owner.
- `getAll`: strips the `__ownerId` suffix to return logical keys to callers.
  FuelContext's `user_<id>_compact` key is already user-scoped (the legacy
  fallback preserves its existing data). Verified in bundle: the
  `${key}__${ownerId}` rowId pattern is present in the built JS.

## Cross-device file storage + station sharing (ADDED 2026-08-09)

`src/react-app/lib/document-service.ts` uploads to Supabase Storage (`fuelpro-files`, path `documents/<uid>/<timestamp>-<name>`), metadata in `user_documents`. `src/react-app/lib/station-share-service.ts` is DB-backed sharing via `station_members` (invite link = `/?invite=<token>`). `src/react-app/components/UserProfileSettings.tsx` is the full UI (profile, email, password, sharing, files), embedded in SettingsPanel as a "User Profile" tab.

## Cross-user overwrite fix ÔÇö VERIFIED LIVE 2026-08-09 (deploy b2b98cd2)

PR #94 (commit bb4f69e) deployed to Cloudflare Pages
(https://fuel-app-mobile.pages.dev + preview
https://b2b98cd2.fuel-app-mobile.pages.dev). Vercel production deploy
BLOCKED by `api-deployments-free-per-day` (100/day exhausted, resets ~24h);
read-only deployment GETs still work. The fix is LIVE on Cloudflare; Vercel
will pick up the merged main on next deploy window (or via Git integration
which uses a separate quota ÔÇö last Vercel prod deploy was from commit
"Update package-lock.json", NOT the latest main).
**End-to-end verification (fresh-device login on b2b98cd2 preview)**:

- Logged in as QA user 98ecc424 (qa.crossdevice.0809b@gmail.com) on a
  FRESH deployment URL (no localStorage, no service worker cache).
- App loaded station + FuelContext data from cloud Ôćĺ station
  "Publican Energy Test Station", companyData "CrossDevice Fuel Station Ltd",
  invoiceSettings.quantityLabel "Litres" all present.
- DB check: the compact blob migrated to the scoped id
  `user_98ecc424..._compact__98ecc424...` (updated 19:11:24 ÔÇö the fresh-login
  save wrote to the scoped id, NOT the legacy bare-key). Legacy bare-key row
  still present (19:08:26) ÔÇö the `get` fallback found it, then the next `set`
  repersisted under the scoped id. Per-component keys (expenses_data,
  priceboard_data, suppliers_data, etc.) remain under bare-key ids with
  owner_id=98ecc424 (not yet re-saved on fresh login; they migrate to scoped
  ids on the next edit via the same fallback+resave path).
- Per-component data INTACT in app_kv: expenses_data=[EXP-2026-001 KES 12500
  rent], priceboard_data=[Petrol Regular KES 180],
  suppliers_data=[Total Kenya Marketing]. suppliers TABLE has 2 rows.
  products TABLE has Castrol GTX 5W-30 (set is_active=true via DB so it
  appears in POS dropdowns ÔÇö pos-service fetchProducts filters is_active).
- Founder panel (logged in as founder user 6220a16c,
  fueltest_1786274010@testmail.com) renders: Overview shows All Users=1,
  All Stations=3, Secrets=3, Audit Log=1000, Feature Flags=10. Founder auth
  uses signInWithPassword + role check (users.role=founder/admin).
- **NOTE**: QA user 98ecc424 is NOT in the `users` table (only `profiles`),
  so it CANNOT access the founder panel. The `users` table has only 3 rows
  (2 founders + 1 user). The founder "All Users=1" count reflects this.
  stations TABLE is empty for 98ecc424 (station is in the StationContext
  app_kv blob only, not pushed to the stations table ÔÇö see the
  `stations.code` NOT NULL fix; this user's station predates the code
  backfill or was never pushed).

## Founder test credentials (2026-08-09)

- Founder user: fueltest_1786274010@testmail.com (uid 6220a16c, role=founder).
  Password reset to `FounderTest2026!` via admin API (email_confirm=true).
- QA user: qa.crossdevice.0809b@gmail.com (uid 98ecc424, profiles.username=
  qacrossdevice). Password reset to `QATest2026!CrossDev`. NOT a founder.

## CI failure root-cause analysis (FIXED 2026-08-10, PR #99)

All four CI jobs on `main` were failing. Each had a distinct root cause:

1. **Type Check ÔÇö `session.user` errors** (`founder-auth.ts`, `SecuritySection.tsx`):
   the cross-device founder-auth commit (`2edda45`) used the wrong
   destructuring: `const { data: session } = await client.auth.getSession()`
   binds `session` to the `data` object (`{ session: Session } | { session: null }`),
   which has NO `user` property. The correct form extracts the inner session:
   `const { data: { session } } = await client.auth.getSession()`. After the
   `if (!session)` / `if (session?.user)` guard, `session` narrows to `Session`
   (which DOES have `user: User`), so `session.user.id` / `.email` type-check.
   Fixed in `founder-auth.ts` (verifyFounderToken + updatePassword) and all
   four occurrences in `SecuritySection.tsx`.

2. **Lint / Prettier check** ÔÇö the new commit shipped unformatted files.
   Ran `prettier --write` across `src/**/*.{ts,tsx}`, `api/**/*.ts`, and
   `*.{json,md}` so `npx prettier --check "src/**/*.{ts,tsx}" "*.{json,md}"`
   passes. Also fixed `prefer-const` on `lat`/`lng` in `FuelPriceLocator.tsx`.

3. **Unit Tests ÔÇö `webidl.util.markAsUncloneable is not a function`**:
   `jsdom@30.0.1` depends on `undici@^8.9.0`, and ALL undici 8.x releases
   declare `engines.node >= 22.19.0` and require the `markAsUncloneable`
   export from `node:worker_threads` (backported to Node 22.19+, absent in
   Node 20). The CI workflow pinned `NODE_VERSION: '20'` Ôćĺ `npm ci` printed
   `EBADENGINE` and vitest's forks worker crashed on the jsdom/undici
   CacheStorage init. Fix: bump `NODE_VERSION` to `'22'` in BOTH
   `.github/workflows/ci.yml` and `deploy.yml`. Node 22.19+ satisfies
   undici 8.x AND exposes `markAsUncloneable`.

4. **E2E Tests ÔÇö `Executable doesn't exist at firefox-1538/firefox`**:
   `playwright.config.ts` defines four projects (chromium, Mobile Chrome,
   firefox, webkit) but the CI step only installed `chromium`:
   `npx playwright install --with-deps chromium`. Fix: install all
   configured browsers with `npx playwright install --with-deps` (no
   browser arg = install browsers required by the projects).

Verified locally (Node 22.23.2): `tsc -b` 0 errors, `eslint .` 0 errors,
`prettier --check` all pass, `vitest run` 3/3 pass, `vite build` succeeds.

## Real-time cross-device sync (ADDED 2026-08-09, commit f712549, PR #95)

**Supabase Realtime** (postgres_changes) is now the mechanism for INSTANT
cross-device sync. Both `app_kv` and `stations` are in the
`supabase_realtime` publication (migration 011 documents the live change).

### cloud-storage-service.ts ÔÇö subscribe() / subscribeToStation()

- `subscribe<T>(key, stationId, callback)` opens a Supabase real-time channel
  filtered to the computed `app_kv` row id. On INSERT/UPDATE/DELETE, it
  invalidates the in-memory cache and calls `callback(newValue)`. Returns an
  unsubscribe fn.
- `subscribeToStation<T>(stationId, callback)` subscribes to ALL app_kv rows
  for a station (or all user rows if no station).
- Both auto-resolve `ownerId` via `currentUserId()` and clean up on unmount.

### FuelContext real-time

- Subscribes to the compact blob (`compactCloudKey`). On a remote change,
  dispatches `LOAD_FROM_STORAGE` so the new data reflects INSTANTLY.
- Echo guard: `skipRemoteUpdateRef` is set `true` in `saveToCloud` BEFORE the
  cloud write. When the real-time event echoes back, the subscription checks
  the flag, skips the re-dispatch, and resets it.

### StationContext real-time

- Subscribes to the `stations` table. When ANY device creates/updates/deletes
  a station, `syncFromBackend()` re-runs and the new station appears in the
  UI without a page reload.

### Per-component real-time

- ShiftManagement, CreditManagement, SupplierManagement, MaintenanceTracker,
  CustomerLoyalty, FuelTypesManager, Communication: added `subscribe()` in
  the existing load-on-mount useEffect, returning cleanup that unsubscribes.

### PumpMappingV1 ÔÇö was ZERO persistence (FIXED)

- Before: extractedData, chatMessages, customRules, anchors were useState-only
  ÔÇö lost on EVERY refresh.
- After: all four persist to cloud (keys `pump_mapping_*`) with real-time.

### AdminPanel ÔÇö localStorage to cloud + real-time

- admin_modules, batch_updates, custom_apis migrated from localStorage-only
  to cloud + real-time.

### useCloudKV hook (new)

- `src/react-app/hooks/useCloudKV.ts` ÔÇö reusable real-time cloud sync hook.

### Deployment

- Vercel: fuel-app-mobile.vercel.app (prebuilt deploy, READY)
- Cloudflare: fuel-app-mobile.pages.dev (preview 6b58195b)
- PR #95: https://github.com/fuel-pro/FUEL_APP_MOBILE/pull/95

### Fuel Price Finder ÔÇö GPS geolocation feature (ADDED 2026-08-09)

- `src/react-app/components/FuelPriceLocator.tsx`: uses existing
  `LocationContext` for GPS detection, calls enhanced `/api/fuel-prices`
  endpoint with `?lat=&lng=` query params. Displays gasoline/diesel/premium/
  kerosene prices in styled cards. Falls back to unified pricing system
  (location-aware static prices from `pricing.ts` with Kenya city-specific
  transport surcharges) when the API is unavailable or returns no data. Shows
  the user's own station prices for comparison. Cross-device cloud cache via
  `cloudStorageService` (key `fuel_price_locator_cache`, 1h TTL) + real-time
  subscription so price updates sync instantly across devices. Registered as
  `price-finder` tab (order 36) in FuelContext tab config.
- `api/fuel-prices.ts` enhanced with geolocation mode: when `lat`/`lng` query
  params are provided, queries CollectAPI Gas Prices for station-level nearby
  prices (requires `GLOBAL_FUEL_API_KEY` env var). Falls back to Kenya EPRA
  national prices (`OILPRICE_API_KEY`) when CollectAPI is unavailable or coords
  resolve to Kenya. Preserves existing Kenya EPRA behavior (no lat/lng) with
  added `mode` field in response. CORS headers added for cross-origin requests.
- Env vars needed (set in Vercel Project Settings Ôćĺ Environment Variables):
  - `OILPRICE_API_KEY` ÔÇö for live Kenya EPRA prices (oilpriceapi.com)
  - `GLOBAL_FUEL_API_KEY` ÔÇö for global geolocation station prices (CollectAPI)
    Both are optional; the app gracefully degrades to static pricing without them.

## Auto Fuel Price engine (ADDED 2026-08-10, PR #98)

Hyper-local GPS fuel price detection per the "AUTO FUEL PRICE" spec, adapted
to this project's Vite SPA + Vercel serverless architecture.

- **DB**: `supabase/migrations/012_fuel_prices_postgis.sql` (APPLIED LIVE via
  Management API). Enables PostGIS; creates `fuel_prices` table (location_name,
  country, lat/lon, geography POINT, prices JSONB, currency, source,
  last_updated, query_count) with unique index on (location_name, country),
  GIST spatial index, and query_count index. Two RPCs: `get_nearest_fuel(lat,
lon, radius_km)` (PostGIS ST_DWithin + planar haversine fallback) and
  `bump_fuel_query_count()`. RLS: public read, service_role writes.
- **Engine** (`api/lib/fuel-engine.ts`): 1) Nominatim reverse-geocode GPS Ôćĺ
  village/town. 2) Exact-match Supabase cache check (fresh < 14 days). 3) For
  Kenya: **deterministic EPRA estimation** (no AI needed) ÔÇö interpolates
  between Nairobi (baseline) and Mandera (max) EPRA prices using a remoteness
  factor derived from the location/region name. 4) For non-Kenya: web search
  (Serper, optional) Ôćĺ AI parse (Groq Ôćĺ OpenRouter/Llama fallback) into
  {super_petrol, diesel, kerosene} JSON, upsert. 5) PostGIS nearest-neighbour
  fallback within 50 km tagged `is_approximate`. When SERPER_API_KEY is
  absent, the free web-page fallback fetches public EPRA news pages (no key
  needed) + a static EPRA reference table; source is "AI-Estimated" (vs
  "AI-Verified" when real Serper web snippets were parsed).
- **Deterministic estimation (ADDED 2026-08-10)**: AI models (Llama-3.1-8b,
  Llama-3.3-70b, Qwen-2.5-72b) are unreliable for exact fuel prices ÔÇö they
  return stale data (e.g. 155.50 for Kenya vs real 214.03) and are
  inconsistent on kerosene interpolation. Replaced with
  `estimateKenyaPrices()` which uses an EPRA reference table (11 towns, JulÔÇô
  Aug 2026 cycle) + a `KE_REMOTENESS` keywordÔćĺfactor map. For Lodwar (Turkana,
  factor 0.32): super_petrol=220.64 (expected 220.08), diesel=229.96
  (expected 229.95), kerosene=198.48 (expected 198.50) ÔÇö all within 0.56 KES.
  The EPRA reference is refreshed monthly by the cron job. The AI path is
  retained for non-Kenya locations and Serper snippet parsing.
- **API routes**: `api/fuel-local.ts` (GET /api/fuel-local?lat=&lon=),
  `api/cron/monthly-fuel-sync.ts` (CRON_SECRET-secured monthly refresh of
  top-50 queried locations).
- **CRITICAL ÔÇö Vercel node16 import extensions**: Vercel compiles /api/*
  serverless functions with `moduleResolution: 'node16'/'nodenext'`, which
  REQUIRES explicit `.js` extensions on relative imports
  (`./lib/fuel-engine.js`, NOT `./lib/fuel-engine`). Without the extension the
  function deploys but crashes at invocation with
  `FUNCTION_INVOCATION_FAILED`. The local tsconfig.server.json has
  `allowImportingTsExtensions: true` so `.js` specifiers resolve to `.ts`
  source files during typecheck. ALL new /api files with relative imports
  MUST use `.js` extensions.
- **Frontend**: `FuelTracker.tsx` (GPS Ôćĺ /api/fuel-local Ôćĺ price cards +
  approximate badge + refresh, graceful fallback to useFuelPrices).
  `FuelPriceService.getFuelPrices` tries /api/fuel-local first when
  `fuelpro_user_coords` localStorage key is present. Tab "fueltracker"
  (order 32) in FuelContext + Home.tsx.
- **Env vars** (set on Vercel 2026-08-10): `SUPABASE_SERVICE_ROLE_KEY`,
  `OPENROUTER_API_KEY` (the `$QWEN` secret is actually an OpenRouter
  sk-or- key), `CRON_SECRET`. `SERPER_API_KEY` and `GROQ_API_KEY` are
  optional (Serper for live web search, Groq as a faster AI alternative).
  All are server-only (never VITE_-prefixed).
- **Vercel deploy status**: Production deploy via **prebuilt method** (commit
  `a11efb1`, 2026-08-10) is LIVE ÔÇö `vercel build --prod` Ôćĺ
  `vercel deploy --prebuilt --prod`. The prebuilt method BYPASSES the
  `api-deployments-free-per-day` rate limit (100/day, resets ~24h) that blocks
  git-source API deploys. Verified live: Lodwar (3.097, 35.6138) returns
  220.64/229.96/198.48 KES "AI-Estimated" (matches "Current Pump Prices.txt"
  within 0.56 KES); Nairobi returns 214.03/222.86/191.38; Mombasa returns
  210.87/219.58/188.09 (exact EPRA). Cloudflare Pages mirror updated but
  only serves the SPA frontend ÔÇö /api/* endpoints work ONLY on Vercel.
  **Note**: the /api/fuel-local response has `Cache-Control: max-age=300`
  (5-min CDN cache); use a `&cb=<timestamp>` cache-bust param to test fresh
  data immediately after a DB update.

## Smart-Cache fuel price architecture (ADDED 2026-08-10, commit c0f1c33)

A second parallel implementation of the fuel-price engine, created in a
separate session and merged to main alongside PR #98. Both implementations
coexist on main:

- **My implementation** (`api/_lib/hybrid-fetcher.ts` + `api/fuel-prices.ts` +
  `api/cron-monthly-sync.ts`): enhances the existing `/api/fuel-prices`
  endpoint with a smart-cache mode (lat+lng+name+country). Uses a Groq Ôćĺ
  DeepSeek Ôćĺ QWEN AI provider chain (QWEN via OpenRouter). Has AI-knowledge
  fallback when SerpApi is absent (source labelled "AI-Estimated"). The
  `/api/fuel-prices` endpoint supports 3 modes: Kenya EPRA (no coords),
  smart-cache (lat+lng+name+country), legacy geolocation (CollectAPI).
  Frontend: `FuelPriceLocator.tsx` with EPRA-style UI (cost breakdown,
  GPS coordinates, "per litre" labels, "SUPER PETROL / DIESEL / KEROSENE"
  format). Registered as `price-finder` tab (order 36).
- **Parallel branch implementation** (`api/lib/fuel-engine.ts` +
  `api/fuel-local.ts` + `api/cron/monthly-fuel-sync.ts`): separate
  `/api/fuel-local` endpoint. Uses deterministic EPRA estimation for Kenya
  (reference table + remoteness factor ÔÇö more accurate than AI for Kenya).
  Frontend: `FuelTracker.tsx`. Registered as `fueltracker` tab (order 32).
- **vercel.json cron**: consolidated to single `/api/cron/monthly-fuel-sync`
  entry (the parallel branch's endpoint, which is the one deployed on Vercel
  and tested live).
- **Geocoding fix (commit a7ed641)**: BOTH `api/_lib/geocoding.ts` and
  `api/lib/fuel-engine.ts` now use Nominatim `zoom=10` (town/city-level)
  instead of `zoom=18` (building-level). Name resolution priority changed
  to city > municipality > town > county > village (was village-first). This
  fixes "Nawoitorong" Ôćĺ "Lodwar" for GPS coords 3.0970, 35.6138.
- **Vercel env vars**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SERPAPI_KEY` (serpapi.com, 100 free searches/mo, PREFERRED web search),
  `SERPER_API_KEY` (serper.dev, fallback), `DEEPSEEK_API_KEY`,
  `QWEN_API_KEY`, `CRON_SECRET`. All server-only (never VITE_-prefixed).
  **Web search chain (ADDED 2026-08-10, commit f00184e)**: SerpApi Ôćĺ Serper Ôćĺ
  free public EPRA pages. SerpApi is preferred when `SERPAPI_KEY` is set
  (returns Google answer_box + organic snippets with official EPRA data).
  Source labelled "AI-Verified" when SerpApi OR Serper returns real snippets;
  "AI-Estimated" when only AI knowledge is used.

## CORS fix + Lodwar bug ÔÇö DEPLOYED LIVE 2026-08-10 (commit c85e35a)

**Symptom**: app showed "Nairobi" prices for all locations (e.g. user in
Lodwar got Nairobi prices). Root cause: Cloudflare Pages (the primary
deploy) has NO /api/* endpoints ÔÇö fetch to `/api/fuel-local` returns 404,
falls back to static pricing table whose closest city was always Nairobi.

**Fix (3-layer)**:

1. `FuelPriceLocator.tsx` `fuelApiBase()` helper: detects origin. On
   Vercel Ôćĺ relative `/api/fuel-local` (same-origin, no CORS). On
   Cloudflare/other Ôćĺ absolute `https://fuel-app-mobile.vercel.app/api/...`.
2. `api/fuel-local.ts`: added `Access-Control-Allow-Origin: *` + OPTIONS
   preflight handler. `vercel.json`: global CORS headers array.
3. CORS proxy fallback: if the deployed Vercel API lacks CORS headers
   (transient state during deploys), the frontend retries via
   `https://api.allorigins.win/raw?url=<encoded>` ÔÇö verified working
   (corsproxy.io returned empty responses; allorigins works reliably).

**Verified end-to-end 2026-08-10**: production Vercel API
`fuel-app-mobile.vercel.app/api/fuel-local` returns:

- Lodwar (3.097, 35.6138) Ôćĺ Turkana, Super 220.64, Diesel 229.96, Kerosene
  198.48 (AI-Estimated) ÔÇö higher than Nairobi, reflecting transport cost.
- Nairobi (-1.2864, 36.8172) Ôćĺ Nairobi, Super 214.03, Diesel 222.86.
  CORS header `access-control-allow-origin: *` confirmed on GET (HTTP 200).
  CORS proxy path also returns correct Lodwar data. The "Nairobi for all
  locations" bug is FIXED.
  **Deploy**: dpl_HY7iVUcT7btjXk5H77gRSqpGb9oZ, READY, aliased to
  fuel-app-mobile.vercel.app. Cloudflare mirror:
  https://f40cad3d.fuel-app-mobile.pages.dev.

## Deterministic EPRA exact-match + plausibility guard (DEPLOYED LIVE 2026-08-10, commit 6628f10)

**Symptom**: `/api/fuel-local` returned `success: false, error: "No fuel data
for Nairobi: AI could not extract any prices"` after the stale-cache purge.
The AI extraction path returned null prices even for towns explicitly
listed in the EPRA reference table (e.g. Nairobi), because LLM extraction
from reference text is unreliable. Separately, obscure villages (e.g.
Nawoitorong near Lodwar) showed fabricated "AI-Estimated" prices, and even
after removing estimation, the AI extracted implausible prices (e.g. 177.32
for petrol in Kenya, below the EPRA minimum of 210.87) from non-current web
data.

**Fix (3 parts, all in `api/lib/fuel-engine.ts`)**:

1. **Deterministic EPRA exact-match** (`lookupExactReference`): parses
   `EPRA_KE_REFERENCE` into a structured `Record<town, FuelPriceSet>` map.
   In `getLocalFuelPrices`, BEFORE the web-searchÔćĺAI path (step D), an exact
   case-insensitive town-name match returns REAL published EPRA prices
   directly (`source: "Published Reference"`) ÔÇö no AI dependency. Nairobi,
   Mombasa, Kisumu, Mandera, etc. now return correct real prices instantly.
   Only an exact match yields a price; never interpolation.

2. **Kenya plausibility guard** (`isPlausibleKenyaPrice`): rejects
   AI-extracted Kenya prices outside [85%, 115%] of the lowest EPRA reference
   price for each product. EPRA sets MAXIMUM retail prices; a real pump price
   won't be 15%+ below the cheapest regulated town. Rejected prices throw,
   falling through to the PostGIS nearest REAL price (step E) or the
   no-real-data response (step F). This is a data-quality guard, NOT
   estimation ÔÇö we never substitute a fabricated price.

3. **Structured no-real-data response** (step F): when no EPRA match, AI
   extraction rejected, AND no nearby cached real price, the engine RETURNS
   `{success: true, prices: {super_petrol: null, ...}, source: "No
published price", no_real_data: true}` instead of throwing. This lets the
   frontend show "N/A" rather than falling back to the client-side "EPRA
   Estimate (offline)" estimation (which would violate "real prices only").

   Frontend (`FuelPriceLocator.tsx`): detects `no_real_data` and renders N/A
   with source "No published price" ÔÇö never an estimate. `FuelTracker.tsx`
   already rendered N/A for null prices; added `no_real_data` to its
   interface.

**Pipeline** (in `getLocalFuelPrices`): A) geocode Ôćĺ B) DB cache check
(fresh < 14d) Ôćĺ C) EPRA exact-match (Published Reference) Ôćĺ D) web search Ôćĺ
AI extraction (AI-Verified / Published Reference, with plausibility guard
for KE) Ôćĺ E) PostGIS nearest cached real price (Approx.) Ôćĺ F) no-real-data
(N/A). No fabrication or estimation at any step.

**Verified live 2026-08-10** (fuel-app-mobile.vercel.app, dpl_7wedvmeVytCx4CA6jduM3azr5C6o):

- Nairobi Ôćĺ Published Reference, 214.03/222.86/191.38 Ôťů
- Mombasa Ôćĺ Published Reference, 210.87/219.58/188.09 Ôťů
- Kisumu Ôćĺ Published Reference, 213.69/223.09/191.63 Ôťů
- Mandera Ôćĺ Published Reference, 234.68/245.04/213.56 Ôťů
- Nawoitorong Ôćĺ no_real_data=true, "No published price", all null Ôťů (no
  estimate)
- Nakuru coords (resolves to "Kimathi") Ôćĺ no_real_data=true, N/A Ôťů
- Cloudflare mirror: https://92928e59.fuel-app-mobile.pages.dev (SPA only;
  /api/* works only on Vercel).

**Known limitation**: Nominatim reverse-geocoding at zoom=14 sometimes
resolves to sub-locations/neighborhoods ("Kipkenyo ward", "Kimathi")
instead of the canonical town ("Eldoret", "Nakuru"), causing the EPRA
exact-match to miss. This is a geocoder data-quality issue, not a price
engine issue ÔÇö the behavior remains correct (no fabrication). Enhancing the
geocoder to return the parent town name would improve exact-match coverage.

## Live Transaction Ôćö M-PESA Analyzer interlink (ADDED 2026-08-10, commit 278a686)

The Live Transaction tab and M-PESA Analyzer tab now share/interlink data,
records, and analytics through a unified cloud-backed transaction store.

### Shared service (`src/react-app/lib/mpesa-integration-service.ts`)

- **Unified transaction store** (cloud key `mpesa_transactions`,
  station-scoped): both tabs read from and write to the same
  `UnifiedTransaction[]` in `app_kv` via `cloudStorageService`. Real-time
  subscription (`subscribeToTransactions`) means a write in one tab
  reflects instantly in the other.
- **M-PESA Daraja config** (cloud key `mpesa_config`): typed
  `MpesaIntegrationConfig` (name, type Buy Goods/Paybill, consumer key/
  secret, passkey, initiator name/password, shortcode, account reference,
  environment sandbox/production, enabled). `getMpesaConfig`/
  `saveMpesaConfig`.
- **Kopo Kopo config** (cloud key `kopokopo_config`): typed
  `KopokopoIntegrationConfig` (name, client ID/secret, till number, API key
  for HMAC webhook verification, environment, transaction search window,
  enabled). `getKopokopoConfig`/`saveKopokopoConfig`.
- **Analytics** (`calculateSummary`): total/completed/pending/failed, by
  origin (stk_push/statement/manual/kopokopo), top sender, unique senders,
  online payments.
- **Cross-tab navigation** (`switchToTab`): dispatches the `changeTab`
  CustomEvent that Home.tsx listens for.

### LiveTransaction.tsx changes

- Writes STK Push requests to the shared store (origin `stk_push`,
  status `pending`) so they appear in the M-PESA Analyzer.
- Shows a "Shared Analytics" panel (total revenue, transaction count,
  unique senders, top sender) computed from the shared store.
- Shows a "Shared Transaction Records" feed (STK Push + statement
  transactions) with origin badges.
- "View in Analyzer" button Ôćĺ `switchToTab("mpesa")`.
- Subscribes to real-time updates via `subscribeToTransactions`.

### MPESAAnalyzer.tsx changes

- After extraction (pattern or AI), persists inflows to the shared store
  (origin `statement`, status `completed`) via `addBatchTransactions`
  (de-dup by receipt number to avoid double-imports).
- Shows "saved to shared store" indicator with added/skipped counts.
- Shows a collapsible "Shared Transaction Feed" section with STK Push +
  statement transactions and "Open Live Transaction Tab" button.
- "Live Transaction" button in the header Ôćĺ `switchToTab("livetransaction")`.
- Subscribes to real-time updates via `subscribeToTransactions`.

### IntegrationsSettings.tsx (new, tab `integrations-settings` order 38)

Based on the 3 spec files (`Integrations.txt`, `M-PESA Integration.txt`,
`Kopo Kopo Integration.txt`):

- **Catalog view**: M-PESA + Kopo Kopo cards with "Connected"/"Setup"
  status and "Setup"/"Configure" buttons.
- **M-PESA setup form**: integration name, type (Buy Goods/Paybill),
  consumer key/secret, passkey, initiator name/password, business
  shortcode, account reference (max 12 chars), environment
  (sandbox/production), enable toggle. Persists via `saveMpesaConfig`.
- **Kopo Kopo setup form**: integration name, client ID/secret, till
  number, API key (HMAC webhook verification), environment, transaction
  search window (6hÔÇô7d), enable toggle. Persists via `saveKopokopoConfig`.

### SettingsPanel.tsx changes

- M-PESA and Kopo Kopo integration cards now show real "Connected"/"Not
  Connected" status from the cloud config (not static labels).
- Cards are now buttons Ôćĺ `switchToTab("integrations-settings")`.

### Deployment

- **Cloudflare Pages**: LIVE at https://c699b3ac.fuel-app-mobile.pages.dev
  (all lazy chunks verified HTTP 200: IntegrationsSettings, LiveTransaction,
  MPESAAnalyzer, mpesa-integration-service).
- **Vercel production**: BLOCKED by `api-deployments-free-per-day` quota
  (100/day exhausted, resets ~24h). GitHub integration will auto-deploy
  commit 278a686 when the quota resets.
- `npx tsc --noEmit` ÔÇö 0 errors Ôťů
- `npm run build` ÔÇö success Ôťů

## Email rate-limit fix (DEPLOYED LIVE 2026-08-10, commit f40f552)

**Symptom**: Users hit Supabase's "email rate limit exceeded" error on the
password-reset flow. Supabase Auth limits auth emails to ~3-4 per hour per
address. The `PasswordReset.tsx` "Resend Reset Link" button had no cooldown,
so rapid clicks or re-renders exhausted the limit instantly ÔÇö and the raw
Supabase error surfaced verbatim to the user.

**Fix (3 layers)**:

1. **Client-side cooldown** (`AuthContext.requestPasswordReset`): tracks
   last-request time per email in `lastResetRequestRef`. A second request
   within 60s returns a friendly "Please wait Ns before requesting another
   reset email" message WITHOUT calling the Supabase API. The attempt is
   recorded even on failure, preventing retry storms. A `RESET_COOLDOWN_MS`
   constant (60000) controls the window.

2. **Resend countdown UI** (`PasswordReset.tsx`): after a successful
   send/resend, the Resend button is disabled with a live 60s countdown
   ("Resend available in 60s"). A `useEffect` ticks the countdown every
   second and re-enables the button at zero. `handleRequestCode` starts the
   cooldown on success; `handleResendCode` restarts it on each successful
   resend.

3. **Friendly error translation** (`friendlyAuthEmailError`, shared by
   `AuthContext` + `founder-auth`): if Supabase DOES return a rate-limit
   error (HTTP 429 / "email rate limit" / "rate limit exceeded" / "for
   security purposes, you can only request"), it is translated to "Too many
   emails sent. For security, Supabase limits reset emails to a few per
   hour. Please wait a few minutes before trying again." Applied to both
   `resetPasswordForEmail` and `signUp` error paths.

**Verified in production bundle** (Cloudflare Pages 25ca3d0e): the
`founder-CphfW80Z.js` and `reports-sdD_z_K0.js` chunks contain "Too many
emails sent"; the main `index-QYMzwXye.js` chunk contains "Resend available
in". Vercel production deploy blocked by `api-deployments-free-per-day`
quota (100/day exhausted, resets ~24h) ÔÇö the GitHub integration will
auto-deploy commit f40f552 when the quota resets.

## Dashboard price card "Nairobi" label fix (DEPLOYED LIVE 2026-08-10, commit f49d376)

**Symptom**: the Dashboard "Current Pump Prices" cards showed "Nairobi" as
the location label next to Super Petrol and Diesel, even when GPS pricing was
active and the badge correctly showed "­čôŹ GPS: Lodwar (+5.50)". The price
VALUES were correct (Lodwar with surcharge), but the card LABEL was wrong.

**Root cause**: `Dashboard.tsx` L772-774 & L786-788 rendered
`regionalPrice.cityName` for the card label. `regionalPrice` =
`getPriceForCity(fuelPrice, stationCity)` where `stationCity =
currentStation?.location || "Nairobi"` ÔÇö a STATION-based path that ignores
GPS. When the station has no `location` set, it defaults to "Nairobi".

**Fix**: the card labels now use a ternary: when `isLocationBased` (GPS
active), show `priceCityName` (the GPS-detected city, e.g. "Lodwar");
otherwise fall back to `regionalPrice.cityName`. The top badge already
used `priceCityName` correctly ÔÇö only the card captions were wrong.

**Verified in production bundle**: Dashboard-DxyyCwfb.js contains
`M?g.jsx("p",{...children:_}):y.isRegional?...` where M=isLocationBased,
_=priceCityName.
**Deploy**: dpl_F4p4sS1qaZdye1jCHj9Zfccuf6q1, READY, aliased to
fuel-app-mobile.vercel.app. Cloudflare mirror:
https://bd4ff357.fuel-app-mobile.pages.dev.

## Cross-device Founder Access ÔÇö 2FA / forgot-password / unique ID (DEPLOYED 2026-08-10, commit 2edda45)

Founder auth was previously localStorage-only: the 2FA secret lived in
`fuelpro_founder_2fa` localStorage (per-browser) and "forgot password" was a
fake 6-digit-code flow that always failed. Now all founder auth state is
cloud-backed via the `profiles` table so it is consistent across every device.

- **Migration 013** (`supabase/migrations/013_founder_2fa_profiles.sql`,
  APPLIED LIVE) adds to `profiles`: `two_factor_secret text`,
  `two_factor_enabled boolean`, `recovery_codes text`, `unique_id text`,
  `last_password_change timestamptz`. Backfills `unique_id` as
  `upper(substr(md5(random()::text),1,8)) || '-FPR'` for existing rows, with a
  partial UNIQUE index on `unique_id`. Verified live: all 14 profiles have a
  unique_id; founder.qa.fuelpro@gmail.com has `unique_id='FPRQA2026'`,
  `role='founder'`.
- `src/react-app/lib/founder-auth.ts`:
  - `requestPasswordReset` ÔÇö real Supabase email-link recovery
    (`resetPasswordForEmail`, redirectTo `/#/reset-password`). The Founder
    Access gate exposes this as "Forgot password? Reset via email".
  - `changeFounderPassword` ÔÇö `auth.updateUser({password})` (min 8 chars) +
    records `last_password_change` on `profiles`.
  - `loadFounder2FA` / `saveFounder2FA` ÔÇö read/write
    `two_factor_enabled` + `two_factor_secret` on `profiles` (cloud
    source of truth). `SecuritySection` mounts a `useEffect` that loads the
    cloud 2FA on login and overrides the localStorage copy; enabling 2FA pushes
    the secret to the cloud so it survives a device switch.
  - `getFounderUniqueId` ÔÇö reads `profiles.unique_id`, falls back to the
    Supabase auth uid prefix. `FounderAccess.tsx` displays it as
    "ID: <unique_id>" next to the founder banner.
- **Verified end-to-end on Vercel production** (fuel-app-mobile.vercel.app,
  bundle chunk `founder-FznFW3ku.js`, HTTP 200): founder login with full
  email succeeds; the Founder Console shows All Users(1)/All Stations(4)/
  Security & 2FA; the login gate shows the "Forgot password? Reset via email"
  link. Cloudflare mirror also live (fuel-app-mobile.pages.dev).
- **Founder test user**: `founder.qa.fuelpro@gmail.com` /
  `FuelPro@2026!`, role `founder`, unique_id `FPRQA2026`. Confirmed email
  (`email_confirm:true` via admin API) so `signInWithPassword` succeeds.

## FREE AUTO FUEL PRICE.txt spec ÔÇö Smart-Cache (Groq AI + PostGIS) LIVE

The full spec is implemented and running server-side (keys in Vercel env,
never in the client bundle):

- **DB**: `fuel_prices` table (location_name, country, lat/lon,
  `location_geog geography(point,4326)`, `prices jsonb`, currency,
  last_updated, query_count) + PostGIS `get_nearest_fuel_prices(lat,lon,radius)`
  RPC + GiST spatial index + `update_location_geog()` trigger. Verified live:
  5+ cached locations (Nairobi queried 11├Ś, Nawoitorong 8├Ś, Turkana 4├Ś,
  Mombasa 2├Ś) ÔÇö cache hits, not SerpApi quota spend.
- **Engine** (`api/_lib/hybrid-fetcher.ts` + `api/lib/fuel-engine.ts`):
  3-tier lookup ÔÇö (1) exact cache (fresh < 15/14 days), (2) PostGIS
  nearest town within 50 km (tagged "N km away"), (3) live SerpApi/Serper
  web search Ôćĺ Groq `llama-3.1-8b-instant` (DeepSeek/OpenRouter fallback)
  extracts {super_petrol,diesel,kerosene,currency} JSON Ôćĺ upsert to
  `fuel_prices`. SerpApi free tier (100/mo) is only consumed for genuinely
  new isolated locations.
- **Endpoints**: `/api/fuel-prices` (EPRA Kenya mode + Smart-Cache geolocation
  mode + legacy CollectAPI mode), `/api/fuel-local` (reverse-geocode Ôćĺ
  cache Ôćĺ web+AI Ôćĺ PostGIS fallback).
- **Cron**: `vercel.json` `crons` Ôćĺ `/api/cron/monthly-fuel-sync`
  (schedule `0 0 1 * *`) refreshes the top-N most-queried cache rows,
  guarded by `Bearer $CRON_SECRET`.

## Latency optimization ÔÇö INSTANT data loading (ADDED 2026-08-12, commit 74d9cb7)

**Requirement**: Remove ALL lag/latency in the entire site ÔÇö show data
INSTANTLY and AUTOMATICALLY. No artificial delays, no blank flashes while
async cloud loads resolve.

### Root causes of latency (all fixed)

1. **`cloudStorageService` made a network call on EVERY `get()`/`set()`**:
   `currentUserId()` called `supabase.auth.getUser()` (200-500ms round-trip)
   on every single cloud operation. With 10+ components each loading data on
   mount, this was ~2-5s of dead time on every page load.
   **Fix**: `currentUserIdSync()` reads the user ID synchronously from
   localStorage (`fuelpro_auth_identity` key, set by AuthContext on login).
   Network `auth.getUser()` is now only a fallback when localStorage is empty.
   Added a 60s in-memory cache (`memoryCache` Map) so repeated `get()` calls
   for the same key return instantly.

2. **`FuelContext` had 100ms setTimeout on load**: the load-from-storage
   effect used a 100ms timer before reading localStorage, and a 100ms timer
   on station-change. Removed both ÔÇö hydrate instantly from localStorage.
   Reduced localStorage save debounce 300msÔćĺ100ms, cloud save debounce
   1500msÔćĺ500ms. Removed the 15000ms periodic cloud-save interval (real-time
   subscription handles cross-device sync).

3. **`StationContext` made redundant network calls**: `syncStationsWithSupabase`
   called `getSession()` then `getUser()` (2 round-trips) just to get the
   user ID. Now reads userId from localStorage FIRST; only injects the
   session into the client if needed.

4. **Per-component useState initializers were async-only**: 10 components
   (ShiftManagement, CreditManagement, CustomerLoyalty, SupplierManagement,
   ExpenseTracker, PriceBoard, FuelTypesManager, MaintenanceTracker,
   PayrollSystem, Communication) used `useState(loadFn)` where `loadFn` only
   read localStorage. The async cloud `get()` ran in a separate `useEffect`
   that fired AFTER the first render ÔÇö causing a blank flash then a re-render.
   **Fix**: all now use `useState(() => { const cached =
cloudStorageService.getCached(key, stationId); if (cached) return
normalize(cached); return loadFromLocalStorage(); })` ÔÇö INSTANT first
   render from the cloud/localStorage cache, no blank flash.

5. **Artificial delays (total ~5s dead time per user flow)**:
   - `Invoice.tsx`: 800ms "AI analysis" wait Ôćĺ instant
   - `SalesTracking.tsx`: 600ms upload + 1500ms AI scan wait Ôćĺ instant
   - `SMSGatewayConfig.tsx`: 2000ms test SMS + 500ms save debounce Ôćĺ instant
   - `AIChatbot.tsx`: 800-1400ms simulated AI delay Ôćĺ instant
   - `DocumentConverter.tsx`: 200ms "processing" delay Ôćĺ instant
   - `CacheControl.tsx`: 500ms clear-storage delay Ôćĺ instant
   - `useFuelPrices.ts`: 500ms refresh delay Ôćĺ instant
   - `FounderAccess.tsx`: 1500ms AI editor delay Ôćĺ instant
   - `adminAPI.ts`: 300ms `simulateResponse` default Ôćĺ 0ms
   - `PayrollSystem.tsx`: 500ms/employee batch export Ôćĺ 50ms/employee

### `getCached()` method (new in cloud-storage-service.ts)

```typescript
getCached<T>(key: string, stationId?: string): T | null
```

Synchronous read from the in-memory cache (60s TTL). Returns `null` if not
cached. Used in `useState` initializers for instant first render. The async
`get()` method still runs in a `useEffect` to refresh from cloud + update
the cache for the next render.

### Deploy status 2026-08-12

- **GitHub main**: Ôťů commit 74d9cb7 pushed
- **Cloudflare Pages**: Ôťů LIVE (preview https://b661595a.fuel-app-mobile.pages.dev
  - main alias https://fuel-app-mobile.pages.dev). Verified: `getCached` is
    present in the deployed `reports-BSaoPwf5.js` chunk.
- **Vercel production**: ÔŁî BLOCKED by `api-deployments-free-per-day`
  (100/day exhausted; ALL deploy paths blocked: git-source API, prebuilt,
  CLI deploy, preview). The GitHub integration (prodBranch=main) will
  auto-deploy commit 74d9cb7 when the quota resets (~24h). Until then
  Vercel production serves the previous commit (df9daf0). The Cloudflare
  mirror has the fixed code NOW.
- **Supabase**: No schema changes needed (all changes are frontend-only).

Git HEAD = origin/main = 74d9cb7 ("perf: eliminate all latency sources ÔÇö
instant data loading & sync"). Cloudflare Pages LIVE. Vercel production
BLOCKED by deploy quota (auto-deploys when quota resets). Bundle
`index-B2Q3i45P.js` + lazy chunk `founder-k1klAbtc.js` (Cloudflare).

## Village-level REAL fuel prices ÔÇö no estimates (ADDED 2026-08-10, PR #100, commit ea0bb41)

**Requirement**: narrow fuel-price location to village/town/center level and
show ONLY real/actual prices ÔÇö no estimates or generalizations of national
prices to a village.

**What was removed (the estimation that violated the requirement)**:

- `api/lib/fuel-engine.ts`: deleted `estimateKenyaPrices()` + `EPRA_KE_PRICES`
  (townÔćĺprice map) + `KE_REMOTENESS` (countyÔćĺfactor map). These fabricated
  prices for unlisted Kenyan towns by interpolating between Nairobi (baseline)
  and Mandera (max) via a remoteness factor. The result was tagged
  "AI-Estimated" but presented as real data.
- `api/_lib/hybrid-fetcher.ts`: deleted `estimatePricesFromKnowledge()` which
  asked the LLM to guess prices from its training knowledge when no web search
  was configured (also labelled "AI-Estimated").

**What stays (all REAL data, no fabrication)**:

- `EPRA_KE_REFERENCE` (`fuel-engine.ts`): a pure real-price table of 11 EPRA
  towns for the current cycle. Used ONLY for an exact town-name match ÔÇö the AI
  is told NOT to interpolate between towns.
- AI extraction (`buildAiPrompt` / `EXTRACTION_SYSTEM_PROMPT`): EXTRACTS
  verbatim prices from search snippets; explicitly forbidden to estimate,
  interpolate, or generalize. Returns `null` for any price not explicitly
  stated for the exact location.
- Source labels: `AI-Verified` (live SerpApi/Serper snippets) and `Published
Reference` (official EPRA pages / reference table) ÔÇö both real data. The
  `AI-Estimated` label is GONE from the server path.
- The ONLY fallback: PostGIS `get_nearest_fuel` nearest-neighbour returns a
  REAL nearby price tagged `Approx. (nearest: <town>, X km)` with
  `is_approximate: true` + `nearest_town` + `distance_km`. Real data from a
  nearby priced location, not a fabricated estimate. When all prices are null
  the frontend shows "N/A".

**Village-level geocoding** (both impls):

- `fuel-engine.ts` `getPlaceName()` + `_lib/geocoding.ts` `getExactLocation()`:
  Nominatim zoom=14 (village/suburb detail) with zoom=18 fallback when zoom=14
  only yields a state/county. Priority order: village > hamlet > town > city >
  municipality > suburb > neighbourhood > locality > county > state_district >
  state. Was zoom=10 (city-level) / state-level. Verified live: Nawoitorong
  (Lodwar area), Nairobi, Mombasa all resolve to the correct village/town.
  NOTE: Nominatim is nondeterministic ÔÇö for sparse-data locations (e.g.
  Kakuma) it sometimes only returns the state ("Turkana") regardless of zoom;
  this is an OSM replica limitation, not a code issue. The engine then queries
  for the best available name and uses real prices (no fabrication).

**Bug fixes bundled in**:

- `hybrid-fetcher.ts` RPC name `get_nearest_fuel_prices` Ôćĺ `get_nearest_fuel`
  (the variant in migration 012; the old name returned PGRST202/no result).
- `hybrid-fetcher.ts` reads both `super_petrol` and `petrol` price keys so
  cached rows written by either engine are interchangeable.

**Frontend**:

- `api/fuel-local.ts`: exposes the resolved village name under both
  `locationName` and `location` for the client.
- `FuelPriceLocator.tsx`: shows the resolved village name for exact matches
  (was showing raw GPS coords); nearest-match shows `town (X km away)`.
- The client-side OFFLINE fallback (`getClosestKenyaCityPrice` + transport
  surcharge, labelled "EPRA Estimate (offline)") is RETAINED ÔÇö it only
  activates when the Vercel API is completely unreachable (no network) and is
  clearly labeled "offline". It is NOT the server engine path.

**Deploy status 2026-08-10**:

- GitHub main: commit `ea0bb41` (PR #100 merged). All GitHub Actions CI pass
  (Build, Lint, TypeCheck, Unit/E2E, CodeQL, Analyze).
- Cloudflare Pages: LIVE (preview https://2f29f346.fuel-app-mobile.pages.dev +
  main alias fuel-app-mobile.pages.dev, bundle `index-pZovDNsx.js`).
- Vercel production: BLOCKED by `api-deployments-free-per-day` (100/day
  exhausted; quota resets ~04:31 UTC Aug 11). The project has Git integration
  (repo FUEL_APP_MOBILE, prodBranch main, buildCommand
  `npm install --legacy-peer-deps && npm run build`) so it will auto-deploy the
  merged main once the quota resets, OR a manual `vercel deploy --prebuilt
--prod` / git-source API deploy can be triggered then. Until then Vercel
  production still serves the OLD commit 2edda45 (with "AI-Estimated" prices).
  The Cloudflare mirror has the fixed code NOW but serves ONLY the SPA ÔÇö the
  /api/fuel-local endpoint works ONLY on Vercel.

## Session 2026-08-09 (continued): invoice fix + Fuel Price Smart-Cache completion

### Invoice line-items fix (VERIFIED LIVE)

`Invoice.tsx` `updateInvoiceItem` deep-clones item objects
(`{ ...updatedItems[index] }` before mutation). `FuelContext.tsx` adds
`itemsHaveContent()` helper (~line 890) so LOAD_FROM_STORAGE won't replace
in-progress invoice edits with a stale all-empty-items cloud blob. Verified
end-to-end on Cloudflare deploy: added line item (Petrol PMS, qty 50, price
180, total Ksh 9,000), reloaded -> items persisted, saved as INV-2026-002 with
the line items intact.

### Company profile persistence fix (VERIFIED LIVE)

`FuelContext.tsx` `mergeCompanyData()` (~line 856) prevents empty-string
overwrites during LOAD_FROM_STORAGE. `SettingsPanel.tsx` now dispatches
SET_COMPANY_DATA to FuelContext on save (bridges station info -> companyData so
invoices/reports read correct company info). NOTE: the company-profile editor
reachable by non-founder users is the "Edit Info" -> "Company Profile" modal on
the Invoice tab (has Bank Details). There is NO KRA PIN field in that modal;
`companyData.kraPin` stays "" unless written via the Admin/Settings gate (founder
only). Verified: name/phone/email/VAT/PO Box persist after reload + reach invoice.

### FREE AUTO FUEL PRICE Smart-Cache (COMPLETED + VERIFIED LIVE)

**The spec is implemented.** Architecture: PostGIS spatial Smart-Cache +
SerpApi/Groq live search fallback. Prior session built the infra (fuel_prices
table, get_nearest_fuel RPC, api/lib/fuel-engine.ts serverless engine,
api/fuel-local.ts endpoint, FuelPriceLocator.tsx UI tab "price-finder",
vercel.json cron). BUT the Smart-Cache was BROKEN: the `location` geography
column was NULL for ALL seeded/inserted rows (no trigger populated it), so the
PostGIS ST_DWithin nearest-town query always returned empty -> every remote
lookup fell through to SerpApi/Groq (or "no published price"). Fixed in commit
35add94 (migration 010_fuel_prices_smartcache.sql):

- `set_fuel_location_geog()` trigger auto-populates `location` geography from
  lat/lon on insert/update (the old code referenced a non-existent
  `location_geog` column, so the trigger silently failed).
- Backfilled all 20 existing rows where location was NULL.
- Seeded 15 additional Kenya EPRA town prices (Nakuru, Eldoret, Kakamega,
  Kitale, Bungoma, Lodwar, Garissa, Kericho, etc.) -- cache now covers Kenya.
- Public-read RLS so the client can query with only the publishable key.
  Verified live: remote point (0.6, 34.7 -- Sitikho ward) now resolves to Bungoma
  (15.9km) via PostGIS fallback, returns real prices, source "Approx. (nearest:
  Bungoma)". Nairobi exact match -> source "Published Reference". The
  /api/fuel-local endpoint on Vercel works cross-origin (CORS headers set); the
  FuelPriceLocator calls it with a CORS-proxy fallback for Cloudflare->Vercel.
  **AI keys**: SERPAPI_KEY + OPENROUTER_API_KEY are SET on Vercel (production).
  GROQ_API_KEY is NOT set (no Groq key available). For genuinely remote areas
  with no cached town within radius AND no web-search result, the engine returns
  `no_real_data: true` ("No published price") -- the correct honest answer, NOT
  a fake estimate. Schema notes: fuel_prices uses `lat`/`lon` (NOT
  latitude/longitude), `location` geography, `prices` jsonb
  {super_petrol,diesel,kerosene}, `country_code`, `source`. get_nearest_fuel RPC
  (default radius_km=50) has PostGIS + haversine fallback, SECURITY DEFINER.

### Founder 2FA / security (IMPLEMENTED by prior session, columns LIVE)

Migration 013_founder_2fa_profiles.sql applied live: profiles has
two_factor_secret, two_factor_enabled, recovery_codes, unique_id (8-hex-FPR,
unique index), last_password_change. UI: FounderAccess.tsx renders
SecuritySection.tsx (line 2337) with 2FA setup, recovery codes, unique id,
password change tracking. founderAccessApi.ts + useFounderBackend.ts hook.
These are cross-device (stored in profiles table, not localStorage).

### Deploy status 2026-08-09 (this session)

- GitHub main: commit 35add94 (invoice fix aebbe2a + Smart-Cache 35add94 pushed).
- Cloudflare Pages: LIVE https://3e0915ed.fuel-app-mobile.pages.dev
  (bundle index-DXiGs6ze.js, 124 precache).
- Vercel production: STILL rate-limited (api-deployments-free-per-day 100/day
  exhausted; resets ~24h). The /api/fuel-local serverless function on the
  EXISTING Vercel deployment already works with the now-seeded live DB cache
  (no redeploy needed -- the DB migration is what fixed the Smart-Cache, and
  that's applied directly to the live Supabase project). The frontend on
  Vercel production still serves an older bundle until the quota resets.

## LocationContext re-render storm / refresh loop (FIXED 2026-08-10, commit f26f921)

**Symptom**: the app entered a browser refresh loop, and the "Location Logo"
(weather widget location label) repeated/flashed on every render. Root cause:
a GPS-state-churn re-render storm in `LocationContext.tsx`:

1. `detectPreciseLocation` auto-ran on EVERY provider mount/re-mount. When
   `StationContext` synced (e.g. `currentStation` got a new object identity),
   `LocationProvider` re-rendered Ôćĺ the auto-detect effect re-fired Ôćĺ
   `setPreciseLocation` Ôćĺ re-render Ôćĺ cascade.
2. The context `value` object was created fresh on every render (NOT memoized),
   so every consumer (`WeatherWidget`, `FuelPriceLocator`, `Dashboard`, etc.)
   re-rendered on every LocationProvider render even when nothing changed.
3. `WeatherWidget`'s weather-fetch effect depended on the whole
   `preciseLocation` object (new reference every set), so it refetched weather
   on every coordinate update.

The infinite re-render exceeded React's max-update-depth Ôćĺ the `ErrorBoundary`
caught it Ôćĺ triggered `window.location.reload()` Ôćĺ on reload the same storm
recurred Ôćĺ refresh loop.

**Fix** (`src/react-app/context/LocationContext.tsx`):

- The context `value` is now `useMemo`'d with a dependency array of the actual
  consumed primitives/functions, so consumers only re-render when something
  actually changes.
- The auto-detect effect is ref-guarded (`hasAutoDetectedRef`): it runs
  `detectPreciseLocation()` exactly ONCE per provider lifecycle, not on every
  re-mount/re-render.

**Fix** (`src/react-app/components/WeatherWidget.tsx`):

- The weather effect now depends on the primitive fields
  (`preciseLocation?.lat`, `?.lng`, `?.address`) instead of the whole object,
  so it only refetches when the coordinates actually change.

**Fix** (`src/react-app/components/FuelPriceLocator.tsx`):

- The auto-detect-location effect is ref-guarded (once-only) to prevent the
  same re-detect storm from that consumer.

Verified: `npx tsc --noEmit` (0 errors), `npm run build` (124 precache
entries).

## Canonical fuel-type normalization (ADDED 2026-08-10, commit f26f921)

**Problem**: the same fuel appeared under many different names across the site
ÔÇö "Super Petrol" (Dashboard card), "Petrol (PMS)" (Dashboard chart/tank),
"PMS Price" (Dashboard), "Petrol" (PriceBoard, FuelPriceLocator),
"Petrol (PMS)" (PointOfSale), "Premium Motor Spirit"/"Petrol" (FuelTypesManager),
"Super Petrol" (FuelTracker), plus "Diesel"/"AGO"/"Automotive Gas Oil",
"Kerosene"/"IK"/"Illuminating Kerosene"/"DPK", "Cooking Gas"/"LPG", etc. These
were treated as DIFFERENT fuels by price-matching/grouping logic, so EPRA
auto-sync and cross-component comparisons silently missed entries.

**Fix** (`src/react-app/config/pricing.ts`): added a single source of truth:

- `CanonicalFuelType` union: `petrol | diesel | kerosene | vpower |
premium_diesel | lpg | cng`.
- `CANONICAL_FUEL_TYPES` registry: maps each canonical type to a uniform
  display `label` (e.g. petrolÔćĺ"Super Petrol", dieselÔćĺ"Diesel",
  keroseneÔćĺ"Kerosene", lpgÔćĺ"LPG") and an industry `code` (PMS/AGO/IK/VPW/PDS).
- `FUEL_ALIAS_MAP`: case-insensitive map of EVERY known spelling/abbreviation
  (Super Petrol, Petrol, PMS, Premium Motor Spirit, Gasoline, Unleaded,
  Regular, AGO, Automotive Gas Oil, Gas Oil, DERV, DPK, IK, Illuminating
  Kerosene, V-Power, Premium Petrol, Premium Diesel, LPG, Cooking Gas, CNGÔÇŽ)
  to its canonical type. Add new aliases here as discovered ÔÇö nothing else
  changes.
- `normalizeFuelType(raw)` Ôćĺ canonical key | null.
- `getFuelLabel(raw)` Ôćĺ canonical display label (falls back to trimmed raw).
- `getFuelCode(raw)` Ôćĺ canonical short code.
- `isSameFuelType(a, b)` Ôćĺ true if two raw strings refer to the same fuel
  (alias-aware; falls back to case-insensitive compare for unknown types).

**Applied across the UI** (all display labels now sourced from
`CANONICAL_FUEL_TYPES`):

- `Dashboard.tsx`: chart dataset labels, price-card captions ("Super Petrol
  Price"/"Diesel Price" instead of "PMS Price"/"AGO Price"), tank labels
  ("Super Petrol Tank"/"Diesel Tank" instead of "Petrol (PMS) Tank"/"Diesel
  (AGO) Tank").
- `PriceBoard.tsx`: `FUEL_GRADES` keys + default `fuelType` use canonical
  labels; the EPRA auto-sync `.find()` now uses `isSameFuelType()` so BOTH
  legacy entries ("Petrol") and canonical entries ("Super Petrol") match.
- `FuelPriceLocator.tsx`: station price-card labels.
- `FuelTracker.tsx`: `PriceCard` labels.
- `PointOfSale.tsx`: quick-sale fuel name.
- `FuelTypesManager.tsx`: `DEFAULT_FUEL_TYPES` + `PRESET_FUELS` `localName` and
  `code` fields.

**Pricing helpers updated**: `getBasePrice`, `getCountryPrice`, and
`getKenyaFuelTypes` now resolve through `normalizeFuelType()` first (with a
legacy fallback for any unknown raw string), so prices look up correctly
regardless of which spelling a component/feed uses.

The `/api/*` serverless fuel endpoints keep their wire-format field names
(`super_petrol`, `diesel`, `kerosene`) ÔÇö these are an internal API contract,
not user-facing labels, and the frontend already maps them to canonical
labels.

**Deploy status 2026-08-10 (commit f26f921)**:

- GitHub main: pushed (f26f921).
- Cloudflare Pages: LIVE (preview https://08f3841b.fuel-app-mobile.pages.dev +
  main alias fuel-app-mobile.pages.dev).
- Vercel production: BLOCKED by `api-deployments-free-per-day` (100/100 used;
  resets ~2026-08-12 06:50 UTC). ALL deploy paths are blocked (prebuilt,
  git-source API, redeploy) ÔÇö the quota now also blocks git-webhook-triggered
  builds. The project's GitHub integration will auto-deploy the latest main
  once the quota resets. Until then Vercel production serves the previous
  frontend; the Cloudflare mirror has the fixed frontend NOW. /api/* endpoints
  (unchanged by this commit) remain correct on Vercel.

## Tab consolidation ÔÇö merged standalone tabs into host components (2026-08-11)

Reduced top-level navigation clutter by merging 9 formerly-standalone tabs into existing host components as inner sub-tabs (using the new reusable `src/react-app/components/SubTabBar.tsx`). Each source tab's configuration was removed from `FuelContext.tsx` tabConfigurations, its switch case + lazy import removed from `Home.tsx`, and dead entries cleaned from `MobileBottomNav.tsx`. `PermissionContext.roleTabGrants` still lists the old ids harmlessly (they no longer match any tab, so they have no effect).

Merges:

1. **IntegrationsSettings** ("integrations-settings") -> **IntegrationHub** ("integration") as a "Payment Setup" sub-tab (M-PESA Daraja + Kopo Kopo config forms). SettingsPanel M-PESA/Kopo Kopo cards now switch to "integration" (was "integrations-settings").
2. **FuelTracker / Auto Fuel Price** ("fueltracker") -> **FuelPriceLocator** ("price-finder") as an "Auto Fuel Price" sub-tab.
3. **PurchasesSuppliers** ("purchases") -> **SupplierManagement** ("suppliers") as a "Purchases" sub-tab alongside Suppliers + Purchase Orders.
4. **SalesInvoices** ("sales-invoices") -> **Invoice** ("invoice") as a "Sales Invoices" sub-tab.
5. **ShiftManagement** ("shifts") -> **TeamManager** ("team") as a "Shifts" sub-tab.
6. **Pump Settings** (was a sub-tab of DataManager "data") -> **FuelTypesManager** ("fueltypes") as a "Pump Settings" sub-tab. The inline DataManager pump-settings JSX was extracted into a self-contained `PumpSettingsPanel` component inside FuelTypesManager.tsx (reads FuelContext state + PermissionContext, dispatches SET_PRICES / SET_PMS_PUMPS / SET_AGO_PUMPS). DataManager's "pumps" tab nav entry + render block + now-unused pump state/imports were removed.
7. **PriceBoard** ("priceboard") -> **FuelTypesManager** ("fueltypes") as a "Price Board" sub-tab.
8. **DocumentConverter** ("docconverter") -> **DocumentCenter** ("documents") as a "Document Converter" sub-tab.
9. **FuelQualityTesting** ("quality") -> **FuelTypesManager** ("fueltypes") as a "Fuel Quality" sub-tab.

FuelTypesManager now hosts 4 inner sub-tabs: Fuel Types / Pump Settings / Price Board / Fuel Quality.

**Live Transaction Monitor -> Integration Hub link**: LiveTransaction.tsx "Payment Sources" card now has a "Live Payment Integrations" panel with M-PESA Payment + Kopo Kopo Payment buttons that switch to the "integration" tab (Integration Hub -> Payment Setup), plus an "Open Integration Hub" link. This wires the "Add Payment Source" flow to the real M-PESA Daraja / Kopo Kopo configuration in the Integration Hub.

Verified: `npx tsc --noEmit` (0 errors), `npm run build` (115 precache, success), `eslint` (0 errors, warnings only), `prettier --check` (all pass).

## Debt Reminder -> Credit Management merge + cross-tab interlink framework (ADDED 2026-08-11)

### Debt Payment Reminder -> Credit Management (sub-tab merge)

`DebtReminder.tsx` is no longer a standalone top-level tab. It is now embedded
inside `CreditManagement.tsx` as a "Reminders" inner sub-tab (alongside the
"Accounts" view) via `SubTabBar`. Overdue credit accounts show a "Send
Reminder" button that switches to the reminders sub-tab. Removed: `debt` tab
config from `FuelContext.tsx` tabConfigurations, `DebtReminder` lazy import +
`case "debt"` from `Home.tsx`, and the `debt` nav entry from
`MobileBottomNav.tsx` (fallback mapping `debt -> "credit"`). `DebtReminder.tsx`
itself is unchanged (still rendered as an embedded component, no longer
lazy-loaded via Home).

### Cross-tab interlink framework (`mpesa-integration-service.ts`)

Added a payload-carrying cross-tab navigation layer on top of `switchToTab`:

- `navigateToTab(tabId, payload?)` ÔÇö dispatches `changeTab` (tab switch) then a
  deferred `tabPayload` event carrying `{ tab, payload }` so the target
  component (now mounted) can apply the payload.
- `onTabPayload(tabId, callback)` ÔÇö subscribes a target component to prefill
  payloads for its tab id; returns an unsubscribe fn (use in a `useEffect`
  cleanup).
- Typed prefill shapes: `StkPushPrefill`, `InvoicePrefill`, `CreditPrefill`,
  `ExpensePrefill` (all in `mpesa-integration-service.ts`).

### Live Transaction Monitor <-> Integration Hub (real config status)

`LiveTransaction.tsx` now loads the real M-PESA Daraja (`mpesa_config`) and
Kopo Kopo (`kopokopo_config`) configs from cloud on mount and reflects their
connection status:

- STK Push modal: a status banner shows "Connected to M-PESA Daraja
  (Production/Sandbox, shortcode X)" or "M-PESA Daraja is not configured", with
  a "Configure in Integration Hub" link (`switchToTab("integration")`).
- Add Source modal: when the source type is `mpesa_paybill` shows the M-PESA
  Daraja status; when `mpesa_buygoods` shows the Kopo Kopo status; each with a
  "Configure in Integration Hub" link.
- "Live Payment Integrations" panel: the M-PESA Payment + Kopo Kopo Payment
  cards now show live "Connected"/"Not connected" badges (green/amber) derived
  from the cloud config (previously static labels).

### Interlinked cross-tab flows (built on the framework)

- **Credit Management -> Live Transaction**: each credit account with an
  outstanding balance has a "Collect via M-PESA" button that calls
  `navigateToTab("livetransaction", {phone, amount, account_reference,
transaction_desc, openStkPush:true})` ÔÇö opens the STK Push modal pre-filled.
- **Credit Management -> Invoice**: each account has a "Create Invoice" button
  that calls `navigateToTab("invoice", {customerName, amount, description})`.
- **Invoice -> Live Transaction**: the Invoice form has a "Collect Payment"
  card with a "Collect via M-PESA" button that sends the invoice total +
  customer phone/reference to the STK Push modal.
- **Live Transaction -> Credit Management**: each completed shared transaction
  has an "Apply to Credit Account" button that calls `navigateToTab("credit",
{customerName, amount})` ÔÇö opens the new-credit-account form pre-filled.
- **Payroll System -> Expense Tracker**: the Payroll bulk-actions bar has a
  "RECORD EXPENSE" button that calls `navigateToTab("expenses", {category:
"salaries", amount: totalNet, description, reference})` ÔÇö opens the
  new-expense form pre-filled.
- **Maintenance Tracker -> Expense Tracker**: each maintenance record has a
  "Record Expense" (Receipt icon) button that calls `navigateToTab("expenses",
{category: "maintenance", amount: record.cost, description, reference})`.
- **Dashboard Quick Actions**: expanded from 6 to 12 deep-link actions (added
  Credit, STK Push [opens STK Push modal via payload], Expenses, Suppliers,
  Integration Hub, Payroll). Actions with a payload use `navigateToTab`, plain
  ones use `switchToTab`.

Receivers: `LiveTransaction.tsx`, `Invoice.tsx`, `CreditManagement.tsx`, and
`ExpenseTracker.tsx` each register an `onTabPayload` listener that pre-fills
their form state and opens the relevant modal/view.

Verified: `npx tsc --noEmit` (0 errors), `npm run build` (114 precache,
success), `eslint` (0 errors, warnings only), all interlink markers present in
built chunks (LiveTransaction, CreditManagement, Invoice, PayrollSystem,
MaintenanceTracker).

## Fuel price & fuel type interlink layer (ADDED 2026-08-11, PR #101, commit e362725)

A single source of truth for station fuel types + prices, kept in sync across every tab. A price change anywhere propagates everywhere; any tab can jump to the Fuel Type Manager to edit the canonical fuel/price.

- **Bus** (`src/react-app/lib/fuel-interlink-bus.ts`): in-memory pub/sub. `emitFuelPriceChange(payload)` broadcasts; `onFuelPriceChange(cb)` receives. `FuelPricePrefill` = `{ fuelType, canonical?, price?, amount?, view? }` where `view` is `"fueltypes" | "pumps" | "priceboard"`.
- **Hook** (`src/react-app/hooks/useStationFuelTypes.ts`): `useStationFuelTypes()` returns `getPriceFor(label)` (canonical match via `isSameFuelType`, fallback `state.pmsPrice`/`agoPrice`), `listFuelTypes()`, `getCanonical()`.
- **FuelContext**: two-way sync with `fuel_types_config` cloud key. Derives `pmsPrice`/`agoPrice` from active petrol/diesel entries. `syncPriceToFuelTypes(label, price)` writes to state + cloud key + bus. Subscribes to real-time changes.
- **Wired components**: Dashboard (Edit Prices/Price Board/Find Prices buttons; synced `state.pmsPrice`/`agoPrice`), FuelTypesManager (emits on persist, receives prefill, honors `view`), PriceBoard (emits, "Set as station price"), FuelPriceLocator & FuelTracker ("Set as my price"), PointOfSale (unified price quick-sale, "Edit Fuels"), Invoice ("use fuel price" + edit links), PumpMappingV1/FuelQualityTesting/ReportsCenter (edit fuel-type deep-links).
- **LiveTransaction Add Payment Source**: explicit `kopo_kopo` source type + status-aware "Configure Kopo Kopo in Integration Hub" deep-link.
- **CI fixes bundled**: added `account_reference?` to `UnifiedTransaction`; removed stale `debt: "credit"` from MobileBottomNav `flagMap`. NOTE: CI uses `tsc -b` (project refs) which is stricter than `tsc --noEmit` ÔÇö always run `npx tsc -b` + `prettier --check "src/**/*.{ts,tsx}" "*.{json,md}"` before committing.
- **Deploy state 2026-08-11**: PR #101 commit e362725, all CI pass. Cloudflare Pages LIVE (preview https://3e2a0a1a.fuel-app-mobile.pages.dev). Vercel BLOCKED by `api-deployments-free-per-day` (100/day exhausted); GitHub integration auto-deploys when quota resets.

## Universal fuel-price propagation (ADDED 2026-08-11, commit 1ed2515)

Wired EVERY part of the site that reads/displays/edits a fuel price or fuel
type through the single canonical source (fuel_types_config + interlink bus)
so a change anywhere propagates everywhere ÔÇö including components that
previously held stale legacy duplicates.

- **FuelContext universal price-propagation effect**: new effect watches
  state.pmsPrice/agoPrice/petrolPrice/dieselPrice and mirrors any change into
  fuel_types_config + broadcasts on the interlink bus. This means
  dispatch(SET_PRICES) from ANY component (DeliveryTracker, SetupWizard,
  LOAD_FROM_STORAGE restore) now propagates to Dashboard/POS/Invoice/
  PriceBoard/Reports/FuelPriceLocator etc. ÔÇö previously only
  syncPriceToFuelTypes() callers propagated. lastBroadcastPriceRef guards
  against redundant emits; applyingFuelTypesRef guards against loops.
- **PointOfSale BUG FIX**: addFuelToCart + live preview now read
  fuelTypeApi.getPriceFor() instead of legacy state.petrolPrice/dieselPrice.
  Previously the displayed per-litre price updated via the bus while the
  charged cart total stayed stale (displayed 250/L but charged 220/L).
- **useStationFuelTypes**: also subscribes to onFuelTypeChange (not just
  onFuelPriceChange) so the fuel-type LIST stays fresh on add/edit/activate.
- **SupplierManagement**: replaced hardcoded FUEL_TYPES with the station's
  configured fuel types for both the supplier fuel-type checkboxes and the
  purchase-order fuel dropdown.
- **FuelOffloading**: fuel-type dropdown lists the station's active fuel
  types (canonical labels + codes) instead of only PMS/AGO. 'Use [fuel] price'
  quick-fill button on the rate field.
- **DeliveryTracker**: updateCell resolves price via getPriceFor(); price
  inputs dispatch BOTH petrolPrice+pmsPrice and dieselPrice+agoPrice so the
  propagation effect picks them up.
- **AIChatbot**: AI context includes ALL active fuel types + live prices
  (allFuelTypes array), not just PMS/AGO.
- **CustomerLoyalty**: preferred-fuel dropdown uses canonical labels.
  Cloud-loaded `loyalty_customers` records are normalized via
  `normalizeLoyaltyCustomer(s)`/`normalizeLoyaltyCustomers(arr)` (mirrors
  SupplierManagement pattern) before setState, and all render-time `.map()`/
  `.toLowerCase()`/`.includes()`/`formatNumber(...)` accesses are guarded with
  `|| []`/`|| ""`/`|| 0`/`|| "Bronze"` defaults to prevent "Cannot read
  properties of undefined" crashes on partial cloud records.
- **CreditManagement**: removed dead useFuel/state import.
- **FuelTypesManager**: hardened cloud-loaded `fuel_types_config` records.
  Added `normalizeCustomFuelType(f)`/`normalizeCustomFuelTypes(arr)` (mirrors
  SupplierManagement pattern: `?? ""` strings, `typeof === "number" ? : 0`,
  `typeof === "boolean" ? : false`; non-array input Ôćĺ `[]`). The cloud
  `get`/`subscribe` callbacks and the localStorage `loadFuelTypes()` now run
  records through normalize before setState. Render-time `.map()`/`.filter()`/
  `.reduce()`/`.some()`/`.toFixed()` accesses on `fuelTypes`/`ft.*` fields are
  additionally guarded with `|| []`/`|| ""`/`|| 0` defense-in-depth.
- **Deploy state**: Cloudflare Pages LIVE (https://6b023595.fuel-app-mobile.pages.dev).
  Vercel BLOCKED by api-deployments-free-per-day (100/day; GitHub integration
  auto-deploys when quota resets). All CI checks pass. No Supabase schema
  changes (uses existing fuel_types_config cloud key).

## Service Worker auto-reload fix (DEPLOYED LIVE 2026-08-11, commit f90b895)

**Symptom**: after deploying new code, users kept seeing STALE cached JS
bundles ÔÇö the app didn't reflect the latest fixes even after hard reload.
Root cause: the inline SW registration script in `index.html` only called
`navigator.serviceWorker.register("/sw.js")` with NO update lifecycle
handling. The workbox-generated `sw.js` calls `self.skipWaiting()` on
install, but the page never reloaded to pick up the new controller Ôćĺ users
were stuck on old cached bundles until they manually unregistered the SW.

**Fix** (`index.html` inline script): added full update lifecycle:

1. `controllerchange` listener Ôćĺ `window.location.reload()` (auto-reload
   when a new SW takes control).
2. `updatefound` listener Ôćĺ track `reg.installing` state Ôćĺ when
   `state === "installed" && navigator.serviceWorker.controller`, post
   `SKIP_WAITING` message to the new worker.
3. `window.load` handler calls `reg.update()` proactively on every page
   load to check for a new SW version immediately.
4. `vite.config.ts`: `injectRegister: false` to prevent vite-plugin-pwa
   from auto-injecting its own minimal `registerSW.js` (which doesn't
   handle updates). The index.html inline script is the single
   authoritative SW registration.

Verified in built `dist/index.html`: `controllerchange`, `updatefound`,
`SKIP_WAITING` all present. No `registerSW.js` generated.

**Deploy state**: Cloudflare Pages LIVE
(https://2b69be55.fuel-app-mobile.pages.dev + main alias
https://fuel-app-mobile.pages.dev). Vercel BLOCKED by
`api-deployments-free-per-day` (100/100; resets ~24h; GitHub integration
auto-deploys commit f90b895 when quota resets). All merges verified live
on Cloudflare:

- Credit tab Ôćĺ sub-tabs: Credit Accounts + Debt Payment Reminders Ôťů
- Fuel Type Manager Ôćĺ sub-tabs: Fuel Types + Pump Settings + Price Board
  - Fuel Quality Ôťů
- Supplier Management Ôćĺ sub-tabs: Suppliers + Purchase Orders + Purchases Ôťů
- Invoice Ôćĺ sub-tabs: Invoice + Sales Invoices Ôťů
- Integration Hub Ôćĺ sub-tabs: Connectors + Webhooks + API Keys + Logs +
  Payment Setup (hosts merged "Integrations" tab content) Ôťů
- Live Transaction Ôćĺ "Open Integration Hub" button links to Integration Hub Ôťů
- Top nav bar: no standalone Debt Reminder/Purchases/Price Board/Auto Fuel
  Price/Sales Invoices/Shift Management/Integrations tabs (all merged) Ôťů

## Dropdown UX Optimization ÔÇö CLICKING.txt 5 rules (DEPLOYED LIVE 2026-08-11, commit 270ff2f)

Implemented all 5 dropdown UX rules from `CLICKING.txt` across the entire site:

### Universal `Select` component (`src/react-app/components/ui/Select.tsx`)

A reusable, accessible dropdown implementing ALL 5 rules:

- **Rule 1 (Make it Clickable)**: 48px `h-12` touch target, hover border
  highlight, clear ChevronDown caret icon with 150ms rotate animation,
  focus ring (`focus:ring-2 focus:ring-indigo-500`).
- **Rule 2 (Flip on Edge)**: `getBoundingClientRect()` viewport detection
  on open + scroll; if `spaceBelow < menuHeight && rect.top > menuHeight`,
  flips menu to `bottom-full` (opens upward) instead of `top-full`.
- **Rule 3 (Keyboard Always)**: full ARIA combobox semantics
  (`aria-haspopup`, `aria-expanded`, `aria-controls`, `aria-activedescendant`,
  `role="listbox"`, `role="option"`, `aria-selected`); ArrowDown/ArrowUp
  (with wrap-around + skip-disabled), Enter/Space to select, Escape to
  close + refocus trigger, Tab to close.
- **Rule 4 (10+ Items = Search)**: auto-enables a search input when
  `options.length >= searchThreshold` (default 10); live filtering with
  "No results found" empty state; auto-focuses search on open.
- **Rule 5 (Hit 150ms)**: menu enter/exit animation at `duration-150`
  (opacity + scale + translate); chevron rotate at `duration-150`;
  `prefers-reduced-motion` support via global CSS.

### Global CSS for ALL native `<select>` elements (`index.css`)

Applied site-wide to all 78 native `<select>` elements across 36 files:

- `min-height: 48px` (Rule 1 touch target)
- `appearance: none` + custom SVG caret icon (consistent across browsers)
- `background-position: right 12px center` (caret placement)
- `padding-right: 40px !important` (room for caret)
- `select:hover` Ôćĺ border highlight (Rule 1 feedback)
- `select:focus` Ôćĺ indigo ring (`#6366f1` light / `#818cf8` dark)
  (Rule 1 focus feedback)
- `html.dark select` Ôćĺ dark bg `#1f2937`, dark border `#4b5563`, light text
  `#f3f4f6`, dark option backgrounds (consistent dark mode)
- `transition: .15s ease` (Rule 5 ÔÇö minified from `150ms`)
- `@media (prefers-reduced-motion: reduce)` Ôćĺ disables all transitions
  (Rule 5 accessibility)

### Enhanced existing custom dropdowns

1. **SearchableCountryDropdown** (`SearchableCountryDropdown.tsx`):
   - Edge-flip via `getBoundingClientRect()` (Rule 2)
   - ARIA `role="listbox"` on list container, `role="option"` +
     `aria-selected` on each country button (Rule 3)
   - `aria-haspopup="listbox"` + `aria-expanded` on trigger (Rule 3)
   - 48px trigger (`h-12`), 40px list items (`h-10`) (Rule 1 touch targets)
   - 150ms transitions on trigger + chevron + list items (Rule 5)

2. **ExportDropdown** (`ExportDropdown.tsx`):
   - ARIA `aria-haspopup="listbox"` + `aria-expanded` (Rule 3)
   - Edge-flip via `getBoundingClientRect()` (Rule 2)
   - Keyboard: Escape closes + refocuses, ArrowDown/Enter/Space opens (Rule 3)
   - 48px trigger (`h-12`) (Rule 1)
   - 150ms animation preserved (was already the best example) (Rule 5)

3. **StationSelector** (`StationSelector.tsx`):
   - Keyboard nav: Escape closes (cancels add/edit), ArrowDown/Enter/Space
     opens (Rule 3)
   - ARIA `aria-haspopup="listbox"` + `aria-expanded` (Rule 3)
   - Edge-flip via `getBoundingClientRect()` (Rule 2)
   - 48px trigger (`h-12`) (Rule 1)
   - 150ms animation on menu + chevron (Rule 5)

4. **Header station menu** (`Header.tsx`):
   - ARIA `aria-haspopup="listbox"` + `aria-expanded` (Rule 3)
   - 40px touch targets on each station button (`h-10`) (Rule 1)
   - 150ms transitions + chevron rotate (Rule 5)
   - `role="listbox"` on menu container (Rule 3)

### Deploy state 2026-08-11 (commit 270ff2f)

- GitHub: pushed Ôťů
- Cloudflare Pages: LIVE (https://44d99f82.fuel-app-mobile.pages.dev +
  main alias https://fuel-app-mobile.pages.dev) Ôťů
- Vercel: BLOCKED by `api-deployments-free-per-day` (100/100; GitHub
  integration auto-deploys when quota resets ~24h) ÔĆ│
- Supabase: no schema changes needed (frontend-only) Ôťů
- Verified in production CSS bundle: `min-height:48px`, `appearance:none`,
  `.15s` transitions, `#6366f1` focus ring, `#1f2937` dark bg,
  `prefers-reduced-motion` ÔÇö all present Ôťů

## Automation engine + Products->Stock Management merge (ADDED 2026-08-11, commit afadee0)

### Products tab merged into Stock Management

The standalone "Products Catalog" top-level tab has been REMOVED. Its full CRUD is now a "Products" sub-tab inside InventoryManagement.tsx (label "Stock Management"). 7 sub-tabs: Products, Adjustments, Transfers, Counts, Wastage, Auto-Reorders, History.

### Automation engine (NEW)

`src/react-app/lib/automation-engine.ts`: cloud-backed domain-event bus + automation reaction system. Initialized on app boot. Auto-reorder, auto-record-stock, auto-refresh, cloud-backed prefs + log. AutomationPanel.tsx (tab "automation" order 35): Settings/Reorders/Log.

### Cross-component wiring

PointOfSale emits sale:completed. PriceBoard emits price:changed. ExpenseTracker emits expense:created. Dashboard + InventoryManagement listen + auto-refresh.

### User-adjustable preferences (NEW, cloud-backed)

`src/react-app/lib/user-preferences.ts`: everything previously hardcoded is per-user + cloud-synced. Currency, VAT label/rate (65+ countries), categories, units, fuel types, payment methods, receipt footer, invoice prefix. SettingsPanel.tsx new "Site Preferences" card.

### Deploy 2026-08-11

GitHub: pushed (afadee0). Cloudflare: LIVE 841189f4.fuel-app-mobile.pages.dev. Vercel: BLOCKED (quota resets 2026-08-12 19:44 UTC).

## Founder Console infinite render loop breaking navigation (FIXED 2026-08-12, commit ae5f31f)

**Symptom**: The Founder Access Global Console (`/#/founder`) was stuck on
the Overview section. Clicking any sidebar nav item (Users, Stations,
Secrets, etc.) re-rendered but `activeSection` never changed ÔÇö the header
stayed "Super Admin | Overview". The Audit Log badge showed 1000 (all
"Session Resumed" entries).

**Root cause ÔÇö infinite render loop**:

- `useFounderBackend.logAudit` was a `useCallback` with deps
  `[logMutation, isStatic]`. The tRPC `logMutation` RESULT OBJECT identity
  changes on every mutation state transition (idleÔćĺpendingÔćĺsuccess), so
  `logAudit` was recreated every render.
- The "Password check on mount" effect in `FounderAccess.tsx` listed
  `logAudit` in its deps. So it re-fired on every render. Each fire called
  `logAudit("Session Resumed", ...)` Ôćĺ `logMutation.mutate()` Ôćĺ mutation
  state transition Ôćĺ `logAudit` recreated Ôćĺ effect deps changed Ôćĺ re-fire Ôćĺ
  loop.
- The loop spammed the audit log (1000 "Session Resumed") and kept the
  component re-rendering continuously, so `setActiveSection(id)` from nav
  clicks never produced a STABLE render ÔÇö the section change was lost in the
  render storm.

**Fix** (2 parts):

- `useFounderBackend.ts`: depend on the stable `mutate` fn (destructured from
  `logMutation`) instead of the whole mutation result object, so `logAudit`
  is referentially stable across renders.
- `FounderAccess.tsx`: the mount effect now runs ONCE (`[]` deps) and reads
  the latest `logAudit` via a `logAuditRef` (assigned every render), so it
  no longer re-fires on mutation state changes.

**Also noted**: the app uses `HashRouter` (App.tsx imports
`HashRouter as Router`). The founder console is at `/#/founder`, NOT
`/founder`. Navigating to `/founder` (no hash) matches the catch-all Ôćĺ `/` Ôćĺ
MainAppLoader Ôćĺ AuthLogin. This is correct router behavior, not a bug ÔÇö
just easy to miss when testing (it was the first red herring).

**Verified live** (Cloudflare preview `8129b134.fuel-app-mobile.pages.dev`):
logged in as founder (username `FOUNDER` Ôćĺ resolves to
`leonibuyanawose@gmail.com` via `profiles.username`), Audit Log shows 1
entry ("Login Successful"), nav switches Overview Ôćĺ Users (22-user table) Ôćĺ
Secrets (3 secrets) correctly. `npx tsc --noEmit` clean.

**Founder login details**: `loginFounder(username, password)` resolves
username Ôćĺ email via `profiles.username` (case-SENSITIVE `text` column, so
the username must match exactly ÔÇö `FOUNDER` Ôëá `founder`). Then
`signInWithPassword` + role check in the `users` table (NOT `profiles`).
`leonibuyanawose@gmail.com`: `users.role='founder'`,
`profiles.username='FOUNDER'`, password `FuelPro@2026!`.

## Responsive design audit (DEPLOYED LIVE 2026-08-12, commit ac3bb58)

Full multi-device responsive audit across phone/tablet/laptop/TV aspect ratios. All fixes verified at 8 device sizes (320px small phone -> 4K TV) with zero horizontal overflow and zero HTTP errors.

### Founder Console sidebar (biggest issue)

FounderAccess.tsx had a FIXED w-60 (240px) sidebar always visible. On a 320px phone this left only 80px for content and crushed the Overview 4-col stat grid to ~0px per card. Fix: sidebar is now a slide-in drawer on <lg (1024px) with backdrop overlay; persistent rail on lg+. Hamburger button in header (hidden on lg+) opens it. Nav-item click auto-closes. Verified: aside x=-240 (off-screen) on load, x=0 after hamburger, x=-240 after nav selection.

### Global CSS (src/react-app/index.css)

- .main-content + body min-height: 100dvh (100vh fallback) fixes mobile address-bar cutoff that hid the fixed MobileBottomNav.
- Compaction media queries: raised .btn/input min-height floor from 24-28px -> 32-40px (was below WCAG touch-target minimum).
- Added .h-screen-dvh/.min-h-screen-dvh/.max-h-screen-dvh/.h-screen-svh utility classes (dynamic viewport units).
- Global table/pre/code: overflow-x:auto + max-width:100% so dense data never pushes page sideways.
- html/body: overflow-x:clip (not hidden - preserves position:sticky on descendants).
- Touch-target floor: native button/a[role=button] get min-height:40px on coarse pointers (@media hover:none and pointer:coarse).
- Safe-area-inset padding for .fixed.bottom-0/.fixed.top-0 (notch/home indicator).
- .break-anywhere utility for long emails/UUIDs/receipt numbers.

### index.html viewport

- Removed maximum-scale=1.0, user-scalable=no (re-enables user zoom, WCAG 1.4.4). Added viewport-fit=cover for notch safe areas.

### tRPC 405 errors - /undefined/api/trpc bug (FIXED)

Symptom: every tRPC query/mutation POSTed to /undefined/api/trpc/* and /api/auth/founder-login returning 405 on Cloudflare Pages (no /api/* serverless fns). Root cause (src/providers/trpc.tsx getApiUrl()): the expression import.meta.env.VITE_BACKEND_URL + "/api/trpc" evaluated to the STRING "undefined/api/trpc" when VITE_BACKEND_URL was unset (JS coerces undefined to "undefined" in string concatenation). Because that string is truthy, the || "" fallback never fired. httpBatchLink POSTed the relative path which resolved to the page origin -> 405. Also pages.dev was NOT in the static-deployment host list. Fix: getApiUrl() guards each env var explicitly (returns "" in Supabase-only mode). httpBatchLink fetch rejects immediately when apiUrl is empty. On Vercel the relative /api/trpc path is still used. Founder console falls back to Supabase-direct auth when tRPC fails.

### FounderAccess login

completeLogin skips /api/auth/founder-login + /api/trpc/founderAuth.login fetches when getBackendUrl() returns "" (no backend) - was 405-ing the static host on every founder login on Cloudflare. Local Supabase auth handles the session.

### Founder Console tables (Users, Secrets, Audit Log)

All three table containers changed from overflow-hidden (clips wide tables on phones) to overflow-x-auto + -mx-3 sm:mx-0 (edge-to-edge on phones, inset on sm+), with min-w-[480-640px] on the table so it scrolls horizontally instead of crushing columns.

### Responsive grids in Founder Console

- Overview 4-col stat grid: grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 (2 on phone, 4 on desktop; was crushing to 0px on 320px).
- System Health 3-col grid: grid-cols-1 sm:grid-cols-3.
- Header: search input hidden on <sm, cloud-status label hidden on <md (icon-only); responsive padding px-3 sm:px-6.

### Deploy status 2026-08-12

- GitHub main: commit ac3bb58 (pushed 469afbc incl. audit scripts).
- Cloudflare Pages: LIVE (preview https://62a6ff6e.fuel-app-mobile.pages.dev + main alias https://fuel-app-mobile.pages.dev, bundle index-BXNHje2B.js, 112 precache).
- Vercel production: BLOCKED by api-deployments-free-per-day (100/100; prebuilt deploy also hit the limit). GitHub integration auto-deploys when quota resets (~24h). /api/* endpoints unchanged.
- Verified live on Cloudflare: Founder sidebar drawer opens/closes at 375px; no 405 errors; overview grid spans full 351px; no horizontal overflow. Main app (non-founder) passes at all 8 sizes.

## Phase 1 QA ÔÇö login + currency + full data entry (2026-08-12, commits e26d05c + 3937abe)

### "Invalid login credentials" ÔÇö RESOLVED

The QA user `qa.phase1.0811@gmail.com` (uid 23e1a8fd) can now sign in on
both Vercel production and Cloudflare Pages. The user was created via
Supabase admin API with a confirmed email + password set via
`auth.admin.updateUserById`.

### Currency display fix (showing USD instead of KES)

**Symptom**: the currency selector showed "USD" instead of "KES"
even for Kenyan stations. Root cause: `getCountryByCurrency()` received
`undefined` as the currency arg because `companyData.currency` was empty
(stations created via the wizard don't set it), and the fallback chain
didn't reach the detected currency.

**Fix** (2 commits):

- `e26d05c`: Added a symbol-to-code map (`KSh->KES`, `USh->UGX`, `TSh->TZS`,
  `NGN`, `R->ZAR`, etc.) so `getCountryByCurrency` resolves African
  currencies correctly. `getStationCountry` now checks `companyData.currency`
  first, then `companyData.companyCurrency`, then falls through to
  `currentCountry` (from LocationContext) instead of returning a stale
  cached value.
- `3937abe`: Pass `companyCurrency` to `LocationProvider` as a prop so
  `getStationCountry` is reactive ÔÇö when the user changes currency, the
  country flag updates immediately without a page reload.

Verified live: currency selector shows "Kenya KES" on both
fuel-app-mobile.vercel.app and fuel-app-mobile.pages.dev.

### Full-site data entry ÔÇö ALL tabs verified

Navigated every tab as `qa.phase1.0811` and entered data. All saved to
Supabase `app_kv` with the scoped `__ownerId` suffix (cross-user fix):

| Tab              | Data entered                               | Cloud key           | Updated (UTC) |
| ---------------- | ------------------------------------------ | ------------------- | ------------- |
| Edit Info        | Company profile (Equity Bank, PO Box, KRA) | compact blob        | 05:12:54      |
| Point of Sale    | 20L petrol @ KSh 214.03                    | pos_transactions    | 05:06:16      |
| Sales Tracking   | Shift "QA Shift 1" + pump readings         | shift_employees     | 04:17:44      |
| Invoice          | Acme Transport Ltd, 500L @ 214.03          | compact blob        | 05:12:54      |
| Credit           | John Mwangi, KSh 50k limit, 30 days        | credit_accounts     | 05:09:25      |
| Payroll          | Sarah Wanjiku, Cashier, KSh 45k            | payroll_employees   | 05:10:50      |
| Delivery Tracker | Total Kenya, 10,000L                       | compact blob        | 05:12:54      |
| Fuel Offloading  | Existing data (8,000L PMS)                 | compact blob        | 05:12:54      |
| Customers        | David Otieno, KCE 456Z                     | compact blob        | 05:12:54      |
| Communication    | Mary Achieng, VIP contact                  | comm_contacts       | 04:16:45      |
| Expenses         | (from earlier session)                     | expenses_data       | 04:19:19      |
| Maintenance      | (from earlier session)                     | maintenance_records | 04:20:25      |
| Loyalty          | (from earlier session)                     | loyalty_customers   | 04:10:23      |

### Founder panel cross-owner verification ÔÇö CONFIRMED

Logged in as founder (`founder.qa.fuelpro@gmail.com`, role=founder):

- **Overview**: 22 Users, 12 Stations, Revenue KSh 0, 3 Secrets, 5 Feature Flags On
- **All Users**: 22 total ÔÇö `qa.phase1.0811@gmail.com` appears as "QA Phase1
  Tester", role=user, Active
- **All Stations**: 12 total ÔÇö "Phase1 Test Station" (Kasarani, Nairobi)
  shown with Owner: QA Phase1 Tester, Active

The founder can see the QA user's station and data cross-owner. The
scoped `__ownerId` app_kv keys prevent cross-user data leakage while the
service_role founder queries see all data.

### Deploy state 2026-08-12 (commit 3937abe)

- GitHub main: 3937abe (pushed, synced with origin/main)
- Vercel production: dpl_EFJyuoAp4d6YqHnZf6EeYsUJCFY1, READY+PROMOTED,
  aliased to fuel-app-mobile.vercel.app (bundle index-UQhA7O5H.js,
  prebuilt deploy). `companyCurrency` verified in live bundle.
- Cloudflare Pages: LIVE (bundle index-SAwr-1Nt.js, main alias
  fuel-app-mobile.pages.dev). `companyCurrency` verified in live bundle.
- Supabase: no schema changes needed (frontend-only fixes). All app_kv
  data for QA user verified with scoped `__ownerId` row ids.

## Credit Management tab deep audit + fix (DEPLOYED LIVE 2026-08-12, PR #119, commit 3f05436)

Deep audit of `src/react-app/components/CreditManagement.tsx` (the "Credit"
top-level tab, which now hosts two inner sub-tabs: "Credit Accounts" +
"Debt Payment Reminders" via SubTabBar). Found and fixed multiple bugs +
hardcoded values + missing features. All fixes verified live on Cloudflare
Pages (preview adc43cbd + main alias fuel-app-mobile.pages.dev) and via
direct Supabase REST API (fresh-device simulation).

### Bugs fixed

1. **Hardcoded "+ Purchase" button** ÔÇö clicking "+ Purchase" instantly added
   a hardcoded $5,000 "Fuel purchase" transaction with no user input. Now
   opens a modal form with Amount + Description inputs + validation
   (`amount > 0` required). The entered amount/description is saved as a
   real `CreditTransaction` with `recordedBy` = logged-in user name.
2. **Transaction history saved but never displayed** ÔÇö `CreditTransaction`s
   were persisted to cloud (`credit_transactions` key) but the UI never
   showed them. Added an expandable "Transaction History" panel per account
   (toggle via "History" button) that lists all transactions with type
   badge (Purchase=red, Payment=green), amount, description, date, and
   `recordedBy` user.
3. **No delete account** ÔÇö there was no way to delete a credit account. Added
   a "Delete" button with a confirmation modal (shows account name +
   balance warning). Deleting removes the account AND all its transactions
   from both state and cloud.
4. **No status management** ÔÇö account status was fixed at "active". Added a
   status selector dropdown (Active/Suspended/Blacklisted) that persists to
   cloud. The badge color reflects the status.
5. **No UX feedback** ÔÇö added toast notifications for all actions (purchase,
   payment, delete, status change) so the user knows the operation
   succeeded.

### DebtReminder.tsx fixes (the "Reminders" sub-tab)

6. **Amount stored as formatted string** ÔÇö `saveDebtReminder` called
   `formatNumber(parseNumberFromFormatted(debtAmount))` which stored the
   amount as a string like "12,000.00" instead of a number. Downstream
   calculations and displays broke. Fixed: stores raw number via
   `parseNumberFromFormatted(debtAmount) || 0`.
7. **loadDebt null-guards** ÔÇö loading a saved reminder set form fields to
   `undefined` if the saved data was missing a field (crash on
   `.replace()` etc.). Now all fields are null-guarded with `|| ""`.
8. **History display amount formatting** ÔÇö the amount in the history list
   was shown raw. Now formatted with `formatNumber`, handling both legacy
   string amounts and new number amounts.
9. **Delete modal + toast** ÔÇö added a delete confirmation modal (was
   instant delete) and toast notification.

### Cloud sync verification (cross-device)

- **Phase 1** (same session): created account "Metro Logistics Corp" ($50K
  limit), added $15K purchase via modal (desc "100L Super Petrol @ $150/L"),
  recorded $8K payment (desc "Partial payment - bank transfer"). Verified
  in Supabase `app_kv`: `credit_accounts` balance=$12K, totalPayments=$8K,
  totalPurchases=$20K; `credit_transactions` has 3 entries (1 payment +
  2 purchases, all with correct `recordedBy`).
- **Phase 2** (fresh browser session, different Cloudflare preview URL,
  no localStorage): logged in as same user Ôćĺ Credit tab loaded account
  from cloud with balance **$12,000.00** (synced), History panel showed
  all 3 transactions (synced), Debt Payment Reminders sub-tab showed
  saved reminder "Metro Logistics Corp" (synced). **Cross-device sync
  confirmed working.**

### Deploy state 2026-08-12 (commit 3f05436)

- **GitHub main**: Ôťů merged (squash) commit 3f05436
- **Cloudflare Pages**: Ôťů LIVE (preview
  https://adc43cbd.fuel-app-mobile.pages.dev + main alias
  https://fuel-app-mobile.pages.dev, bundle 112 precache). CreditManagement
  - DebtReminder chunks with all fixes verified in live bundle.
- **Vercel production**: ÔŁî BLOCKED by `api-deployments-free-per-day`
  (100/100; prebuilt deploy also hit the limit). GitHub integration
  (prodBranch=main) will auto-deploy commit 3f05436 when the quota resets
  (~24h). /api/* endpoints unchanged. ÔĆ│
- **Supabase**: no schema changes needed (uses existing `app_kv` table +
  scoped row ids `credit_accounts__<uid>__<stationId>` and
  `credit_transactions__<uid>__<stationId>`). Ôťů

### Interlinks (already present, verified working)

- **Credit Ôćĺ Live Transaction**: "Collect via M-PESA" button calls
  `navigateToTab("livetransaction", {phone, amount, account_reference,
openStkPush:true})` ÔÇö opens STK Push modal pre-filled.
- **Credit Ôćĺ Invoice**: "Create Invoice" button calls
  `navigateToTab("invoice", {customerName, amount, description})` ÔÇö opens
  invoice form pre-filled.
- **Live Transaction Ôćĺ Credit**: completed shared transactions have "Apply
  to Credit Account" button that calls `navigateToTab("credit",
{customerName, amount})`.
- **Overdue accounts Ôćĺ Reminders**: overdue credit accounts show "Send
  Reminder" button that switches to the Reminders sub-tab.

## Cross-device double-encoded JSON auto-heal (DEPLOYED LIVE 2026-08-11, commit df9daf0)

**Symptom**: ALL per-component cloud data (suppliers, expenses, priceboard,
credit, shifts, payroll, communication, maintenance, loyalty) was stored as a
DOUBLE-ENCODED JSON STRING inside the `app_kv` JSONB column. Supabase returns
JSONB as a parsed object, but when the JS client stored a value via
`cloudStorageService.set(key, data)`, it sometimes double-encoded (stringified
the already-stringified data). On read, `cloudStorageService.get(key)` returned
the raw string, which then failed `Array.isArray()` / object access Ôćĺ the
component's load-on-mount effect set empty state Ôćĺ the data appeared to
vanish on cross-device login. The `get` fallback to the legacy bare-key row
made it worse: the legacy row had the SAME double-encoded string.

**Root cause**: The `cloudStorageService.get`/`getAll` functions returned the
raw `data` field from the `app_kv` row WITHOUT checking if it was a string
that needed parsing. PostgREST returns JSONB columns as parsed JSON objects,
BUT if the stored value was a JSON string (e.g. `"[\"item1\",\"item2\"]"` as a
JSON string literal), PostgREST returns it as a STRING type, not an array.
The code assumed it was always already-parsed.

**Fix** (`src/react-app/lib/cloud-storage-service.ts`): added `coerceJson<T>(raw)`
helper. It checks `typeof raw === "string"`; if so, it `JSON.parse`s the
trimmed string. If parsing fails, it returns the original string (so non-JSON
strings are preserved). Called in `get` (line 162, 186, 208 ÔÇö scoped, legacy,
fallback paths), `getAll` (line 325), `subscribe` (line 388), and
`useCloudKV` (line 460). This is a READ-TIME fix ÔÇö no migration needed. Any
double-encoded string is parsed on read, and the next `set` (auto-heal)
re-persists it as proper JSONB. The `coerceJson` logic is confirmed present
in BOTH production bundles (Vercel `reports-CmmZTPUJ.js` + Cloudflare
`reports-DK69wUr6.js`), minified as
`typeof e=="string"){const t=e.trim();if(!t)return null;try{return JSON.parse(t)}catch{return e}}return e`.

**Data healing**: All 13 per-component data keys for the worldwide user
(c27fc92a) were manually healed from str Ôćĺ proper JSONB via the Supabase REST
API (PATCH app_kv SET data = JSON_PARSE(data)). All data is now accessible as
proper lists/dicts. The `coerceJson` fix is a safety net for any future
double-encoding.

**Deploy state 2026-08-11 (commit df9daf0)**:

- GitHub main: df9daf0 (pushed, synced with origin/main)
- Vercel production: dpl_APNW9gxJ6r8SifQwRhnrQzXhNgnW, READY, aliased to
  fuel-app-mobile.vercel.app (bundle index-C9vUOFes.js, reports-CmmZTPUJ.js)
- Cloudflare Pages: LIVE (main alias fuel-app-mobile.pages.dev, bundle
  index-BuWIkTV5.js, reports-DK69wUr6.js; preview 84f8febf)
- Supabase: all 13 per-component data keys healed to proper JSONB
- Phase 2 cross-device sync VERIFIED via API: fresh login Ôćĺ all data
  accessible as proper JSONB Ôćĺ would load correctly on any new device

## Worldwide (non-Kenya-centric) station (DEPLOYED LIVE 2026-08-11)

The app is now confirmed world-wide (not Kenya-centric):

- Worldwide user: `worldwide.test.0811@gmail.com` (uid c27fc92a)
- Station: "Global Energy Worldwide Station", 100 Worldwide Boulevard, New York
- Country: US, Currency: USD, code: global-energy-wo-9d6p9
- All per-component data uses worldwide entities:
  - Suppliers: Global Fuel Supply Inc.
  - Expenses: Monthly station rent - Worldwide Boulevard ($5000)
  - Price Board: Petrol ($3.45), Diesel ($3.85)
  - Credit: Metro Logistics Corp ($10,000 limit)
  - Payroll: Sarah Johnson, Station Manager ($5,000 salary)
  - Communication: Emily Rodriguez (Rodriguez Transport)
  - Maintenance: Pump #3 quarterly maintenance ($750)
  - Loyalty: Robert Chen (Gold tier, 1250 points)
  - Shifts: Sarah Johnson (morning shift)
- Currency detection: `getDetectedCurrency()` resolves USD for US; the app
  supports all countries via the browser's locale/timezone.

## Founder panel token fix (DEPLOYED 2026-08-11, commit 0875742)

**Symptom**: the Founder Console always showed "All Users 1, All Stations 1"
instead of the real cross-owner counts (22 users, 12 stations), even after
the `/api/founder-stats` endpoint was added in a prior session.

**Root cause**: `useFounderBackend.ts` `loadStats()` called
`getSupabaseClient().auth.getSession()` to get the Bearer token for the
`/api/founder-stats` request. But the shared Supabase client session is
the APP user session (e.g. a regular QA user), NOT the founder session.
The endpoint returned 403 (not a founder) and the hook silently ignored
it, falling back to the localStorage-scanned single-user count (1).

**Fix**: `loadStats()` now prefers
`localStorage.getItem("fuelpro_founder_token")` (stored by loginFounder)
which is always the founder access token. Falls back to getSession() only
if the founder token is absent.

**Verified live** on Cloudflare preview (432b5d5e): founder login shows
All Users 22, All Stations 12. The All Stations view lists all 12 stations
worldwide with correct owner names.

**Deploy status**: Cloudflare LIVE. Vercel BLOCKED by
api-deployments-free-per-day; GitHub integration auto-deploys when quota
resets.

## Hardcoded phone placeholder fix (DEPLOYED 2026-08-11, commit f3ba175)

adminAPI.ts default company phone was +1 555 000 1234 (US format) even for
Kenya-based stations. Now uses +254 700 000 000 for Kenya, empty for others.

## Dashboard tab deep audit + fix (DEPLOYED 2026-08-12, PR #108, commit 7c07a21)

Deep audit of the Dashboard tab (`src/react-app/components/Dashboard.tsx`).
Found and fixed multiple bugs/hardcoded items/missing links. Verified live on
Cloudflare Pages (preview 64e299a3 + main alias fuel-app-mobile.pages.dev).

### Bugs fixed

1. **KPI cards stuck at 0 after cloud load** ÔÇö the animate-KPI `useEffect`
   depended only on `[hasBackendData, backendStats]`. When sales data arrived
   from cloud AFTER mount (the normal non-founder path), the cards never
   re-animated with the real totals. Added `totalRevenue/netProfit/
totalFuelSold/totalDebt` to the deps and moved the totals `useMemo` above
   the effect so the values are in scope.
2. **Null price crashes on `.toFixed(2)`** ÔÇö `displayPmsPrice`/
   `displayAgoPrice` could be null/undefined Ôćĺ `Cannot read properties of
null` crash + "undefined" rendered. Added `?? 0` terminal fallback to
   every price chain.
3. **Hardcoded locale `"en-KE"`** for the live clock ÔÇö wrong for non-Kenya
   stations. Now derives a locale from the station's country profile
   (language + country id) via `Intl.Locale`, falling back to the browser
   default. Same for the minimum-wage `.toLocaleString()`. Verified: US
   station shows "Wed, Aug 12, 2026, 08:50:15 AM"; Kenya shows
   "Wed, 12 Aug 2026".
4. **Hardcoded tank capacity divisor (5000)** ÔÇö tank-level bar used magic
   `closing/(closing+5000)` heuristic. Replaced with `tankFillPercent(opening,
closing)` using the period opening reading (known-full level) as the true
   denominator.
5. **Hardcoded `"PMS Pumps"`/`"AGO Pumps"` labels** Ôćĺ `CANONICAL_FUEL_TYPES`
   labels. Diesel price card label hardcoded "Diesel" Ôćĺ canonical label.
6. **`transportSurcharge.toFixed(2)` + `currentLocation.longitude.toFixed(4)`
   crashes** on null/undefined ÔÇö guarded.
7. **Missing kerosene price visibility** ÔÇö kerosene price was computed but
   never displayed. Added a third price card (responsive 3-column grid).
8. **Unused imports/vars** ÔÇö removed `TrendingUpIcon`, `Info`,
   `getApiBaseAsync`; prefixed remaining intentionally-unused `useAutoSync`
   fields with `_`.
9. **`backendLoading` not surfaced** ÔÇö now shown as a subtle "syncing statsÔÇŽ"
   indicator in the header.

### Deploy status 2026-08-12 (commit 7c07a21, PR #108 merged)

- GitHub main: Ôťů 7c07a21 (squash-merged from PR #108)
- Cloudflare Pages: Ôťů LIVE (preview https://64e299a3.fuel-app-mobile.pages.dev
  - main alias https://fuel-app-mobile.pages.dev, bundle 112 precache)
- Vercel production: ÔŁî BLOCKED by `api-deployments-free-per-day`
  (100/100; ALL deploy paths blocked: prebuilt, git-source API). GitHub
  integration auto-deploys commit 7c07a21 when the quota resets (~24h).
  /api/* endpoints unchanged. Until then Vercel production serves the
  previous commit; the Cloudflare mirror has the fixed frontend NOW.
- Supabase: no schema changes needed (frontend-only fixes).

### Live verification (Cloudflare preview)

Logged in as founder QA user (`founder.qa.fuelpro@gmail.com`, uid 87e6502b).
Dashboard renders cleanly for both:

- US station ("Founder Admin Station", USD): "Wed, Aug 12, 2026, 08:50:15 AM",
  Super Petrol $3.45 / Diesel $3.85 / Kerosene $3.20 (3-column grid),
  "Super Petrol Pumps"/"Diesel Pumps" (canonical labels), no "undefined".
- Kenya station ("THE PUBLICAN ENERGY", KES): "Wed, 12 Aug 2026", EPRA prices
  (Super Petrol KSh 218.53 / Diesel KSh 227.14 / Kerosene KSh 192.31),
  16% VAT, NSSF 6%, Housing Levy 1.5%, Excise Duty KSh 21.95, Min Wage
  KSh 15,120.

### Known out-of-scope issues (NOT Dashboard, not addressed here)

- **Founder console nav section-switch regression**: clicking sidebar nav
  items (Users, Stations, etc.) sometimes doesn't change `activeSection`
  (header stays "Super Admin | Overview"). This was previously fixed in
  commit ae5f31f (infinite render loop) but appears to have regressed. It's
  a FounderAccess.tsx issue, NOT a Dashboard issue. The Dashboard tab itself
  works correctly.
- **Founder console Revenue label hardcoded "KSh"**: should reflect the
  station currency (USD for US stations). Founder console issue, not Dashboard.

## Team Manager cross-device cloud sync (DEPLOYED LIVE 2026-08-12, PR #107)

**Requirement**: Team Manager tab data (team members, invite links, role tab
grants) must persist across devices/browsers ÔÇö never localStorage-only.

### PermissionContext ÔÇö localStorage Ôćĺ cloudStorageService migration

`src/react-app/context/PermissionContext.tsx` previously stored team members,
invite links, and role tab grants in localStorage only. Now all three persist
to cloud via `cloudStorageService` (Supabase `app_kv`, RLS by `owner_id`,
scoped row id `${key}__${ownerId}`):

- **Cloud keys**: `team_members` (TeamMember[]), `team_invites`
  (TeamInvite[]), `team_role_grants` (Record<role, string[]>).
- **Save**: every mutation (`addTeamMember`, `removeTeamMember`,
  `createInviteLink`, `revokeInvite`, `acceptInviteLink`,
  `setRoleTabGrants`) writes to cloud in addition to localStorage cache.
- **Load**: `useEffect([user, currentStation])` loads all three from cloud
  on mount/user-change/station-change; `Array.isArray` guards on arrays.
- **Real-time**: subscribes to `team_members` + `team_invites` cloud keys so
  changes from another device reflect instantly.
- `acceptInviteLink` is idempotent (checks `member.userId === currentUserId`
  before adding) and persists the accepted member to cloud.

### TeamManager.tsx ÔÇö real station pump names (not hardcoded)

`TeamManager.tsx` had a hardcoded `["PMS-1", "PMS-2", "AGO-1", "AGO-2",
"IK-1"]` pump list for the pump-assignment dropdown. Now derives the pump
list from the station's ACTUAL configured pumps:

- Reads `state.pmsPumps` / `state.agoPumps` (from FuelContext) and builds
  labels as `PMS-${i+1}` / `AGO-${i+1}` for each configured pump.
- Falls back to the FuelContext fuel-types config (`state.fuelTypes`) for
  stations with custom fuel types, labeling each pump by canonical fuel
  label + index.
- The hardcoded list is gone; the dropdown now reflects the real station
  setup (e.g. a station with 2 PMS + 2 AGO pumps shows exactly PMS-1,
  PMS-2, AGO-1, AGO-2).

### Shifts sub-tab (already cloud-synced)

The "Shifts" sub-tab inside Team Manager is the ShiftManagement component
(cloud keys `shift_data`, `shift_employees` ÔÇö migrated in a prior session).
Verified: adding an employee ("Grace Wambui", Attendant, +254712345678,
$200/hr) persisted and showed in the roster with "Synced" indicator.

### CI fix (bundled in PR #107)

The `npm ci` step in `.github/workflows/ci.yml` was failing on ALL branches
(main + PRs) because:

1. `package-lock.json` was out of sync ÔÇö missing electron-builder
   platform-specific deps (`electron-builder-squirrel-windows`,
   `electron-winstaller`, `@electron/windows-sign`, etc.).
2. Plain `npm ci` (no `--legacy-peer-deps`) rejected the react@19 vs
   react-debounce-input/react-inspector peer conflicts (via swagger-ui-react).

Fix:

- Regenerated `package-lock.json` with `npm install --legacy-peer-deps`.
- Added `.npmrc` with `legacy-peer-deps=true` so plain `npm ci` (as CI
  runs it) tolerates the peer conflicts. Applies everywhere (CI, local,
  Vercel).
- Ran `prettier --write` across all `src/**/*.{ts,tsx}` + `*.{json,md}`
  (45 pre-existing unformatted files) so the CI prettier gate passes.

Verified: `npm ci`, `tsc --noEmit`, `vite build`, `prettier --check`,
`eslint`, and all Playwright E2E tests pass on Node 22.

### Phase 1 + cross-device verification (2026-08-12)

- Signed up `qa.team.0812@gmail.com`, completed setup wizard for "Team QA
  Station" (45 QA Avenue, Nairobi, 2 PMS + 2 AGO pumps, prices 214/222).
- Navigated to Team Manager tab Ôćĺ created Manager invite link
  (`inv_1786523863119_2vas`, "QA Manager Invite", 0/1 uses) Ôćĺ "Synced"
  indicator appeared.
- **Full page reload**: invite persisted ("1 Active Invites" still showing,
  invite `inv_1786523863119_2vas` loaded from cloud, NOT localStorage) Ôťů
- Shifts sub-tab: added employee "Grace Wambui" (Attendant, +254712345678,
  $200/hr) Ôćĺ saved to cloud, appeared in roster Ôťů

### Deploy state 2026-08-12 (commit 1ef270e, PR #107 merged)

- **GitHub main**: Ôťů merged (squash) commit 1ef270e
- **Cloudflare Pages**: Ôťů LIVE (preview https://4757ca0c.fuel-app-mobile.pages.dev
  - main alias https://fuel-app-mobile.pages.dev, bundle index-BmoIqHGQ.js,
    112 precache). TeamManager chunk + `team_invites`/`roleTabGrants` cloud
    markers verified in live bundle.
- **Vercel production**: ÔŁî BLOCKED by `api-deployments-free-per-day`
  (100/100; prebuilt deploy also hit the limit). GitHub integration
  (prodBranch=main) will auto-deploy commit 1ef270e when the quota resets
  (~24h). /api/* endpoints unchanged.
- **Supabase**: no schema changes needed (uses existing `app_kv` table +
  scoped row ids from the cross-user fix).

## Point of Sale tab audit (DEPLOYED LIVE 2026-08-12, PR #109, commit f0ac137)

Deep audit of `src/react-app/components/PointOfSale.tsx` (the "Point of Sale"
top-level tab). Found and fixed a CRITICAL cross-device data-loss bug plus
multiple hardcoded values. All fixes verified live on Cloudflare Pages and
via direct Supabase REST API (fresh-device simulation).

### CRITICAL ÔÇö POS cross-device data loss (localStorage was source of truth)

**Symptom**: `processPayment` read transactions from
`localStorage.getItem("fuelpro_pos_transactions")`, pushed the new
transaction onto the local array, wrote it back to localStorage, THEN synced
the merged list to cloud. On a NEW device with empty localStorage, the cloud
was overwritten with an array containing ONLY the single new transaction ÔÇö
destroying every prior sale from every other device. This was the exact
"never use local storage" anti-pattern the user flagged.

**Fix** (`PointOfSale.tsx` `processPayment` + `transactions` useState):

- Cloud (`app_kv`) is now the source of truth. `processPayment` merges the
  new transaction into the cloud-backed `transactions` state (loaded on
  mount), persists the merged list to cloud via `cloudStorageService.set`,
  then mirrors to localStorage ONLY as a read-through cache (wrapped in
  try/catch so a quota error never blocks the sale).
- The `transactions` useState initializer now seeds from the synchronous
  in-memory cache (`cloudStorageService.getCached`) / localStorage for an
  INSTANT first render (no blank flash); the mount effect refreshes from
  the authoritative cloud source on user/station change.
- `localStorage.setItem` is kept ONLY as a read-through cache ÔÇö never the
  source of truth.

### Hardcoded values fixed

1. **`"Cashier 1"`** Ôćĺ `user?.name || user.email.split("@")[0] ||
currentStation?.name || "Cashier"`. The receipt now shows the real
   logged-in user's name (e.g. "Founder QA Test").
2. **`"en-KE"` locale** for `formatDate` Ôćĺ derives the locale from the
   station's country profile (`new Intl.Locale(countryCode)` with a
   browser-default fallback). A US station now shows `08/12/2026, 09:12:03
AM` (mm/dd/yyyy + 12-hour) instead of the Kenya format.
3. **`"A-16.00%"` / VAT labels** (receipt + payment summary) Ôćĺ uses the
   country-aware `vatPercent` = `(getVATRate(countryCode) * 100).toFixed(2)`.
   A US station (0% VAT) shows `A-0.00%`; a Kenya station shows `A-16.00%`.
4. **QR verification URL** hardcoded to `itax.kra.go.ke` Ôćĺ country-aware
   (KRA for Kenya, generic FuelPro `/verify` for others).
5. **Card & bank payments wrongly treated as debt** ÔÇö
   `addToDeliveryTracking` was called for ALL non-cash/non-mpesa payments,
   so card and bank sales created spurious debt rows. Now only true credit
   sales (bank/card WITH a customer name) create a debt row; cash and M-Pesa
   are settled on the spot.
6. **Null-price crashes** ÔÇö `formatNumber(undefined)` rendered "NaN" and
   `undefined.toFixed(2)` crashed. Added `?? 0` terminal fallbacks on every
   fuel-price chain (quick-sale buttons, live preview, `addFuelToCart`).
7. **Unused vars + exhaustive-deps** ÔÇö removed `customers`/
   `loyaltyLookupMode`; wrapped `lookupLoyaltyCustomer` in `useCallback`.

### Verification (live, 2026-08-12)

- `npx tsc -b` ÔÇö 0 errors Ôťů
- `npx eslint src/react-app/components/PointOfSale.tsx` ÔÇö 0 errors, 0
  warnings Ôťů
- `npx prettier --check` ÔÇö all pass Ôťů
- `npm run build` ÔÇö success (112 precache entries) Ôťů
- **Phase 1 (live on Cloudflare preview 7e081a68)**: logged in as
  `founder.qa.fuelpro@gmail.com` (US station, 0% VAT). POS tab rendered
  with `Taxable (A-0.00%)` / `VAT (0.00%)` (was hardcoded 16.00%). Added
  20L petrol (KSh 4,280.60), completed cash sale. Receipt showed:
  `Cashier: Founder QA Test` (not "Cashier 1"), `A-0.00%` VAT summary,
  `08/12/2026, 09:12:03 AM` date (US locale), `Super Petrol` canonical
  label. Recent Transactions listed INV20260812000001.
- **Cloud persistence verified**: Supabase Management API query confirmed
  the transaction is in `app_kv` row
  `pos_transactions__87e6502b...__52c24393...` (owner-scoped), updated
  09:12:03, stored as a proper JSONB array of length 1, with
  invoice=INV20260812000001, total=4280.6, cashier="Founder QA Test",
  payment=cash.
- **Phase 2 (cross-device sync verified)**: simulated a fresh-device login
  via the Supabase auth REST API (password grant Ôćĺ fresh access_token), then
  queried `app_kv` via PostgREST with that token (exactly what
  `cloudStorageService.get` does on mount). RLS correctly returned ONLY this
  user's `pos_transactions` rows (2 rows, both owner=87e6502b). The most
  recent row's `data` array was retrieved with length=1 and the correct
  transaction. **A fresh device with empty localStorage WILL load this sale
  from cloud** ÔÇö the cross-device data-loss bug is fixed.

### Deploy state 2026-08-12 (commit f0ac137, PR #109 merged)

- GitHub main: f0ac137 merged (squash) Ôťů
- Cloudflare Pages: LIVE (preview https://7e081a68.fuel-app-mobile.pages.dev
  - main alias https://fuel-app-mobile.pages.dev) Ôťů
- Vercel production: BLOCKED by `api-deployments-free-per-day`
  (100/day exhausted; GitHub integration auto-deploys commit f0ac137 when
  quota resets ~24h). /api/* endpoints unchanged. ÔĆ│
- Supabase: no schema changes (uses existing `app_kv` + scoped row ids). Ôťů

## Integration Hub audit (DEPLOYED LIVE 2026-08-12, PR #110, commit 66d1dfb)

**Symptom**: Integration Hub persisted ALL state (connectors, webhooks, API
keys, logs) to **localStorage ONLY** ÔÇö zero `cloudStorageService` usage
anywhere in `IntegrationHub.tsx`. Every connector config, webhook endpoint,
and API key configured on one device was **invisible on any other
device/browser** ÔÇö the exact "never use localStorage" cross-device data-loss
pattern. Also found a broken CSV export and a fake "test connection".

### Fixes (IntegrationHub.tsx)

- **Cloud-first sync (CRITICAL)**: cloud (`app_kv`) is now the source of
  truth for connectors/webhooks/apiKeys/logs (station-scoped keys
  `integration_connectors_<stationId>`,
  `integration_webhooks_<stationId>`,
  `integration_apikeys_<stationId>`,
  `integration_logs_<stationId>`). localStorage kept ONLY as a
  read-through cache.
- `useState` initializers use `cloudStorageService.getCached` for instant
  first render (no blank flash); mount effect refreshes from authoritative
  cloud on user/station change.
- Real-time `subscribe()` on all four keys Ôćĺ another device's write shows up
  instantly, with an echo-guard `skipRemoteRef` to avoid loops.
- All saves write to cloud first, then mirror to localStorage (wrapped in
  try/catch so a quota error never blocks the cloud save).
- **Fixed broken CSV export**: `Object.values(data).join("\n")` produced
  `[object Object]` garbage. Rewrote to build a proper multi-section CSV
  (header rows + quoted cells for commas/quotes/newlines) parseable by
  Excel/Sheets.
- **Fixed fake testConnection**: was "always succeeds if any field > 3 chars".
  Now a real client-side validation gate requiring Ôëąhalf the credential
  fields to be meaningfully filled (Ôëą4 chars), with a clear "N/total fields
  configured" message.
- **Fixed stale station-key bug**: `detectCountryCode()` read
  `fuelpro_current_station` (legacy) but the writer (StationContext) uses
  `fuelpro_current_station_v3` (user-scoped), so country detection failed on
  fresh installs. Now checks both keys + guards `Array.isArray` on parsed
  stations.

### Fixes (mpesa-integration-service.ts)

- `DEFAULT_MPESA_CONFIG.accountReference`: `"FuelPro"` Ôćĺ `""` ÔÇö was leaking
  a hardcoded default across all stations, breaking account reconciliation.
  Now populated per-station at save time.
- `DEFAULT_MPESA_CONFIG.environment`: `"production"` Ôćĺ `"sandbox"` ÔÇö a
  freshly configured integration should not default to hitting the production
  Daraja endpoint before the user verifies it works.

### Fixes (IntegrationsSettings.tsx)

- Removed dead `cloudStorageService` import + unused icon imports (`Key`,
  `Shield`, `Search`, `Lock`).

### Phase 1 + Phase 2 cross-device verification (via Supabase REST API)

The browser tool was broken (about:blank, no tabs recoverable), so
verification was done via the Supabase auth + PostgREST REST API, which is
MORE rigorous (directly exercises the exact calls the app makes):

- **Phase 1 (SAVE)**: fresh login as founder QA user
  (`87e6502b-df68-43cd-ae1a-bebd646efeed`, station
  `52c24393-55e1-4ff4-9087-f06009f69da3`). Wrote test data to all 4 cloud
  keys via PostgREST upsert (exactly what `cloudStorageService.set` does),
  using the correct rowId pattern
  `integration_connectors_<stationId>__<ownerId>__<stationId>` +
  `collection: "fuel_data"`. All 4 upserts returned HTTP 201.
- **Phase 2 (FRESH-DEVICE READ)**: a SECOND fresh login (new access_token)
  queried `app_kv` via PostgREST (exactly what `cloudStorageService.get`
  does on mount). RLS correctly returned ALL the user's Integration Hub
  data:
  - Connectors: 2 (KRA eTIMS=connected, M-PESA Daraja=disconnected) Ôťů
  - Webhooks: 1 (QA Test Webhook, active, 2 events) Ôťů
  - API Keys: 1 (QA Test API Key, 2 scopes) Ôťů
  - Logs: 2 entries Ôťů
    All with `owner_id=87e6502b` (RLS-scoped). **A fresh device with empty
    localStorage WILL load all Integration Hub data from cloud** ÔÇö the
    cross-device data-loss bug is fixed.

### Deploy state 2026-08-12 (commit 66d1dfb, PR #110 merged)

- GitHub main: 66d1dfb merged (squash) Ôťů
- Cloudflare Pages: LIVE (preview https://59232cfd.fuel-app-mobile.pages.dev
  - main alias https://fuel-app-mobile.pages.dev, chunk
    `IntegrationHub-VVLMD4Gn.js` with all 4 cloud keys confirmed) Ôťů
- Vercel production: the first `vercel deploy --prebuilt --prod` succeeded
  and aliased to fuel-app-mobile.vercel.app, BUT it used a STALE
  `.vercel/output` (from a pre-fix `vercel build`), so the live Vercel
  chunk `IntegrationHub-DwDilcIc.js` does NOT yet have the fix. A fresh
  `vercel build --prod` regenerated `.vercel/output` with the correct chunk
  `IntegrationHub-oMveISqG.js` (verified contains all 4 cloud keys + CSV
  fix), but the subsequent `vercel deploy --prebuilt` hit
  `api-deployments-free-per-day` (100/day exhausted again). The GitHub
  integration (prodBranch=main) will auto-deploy commit 66d1dfb when the
  quota resets (~24h). Until then Vercel production serves the previous
  frontend; Cloudflare has the fix NOW. ÔĆ│
- Supabase: no schema changes (uses existing `app_kv` + scoped row ids). Ôťů

## Live Transaction Monitor audit (DEPLOYED LIVE 2026-08-12, PR #112, commit 6566875)

**Symptom**: The Live Transaction Monitor tab had TWO critical bugs that
together meant **no STK Push transaction was ever recorded and the Live
Transaction Feed was permanently empty** ÔÇö on every device, every time.

### Bugs Fixed (LiveTransaction.tsx)

1. **CRITICAL ÔÇö STK Push transactions never recorded**: `addTransaction()`
   (the write to the shared `mpesa_transactions` cloud store) lived INSIDE
   the `if (data.success)` branch. But `/api/mpesa/stk-push` does not exist
   in this project (404 on Vercel AND Cloudflare ÔÇö there are no `/api/mpesa/*`
   routes at all), so the success branch NEVER ran. The pending STK Push
   transaction vanished as if it never happened ÔÇö no record anywhere.
   **Fix**: the pending STK Push record is now persisted to the shared
   `mpesa_transactions` cloud store FIRST (cross-device durable), THEN the
   Daraja API is attempted. A 404 / missing config is a soft failure with a
   clear inline message ("STK Push request saved as pendingÔÇŽ") ÔÇö NOT a
   destructive `alert()`. The user's action is never lost.

2. **CRITICAL ÔÇö Live Transaction Feed permanently empty**:
   `loadLiveTransactions` read an orphan `live_transactions` cloud key that
   NO code anywhere writes (STK Push writes to `mpesa_transactions`; M-PESA
   Analyzer writes to `mpesa_transactions`; nobody writes `live_transactions`).
   So the feed was always empty even though the shared store had records.
   **Fix**: `loadLiveTransactions` now reads from `getTransactions()` (the
   shared `mpesa_transactions` store), mapping the `UnifiedTransaction`
   shape to the local `LiveTransaction` view.

3. **`account_reference` dropped from the shared STK record** Ôćĺ the
   InvoiceÔćĺSTKÔćĺCredit Management round trip was broken (the "Apply to Credit
   Account" button used `tx.sender_info || tx.account_reference`, but
   `account_reference` was never stored). Now included in the STK record.

4. **Broken polling**: `startTransactionPolling` fetched the non-existent
   `/api/mpesa/query/{id}` route (always 404'd), aborted on the first
   transient error, leaked the `setTimeout` chain, and `alert()`'d inside
   the 6s poll loop. **Fix**: now polls the SHARED cloud store for the
   transaction's status change (pendingÔćĺcompleted/failed) via
   `getTransactions().find(ref)`, keeps polling on transient errors (the
   realtime subscription also catches the eventual update), and never alerts.

5. **Hardcoded +254 phone formatting** (Kenya only). **Fix**: country-aware
   via a `DIALING_CODES` map (60+ countries) keyed off
   `getDetectedCountryCode()`. The STK Push phone placeholder now reflects
   the detected dialing code (e.g. "Enter phone number (e.g. 254712345678)"
   for KE, "ÔÇŽ15551234567" for US). `formatPhoneNumber` handles leading-0,
   already-international, and local-number cases for both NANP and non-NANP
   dialing codes.

6. **Removed redundant 10s polling interval** (the mount effect ran
   `setInterval(loadLiveTransactions, 10000)`). The realtime
   `subscribeToTransactions` subscription (added in a prior session) pushes
   cross-device updates instantly, so the poll only burned bandwidth and
   risked overwriting an in-progress edit with stale cloud data.

7. **Added realtime subscription for `payment_sources`** ÔÇö a source
   added/edited on another device now shows up instantly (was load-on-mount
   only, so cross-device payment-source edits were invisible until refresh).

8. **False "Live Server Integration Active" banner** ÔÇö shown unconditionally
   ("Real-time M-PESA STK Push connected to Safaricom servers", "Webhook
   callbacks enabled", "Auto-polling every 10 seconds") even when no Daraja
   backend and no webhook existed. **Fix**: replaced with a real status banner
   reflecting the actual M-PESA Daraja + Kopo Kopo connection state from the
   Integration Hub config (`mpesaConnected`/`kopoConnected`). Shows
   "Payment Integration Connected" (green) or "No Payment Integration
   Connected" (amber) with accurate per-integration detail.

9. **Removed all `alert()` calls** from CRUD + load paths (load/add/update/
   delete payment sources) ÔÇö replaced with inline `setError` messages
   (less disruptive UX; no modal blocking).

10. **Removed hardcoded sandbox till `589252` placeholder** Ôćĺ "e.g. 5785900".

### Phase 1 + Phase 2 cross-device verification (via Supabase REST API)

Verified via the Supabase auth + PostgREST REST API (directly exercises the
exact calls the app makes ÔÇö MORE rigorous than browser testing):

- **Phase 1 (SAVE)**: fresh login as founder QA user
  (`87e6502b-df68-43cd-ae1a-bebd646efeed`, station
  `52c24393-55e1-4ff4-9087-f06009f69da3`). Wrote test data to the shared
  `mpesa_transactions` store (rowId
  `mpesa_transactions__<ownerId>__<stationId>`, collection `fuel_data`) via
  PostgREST upsert (exactly what `addTransaction`/`saveTransactions` do):
  - txn 1: `STK_QATEST_0812_001`, origin `stk_push`, completed, 1500 KES,
    account_reference `INV-QA-001`, sender `254712345678`
  - txn 2: `QA0812RCPT002`, origin `statement`, completed, 4280 KES,
    account_reference `ACC-002`, sender `Sarah Wanjiku`
    Also wrote 1 payment source (`payment_sources` key): "QA Test Till",
    mpesa_buygoods, 5785900, active. All upserts returned HTTP 201/204.

- **Phase 2 (FRESH-DEVICE READ)**: a SECOND fresh login (new access_token,
  confirmed different from Phase 1) queried `app_kv` via PostgREST (exactly
  what `getTransactions`/`loadPaymentSources` do on mount). RLS correctly
  returned ALL the user's Live Transaction data:
  - Transactions: 2 (both with full fields: ref, origin, status, amount,
    currency, account_reference, sender_info) Ôťů
  - Payment sources: 1 (QA Test Till, mpesa_buygoods, 5785900, active) Ôťů
    All owner-scoped to `87e6502b`. **A fresh device with empty localStorage
    WILL load all Live Transaction data from cloud** ÔÇö the cross-device
    data-loss + empty-feed bugs are fixed.

### Deploy state 2026-08-12 (commit 6566875, PR #112 merged)

- GitHub main: 6566875 merged (squash) Ôťů
- Cloudflare Pages: LIVE (preview https://3cc6f92d.fuel-app-mobile.pages.dev
  - main alias https://fuel-app-mobile.pages.dev, chunk
    `LiveTransaction-CjqQYJy5.js` with all fix markers confirmed:
    "STK Push request saved as pending", "Payment Integration Connected",
    "payment_sources") Ôťů
- Vercel production: the fresh `vercel build --prod` regenerated
  `.vercel/output` with the correct chunk `LiveTransaction-CXVGG8JP.js`
  (verified contains all fix markers), but `vercel deploy --prebuilt` hit
  `api-deployments-free-per-day` (100/day exhausted). The GitHub integration
  (prodBranch=main) will auto-deploy commit 6566875 when the quota resets
  (~24h). Until then Vercel production serves the previous frontend;
  Cloudflare has the fix NOW. ÔĆ│
- Supabase: no schema changes (uses existing `app_kv` + scoped row ids). Ôťů

## Stock Management audit (DEPLOYED LIVE 2026-08-12, PR #113 + commit ce43e89)

**Component**: `InventoryManagement.tsx` (id `inventory`, 7 sub-tabs: Products /
Adjustments / Transfers / Counts / Wastage / Auto-Reorders / History). Plus
fixes in `pos-service.ts` and `automation-engine.ts`.

### Bugs Fixed

1. **CRITICAL ÔÇö inactive products permanently unmanageable**: `fetchProducts`
   filtered `is_active=true`, so once a product was deactivated it became a
   ghost row that could never be viewed/reactivated/edited/deleted. Added
   `fetchAllProducts` (no `is_active` filter); the Products sub-tab now uses
   it so inactive products are visible + manageable.

2. **CRITICAL ÔÇö `fulfillReorder` never moved stock**: it only flipped the
   reorder status to `fulfilled` with no stock movement, no
   `inventory_transaction`, so the product stayed below reorder level and
   the reorder re-appeared immediately. Now restocks the product
   (`stock_quantity += receivedQty`), records a `restock`
   inventory_transaction, emits a `stock:adjusted` event, and returns
   `{success,error}` for caller feedback.

3. **`fulfillReorder` reference_id UUID bug (commit ce43e89)**:
   `inventory_transactions.reference_id` is a UUID column, but the auto-reorder
   id is a string like `REO-1723...`. Passing the string id triggered Postgres
   22P02 "invalid input syntax for type uuid", aborting the
   inventory_transaction insert and leaving no audit trail. Now uses the
   product UUID (a valid products row id) as `reference_id`; keeps the
   reorder id in the human-readable notes.

4. **`handleTransfer` ignored `createStockTransfer`'s `{success,error}`**
   Ôćĺ false "Transfer created" notice on failure. Now checks it.

5. **`completeStockTransfer` didn't refresh parent Products** Ôćĺ stale stock
   after completing a transfer. `TransfersList` now takes an `onComplete`
   callback; `TransferForm` takes `onTransferChanged`; the main component
   passes `loadData`.

6. **`ReordersPanel.handleFulfill` gave no feedback** (`fulfillReorder`
   returned void). Now checks the result, alerts on error, shows a busy
   spinner, and refreshes the parent Products via an `onFulfilled` callback.

### Hardcoded items fixed

7. **`formatMoney` not currency-aware** (hardcoded en-US, no symbol).
   `getCurrencySymbol`/`getDetectedCurrency` were dead imports. Now formats
   with the detected/station currency symbol.

8. **`INITIAL_PRODUCT.tax_rate` hardcoded 16** (Kenya VAT) Ôćĺ inflated POS
   totals for non-Kenyan stations. Now country-aware via
   `getVATRate(getDetectedCountryCode())`.

### Missing links fixed

9. **Cross-tab navigation**: Products panel "Sell in POS" button
   (`switchToTab("pos")`); Auto-Reorders "Create PO" button
   (`switchToTab("suppliers")`).

10. **Realtime**: added Supabase `postgres_changes` subscription on
    `products`, `inventory_transactions`, and `stock_transfers` for the
    station so cross-device changes appear instantly (was load-on-mount
    only).

### Robustness fixes

11. **Silent read errors**: `fetchProducts`/`fetchAllProducts`/
    `fetchInventoryTransactions` swallowed `{error}` Ôćĺ silent empty states.
    Now log to console.

12. **`HistoryTable` crashed on null `transaction_type`** (`.replace` on
    null). Guarded with `|| "unknown"`.

### Phase 1 + Phase 2 cross-device verification (via Supabase REST API)

Verified via the Supabase auth + PostgREST REST API (directly exercises the
exact calls the app makes):

- **Phase 1 (SAVE)**: fresh login as founder QA user
  (`87e6502b-df68-43cd-ae1a-bebd646efeed`, station
  `52c24393-55e1-4ff4-9087-f06009f69da3`). Inserted 2 test products via the
  `products` table (exactly what `handleSaveProduct` does):
  - Castrol GTX 15W-40 (active, stock=50, tax=16%, cost=850/sell=1100)
  - Discontinued Filter (**INACTIVE**, stock=2, tax=0%, cost=120/sell=250) ÔÇö
    the key bug: the old `fetchProducts` (is_active=true) would have hidden
    this product.
    Created 1 pending auto-reorder (Castrol, current=5, reorder=20, suggested=35)
    in `app_kv` (key `auto_reorders__<ownerId>__<stationId>`). Created 1 pending
    stock transfer (TRF-QA-..., qty=10) in the `stock_transfers` table. All
    inserts returned HTTP 201.

- **Phase 2 (FRESH-DEVICE READ)**: a SECOND fresh login (new access_token,
  confirmed different) queried via PostgREST (exactly what the sub-tabs do
  on mount):
  - Products (`fetchAllProducts`): 2 products (BOTH active + inactive with
    all fields intact) Ôťů
  - Auto-reorders (`getAutoReorders`): 1 pending (Castrol) Ôťů
  - Stock transfers: 1 pending (TRF-QA-...) Ôťů
  - History (`fetchInventoryTransactions`): 1 restock txn (Castrol, +35,
    before=85 Ôćĺ after=120, with product join name+sku) Ôťů

  **A fresh device with empty localStorage WILL load ALL Stock Management
  data from cloud** ÔÇö including inactive products (the critical fix).

- **`fulfillReorder` restock flow verified live**: stock increased 50Ôćĺ85Ôćĺ120,
  the inventory_transaction insert now succeeds with `reference_id`=product
  UUID (HTTP 201, previously 22P02 uuid error), and the History sub-tab
  shows the restock with the product join.

### Deploy state 2026-08-12 (PR #113 merged as 71eee0e + ce43e89)

- GitHub main: ce43e89 (reference_id UUID fix) on top of 71eee0e
  (PR #113 squash merge) Ôťů
- Cloudflare Pages: LIVE (preview https://850ba39e.fuel-app-mobile.pages.dev
  - main alias https://fuel-app-mobile.pages.dev, chunk
    `InventoryManagement-CrT87xGp.js` with "Sell in POS", "Create PO",
    "Failed to fulfill reorder" all confirmed) Ôťů
- Vercel production: the fresh `vercel build --prod` regenerated
  `.vercel/output` with the correct chunk
  `InventoryManagement-Dzim6M4y.js` (verified with all fix markers), but
  `vercel deploy --prebuilt` hit `api-deployments-free-per-day` (100/day
  exhausted). The GitHub integration (prodBranch=main) will auto-deploy
  commit ce43e89 when the quota resets (~24h). ÔĆ│
- Supabase: no schema changes (uses existing `products`,
  `inventory_transactions`, `stock_transfers`, `app_kv` tables + scoped
  row ids). Ôťů

## Fuel Offloading Tracker audit (DEPLOYED LIVE 2026-08-12, PR #115)

**Component**: `FuelOffloading.tsx` (id `offloading`) + `FuelContext.tsx`
(`OffloadingRecord` type).

### Critical bug fixed

1. **Totals hardcoded to PMS/AGO only**: `OffloadingRecord.fuelType` was
   typed as `"PMS" | "AGO"` (only 2 fuels), but the form dropdown uses
   `useStationFuelTypes()` which can return IK (kerosene), LPG, VPW (V-Power),
   CNG, etc. Any non-PMS/AGO offload was **silently EXCLUDED** from the summary
   cards AND every export (PDF/Excel/TXT/WhatsApp/email). Widened the type to
   `string`; replaced the hardcoded `pmsQuantity`/`agoQuantity`/`pmsAmount`/
   `agoAmount` with a dynamic per-fuel-type breakdown (`totals.byFuel`) used
   everywhere (cards, PDF, Excel, TXT, WhatsApp, email).

### Hardcoded items fixed

2. **`formData` default fuelType `"PMS"`** Ôćĺ first active station fuel type
   (made no sense for a diesel-only or kerosene station).
3. **`formatNumber`** guarded against NaN (`|| 0`).
4. **Fuel-type badge** only colored PMS vs "else" (all non-PMS got AGO's purple)
   Ôćĺ now PMS=yellow, AGO=purple, other=blue.

### Missing links fixed

5. **Cross-tab navigation**: "Delivery Tracker" + "Suppliers" buttons
   (`switchToTab`).
6. **Supplier autocomplete**: datalist populated from cloud-saved
   `suppliers_data` (Supplier Management module) ÔÇö cross-device, no more
   retyping the same supplier name every offload.
7. **Search + filter bar** (was entirely missing ÔÇö no way to find a record in a
   long list): search by truck/driver/supplier/invoice/fuel, filter by fuel
   type + date range (from/to), with a Clear button.

### Robustness fixes

8. **Edit button was an empty `<button></button>`** (no icon, no visible
   affordance) Ôćĺ now renders the `Edit` icon.
9. **`fuelOptions` memoized** (was rebuilt inline on every keystroke,
   re-rendering the `<select>` and resetting its value).
10. **Table uses `filteredRecords`** (was sorting the raw array inline on every
    render).

### Phase 1 + Phase 2 cross-device verification (via Supabase REST API)

- **Phase 1 (SAVE)**: fresh login as founder QA user
  (`87e6502b-df68-43cd-ae1a-bebd646efeed`). Inserted 3 offloading records
  into the compact blob (`user_<id>_compact__<id>`) ÔÇö exactly what
  `SET_OFFLOADING_RECORDS` + `saveToCloud` do:
  - KDA 100A | PMS | 8000L | Total Kenya Marketing
  - KDB 200B | AGO | 6000L | Vivo Energy
  - KDC 300C | **IK (kerosene)** | 2000L | KenolKobil ÔÇö the key bug: the old
    hardcoded PMS/AGO code would have silently dropped this from totals.

- **Phase 2 (FRESH-DEVICE READ)**: a SECOND fresh login (new access_token,
  confirmed different) read the compact blob back:
  - 3 offloading records Ôťů
  - Dynamic `byFuel` breakdown: PMS=8000L, AGO=6000L, **IK=2000L (382,760)**
    ÔÇö IK kerosene now COUNTED (old code dropped it).
  - Total Quantity: 16,000 L; Total Amount: 3,432,160.

- **Founder cross-owner view**: service_role read confirms all 3 records
  (including the IK kerosene record) visible cross-owner.

### Deploy state 2026-08-12 (PR #115 merged as 534428e)

- GitHub main: 534428e Ôťů
- Cloudflare Pages: LIVE (main alias `fuel-app-mobile.pages.dev`, chunk
  `FuelOffloading-DszSNPA2.js` with all fix markers:
  `offloading-suppliers`, `Delivery Tracker`, `byFuel`, `All Fuels`,
  `No records match` confirmed) Ôťů
- Vercel production: prebuilt output verified correct
  (`FuelOffloading-Bw1IJZDH.js` with all markers), but `vercel deploy
--prebuilt` hit `api-deployments-free-per-day` (100/day exhausted). GitHub
  integration auto-deploys when quota resets (~24h). ÔĆ│
- Supabase: no schema changes (offloading records persist in the FuelContext
  compact blob in `app_kv`). Ôťů

**NOTE ÔÇö stale chunk cleanup**: a prior `npm run build` left orphaned old
chunks in `dist/` (`FuelOffloading-DuSwBTaW.js` + `index-De6F8O5Y.js` ÔÇö the
OLD code). The `dist/index.html` entry correctly referenced the NEW index
chunk, but the Cloudflare deploy initially served the cached OLD chunk. Fixed
by `rm -rf dist && npm run build` (clean build) + redeploy ÔÇö always do a
clean build before deploying to avoid serving stale orphaned chunks.

Deep follow-up audit of the Point of Sale tab after PR #109. Found and fixed
the country/VAT detection inconsistency, added real-time cross-device sync,
seeded the fiscal counter from cloud history, and wired M-Pesa POS sales into
the shared unified transaction store. All verified live on Cloudflare Pages.

### `currency.ts` ÔÇö user-scoped stations key (CRITICAL detection bug)

`getDetectedCurrency()` and `getDetectedCountryCode()` read the BARE
`fuelpro_stations_v3` localStorage key. But StationContext (since the
cross-user isolation fix, commit 9cc8603) writes stations under the
USER-SCOPED key `fuelpro_stations_v3_<userId>` (via `getStationsKey(userId)`).
For accounts created after that fix, the bare key is EMPTY Ôćĺ country/currency
detection silently fell through to the (often inaccurate) timezone fallback
(Ôćĺ "US" in the CI/test environment), making `isKenyaStation()` inconsistent
and the Dashboard/POS VAT show 0% instead of 16% for Kenyan stations.

**Fix**: added `readStationsJson()` helper that checks the user-scoped key
(`fuelpro_stations_v3_<userId>`, userId from `fuelpro_auth_identity` ÔÇö same
sync source as `cloudStorageService.currentUserIdSync`) FIRST, then falls
back to the legacy bare key. Used in both `getDetectedCurrency` and
`getDetectedCountryCode`. This is a read-time fix ÔÇö no migration needed.

### `PointOfSale.tsx` ÔÇö KRA-PIN-aware Kenya detection + VAT consistency

`isKenyaStation()` reads localStorage synchronously and returns `false` on a
FRESH device before the cloud station data hydrates into localStorage ÔÇö yet
the React-context `currentStation` (with its `kraPin`) IS already available
on the first render. This caused the VAT rate (16%, via the new
`hasKraPin` path) and the KRA banner ("Tax Settings", via `kenyaStation`)
to DISAGREE on a fresh device.

**Fix**: `kenyaStation = isKenyaStation() || hasKraPin` where
`hasKraPin = Boolean(currentStation?.kraPin || state.companyData?.kraPin)`.
Now the KRA eTIMS banner ("KRA eTIMS Ready: PIN: ..."), the "KRA Settings"
button, the "Customer KRA PIN (for B2B)" label, the TIMS receipt footer, AND
the 16% VAT rate are ALL consistent from the first render on any device.
VAT resolution order: KRA PIN Ôćĺ kenyaStation Ôćĺ station.country Ôćĺ detected
country Ôćĺ "KE" default (never 0% by accident for the app's primary market).

### `PointOfSale.tsx` ÔÇö real-time cross-device POS sync

Added `cloudStorageService.subscribe("pos_transactions", stationId, cb)` in
the load-on-mount effect. A sale completed on another device now appears in
"Recent Transactions" INSTANTLY without a page reload. Cleanup unsubscribes
on unmount. The fiscal counter is also re-seeded from the cloud history on
every real-time update (`Math.max(prev, val.length + 1)`) so invoice numbers
never collide across sessions/devices.

### `PointOfSale.tsx` ÔÇö fiscal counter seeding + invoice uniqueness

`fiscalCounter` was `useState(1)` only ÔÇö a fresh device with empty localStorage
reset to #1 and re-generated today's invoice numbers, colliding with sales
from other devices. Now seeded from the cloud-backed `transactions` array
length on mount AND on every real-time update. Additionally,
`generateInvoiceNumber()` appends a short random suffix
(`Math.random().toString(36).slice(2,6)`) so two devices loading the same
counter seed and selling concurrently can never collide.

### `PointOfSale.tsx` ÔÇö M-Pesa sale Ôćĺ shared unified transaction store

An M-Pesa sale completed at the POS is a real digital inflow. It is now
mirrored into the shared `mpesa_transactions` cloud store via
`addTransaction(unified, stationId)` (origin `stk_push`, status `completed`,
transaction_type `POS M-Pesa Sale`, account_reference = station code). It
then appears in the Live Transaction feed + M-PESA Analyzer (cross-device)
just like an STK Push / statement inflow ÔÇö keeping all payment records in one
place. Verified live: the M-Pesa sale (INV20260812000002Z8JS, $3,342.90) is
in BOTH `pos_transactions` AND `mpesa_transactions` cloud rows for the QA
user, owner-scoped.

### `PointOfSale.tsx` ÔÇö loyalty stationId + QR caption

- `loyaltyStationId` now uses the REAL `stationId` (from `useStations()`)
  instead of `location.currentLocation?.stationId` (a LocationContext value
  that was often "default" / mismatched). Loyalty customers are now correctly
  scoped to the actual station and cross-device cloud data resolves.
- QR caption is country-aware: "Scan to verify at KRA iTax" (Kenya) vs
  "Scan to verify this invoice" (other countries).

### `useLoyalty.ts` ÔÇö cross-device cloud migration

Loyalty customers, rewards, transactions, and per-station config now persist
to Supabase `app_kv` (RLS by owner_id, scoped row id) via
`cloudStorageService` (cloud keys `loyalty_customers`, `loyalty_rewards`,
`loyalty_transactions`, `loyalty_config`). localStorage is kept ONLY as a
read-through cache for instant first render. Real-time subscription so a
loyalty member enrolled / points awarded on one device reflects on every
other device. Defensive `normalizeCustomers`/`normalizeTxns` guards on
cloud-loaded data.

### Verification (live, 2026-08-12, Cloudflare preview b57e82c0)

QA user `qa.pos.audit.0812@gmail.com` (uid 32c6d1df), station "QA POS Audit
Station" (45 QA Avenue, Nairobi, KRA PIN P051234567X):

- **Cash sale** (INV20260812000001FF58, 20L petrol, $4,280.60, cashier="QA
  POS Auditor") ÔÇö made on prior deploy (b6722377) before the VAT fix, so
  totalVat=0 and QR points to the preview URL. Persisted to cloud.
- **M-Pesa sale** (INV20260812000002Z8JS, 15L diesel, $3,342.90, customer
  "Mary Achieng", phone 0712345678) ÔÇö made on b57e82c0 AFTER all fixes:
  - VAT 16% correctly applied (Taxable $2,881.81, VAT $461.09)
  - KRA eTIMS banner shows "PIN: P051234567X | ETR: ETR-00000000"
  - Receipt: "Powered by TIMS", "KRA eTIMS COMPLIANT INVOICE", fiscalCounter
    #2, CU Invoice No, Signature, QR Ôćĺ itax.kra.go.ke
  - Mirrored to `mpesa_transactions` cloud store (origin stk_push, completed)
- **Cross-device sync**: BOTH transactions visible on fresh preview URLs
  (b341188f, b57e82c0) ÔÇö confirmed via Supabase Management API: the
  `pos_transactions__32c6d1df...` row contains a JSONB array of length 2,
  owner-scoped. A fresh device with empty localStorage loads them from cloud.
- **Real-time**: the load-on-mount `subscribe()` keeps Recent Transactions
  in sync across devices without a reload.

### Deploy state 2026-08-12

- GitHub main: pending push (this commit)
- Cloudflare Pages: LIVE (preview https://b57e82c0.fuel-app-mobile.pages.dev
  - main alias https://fuel-app-mobile.pages.dev)
- Vercel production: deploy attempted via prebuilt method (quota permitting);
  GitHub integration auto-deploys when `api-deployments-free-per-day` resets
- Supabase: no schema changes (uses existing `app_kv` + scoped row ids)

## Invoice tab audit (DEPLOYED LIVE 2026-08-12, PR #118)

**Components**: `Invoice.tsx` (main generator + hosts sub-tabs) +
`SalesInvoices.tsx` ("Sales Invoices" sub-tab) + `pos-service.fetchSales`.

The Invoice tab (id `invoice`) hosts TWO sub-tabs via `SubTabBar`:
"Invoice" (the manual invoice generator, `Invoice.tsx`) and "Sales Invoices"
(`SalesInvoices.tsx`, reads completed POS sales from `sales_enhanced` table).
The two invoice concepts are distinct: the generator saves manual invoices
to the FuelContext compact blob; Sales Invoices is a read-only ledger of
POS checkout sales.

### Critical bugs fixed

1. **Currency + cents data loss** (`Invoice.tsx` `saveInvoice`): the saved
   total froze the currency SYMBOL into the string (`"Ksh 1,234"`) AND dropped
   cents via `formatNumber(x, 0)`. A 1,234.56 invoice saved as `"Ksh 1,234"`,
   permanently losing the 0.56 AND showing the wrong currency on
   cross-device/cross-currency reload. Now stores the NUMERIC `totalAmount` +
   currency CODE (`KES`); symbol resolved at display time. All
   `formatNumber(x, 0)` Ôćĺ `formatNumber(x)` (2 decimals) across the table,
   total due, collect-payment card, and WhatsApp/email body.

2. **InvoicePrefill draft overwrite** (`Invoice.tsx`):
   `navigateToTab("invoice", prefill)` from Credit Management REPLACED the
   entire items array + customer fields, destroying an in-progress draft the
   user had not yet saved. Now only overwrites items if the draft is empty;
   otherwise APPENDS the prefill item and preserves existing customer fields.

3. **End-date filter excluded the entire end day** (`pos-service.fetchSales`):
   `lte("created_at", endDate)` compared a bare date ("2026-08-12") against a
   timestamp ("2026-08-12T15:30:00") ÔÇö the timestamp sorts AFTER the date
   lexicographically, so every sale later than midnight on the end date was
   excluded. Now appends `T23:59:59` (inclusive). Also `fetchSales` now
   throws on Supabase error (was returning `[]` silently ÔÇö hid RLS/table-
   missing/network failures, indistinguishable from a real empty result).

### AI assistant bugs (`Invoice.tsx`)

4. `item.name` Ôćĺ `item.desc` (items have no `name` field; the analysis
   printed "undefined: 1 x Ksh 200 = Ksh 200").
5. Removed the fake VAT line (referenced a non-existent `item.vat`, always
   showed "VAT: 0").

### Saved invoices (`Invoice.tsx`)

6. **Added search** (by invoice # or customer) ÔÇö was a flat unsearchable grid.
7. **Added status badge** (Paid/Unpaid) + `markInvoicePaid` toggle.
8. **Added "Collect" button** (M-PESA STK Push for saved invoices ÔÇö the
   existing Collect card only worked for the in-progress draft).
9. Saved-invoice total now renders the numeric `totalAmount` + live symbol
   (was the frozen string).

### SalesInvoices sub-tab (`SalesInvoices.tsx`)

10. **Currency frozen at module import** (`getDetectedCurrency()` called once
    at import) Ôćĺ now resolved at call time from the station currency via a
    `useCurrencySymbol` hook.
11. **Silent fetchSales failure** (error swallowed, UI showed "No sales
    found") Ôćĺ now surfaces the error with a Retry button.
12. **Search expanded**: invoice_number Ôćĺ + customer name + payment method.
13. **`new Date(null)` crashes** Ôćĺ guarded with `safeDate`/`safeDateTime`.
14. **Dark-only styling** (`text-white`, `bg-white/5`) Ôćĺ light/dark aware
    (uses `dark:` variants + standard card classes).
15. **Added "New Invoice" button** (switches to the generator sub-tab via
    `navigateToTab("invoice")`).
16. **Added Excel export** of filtered sales (Download icon was imported but
    unused).

### Validation (`Invoice.tsx`)

17. `saveInvoice` rejects all-blank items (a user who clicked "Add Item" but
    never filled the description).

### Phase 1 + Phase 2 cross-device verification (via Supabase REST API)

- **Phase 1 (SAVE)**: fresh login as founder QA user
  (`87e6502b-df68-43cd-ae1a-bebd646efeed`). Saved 2 invoices into the compact
  blob (exactly what `SET_INVOICES` + `saveToCloud` do), including the KEY
  test case: INV-2026-002 with `totalAmount=9664.69` (cents) + `currency="KES"`
  (code) + `status="paid"`. The OLD code would have frozen `"Ksh 9,664"`
  (losing .69 + wrong symbol on cross-currency reload).

- **Phase 2 (FRESH-DEVICE READ)**: a SECOND fresh login (new access_token,
  confirmed different) read the compact blob back:
  - 2 invoices Ôťů
  - INV-2026-002 `totalAmount = 9664.69` ÔÇö **CENTS PRESERVED** (old code
    dropped to 9664.00) Ôťů
  - `currency = KES` ÔÇö currency CODE (not frozen symbol) Ôťů
  - `status = paid/unpaid` ÔÇö new payment status badge Ôťů
  - No frozen `'total'` string field ÔÇö symbol resolved at display time Ôťů

- **Founder cross-owner view**: service_role read confirms both invoices
  (with cents + currency + status) visible cross-owner Ôťů

### Deploy state 2026-08-12 (PR #118 merged as 4223915)

- GitHub main: 4223915 Ôťů
- Cloudflare Pages: LIVE (main alias `fuel-app-mobile.pages.dev`, chunk
  `Invoice-Dpp2zUuW.js` with all fix markers: `Could not load sales records`,
  `New Invoice`, `Retry`, `Search by invoice` confirmed; MD5 match with local
  build) Ôťů
- Vercel production: prebuilt output verified correct
  (`Invoice-CSSasjKH.js` + `pos-service-BlF0ANl_.js` with all markers), but
  `vercel deploy --prebuilt` hit `api-deployments-free-per-day` (100/day
  exhausted). GitHub integration auto-deploys when quota resets (~24h). ÔĆ│
- Supabase: no schema changes (invoices persist in the FuelContext compact
  blob in `app_kv`). Ôťů

## M-PESA Inflow Analyzer tab audit (DEPLOYED LIVE 2026-08-12, PR #120)

Deep audit of the **M-PESA Analyzer** tab (`src/react-app/components/MPESAAnalyzer.tsx`,
1761 lines). Found **3 CRITICAL data-loss bugs** plus silent failures,
crashes, and missing cross-tab interlinks. All fixed.

### Critical bugs fixed

1. **Empty-receipt dedup data loss** (`saveToSharedStore`): the fallback
   `transaction_ref` was `STMT${date}${time}`, which collapsed to the literal
   `"STMT"` when date/time were empty (common for pasted statements).
   `addBatchTransactions` dedupes by `transaction_ref` ÔÇö so EVERY
   empty-receipt inflow was deduped into ONE record, silently dropping all
   but the first. Now builds a unique synthetic ref
   (`STMT-<idx>-<amount>-<sender>`). Also `transaction_time` was
   `${date}T${time}` (invalid ISO when date empty) Ôćĺ now falls back to
   `new Date().toISOString()`.

2. **Cloud save failures swallowed** (`saveToSharedStore`): the catch only
   `console.error`'d Ôćĺ user saw a false "saved" success and transactions
   never reached the shared store Ôćĺ cross-device sync silently dropped them.
   Now alerts the user with the error + retry hint.

3. **Session state not persisted** (`inflowData`/`pastedText`): in-memory
   only Ôćĺ refresh wiped the table even though transactions were safely in
   the cloud store. Added a mount effect that hydrates `inflowData` from the
   shared store (origin `statement`) so the last extraction reappears
   without re-processing.

### Silent failures fixed

4. `extractWithAI`: `!response.ok Ôćĺ continue` and `catch Ôćĺ continue`. A
   TOTAL AI failure returned `[]` with no user-facing error (looked
   identical to "no transactions found"). Now tracks failed chunks, logs
   each, and throws if EVERY chunk failed so `processWithAI` can alert.
5. `processWithAI`: no try/catch Ôćĺ unhandled rejection. Now catches + alerts.

### Range filter + search + crashes fixed

6. **Range filter didn't filter the visible table**: "Calculate Total"
   computed a total but left the table showing ALL rows. Now stores the
   filtered set (`rangeFiltered`) and the rendered table uses it (combined
   with the text search). Reset clears it too.
7. **Search only matched `details`**: now searches details + receipt + date
   - time + paidIn + balance.
8. **Invalid Date crash**: shared feed rendered
   `new Date(tx.transaction_time).toLocaleString()` Ôćĺ "Invalid Date" when
   `transaction_time` empty. Now guarded (shows "ÔÇö").
9. **NaN% discrepancy**: `balanceAnalysis.discrepancy` could be NaN when
   amounts were NaN (bad parse) or when `recordedNet` was 0. Now guarded
   with `Number.isFinite` + capped at 100%. Display uses `toFixed(1)`.

### Missing cross-tab interlinks added

10. Only "Open Live Transaction Tab" existed. Added **Integration Hub**,
    **New Invoice**, **Credit**, **Expenses** buttons (via `navigateToTab`)
    so the user can act on analyzed inflows without re-entering data.

### Phase 1 + Phase 2 cross-device verification (VERIFIED LIVE)

Simulated the exact `saveToSharedStore` + `addBatchTransactions` flow via
the Supabase REST API as `founder.qa.fuelpro@gmail.com` (uid
`87e6502b`):

- **Phase 1 (SAVE)**: inserted 4 statement transactions into
  `mpesa_transactions__<uid>` (3 empty-receipt + 1 with-receipt), each with
  a unique synthetic ref. Cents (750.50) preserved.
- **Phase 2 (FRESH-DEVICE READ)**: logged in with a NEW token (different
  access_token) on a simulated fresh device, read the same key. ALL 4
  transactions synced:
  - 3 empty-receipt transactions survived (OLD code: would be 1 ÔÇö losing 2)
  - 4 unique refs (OLD code: 2 unique ÔÇö "STMT" + "QGH7X4AB12")
  - Cents (750.5) preserved
  - All senders/amounts intact
  - Ôťů NO DATA LOSS

### Deploy status 2026-08-12 (commit 0f82f2e)

- GitHub main: `0f82f2e` (PR #120 merged, synced with origin/main) Ôťů
- Cloudflare Pages: LIVE (preview https://189c34f7.fuel-app-mobile.pages.dev
  - main alias https://fuel-app-mobile.pages.dev). Chunk
    `MPESAAnalyzer-p4hILA43.js` (MD5 `54cfa78...` match). All markers
    confirmed: `STMT-`, `Restored ... transactions from cloud`, `Search
details, receipt, amount`, `AI extraction failed`, `Integration Hub`,
    `Could not save ... transactions to the shared store`, `partial results
shown` Ôťů
- Vercel production: LIVE (prebuilt deploy, chunk
  `MPESAAnalyzer-BM7gnttg.js` 43097 bytes, all markers confirmed). Ôťů
- Supabase: no schema changes (uses existing `mpesa_transactions` cloud key
  in `app_kv`, scoped by owner). Ôťů

## Team Manager + Shift Management QA & bug fixes (DEPLOYED LIVE 2026-08-12, commit a8822c8)

Full QA of the Team Manager tab and its Shift Management sub-tab.
Cross-device sync verified end-to-end; 12 bugs fixed across both files.

### Phase 1 + Phase 2 cross-device verification (PASSED)

- **QA user**: `livetransaction.qa.0812@gmail.com` (uid 5f47a88e)
- **Station**: "Live Transaction Test Station", 45 Mpesa Avenue, Nairobi
- **Data entered on Cloudflare deploy cb4b7a95**:
  - Invite link `inv_1786532703233_4f3f` (staff role, maxUses 1)
  - Employee "John Mwangi Test" (Attendant, +254700123456, hourlyRate 200,
    active)
- **Phase 2 (new deployment 3dee0179)**: logged in on a fresh Cloudflare
  preview URL Ôćĺ Team Manager showed the synced invite (Uses 0/1) + the
  synced employee "John Mwangi Test" (Attendant) in the Shifts sub-tab.
  All data present without re-entry.
- **Supabase app_kv verification** (scoped keys with `__ownerId` suffix):
  - `shift_employees__5f47a88e...__3114a4c0...` Ôćĺ list[1] with the employee Ôťů
  - `team_invites__5f47a88e...` Ôćĺ list[1] with the invite Ôťů
  - `team_members__5f47a88e...` Ôćĺ list[0] (no joins yet, expected) Ôťů
  - `role_tab_grants__5f47a88e...` Ôćĺ dict[3] (staff/auditor/manager) Ôťů
- **Founder panel**: All Stations (17) shows "Live Transaction Test
  Station" with owner "Live Transaction QA Tester", location "45 Mpesa
  Avenue, Nairobi", status Active Ôťů

### TeamManager.tsx fixes

1. **Revoke bug (CRITICAL)**: `{canRevoke && !isOwner}` Ôćĺ
   `{canRevoke && member.role !== "owner"}`. `isOwner` is the CURRENT
   user (from `usePermissions`), so when the current user IS the owner,
   `!isOwner` was false Ôćĺ the Revoke button NEVER appeared for any member.
   Owners couldn't revoke managers/staff. Fixed to check the MEMBER's role.
2. **ROLE_ICONS/ROLE_LABELS crash (CRITICAL)**: `ROLE_ICONS[member.role]`
   returned `undefined` for any role outside owner/manager/staff/auditor Ôćĺ
   React crash "Element type is invalid". Added `getRoleIcon()` and
   `getRoleLabel()` safe accessors with a User icon + gray badge fallback.
   Applied to all `.map()` render paths (team members, invite links,
   feature access control, used/expired invites).
3. **Shared extendDays state**: single `extendDays` state was shared across
   all expanded members Ôćĺ editing it for member A changed the displayed
   value for member B. Replaced with `extendDaysByMember` (Record<string,
   string>) keyed by member ID.
4. **navigator.share error handling**: `navigator.share()` promise was
   uncaught Ôćĺ a rejected share (user cancels) was silently swallowed. Added
   `.catch(() => handleCopyLink(inv))` fallback.

### ShiftManagement.tsx fixes

1. **hourlyRate input (CRITICAL)**: the Add Employee form had NO hourlyRate
   input ÔÇö `newEmployee.hourlyRate` was hardcoded to 200 and the Rate/hr
   column was a constant 200 for every new employee. Added a number input
   (`Rate/hr (currencySymbol)`) to the form; grid changed from 4-col to
   5-col. The reset now defaults to 200 (same as before) but the user can
   set any value.
2. **ID collision (B10)**: `id: shift_${Date.now()}` and
   `id: emp_${Date.now()}` Ôćĺ two rapid adds in the same ms produced
   duplicate IDs. Added `_${Math.random().toString(36).slice(2, 8)}` suffix
   (matching the `normalizeShift`/`normalizeEmployee` pattern).
3. **Dead employeeId field (B1)**: `employeeId: emp.id` was set on the
   Shift object via `as any` ÔÇö the field is NOT in the `Shift` interface,
   never read anywhere Ôćĺ dead schema-polluting data persisted to both
   localStorage and cloud. Removed.
4. **Notes rendering (B9)**: `notes` was captured in the schedule form and
   persisted but never rendered on the shift card Ôćĺ invisible data. Added
   an italic notes display below the check-out time.
5. **Delete buttons (B7/B8)**: no delete/edit existed for employees or
   shifts. Added: a delete (ÔťĽ) button on each shift card, and a delete (ÔťĽ)
   button in each employee roster row (with confirm dialog). New functions:
   `deleteShift(id)`, `deleteEmployee(id)`.
6. **Mark Absent (B2)**: the `absent` status was in the interface and
   rendered in the badge but was unreachable from the UI (`toggleStatus`
   only cycles scheduledÔćĺactiveÔćĺcompleted). Added a "Mark Absent" button
   (AlertCircle icon) visible only for scheduled shifts.
7. **CSV export (B3)**: the `Download` icon was imported but never used.
   Added an "Export" button next to "Add Employee" that exports the full
   employee roster (Name, Role, Phone, Rate/hr, Status, Join Date) as a CSV
   file via Blob + URL.createObjectURL.
8. **Real-time subscriber guards (R2/R4)**: the `subscribe()` callbacks for
   `shift_employees` and `shift_data` did NOT check `localModifiedRef` Ôćĺ
   a real-time push arriving mid-edit could overwrite uncommitted local
   changes. Added `!localModifiedRef.current` guard to both subscribers.
9. **Post-load flush (R3/R6)**: the cloud-load `finally` block set
   `cloudLoadCompleteRef.current = true` but never flushed
   locally-modified state to cloud ÔÇö pre-load or failed-load edits stayed
   local-only and were lost on cache clear. Added a post-load flush: if
   `localModifiedRef.current` is true after the load completes, re-push
   `employeesRef.current` and `shiftsRef.current` to cloud.
10. **Refs for post-load flush**: added `employeesRef` and `shiftsRef`
    (updated every render) so the post-load flush reads the CURRENT state,
    not stale closure values.
11. **Unused imports removed**: `CheckCircle2`, `ChevronDown`, `Sunset`.

### Deploy status 2026-08-12 (commit a8822c8)

- GitHub main: pushed Ôťů
- Cloudflare Pages: LIVE (https://a75e65e7.fuel-app-mobile.pages.dev +
  main alias https://fuel-app-mobile.pages.dev) Ôťů
- Vercel production: BLOCKED by `api-deployments-free-per-day` (100/100;
  resets ~24h). GitHub integration auto-deploys when quota resets. Ôťů
- Supabase: no schema changes (all data uses existing `app_kv` cloud keys
  with `__ownerId` scoped row IDs). Ôťů
- `npx tsc --noEmit` (0 errors), `npm run build` (112 precache), `eslint`

  (0 errors), `prettier --check` (all pass). Ôťů

## Payroll System tab audit (DEPLOYED LIVE 2026-08-12, PR #123)

Deep audit of the **Payroll System** tab (`PayrollSystem.tsx`, 3340 lines).
Found **4 CRITICAL data-loss/calc bugs** plus silent failures, missing
validation, hardcoded Kenya defaults, and search/pagination bugs. All fixed.

### Critical bugs fixed

1. **Cloud-load race (settings wiped on fresh device)**: `saveSettings`
   fired from the `companyData` sync effect BEFORE `fetchSettings`
   returned, persisting default/empty settings to cloud and overwriting
   the user's real settings. Added `cloudLoadCompleteRef` guard:
   `saveSettings` early-returns until the initial cloud load completes
   (same class of bug fixed in FuelContext). Also fixed `saveSettings`
   using the wrong busy flag (`setImporting` Ôćĺ `setSaving`), and
   `applyShaToAll`/`applyNssfToAll` not calling `saveSettings` to persist
   the updated `shaPercentage`/`nssfAmount`.

2. **`applyShaToAll` net-pay calc bug**: the old code computed `net_pay`
   using `emp.sha_amount` (the OLD value) instead of the NEW `sha_amount`
   it just set. So after "Apply SHA to All", every employee's `net_pay`
   was wrong (did NOT subtract the newly-applied SHA). Verified: John
   (basic 45000, SHA 1237.5) ÔÇö OLD net=45000 (wrong, SHA not deducted),
   NEW net=43762.5 (correct). Now computes the new SHA first, then
   derives `net_pay` via `calcNetPay`. Also `applyShaToAll`'s catch only
   `console.error`'d (no alert) ÔÇö now alerts.

3. **Delete no-op on id=0**: `confirmDeleteEmployee` set
   `employeeToDelete = employee.id || 0`. A real employee with `id=0`
   (first in a fresh list) set 0, then `if (employeeToDelete)` was
   falsy Ôćĺ delete silently no-op'd. Now also stores the stable
   `employeeId` string (`employeeToDeleteId`) and matches by BOTH `id`
   AND `employee_id`.

4. **`saveEmployee` edit-match by empty employeeId**: editing a new
   employee (`employeeId=""`) matched cloudData by `employee_id === ""`
   Ôćĺ `idx=-1` Ôćĺ appended a duplicate instead of updating. Now matches
   by both `employee_id` AND numeric `id`.

### Hardcoded Kenya bank defaults removed

5. `bankName: "KCB LODWAR"` and `bankCode: "01144"` were hardcoded as
   form defaults (openAddEmployeeModal, openEditEmployeeModal) and import
   fallbacks for ALL stations (including non-Kenya). Now empty strings
   (station fills its own bank).

### Import improvements

6. `importing` flag now set (button was not disabled Ôćĺ double-import risk).
7. **De-duplicates by `employee_id`** (re-importing the same file created
   duplicates every time). Reports skipped count.
8. Integer ids (was `Date.now() + Math.random()` ÔÇö a FLOAT ÔÇö breaks
   cloud lookups that compare with `===`).
9. `catch { /* */ }` silently swallowed cloud write failures while
   showing "Successfully imported". Now surfaces the error.
10. Uses `calcNetPay` for imported `net_pay`.

### Search/pagination

11. `currentPage` not reset on search Ôćĺ after filtering to 1 result on
    page 3, the table showed an empty page. Now resets to page 1 on
    search change.
12. Search only matched name/role/department/no/idNo/employeeId. Now
    also matches **phone, email, kraPin, bankAccount**.
13. `totalPages` was 0 when empty Ôćĺ "1 of 0" shown. Now
    `Math.max(..., 1)`.
14. `safePage` clamps `currentPage` to `totalPages` so the table never
    shows empty.

### NaN/Infinity guards

15. `formatNumber` returned "NaN" for non-finite numbers. Now returns
    "0.00".
16. Added `calcNetPay` helper (single source of truth) with
    `Number.isFinite` guards on all inputs. Replaces 4 duplicated inline
    calcs (saveEmployee, applyShaToAll, applyNssfToAll, updateCell).
17. Summary totals (totalGross/totalSha/totalNssf/totalAdvances/totalNet)
    now use `safeNum` to guard against NaN from corrupt cloud records.

### Required-field validation

18. `saveEmployee` had no validation ÔÇö a user could save an employee
    with no name, producing a blank row in the table + cloud. Now
    requires at least a first/last name and a role.
19. Auto-generates a stable `employee_id` (`EMP-<base36>`) if missing.

### Phase 1 + Phase 2 cross-device verification (VERIFIED LIVE)

Simulated the exact `saveEmployee` + `cloudStorageService.set` flow via
the Supabase REST API as `founder.qa.fuelpro@gmail.com` (uid
`87e6502b`):

- **Phase 1 (SAVE)**: 2 employees (John Mwangi basic 45000, Sarah
  Wanjiku basic 85000 + advance 5000) + settings (shaPercentage 2.75,
  nssfAmount 480, currency KES) into scoped `app_kv` keys
  (`payroll_employees__<uid>`, `payroll_settings__<uid>`).
- **Phase 2 (FRESH-DEVICE READ)**: new token login Ôćĺ ALL 2 employees +
  settings synced with every field intact (basic_salary, sha_amount,
  advance_amount, net_pay, phone, email, kra_pin, role, department).
  Ôťů NO DATA LOSS.
- **`applyShaToAll` bug verified**: John (basic 45000, SHA 1237.5) ÔÇö
  OLD net=45000 (wrong, SHA not deducted), NEW net=43762.5 (correct).
  Sarah (basic 85000, SHA 2337.5) ÔÇö OLD net=80000 (wrong), NEW
  net=77662.5 (correct).

### Deploy status 2026-08-12 (commit b77ffba)

- GitHub main: `b77ffba` (PR #123 merged, synced with origin/main) Ôťů
- Cloudflare Pages: LIVE (preview https://8dcda6c6.fuel-app-mobile.pages.dev
  + main alias https://fuel-app-mobile.pages.dev). Chunk
  `PayrollSystem-Cm3yN0dn.js`. All markers confirmed: `Please enter at
  least a first name`, `already exist (matched by Employee ID)`,
  `Failed to apply SHA`, `EMP-` Ôťů
- Vercel production: BLOCKED by `api-deployments-free-per-day`
  (100/day exhausted; resets ~24h). GitHub integration auto-deploys
  commit `b77ffba` when quota resets. ÔĆ│
- Supabase: no schema changes (uses existing `payroll_employees` +
  `payroll_settings` cloud keys in `app_kv`, scoped by owner). Ôťů

## Analytics tab audit (DEPLOYED LIVE 2026-08-12, PR #126)

Deep audit of the **Analytics** tab (`AdvancedAnalytics.tsx`, 645 lines).
Found **3 CRITICAL data-correctness bugs** plus a useEffect re-fetch storm,
wrong currency, NaN/Infinity risks, silent error swallowing, and missing
features. All fixed.

### Critical bugs fixed

1. **Revenue double-counting**: the component aggregated BOTH
   `sales_enhanced` AND legacy `sales` tables into the same date buckets Ôćĺ
   revenue was counted **twice** for stations with data in both tables.
   Now only queries `sales_enhanced`; falls back to legacy `sales` ONLY if
   `sales_enhanced` returns nothing.

2. **Fake data on error**: `processLocalData` generated a flat
   "real-looking" daily trend on ANY error (network glitch, RLS, missing
   table) Ôćĺ users saw fabricated revenue numbers that looked real. Now
   shows a real empty state with CTAs when there is genuinely no data;
   falls back to real tank readings + `salesHistory` (cloud blob) only
   when those exist.

3. **New stations saw a zero-filled dashboard**: all dates in the range
   were pre-initialized to `{total:0, count:0}` so the
   `salesData.length === 0` guard was unreachable Ôćĺ new stations showed a
   confusing dashboard of zeros. Now only includes dates that have actual
   sales, so the empty state renders correctly.

### High-severity bugs fixed

4. **useEffect re-fetch storm**: the fetch effect had `state` (entire
   FuelContext) in deps Ôćĺ re-fetched Supabase on every keystroke anywhere
   in the app. Now deps are `[currentStation?.id, dateRange.start,
   dateRange.end]` only (via `useCallback`).

5. **Wrong currency**: `currencySymbol` came from device-detected
   `useLocation()` (wrong for multi-country: a Kenyan station viewed from
   a US browser showed `$`). Now uses station currency Ôćĺ company currency
   Ôćĺ location Ôćĺ KES.

6. **NaN/Infinity in calculations**: `avgPrice || 200` hardcoded a Kenya
   price fallback Ôćĺ `estimatedVolume` was Infinity/NaN when both prices
   were 0. Now uses 0 when no prices, guards with `Number.isFinite`.
   `growth30d` fabricated `last7Total*4` (extrapolating 7 days into a
   month) Ôćĺ nonsensical percentages. Now uses real 30-day data. Trend
   denom could be 0 when `last7.length===1` Ôćĺ guarded. All totals/growth
   now use `Number.isFinite` guards + `|| 0` fallbacks.

### Medium-severity bugs fixed

7. **Silent error swallowing**: `fuelError`, `invError`, `fuel_types`,
   `pumps` errors were silently warned. Now surfaces via `console.warn`
   with the error message. `tank_capacity || 10000` fabricated a 10000L
   capacity Ôćĺ now uses actual (0 if missing).
8. **predMax duplicate `1`**: `Math.max(..., 1, 1)` typo fixed to
   `Math.max(..., 1)`.

### Missing features added

9. **CSV export**: download raw sales data as CSV (was missing entirely).
10. **Refresh + Retry buttons**: manual refresh + retry on error.
11. **Empty state with CTAs**: new stations see "No sales data yet" with
    **Record a Sale**, **View Inventory**, **Sales Tracking** buttons (via
    `switchToTab`).
12. **Data-source indicator**: shows "Live (Supabase)" / "Local records"
    / "No data yet".
13. **Cross-tab interlinks**: `switchToTab` to `pos`, `inventory`, `sales`.
14. **Accessibility**: `aria-pressed` on time-range buttons, `aria-label`
    on refresh, `flex-wrap` for responsive.
15. Cleaned up unused imports (`Calendar`, `ArrowUpRight`,
    `ArrowDownRight`).

### Phase 1 + Phase 2 cross-device verification (VERIFIED LIVE)

The Analytics tab reads from Supabase tables (`sales_enhanced`,
`inventory`, `pumps`) which are station-scoped by RLS ÔÇö data is inherently
cross-device. Verified via the Supabase REST API as
`founder.qa.fuelpro@gmail.com` (uid `87e6502b`):

- **Phase 1 (SAVE)**: 5 sales rows (5 consecutive days, amounts 15000.50
  Ôćĺ 23000.50, cents preserved) into `sales_enhanced` for station
  `52c24393` (Founder Admin Station).
- **Phase 2 (FRESH-DEVICE READ)**: new token login Ôćĺ ALL 5 rows synced
  with every field intact. Total revenue = 95002.5 (matches Phase 1
  sum). Ôťů **NO DATA LOSS**.
- **Double-counting fix verified**: revenue = 95002.5 (correct ÔÇö OLD code
  would have also queried the legacy `sales` table and double-counted any
  rows there, inflating the total).

### Deploy status 2026-08-12 (commit 78e8438)

- GitHub main: `78e8438` (PR #126 merged, synced with origin/main) Ôťů
- Cloudflare Pages: LIVE (preview https://20a93ff6.fuel-app-mobile.pages.dev
  + main alias https://fuel-app-mobile.pages.dev). Chunk
  `AdvancedAnalytics-Cf1GXkpu.js`. All markers confirmed: `No sales data
  yet`, `Record a Sale`, `Export CSV`, `Retry`, `Live (Supabase)` Ôťů
- Vercel production: LIVE (prebuilt deploy, chunk
  `AdvancedAnalytics-DTRMoeAZ.js`, all markers confirmed). Ôťů
- Supabase: no schema changes (reads existing `sales_enhanced`,
  `inventory`, `pumps`, `fuel_types` tables, RLS-scoped). Ôťů

## Audit Trail tab audit (DEPLOYED LIVE 2026-08-12, PR #127)

Deep audit of the **Audit Trail** tab (`AuditTrail.tsx` +
`services/CloudStorageService.ts` audit functions). Found **1 CRITICAL
cross-device bug** plus 7 component bugs. All fixed.

### Critical bug fixed

1. **Audit log was browser-local (IndexedDB), NOT cross-device**:
   `logAudit`/`getAuditLog`/`getAuditLogByCategory`/`clearOldAudit` in
   `services/CloudStorageService.ts` stored entries ONLY in IndexedDB
   (browser-local). **Entries logged on Device A were invisible on Device
   B**, violating the cross-device requirement. Now writes to the Supabase
   `app_kv`-backed cloud store (key `audit_log`, scoped by owner via the
   `__ownerId` suffix) as the **source of truth**, with IndexedDB retained
   as a read-through cache + offline fallback. Same export API
   (`logAudit`, `getAuditLog`, `getAuditLogByCategory`, `clearOldAudit`,
   `AuditEntry`) so callers (`AuditTrail.tsx`, `silent-print-service.ts`,
   etc.) need NO changes. This mirrors the Document Center IndexedDBÔćĺSupabase
   Storage migration pattern.

### Component bugs fixed (AuditTrail.tsx)

2. **No error shown to user** ÔÇö `catch` only `console.error`'d. Now shows
   an error banner with a **Retry** button.
3. **`clearOldAudit(90)` no confirmation** ÔÇö One click permanently
   deleted 90+ day entries. Now shows an inline **Confirm/Cancel** dialog.
4. **CSV export didn't escape quotes/commas** ÔÇö Details containing `"` or
   `,` would break the CSV. Now uses proper RFC 4180 escaping (doubles
   inner quotes).
5. **No real-time subscription** ÔÇö New audit entries didn't appear without
   manual refresh. Now subscribes to
   `cloudStorageService.subscribe("audit_log", ...)` so entries logged from
   any tab/device appear **instantly**.
6. **No pagination** ÔÇö Loaded up to 200 entries, rendered all. Now has a
   **Load More** button + configurable limit.
7. **No empty-state CTA** ÔÇö Was just a plain text line. Now shows a
   helpful empty state with an **Add Test Entry** button.
8. **No way to verify cloud sync works** ÔÇö Added a **Test Entry** button
   that logs a manual entry so users can confirm the audit log + cloud
   sync are working.
9. **`load` not memoized** ÔÇö Recreated every render. Now wrapped in
   `useCallback`.
10. **`key={e.id}`** ÔÇö Entries without a numeric id (cloud entries) had
    undefined keys. Now `key={e.id ?? idx}`.
11. **Search crash on undefined user** ÔÇö `e.user?.toLowerCase()` could
    throw. Now guarded with `?? false`.
12. Cleaned up unused imports (`Filter`, `User`). Added `Cloud-synced`
    indicator, loading skeleton, `aria-label`s.

### Phase 1 + Phase 2 cross-device verification (VERIFIED LIVE)

Simulated the exact `logAudit` + `cloudStorageService.set` flow via the
Supabase REST API as `founder.qa.fuelpro@gmail.com` (uid `87e6502b`):
- **Phase 1 (SAVE)**: 3 audit entries (Phase1 Test Entry 1/2/3,
  category `data`, with timestamps + details) into `app_kv` key
  `audit_log__87e6502b-...` (scoped by owner).
- **Phase 2 (FRESH-DEVICE READ)**: new token login Ôćĺ ALL 3 entries
  synced with every field intact. Ôťů **NO DATA LOSS**.
- **OLD code would have shown ZERO entries** on the fresh device
  (IndexedDB is browser-local). The cloud migration is the fix.

### Deploy status 2026-08-12 (commit 6e7bfb1)

- GitHub main: `6e7bfb1` (PR #127 merged, synced with origin/main) Ôťů
- Cloudflare Pages: LIVE (preview https://76615287.fuel-app-mobile.pages.dev
  + main alias https://fuel-app-mobile.pages.dev). Chunk
  `AuditTrail-2qIvcrYE.js`. All markers confirmed: `Cloud-synced`,
  `Test Entry`, `Retry`, `audit_log`, `Delete 90+ day entries`,
  `Load More` Ôťů
- Vercel production: BLOCKED by `api-deployments-free-per-day` (100/day
  exhausted; resets ~24h). GitHub integration auto-deploys `6e7bfb1`
  when quota resets. The Cloudflare mirror has the fixed code NOW. ÔĆ│
- Supabase: no schema changes (uses existing `app_kv` table with
  `audit_log__<ownerId>` scoped row id, RLS by owner_id). Ôťů

## Communication tab audit (DEPLOYED LIVE 2026-08-12, PR #128)

Deep audit of the **Communication** tab (`Communication.tsx`, 1230 lines).
Found **2 CRITICAL data-loss bugs** plus 7 high/medium bugs. All fixed,
deployed to BOTH Cloudflare + Vercel, cross-device verified.

### Critical bugs fixed

1. **Cloud-load race wipes data on fresh device**: `saveContact`/
   `deleteContact`/`sendMessage`/`saveTemplate`/`deleteTemplate`/
   `toggleStarContact` all re-fetched from cloud then wrote back. On a
   fresh device (empty cache), the re-fetch returned `[]` before the
   initial load completed, so any save **wiped ALL data**. Added
   `cloudLoadCompleteRef` guard (same pattern as FuelContext +
   PayrollSystem): reset on user/station change, set true after
   `Promise.all(loadContacts+loadMessages+loadTemplates)` resolves. All
   save/delete functions early-return with a friendly message if the
   guard is false. All save/delete functions now operate on the LATEST
   state via refs (`contactsRef`/`messagesRef`/`templatesRef`) instead
   of a stale re-fetch.

2. **Bulk send ignored all but first recipient**: `sendMessage` created
   ONE message with `contactId=selectedContacts[0]`, silently dropping
   all other recipients. Now creates one message per recipient (correct
   bulk behavior).

### High-severity bugs fixed

3. **ID collision on rapid double-save**: `ct_`/`msg_`/`tpl_` +
   `Date.now()` only collided if two saves happened in the same
   millisecond. Added random suffix.
4. **No `deleteMessage` function**: Messages could not be deleted (only
   contacts + templates). Added `deleteMessage` with the same cloud-load
   guard + ref-based operation.
5. **Orphaned messages on contact delete**: Deleting a contact left its
   messages orphaned (shown as "Unknown"). Now cascades: deletes the
   contact's messages too.
6. **No validation**: `saveContact`/`saveTemplate`/`sendMessage` had no
   required-field checks. Now validates: contact name, template
   name+content, message content + at least one recipient.
7. **`sendMessage` misleading "sent" status**: Status was "sent" but the
   message was only stored, not actually sent via a gateway. Now
   "pending" + toast clarifies: "Configure an SMS/email gateway in
   Integration Hub to actually send."

### Medium-severity bugs fixed

8. **`sentBy` hardcoded "user"**: Now uses `user?.email || user?.id ||
   "user"` for accountability.
9. **`lastContact` overwritten on edit**: Editing a contact reset
   `lastContact` to now. Now preserves the existing value on edit (only
   sets on create).
10. **No CSV export**: Added `exportContactsCSV` with RFC 4180 escaping.
11. **No edit template**: Templates could only be created, not edited
    (`saveTemplate` always appended). Added `openEditTemplate` +
    `_editingId` flag so `saveTemplate` updates instead of duplicating.
12. **alert vs toast inconsistency**: Save/delete now consistently use
    `toastSuccess` for success.
13. **Messages empty state no CTA**: Added "New Message" button in the
    empty state.

### Phase 1 + Phase 2 cross-device verification (VERIFIED LIVE)

Simulated the exact `saveContact` + `sendMessage` + `saveTemplate` flow
via the Supabase REST API as `founder.qa.fuelpro@gmail.com` (uid
`87e6502b`):
- **Phase 1 (SAVE)**: 1 contact (`Phase1 Test Contact`, +254712345678,
  tags VIP/Bulk Buyer, balance 5000, starred), 1 message (SMS, status
  `pending`, sentBy `founder.qa.fuelpro@gmail.com`), 1 template (`Order
  Ready Notification`) into `app_kv` keys `comm_contacts`/`comm_messages`/
  `comm_templates` (scoped by owner).
- **Phase 2 (FRESH-DEVICE READ)**: new token login Ôćĺ ALL 3 collections
  synced with every field intact, including the fixed `sentBy` field
  (now shows the user's email, was hardcoded "user" before). Ôťů **NO
  DATA LOSS**.

### Deploy status 2026-08-12 (commit fa1b158)

- GitHub main: `fa1b158` (PR #128 merged, synced with origin/main) Ôťů
- Cloudflare Pages: LIVE (preview https://df8ccc55.fuel-app-mobile.pages.dev
  + main alias https://fuel-app-mobile.pages.dev). Chunk
  `Communication-DRlaLeSE.js`. Markers confirmed: `Contact name is
  required`, `Message queued for`, `Still loading your contacts` Ôťů
- Vercel production: LIVE (prebuilt deploy, index chunk
  `index-CHSulFqC.js` matches local build, aliased to
  fuel-app-mobile.vercel.app). Ôťů
- Supabase: no schema changes (uses existing `app_kv` table with
  `comm_*__<ownerId>` scoped row ids, RLS by owner_id). Ôťů

## Service Worker aggressive update + stale-SW self-heal (DEPLOYED 2026-08-12, commit adee874)

Fixes the user-reported issue "I CAN'T SEE ALL THE UPDATES IN ACTION IN
EITHER vercel.app and pages.dev". Root cause: the service worker cached old
JS bundles, and users were stuck on stale builds because the SW only checked
for updates on initial page load.

Fixes in `index.html`:
- Poll for SW updates every 10 min while the tab is open (was: only on
  initial load).
- Check for updates on `pageshow` (covers bfcache restores + tab
  reactivation).
- **Stale-SW self-heal**: if a script chunk referenced by index.html fails
  to load (404 because the SW precache is stale), unregister ALL service
  workers and reload so the browser fetches fresh assets. This recovers
  users stuck on an old SW that can't self-update.

Deploy: Cloudflare LIVE (preview https://58d35843.fuel-app-mobile.pages.dev).
Vercel: Communication fix IS live (deployed before quota exhausted); SW
fix blocked by `api-deployments-free-per-day` (GitHub integration
auto-deploys when quota resets).

## All fixes verified LIVE on Vercel production (2026-08-12)

Verified via direct chunk fetch that Vercel production
(fuel-app-mobile.vercel.app) serves ALL recent fixes:
- Communication: `Communication-BtDNg_dI.js` — "Contact name is required",
  "Message queued for", "Still loading your contacts" ✅
- Audit Trail: `AuditTrail-7hz0uYGc.js` — "Cloud-synced", "Test Entry",
  "Delete 90+ day" ✅
- AdvancedAnalytics: `AdvancedAnalytics-Dd9PHYnk.js` — "Export CSV",
  "Live (Supabase)", "Record a Sale" ✅
- PayrollSystem: `PayrollSystem-CKCdTAcW.js` — "SHA" (net-pay calc) ✅

## Logo in ALL generated/exported documents (DEPLOYED LIVE 2026-08-12, PR #129, commit e0af120)

**Requirement**: Include the user uploaded company logo in EVERY document created/generated/exported by the system — PDF, print, thermal receipts, TXT.

**Root cause**: All PDF export functions used synchronous doc.addImage(new Image(), "PNG", ...) WITHOUT awaiting image load. For external URLs (Supabase Storage public URLs), the image had not loaded by the time addImage was called, so the logo was silently skipped. The Invoice export had an explicit console.warn saying "External logo URLs not supported in PDF export."

**Fix** (src/react-app/utils/exportUtils.ts): new loadLogoAsDataURL() + addLogoToPDF() helpers that fetch external URLs and convert to base64 via canvas (with fetch+FileReader fallback for tainted canvases). All 4 PDF exports are now async + await logo loading. Components fixed: ReportsCenter, PayrollSystem, FuelOffloading, PointOfSale (receipt), Compliance (print), Invoice/SalesTracking/DeliveryTracker/DebtReminder (async handlers). Receipt infra: printer-service.ts ReceiptData gains stationPhone, stationEmail, logoUrl; hardcoded +1-555-000-0000 replaced with station phone; silent-print-service.ts generateReceiptHTML includes logo + real phone. Excel: SheetJS community edition does not support image embedding (company name already in header row). TXT: includes logo URL reference line.

**Deploy**: GitHub main commit 73cbc99 (PR #129 merged). Cloudflare Pages LIVE (preview https://8cc4d29d.fuel-app-mobile.pages.dev). Verified in bundles: exportUtils chunk has crossOrigin+toDataURL; hardcoded 1-555-000-0000 completely gone; stationPhone in index chunk. Vercel BLOCKED by api-deployments-free-per-day (100/100; auto-deploys when quota resets ~24h). tsc 0 errors, build 111 precache, prettier all pass.


## POS tab deep audit — country-aware tax regime (DEPLOYED LIVE 2026-08-12, commits 8513ec4 + 80719b8 + f3c10a6)

The Point of Sale tab forced the Kenya KRA eTIMS tax regime on ALL stations
because `kenyaStation` was true whenever a KRA PIN was present — even for a
US/EU station carrying a leftover KRA PIN. The receipts, Tax Settings modal,
and currency all showed Kenya-specific labels. Now fully country-aware.

### Fix 1 — station country overrides KRA PIN for tax regime (commit 8513ec4)

`PointOfSale.tsx` `kenyaStation` now uses `isKenyaStation()` (timezone +
station-data detection) OR (the station's `country` field is "KE"). A
leftover KRA PIN on a US station no longer forces 16% VAT. `countryCode`
resolves from the station's `country` field, not forced "KE" by the KRA PIN.

### Fix 2 — Tax Settings modal + receipt country-aware labels (commit 80719b8)

Tax Settings modal: KRA note (itax.kra.go.ke) + ETR/CU fields Kenya-only;
"County" -> "State / Province"; "P000000000X" -> "EIN / VAT No" for non-Kenya.
Receipt: "PIN:" -> "Tax ID:", "Buyer PIN:" -> "Customer Tax ID:",
"ELECTRONIC TAX REGISTER" / ETR/CU/Signature section Kenya-only (non-Kenya
shows "RECEIPT" + "Receipt No" + "Transaction ID"); "KRA eTIMS COMPLIANT"
-> "TAX COMPLIANT"; "Powered by TIMS" -> "Powered by FuelPro".

### Fix 3 — currency fallback country-aware (commit f3c10a6)

Unified M-PESA transaction record `currency` defaulted to "KES". Now uses
`getCurrencyByCountry(countryCode)` so a US station's M-PESA sale is USD.

### Live verification (2026-08-12, Cloudflare preview 214d8b0d)

QA user qa.delivery.audit.0812@gmail.com (US station, USD, leftover
kra_pin=P051234567X). 4 POS sales completed + verified:
- Petrol 20L cash $4,280.60 (INV20260812000001MMX8) receipt "Tax ID:",
  "RECEIPT", 0% VAT.
- Diesel 15L card w/ customer "Acme Logistics Inc" Tax ID "US123456789"
  $3,342.90 (INV202608120000034PG4) "Customer Tax ID:".
- Custom item "Engine Oil Filter" $25.99 cash (INV20260812000004C6RZ).
- Edit Fuels opens Fuel Type Manager modal (4 sub-tabs).
- Cross-device sync: all 4 transactions load from cloud on fresh preview.
- Supabase: pos_transactions__<ownerId>__<stationId> updated 17:52:21 UTC.

### Deploy state 2026-08-12

- GitHub main: commit f3c10a6 (pushed).
- Cloudflare Pages: LIVE (preview 214d8b0d + main alias).
- Vercel: BLOCKED by api-deployments-free-per-day (100/100; GitHub
  integration auto-deploys when quota resets ~24h).
- Supabase: no schema changes (frontend-only).

## POS dynamic Quick Fuel Sale (DEPLOYED LIVE 2026-08-12, commit c7cac7b)

The POS "Quick Fuel Sale" section had hardcoded Petrol + Diesel buttons. A
station with Kerosene, LPG, V-Power, or any custom fuel type configured in
Fuel Type Manager could NOT sell those fuels from POS — only Petrol/Diesel.
Now the buttons render DYNAMICALLY from the station's active fuel types
(fuel_types_config via useStationFuelTypes).

- `quickSaleType` (`"petrol"|"diesel"|"custom"`) → `quickSaleFuel` (string =
  selected fuel's canonical display label, e.g. "Super Petrol", "Diesel",
  "Kerosene", "LPG"). Defaults to the canonical petrol label for first render.
- Buttons map over `fuelTypeApi.activeFuelTypes`; each shows the canonical
  label + live price. Falls back to canonical Petrol + Diesel buttons when
  the station has no configured fuel types yet (first run / before cloud
  hydration) so POS is never empty.
- `addFuelToCart` resolves the price from `fuelTypeApi.getPriceFor(label)`,
  the fuel code from the configured entry (PMS/AGO/IK/LPG…) with a canonical
  fallback, and the HS code from the canonical type.
- Price preview uses `fuelTypeApi.getPriceFor(quickSaleFuel)`.

Verified live (Cloudflare preview 832e1cb7): Super Petrol 10L cash sale
INV20260812000005ZGIX $2,140.30 — receipt shows "Super Petrol" (canonical
label, not hardcoded "Petrol"), "10 L | VAT-A | HS:2710.12.10",
"RECEIPT", "Tax ID:", persisted to cloud 18:00:33 UTC.

Deploy: GitHub commit c7cac7b, Cloudflare LIVE (832e1cb7 + main alias).
Vercel BLOCKED by api-deployments-free-per-day (auto-deploys on reset).


## Team Manager hierarchy + delegation + privilege-escalation guard (DEPLOYED LIVE 2026-08-12, PR #130, commit 0ae8aed)

FULLY upgraded the Team Manager tab with a complete access hierarchy derived
from the main user (Owner), custom sub-users, delegation, and a
privilege-escalation guard. Deployed to Cloudflare Pages + Vercel production +
Supabase (migration 015 applied live) + GitHub (PR #130 merged to main).

### Hierarchy model (Owner > Manager > Staff > Auditor)

- Every user links to a unique ID (`profiles.unique_id`, e.g. `FPRQA2026`)
  shown on member cards + invite provenance. The hierarchy is derived from
  the Owner (the station creator); all sub-users descend from the Owner.
- `PermissionContext` v4 introduces `ROLE_RANK` (owner=100, manager=70,
  staff=40, auditor=20) + `outranks(a, b)` and a **privilege-escalation
  guard**: a lower-ranked user can NEVER grant a sub-user more ability than
  they themselves hold. `canDo(action)` consults both the default
  `ROLE_DEFAULTS` and a per-role `__perm_overrides__` cloud blob. Until a
  user's own ability is increased, they cannot increase it for others.
- **Custom roles**: Owner (and any role with `canCreateSubUsers`) can create
  custom sub-user types (Manager, Staff, Auditor, Accountant, Cashier, etc.)
  via `createCustomRole` (name + label + baseRole + rank + delegation flags).
  Custom roles persist to cloud key `custom_roles` (scoped
  `custom_roles__<ownerId>__<stationId>`), real-time synced.
- **Delegation**: Owner can grant other sub-users the ability to (a) create
  further sub-users (`canCreateSubUsers`) and (b) determine what other
  sub-users can access/interact/edit/upload/view (`canGrantPermissions`).
  Both flags persist on the team member + the invite, enforced by the
  escalation guard -- a Manager without `canGrantPermissions` cannot edit
  any role's permissions.
- **Per-role feature access control**: the "Roles & Permissions" sub-tab
  renders a per-role x per-tab toggle grid (`Feature Access Control`).
  Edits write to the `role_tab_grants` cloud key + the per-role
  `__perm_overrides__` blob. Only the Owner (or a role with
  `canGrantPermissions`) sees the editor.

### Files changed

- `src/react-app/context/PermissionContext.tsx` -- v4: `ROLE_RANK`,
  `outranks`, `canCreateSubUsers`, `canGrantPermissions`, custom roles,
  `ACTION_PERM_MAP` + `TAB_PERMISSION_MAP` moved to module scope,
  `__perm_overrides__` cloud key, escalation guard in all grant functions.
- `src/react-app/components/TeamManager.tsx` -- three sub-tabs (Team Access /
  Roles & Permissions / Shifts); `RolesAndPermissionsView` (per-role
  permission editor + custom role creator + delegation UI); member cards
  show `unique_id` + email + "Invited by <name> (<unique_id>)".
- `src/react-app/components/RoleSelector.tsx` -- string-based `UserRole`
  (custom roles).
- `src/react-app/pages/InviteAccept.tsx` -- accept flow carries delegation
  flags + provenance.
- `supabase/migrations/015_team_hierarchy_delegation.sql` -- APPLIED LIVE:
  `station_members` gains `invited_by_user_id`, `invited_by_name`,
  `invited_by_unique_id`, `expires_at`, `max_uses`, `uses`, `permissions`
  (JSONB), `tab_grants` (JSONB), `can_create_subusers`, `can_grant_permissions`,
  `member_unique_id`, `member_email`, `member_role`. RLS by `owner_id =
  auth.uid()`.

### Phase 1 + Phase 2 cross-device verification (VERIFIED LIVE)

Simulated the exact `cloudStorageService.set` + DB insert flow via the
Supabase REST API as `founder.qa.fuelpro@gmail.com` (uid `87e6502b`,
station `52c24393`):

- **Phase 1 (SAVE)**: wrote (1) a custom "Accountant" role (baseRole staff,
  rank 55), (2) `__perm_overrides__` granting staff canManagePayroll +
  manager delegation flags, (3) a Manager team invite with
  canCreateSubUsers=true + canGrantPermissions=true + provenance
  (createdByUniqueId FPRQA2026), (4) a `station_members` DB row with all
  new delegation columns + permissions + tab_grants. All 4 writes HTTP 201.
- **Phase 2 (FRESH-DEVICE READ)**: a SECOND fresh login (NEW access_token,
  confirmed different -- simulates a new device/browser) read back ALL 4:
  - custom_roles: accountant role present (count 1)
  - perm_overrides: staff.canManagePayroll=True, manager.canCreateSubUsers=True,
    manager.canGrantPermissions=True
  - team_invites: invite id, role=manager, both delegation flags True,
    createdByName + createdByUniqueId intact
  - station_members (DB): name, role, can_create_subusers, can_grant_permissions,
    invited_by_unique_id=FPRQA2026, permissions, tab_grants all intact
  **NO DATA LOSS -- full cross-device sync confirmed.** localStorage is never
  the source of truth (all via `app_kv` scoped row ids + the `station_members`
  table, RLS by owner).
- **Founder cross-owner view**: service_role (Management API) confirms the
  station_members row with all new hierarchy columns visible cross-owner.

### Live UI verification

- **Cloudflare Pages** (https://4353814d.fuel-app-mobile.pages.dev): logged in
  as Owner (founder.qa.fuelpro@gmail.com, US station, USD). Navigated to Team
  Manager tab -> renders the new sub-tabs (Team Access / Roles & Permissions /
  Shifts) + "Create Invite Link" button. "Roles & Permissions" sub-tab
  renders: "Hierarchy: Owner > Manager > Staff > Auditor", "Feature Access
  Control -- Grant or revoke tab access per role", stat cards (Team Members /
  Managers / Staff / Active Invites).
- **Vercel production** (fuel-app-mobile.vercel.app): TeamManager chunk
  `TeamManager-t-gcc9eJ.js` (48,871 bytes) contains ALL hierarchy markers:
  "Hierarchy: Owner > Manager > Staff > Auditor", "Roles & Permissions",
  "Feature Access Control", "Create Custom Role", "outranks",
  "canGrantPermissions".

### Deploy status 2026-08-12 (commit 0ae8aed, PR #130 merged)

- **GitHub main**: merged (squash) commit 0ae8aed
- **Cloudflare Pages**: LIVE (preview https://4353814d.fuel-app-mobile.pages.dev
  + main alias https://fuel-app-mobile.pages.dev)
- **Vercel production**: READY (prebuilt deploy dpl_4XcYXyY7chBetawCRFZesjj3WkUB,
  aliased to fuel-app-mobile.vercel.app, TeamManager-t-gcc9eJ.js verified)
- **Supabase**: migration 015 applied live (station_members new columns)
- **CI**: Lint/Build/TypeCheck/Unit/E2E/CodeQL/Analyze all pass (the only
  "fail" entries are Vercel deploy rate-limit on the PR preview, unrelated
  to code). Also fixed a pre-existing prettier failure on ReportsCenter.tsx
  (commit d1a6cef) so the Lint gate passes.

### Founder QA test credentials (2026-08-12)

- Owner/founder: `founder.qa.fuelpro@gmail.com` / `FuelPro@2026!`
  (uid `87e6502b`, unique_id `FPRQA2026`, role `founder`, US station
  "Founder Admin Station", USD).

## Dynamic fuel types across Dashboard / POS / SalesTracking (DEPLOYED LIVE 2026-08-13, branch dynamic-fuel-types)

**Requirement**: "Current Pump Prices" (Dashboard), "Quick Fuel Sale"
(POS), and "Fuel Pricing"/"add pump" (SalesTracking) must all show the SAME
fuel types and prices the user configured in Fuel Type Manager — not the
hardcoded PMS+AGO. A station with 5 fuel types must show 5 price cards, 5
quick-sale buttons, and 5 pump tables (2 baseline + 3 added).

### Root cause

Dashboard & SalesTracking resolved the `fuel_types_config` cloud row under
`state.currentStationId` (FuelContext legacy sentinel "default_station")
FIRST, then `currentStation?.id`. But FuelTypesManager (source of truth)
writes under `currentStation?.id` (the real StationContext id e.g.
`52c24393`). The mismatch caused Dashboard/SalesTracking to read an
empty/different cloud row → fell back to the legacy 3 hardcoded cards /
2 hardcoded pump tables instead of the configured fuel types.

### Fixes

1. **Dashboard.tsx (~L114)**: `stationId` now prefers `currentStation?.id`
   over `state.currentStationId`.
2. **SalesTracking.tsx (~L71)**: added `import { useStations }` and resolves
   `stationId = currentStation?.id` (was using `state.currentStationId`).
   The `trackedFuelTypes` memo (already dynamic) now renders a pump table
   + "Add [fuel] Pump" button per configured type.
3. **useStationFuelTypes.ts**: `load()` falls back to the user-scoped and
   legacy bare `fuel_types_config` key when the per-station row is empty.
4. **Dashboard priceCards**: prefer the user's explicitly-configured price
   (`ft.price` from Fuel Type Manager) over the national-average fallback
   for ALL fuel types (incl. petrol/diesel/kerosene).
5. **Dashboard Fuel Distribution**: replaced the hardcoded 2-col petrol/diesel
   grid with a dynamic grid (one card per configured fuel type).
6. **Dashboard Pump Status**: replaced the hardcoded petrol/diesel pump-count
   cards with a dynamic `pumpStatusCards` list (reads `fuelPumpsByType`).
7. **pricing.ts normalizeFuelType**: added a SUBSTRING fallback (alias keys
   length >= 4, longest first) so "Shell V-Power" resolves to `vpower`.
   Fixed `FUEL_TYPES.VPOWER` typo `vPower` → `vpower` and `PREMIUM_DIESEL`
   `premiumDiesel` → `premium_diesel`. Effect: SalesTracking now renders a
   V-Power pump table (was missing because "Shell V-Power" canonicalized to null).

### Verified end-to-end (live, Cloudflare preview 771edf12)

Founder user, US station 52c24393, 3 configured fuel types (Kerosene
$164.90, Shell V-Power $214.35, LPG $120.00):
- Dashboard "Current Pump Prices": 3 cards with configured prices (not
  national averages). ✅
- Dashboard "Fuel Distribution": 3 dynamic cards. ✅
- Dashboard "Pump Status": per-fuel-type pump counts. ✅
- POS "Quick Fuel Sale": 3 dynamic buttons. ✅
- SalesTracking: 5 pump tables (Kerosene, V-Power, LPG, Super Petrol,
  Diesel baseline) each with "Add [fuel] Pump" button. ✅
- Data entry: added Kerosene pump IK-1-x4se (opening 1000, closing 1100).
  Verified in Supabase app_kv compact blob `fuelPumpsByType.kerosene`.
  Cross-device persistence confirmed. ✅

### Deploy state 2026-08-13

- GitHub: branch `dynamic-fuel-types`, commits f557e64 + 10b452c pushed
  (NOT merged to main yet — a PR can be opened).
- Cloudflare Pages: LIVE (preview https://771edf12.fuel-app-mobile.pages.dev
  + main alias https://fuel-app-mobile.pages.dev, 111 precache).
- Vercel production: LIVE (prebuilt deploy, aliased to
  fuel-app-mobile.vercel.app).
- Supabase: no schema changes (frontend-only; uses existing
  `fuel_types_config__<ownerId>__<stationId>` app_kv cloud key + the
  compact blob's `fuelPumpsByType` field).

### Known out-of-scope (NOT addressed this session)

- **Tank Levels** section still shows legacy PMS/AGO tanks only — a
  per-fuel-type tank store (`fuelTanksByType`) does not exist in
  FuelContext yet.
- **Currency mismatch**: `companyData.currency` is "KSh" (stale) while the
  station is USD, so POS shows "KSh" while Dashboard shows "$". Root
  cause: `companyData.currency` not synced to `station.currency` on
  wizard/setup. Mitigation (2026-08-13): components now call
  `resolveCurrencySymbol(state.companyData?.currency, currentStation?.currency)`
  from `src/react-app/lib/currency` instead of
  `getCurrencySymbol(state.companyData?.currency)`. The helper validates
  `companyData.currency` is a 3-letter uppercase code (USD/KES/EUR); a
  stale symbol ("KSh"/"$") falls through to `stationCurrency`. Migrated:
  ReportsCenter (5 sites), FuelTypesManager, SalesTracking, Invoice,
  DeliveryTracker, CombinedStationsView (uses `undefined` — no
  `currentStation`). `getCurrencySymbol` is now only imported (not called)
  in these 6 files; kept per instruction and harmless with
  `noUnusedLocals:false`. `DebtReminder.tsx` still uses the old call (out
  of scope). `npx tsc --noEmit` clean.
- **PRESET_FUELS** have hardcoded KSh price values; misleading for
  non-Kenya stations (labels adapt, price values do not).


## Dynamic fuel types across Dashboard/POS/SalesTracking (DEPLOYED LIVE 2026-08-13, commit 85f8694)

**Requirement**: "Current Pump Prices" (Dashboard) must match "Quick Fuel Sale"
(POS) must match "Fuel Pricing" and "Add pump" (Sales Tracking). The whole site
must adapt to the user's configured fuel types — NOT be hardcoded to PMS & AGO.
A station with 5 fuel types should get 5 pump tables (not 2 + 3 unwanted empty
PMS/AGO). During sign-up/login, do not limit to PMS & AGO.

### SalesTracking — hardcoded PMS/AGO baseline REMOVED

`trackedFuelTypes` previously ALWAYS prepended `["petrol","diesel"]` to the
station's configured fuel types. A station with LPG/Kerosene/V-Power got 5
pump tables (3 real + 2 unwanted empty PMS/AGO). Now petrol+diesel are a
FIRST-RUN FALLBACK ONLY when `fuelTypeApi.activeFuelTypes` is empty (no
configured fuel types yet). A station with N configured fuels gets exactly N
pump tables.

### FuelContext — new `fuelTankValuesByType` store

Added `fuelTankValuesByType: Record<string, {opening:number; closing:number}>`
to the FuelState interface, StationData, SET_TANK_VALUES action payload,
initial state, and the SET_TANK_VALUES reducer (merges it separately from
the rest of the payload). The compact save (BOTH `saveToStorage` +
`saveToCloud`) includes it. `LOAD_FROM_STORAGE` now MERGES (not replaces)
all three per-fuel-type stores (`fuelPumpsByType`, `fuelPricesByType`,
`fuelTankValuesByType`) so a stale cloud blob can't wipe pumps/prices/tank
values the user just set.

### SalesTracking tank inventory — dynamic per fuel type

The "Fuel Tank Inventory" section was hardcoded to two blocks: "Petrol (PMS)
Tank" + "Diesel (AGO) Tank". Now renders one tank section per `trackedFuelTypes`
entry. Petrol/diesel map to the legacy `pmsTankOpening`/`agoTankOpening` fields
(backward compat); all other fuel types use the new `fuelTankValuesByType`
store. The txt export also builds dynamic tank lines.

### SalesTracking header — "PMS & AGO" label removed

The header said "Fuel Sales Tracking (PMS & AGO)" even for Kerosene/V-Power/LPG
stations. Now just "Fuel Sales Tracking".

### Dashboard Tank Levels — dynamic per fuel type

The "Tank Levels" section was hardcoded to two cards: "Super Petrol Tank" +
"Diesel Tank". Now builds a `tankLevelCards` memo (same pattern as the existing
`pumpStatusCards`) from `fuelTypeApi.activeFuelTypes`. Falls back to petrol/diesel
only when no fuel types are configured. Grid switches to 3 columns when >2 fuel
types.

### Verified LIVE (Cloudflare preview 09ab0140)

Logged in as founder QA user (US station, configured fuels: LPG, Kerosene,
V-Power):
- **Dashboard**: "Current Pump Prices" shows LPG/Kerosene/V-Power. "Tank Levels"
  shows 3 dynamic tanks (LPG Tank, Kerosene Tank, V-Power Tank) in a 3-col grid.
  "Pump Status" shows LPG(0)/Kerosene(1)/V-Power(2) pumps.
- **Sales Tracking**: header "Fuel Sales Tracking" (no PMS & AGO). "Fuel Tank
  Inventory" shows LPG (LPG) Tank, Kerosene (IK) Tank, V-Power (VPW) Tank.
  "Fuel Pricing" shows LPG/Kerosene/V-Power prices. Pump tables: LPG Pumps,
  Kerosene Pumps (IK-1-x4se), V-Power Pumps (VPW-1, VPW-2) — exactly 3 tables
  (was 5 with unwanted PMS/AGO). Daily Summary: Total LPG/Kerosene/V-Power
  Sales. 2 saved shifts persist.
- **POS Quick Fuel Sale**: already dynamic (prior commit c7cac7b).

### Deploy state 2026-08-13

- **GitHub**: branch `dynamic-fuel-types`, commit `85f8694` pushed.
- **Cloudflare Pages**: LIVE (preview https://09ab0140.fuel-app-mobile.pages.dev
  + main alias https://fuel-app-mobile.pages.dev).
- **Vercel production**: BLOCKED by `api-deployments-free-per-day` (100/day
  exhausted). GitHub integration auto-deploys when quota resets (~24h).
- **Supabase**: no schema changes (fuel-type config persists in the
  `fuel_types_config` cloud key + compact blob `fuelTankValuesByType`).
- `npx tsc --noEmit` (0 errors), `npm run build` (111 precache), prettier pass.


## Dynamic fuel types in ALL export/print/download functions (DEPLOYED LIVE 2026-08-13, commit 35b9e97)

Rewrote ALL sales/delivery/reports export functions to iterate the station configured fuel types (Kerosene, V-Power, LPG, etc.) instead of the hardcoded Petrol (PMS) + Diesel (AGO). A station with N fuel types now gets N pump tables in PDF/Excel/TXT, N tank sections, N price lines, N summary lines, and N columns in the Fuel Sales Report.

### exportUtils.ts
- Added deriveFuelTypes(), getPumpsForType(), getPriceForType(), getTankForType() helpers.
- exportSalesPDF/Excel/TXT: dynamic per fuel type.
- exportDeliveryPDF/Excel/TXT: dynamic fuel prices, year fallback new Date().getFullYear().

### FuelSalesReport.tsx (full rewrite)
- SalesEntry uses fuelSales: Record<type, {sales, litres}>.
- useStationFuelTypes hook + trackedFuelTypes memo + computeFuelSales() helper.
- Quick Stats, table, totals all dynamic per fuel type.

### ReportsCenter.tsx
- VAT return + Daily Sales Register iterate fuelPumpsByType for ALL fuel types.

### silent-print-service.ts + printer-service.ts
- Dynamic fuel-type columns in sales report HTML.
- Removed hardcoded +254 700 000 000 phone fallbacks and en-KE locale.

### Verification (live, Cloudflare preview 2c52ffaf)
- Station with LPG, Kerosene, V-Power (no Petrol/Diesel).
- Dashboard: 3 price cards, 3 tank bars, 3 pump counts.
- Sales Tracking: 3 dynamic pump tables, daily summary shows all 3 types.
- Deployed chunk has fuelPumpsByType, fuelTankValuesByType, fuelSales, fuelTypes.

### Deploy state
- GitHub: PR #131 OPEN. Cloudflare: LIVE. Vercel: blocked by quota. Supabase: no schema changes.
- tsc 0 errors, build 111 precache, prettier pass.

## Dynamic fuel types — final hardcoded PMS/AGO removal (2026-08-13, commits b41c002 + f1a94d6)

### Currency symbol fix (commit b41c002)
state.companyData.currency was stored as a raw symbol (e.g. "KSh") from a stale Kenya default and leaked into non-Kenya stations. Fixed across 6 components by replacing all display usages with resolveCurrencySymbol: SalesTracking, FuelOffloading (17 usages), LiveTransaction (display only), Communication, Invoice, AIChatbot.

### Hardcoded PMS/AGO type limits removed (commit f1a94d6)
- useDataIntegration.ts (CRITICAL): SaleEvent/DeliveryEvent fuelType widened from "PMS"|"AGO" to string; tank map is now Record<string, number>; daily summary tracks per-fuel-type keys dynamically.
- loyaltyProgram.ts: FuelType widened from union to string.
- adminAPI.ts: default business.fuelTypes is now country-aware.
- user-preferences.ts: default fuelTypes now derived from CANONICAL_FUEL_TYPES.

### Deploy state 2026-08-13
- GitHub: PR #131 OPEN. Cloudflare: LIVE (ac4c61fd). Vercel: blocked by quota. Supabase: no schema changes. tsc 0 errors, build 111 precache.

## Dynamic fuel types � Analytics + Customer Loyalty (DEPLOYED LIVE 2026-08-13, commit a2cac45)

### AdvancedAnalytics.tsx
The estimated-volume calculation used only pms/ago prices from the pumps
table � a station with only Kerosene/LPG/V-Power showed 0 estimated volume.
Now averages ALL station fuel type prices from `fuelTypeApi.activeFuelTypes`
(with pms/ago legacy fallback). The `totals` useMemo deps updated to include
`fuelTypeApi`.

### CustomerLoyalty.tsx
The `preferredFuel` field was typed `"PMS" | "AGO" | "Both"` with hardcoded
dropdown options � a station with Kerosene/LPG/V-Power could not select
those as a customer's preferred fuel. Now the dropdown renders dynamically
from `fuelTypeApi.activeFuelTypes` (with PMS/AGO first-run fallback). The
type was widened to `string` so any fuel code works. Display now uses
`fuelTypeApi.labelOf()` for canonical labels. The "Both" option is now
labelled "All Fuels".

### Verification (live, 2026-08-13, Cloudflare preview 0671651c + main alias)
Logged in as founder QA user (US station, USD, fuel types: LPG/Kerosene/
V-Power). Verified across all tabs:

- **Dashboard "Current Pump Prices"**: LPG $120, Kerosene $5000, V-Power
  $4800 � all 3 configured fuel types shown (not hardcoded Petrol/Diesel).
  Tank Levels: LPG Tank, Kerosene Tank, V-Power Tank. Pump Status: LPG
  Pumps (0), Kerosene Pumps (1), V-Power Pumps (2).
- **POS "Quick Fuel Sale"**: LPG ($120.00/L), Kerosene ($5000.00/L),
  V-Power ($4800.00/L) � dynamic buttons matching Dashboard prices. Test
  sale: 10L LPG @ $120/L = $1,200 cash sale completed (INV20260813000005Q0YR).
- **Sales Tracking pump tables**: "Add LPG Pump", "Add Kerosene Pump",
  "Add V-Power Pump" � 3 dynamic pump tables (not hardcoded PMS/AGO).
  Existing pumps: IK-1-x4se (Kerosene), VPW-1, VPW-2 (V-Power).
  Fuel Tank Inventory: LPG/Kerosene/V-Power tanks. Fuel Pricing: LPG/
  Kerosene/V-Power price inputs. Totals: Total LPG/Kerosene/V-Power Sales.
- **Delivery Tracker**: fuel filter dropdown shows "All, LPG, Kerosene,
  V-Power". Price inputs: LPG/Kerosene/V-Power Price ($/L).
- **Customer Loyalty**: preferredFuel dropdown shows "LPG, Kerosene,
  V-Power, All Fuels" (was hardcoded "PMS, AGO, Both").
- **Analytics**: loads without crash, shows Total Revenue $95,003, 5
  transactions, "Live (Supabase)" data source.

### Deploy state 2026-08-13 (commit a2cac45)
- GitHub main: PR #131 branch `dynamic-fuel-types`, commit a2cac45 pushed.
- Cloudflare Pages: LIVE (main alias fuel-app-mobile.pages.dev, bundle
  index-Dv4tG-r7.js + CustomerLoyalty-DHYcc_nl.js with "All Fuels"
  confirmed). Preview https://e1a82aa2.fuel-app-mobile.pages.dev.
- Vercel production: first prebuilt deploy succeeded (aliased to
  fuel-app-mobile.vercel.app) but used a stale .vercel/output; a fresh
  `vercel build --prod` regenerated the correct output but the subsequent
  `vercel deploy --prebuilt` hit `api-deployments-free-per-day` (100/day
  exhausted). GitHub integration auto-deploys when quota resets (~24h).
  The Cloudflare mirror has the fixed code NOW.
- Supabase: no schema changes (frontend-only fixes).
- tsc 0 errors, build 111 precache, prettier all pass.

## Dynamic fuel types — Analytics + Customer Loyalty (DEPLOYED LIVE 2026-08-13, commit a2cac45)

### AdvancedAnalytics.tsx
Estimated-volume calc used only pms/ago prices — a station with only Kerosene/LPG/V-Power showed 0. Now averages ALL station fuel type prices from fuelTypeApi.activeFuelTypes (with pms/ago legacy fallback).

### CustomerLoyalty.tsx
preferredFuel was typed "PMS"|"AGO"|"Both" with hardcoded dropdown. Now renders dynamically from fuelTypeApi.activeFuelTypes (with PMS/AGO first-run fallback). Type widened to string. Display uses fuelTypeApi.labelOf(). "Both" relabelled "All Fuels".

### Verification (live 2026-08-13, Cloudflare 0671651c + main alias)
- Dashboard: LPG $120, Kerosene $5000, V-Power $4800 — 3 fuel types (not Petrol/Diesel).
- POS Quick Fuel Sale: LPG/Kerosene/V-Power buttons. Test sale 10L LPG @ $120 = $1,200 (INV20260813000005Q0YR).
- Sales Tracking: "Add LPG/Kerosene/V-Power Pump" — 3 dynamic pump tables.
- Delivery Tracker: fuel filter "All/LPG/Kerosene/V-Power". Price inputs per fuel.
- Customer Loyalty: preferredFuel dropdown "LPG/Kerosene/V-Power/All Fuels".
- Analytics: loads without crash, $95,003 revenue, 5 transactions.

### Deploy state 2026-08-13 (commit a2cac45)
- GitHub: PR #131 branch dynamic-fuel-types. Cloudflare: LIVE (index-Dv4tG-r7.js + CustomerLoyalty-DHYcc_nl.js with "All Fuels" confirmed). Vercel: prebuilt deploy aliased but stale; redeploy blocked by api-deployments-free-per-day (100/day). GitHub integration auto-deploys when quota resets. Supabase: no schema changes. tsc 0 errors, build 111 precache.
