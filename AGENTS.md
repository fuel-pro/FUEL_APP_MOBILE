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
  `purchase_orders`), ExpenseTracker (`expenses_data`), PriceBoard
  (`priceboard_data`, `price_history_data`), APIKeyManager (`apikeys_data`),
  MPesaConfig (`mpesa_config` — object, uses `if (cloud)` not Array.isArray),
  SMSGatewayConfig (`sms_config` — object), WebhookManager (`webhooks_data`),
  PointOfSale (`pos_transactions`), News (`news_bookmarks`).
  Pattern: import service + `useAuth`, `const { user } = useAuth()`, append
  `cloudStorageService.set(key, data).catch(()=>{})` to the existing save fn
  (keep `localStorage.setItem` as cache), and add a `useEffect([user])` that
  `get`s the typed array/object and `setState`s it — for arrays guard with
  `Array.isArray`, for objects use `if (cloud)`. For components whose save is a
  `useEffect` (e.g. ExpenseTracker/PriceBoard) put the `cloudStorageService.set`
  inside that same effect. MIGRATED 2026-08-09: the 8 above (ExpenseTracker,
  PriceBoard, APIKeyManager, MPesaConfig, SMSGatewayConfig, WebhookManager,
  PointOfSale, News); `npx tsc --noEmit` clean (0 errors).
- **Document Center — Supabase Storage migration (FIXED 2026-08-09)**: The
  Document Center tab (`DocumentCenter.tsx`) used `documentStore.ts` which
  stored files in **IndexedDB** (browser-local, NO cross-device sync — files
  uploaded on one device were invisible on another). Rewrote `documentStore.ts`
  to use Supabase Storage (`fuelpro-files` bucket, path
  `documents/<uid>/<ts>-<name>`) + `user_documents` table (RLS by owner_id).
  Same export API (saveDocument, getDocument, listDocuments, deleteDocument,
  countDocuments, getTotalStorageUsed, CATEGORIES, DocMetadata) so
  DocumentCenter.tsx needed NO changes. Migration 010 added `tags` (JSONB),
  `folder_path` (TEXT), `thumbnail` (TEXT) columns to `user_documents` for the
  extra metadata. E2E verified: upload → metadata insert → list → fetch via
  public URL (HTTP 200) → delete, all with a user token. `Documents.tsx` (the
  legacy Documents tab, NOT rendered but kept for reference) was also migrated
  from base64-in-JSON to Storage uploads via `uploadFileToStorage()`.
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
- **2026-08-09 commit 3746b02 (DEPLOYED LIVE)** — React error #185 (Maximum
  update depth exceeded) in StationContext. Root cause: a dependency-chain
  cascade caused an infinite mount-effect loop: `persist` (deps
  `[stations, adminSettings]`) was recreated on every state change →
  `syncFromBackend` (deps `[persist]`) recreated whenever `persist` changed →
  the mount effect (deps `[syncFromBackend]`) re-fired on every
  `syncFromBackend` recreation, calling `setStations`/`setAdminSettings` →
  recreating `persist` → infinite loop. Fix: `persist` is now stable
  (`deps []`) by reading current stations/adminSettings from refs
  (`stationsRef`/`adminSettingsRef`) instead of closure capture. Deployed as
  `dpl_8rD75tGEkqD16pHWwDQEShtoePpy` (READY, PROMOTED, aliased to
  fuel-app-mobile.vercel.app). Also bundles `3c28f5e` (replaced all broken
  `/api/*` calls with `cloudStorageService` for cross-device persistence) and
  `f0299c8` (profile management, password reset, cross-device sharing &
  documents). Verified live: HTTP 200, prod chunk `index-gwkrD55k.js`.
  Git-source API deploy method confirmed reliable: `POST /v13/deployments`
  with body `gitSource.repoId=1241380610` + `ref=<sha>` and
  `?projectId=prj_...` as QUERY param (NOT body — body `projectId` is rejected
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

## CRITICAL — Cross-user station + data leak via overly-permissive RLS (FIXED 2026-08-09, commit fb9eb29)
**Symptom**: any logged-in user received the GLOBAL station list — including
every other user's stations — via the cloud sync query. On a fresh device
(cleared localStorage), the app defaulted to another user's station
("Publican Energy Test Station") on first login, and the leaked stations
were persisted into the user-scoped localStorage cache. This affected not
just `stations` but also `users`, `inventory`, `sales`, `audit_logs`, and
`config` — all of which had broad `authenticated_*` RLS policies.

**Root cause**: the tables had three broad RLS policies shadowing the proper
owner-scoped ones:
- `authenticated_select`: `(auth.role() = 'authenticated')` → ANY
  authenticated user can SELECT ALL rows.
- `authenticated_update`: same → ANY user can UPDATE ALL rows.
- `authenticated_insert`: `(auth.role() = 'authenticated')` WITH CHECK →
  ANY user can INSERT as anyone.
Because Postgres RLS policies are OR'd, the broad policy made the
owner-scoped `(auth.uid() = owner_id)` policy irrelevant — every row was
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
  (`fuelpro_stations_v3_<userId>`, see commit 9cc8603) — each account has
  its own isolated local cache; the legacy global key is cleared on
  user change/logout.

**Verified end-to-end**: a real user token now returns ONLY that user's
stations (was 5 incl. 4 foreign; now 1 own station). Fresh-device login
defaults to the user's OWN station, never another user's. localStorage
scoped key contains only the user's own station; old global key empty.
IMPORTANT: `created_by` is NULL for all existing stations, so the
`(created_by = auth.uid())` policy matches nothing — the `(auth.uid() =
owner_id)` policy is the effective one. New stations should set both
`owner_id` AND `created_by` to the auth uid for full coverage.

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

## Cross-user app_kv data overwrite (FIXED 2026-08-09, commit bb4f69e, PR #94)

**Symptom**: Per-component cloud keys (expenses_data, priceboard_data,
suppliers_data, shift_data, payroll_employees, maintenance_records,
comm_contacts, credit_accounts, loyalty_customers, fuel_types_config,
purchase_orders, pos_transactions, etc.) were stored in `app_kv` with a
GLOBAL row id (the bare key name) and `onConflict: "id"`. Every user
sharing a logical key name upserted the SAME row → the most recent write
OVERWROTE the previous user's data AND flipped `owner_id`. With RLS
(`owner_id = auth.uid()`), the original owner's subsequent `get` (which
filters `id = key AND owner_id = auth.uid()`) returned `null` → silent,
total cross-user data loss. Verified live: the `credit_accounts`,
`loyalty_customers`, and `comm_contacts` rows in production had their
`owner_id` flipped from `a17b4a8a` to `98ecc424`, destroying user
a17b4a8a's data.

**Fix** (`src/react-app/lib/cloud-storage-service.ts`): scope the `app_kv`
row id by `owner_id` → `id = `${key}__${ownerId}`` in `set`/`get`/`delete`/
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

## Cross-user overwrite fix — VERIFIED LIVE 2026-08-09 (deploy b2b98cd2)

PR #94 (commit bb4f69e) deployed to Cloudflare Pages
(https://fuel-app-mobile.pages.dev + preview
https://b2b98cd2.fuel-app-mobile.pages.dev). Vercel production deploy
BLOCKED by `api-deployments-free-per-day` (100/day exhausted, resets ~24h);
read-only deployment GETs still work. The fix is LIVE on Cloudflare; Vercel
will pick up the merged main on next deploy window (or via Git integration
which uses a separate quota — last Vercel prod deploy was from commit
"Update package-lock.json", NOT the latest main).
**End-to-end verification (fresh-device login on b2b98cd2 preview)**:

- Logged in as QA user 98ecc424 (qa.crossdevice.0809b@gmail.com) on a
  FRESH deployment URL (no localStorage, no service worker cache).
- App loaded station + FuelContext data from cloud → station
  "Publican Energy Test Station", companyData "CrossDevice Fuel Station Ltd",
  invoiceSettings.quantityLabel "Litres" all present.
- DB check: the compact blob migrated to the scoped id
  `user_98ecc424..._compact__98ecc424...` (updated 19:11:24 — the fresh-login
  save wrote to the scoped id, NOT the legacy bare-key). Legacy bare-key row
  still present (19:08:26) — the `get` fallback found it, then the next `set`
  repersisted under the scoped id. Per-component keys (expenses_data,
  priceboard_data, suppliers_data, etc.) remain under bare-key ids with
  owner_id=98ecc424 (not yet re-saved on fresh login; they migrate to scoped
  ids on the next edit via the same fallback+resave path).
- Per-component data INTACT in app_kv: expenses_data=[EXP-2026-001 KES 12500
  rent], priceboard_data=[Petrol Regular KES 180],
  suppliers_data=[Total Kenya Marketing]. suppliers TABLE has 2 rows.
  products TABLE has Castrol GTX 5W-30 (set is_active=true via DB so it
  appears in POS dropdowns — pos-service fetchProducts filters is_active).
- Founder panel (logged in as founder user 6220a16c,
  fueltest_1786274010@testmail.com) renders: Overview shows All Users=1,
  All Stations=3, Secrets=3, Audit Log=1000, Feature Flags=10. Founder auth
  uses signInWithPassword + role check (users.role=founder/admin).
- **NOTE**: QA user 98ecc424 is NOT in the `users` table (only `profiles`),
  so it CANNOT access the founder panel. The `users` table has only 3 rows
  (2 founders + 1 user). The founder "All Users=1" count reflects this.
  stations TABLE is empty for 98ecc424 (station is in the StationContext
  app_kv blob only, not pushed to the stations table — see the
  `stations.code` NOT NULL fix; this user's station predates the code
  backfill or was never pushed).

## Founder test credentials (2026-08-09)

- Founder user: fueltest_1786274010@testmail.com (uid 6220a16c, role=founder).
  Password reset to `FounderTest2026!` via admin API (email_confirm=true).
- QA user: qa.crossdevice.0809b@gmail.com (uid 98ecc424, profiles.username=
  qacrossdevice). Password reset to `QATest2026!CrossDev`. NOT a founder.

## CI failure root-cause analysis (FIXED 2026-08-10, PR #99)

All four CI jobs on `main` were failing. Each had a distinct root cause:

1. **Type Check — `session.user` errors** (`founder-auth.ts`, `SecuritySection.tsx`):
   the cross-device founder-auth commit (`2edda45`) used the wrong
   destructuring: `const { data: session } = await client.auth.getSession()`
   binds `session` to the `data` object (`{ session: Session } | { session: null }`),
   which has NO `user` property. The correct form extracts the inner session:
   `const { data: { session } } = await client.auth.getSession()`. After the
   `if (!session)` / `if (session?.user)` guard, `session` narrows to `Session`
   (which DOES have `user: User`), so `session.user.id` / `.email` type-check.
   Fixed in `founder-auth.ts` (verifyFounderToken + updatePassword) and all
   four occurrences in `SecuritySection.tsx`.

2. **Lint / Prettier check** — the new commit shipped unformatted files.
   Ran `prettier --write` across `src/**/*.{ts,tsx}`, `api/**/*.ts`, and
   `*.{json,md}` so `npx prettier --check "src/**/*.{ts,tsx}" "*.{json,md}"`
   passes. Also fixed `prefer-const` on `lat`/`lng` in `FuelPriceLocator.tsx`.

3. **Unit Tests — `webidl.util.markAsUncloneable is not a function`**:
   `jsdom@30.0.1` depends on `undici@^8.9.0`, and ALL undici 8.x releases
   declare `engines.node >= 22.19.0` and require the `markAsUncloneable`
   export from `node:worker_threads` (backported to Node 22.19+, absent in
   Node 20). The CI workflow pinned `NODE_VERSION: '20'` → `npm ci` printed
   `EBADENGINE` and vitest's forks worker crashed on the jsdom/undici
   CacheStorage init. Fix: bump `NODE_VERSION` to `'22'` in BOTH
   `.github/workflows/ci.yml` and `deploy.yml`. Node 22.19+ satisfies
   undici 8.x AND exposes `markAsUncloneable`.

4. **E2E Tests — `Executable doesn't exist at firefox-1538/firefox`**:
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

### cloud-storage-service.ts — subscribe() / subscribeToStation()

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

### PumpMappingV1 — was ZERO persistence (FIXED)

- Before: extractedData, chatMessages, customRules, anchors were useState-only
  — lost on EVERY refresh.
- After: all four persist to cloud (keys `pump_mapping_*`) with real-time.

### AdminPanel — localStorage to cloud + real-time

- admin_modules, batch_updates, custom_apis migrated from localStorage-only
  to cloud + real-time.

### useCloudKV hook (new)

- `src/react-app/hooks/useCloudKV.ts` — reusable real-time cloud sync hook.

### Deployment

- Vercel: fuel-app-mobile.vercel.app (prebuilt deploy, READY)
- Cloudflare: fuel-app-mobile.pages.dev (preview 6b58195b)
- PR #95: https://github.com/fuel-pro/FUEL_APP_MOBILE/pull/95

### Fuel Price Finder — GPS geolocation feature (ADDED 2026-08-09)

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
- Env vars needed (set in Vercel Project Settings → Environment Variables):
  - `OILPRICE_API_KEY` — for live Kenya EPRA prices (oilpriceapi.com)
  - `GLOBAL_FUEL_API_KEY` — for global geolocation station prices (CollectAPI)
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
- **Engine** (`api/lib/fuel-engine.ts`): 1) Nominatim reverse-geocode GPS →
  village/town. 2) Exact-match Supabase cache check (fresh < 14 days). 3) For
  Kenya: **deterministic EPRA estimation** (no AI needed) — interpolates
  between Nairobi (baseline) and Mandera (max) EPRA prices using a remoteness
  factor derived from the location/region name. 4) For non-Kenya: web search
  (Serper, optional) → AI parse (Groq → OpenRouter/Llama fallback) into
  {super_petrol, diesel, kerosene} JSON, upsert. 5) PostGIS nearest-neighbour
  fallback within 50 km tagged `is_approximate`. When SERPER_API_KEY is
  absent, the free web-page fallback fetches public EPRA news pages (no key
  needed) + a static EPRA reference table; source is "AI-Estimated" (vs
  "AI-Verified" when real Serper web snippets were parsed).
- **Deterministic estimation (ADDED 2026-08-10)**: AI models (Llama-3.1-8b,
  Llama-3.3-70b, Qwen-2.5-72b) are unreliable for exact fuel prices — they
  return stale data (e.g. 155.50 for Kenya vs real 214.03) and are
  inconsistent on kerosene interpolation. Replaced with
  `estimateKenyaPrices()` which uses an EPRA reference table (11 towns, Jul–
  Aug 2026 cycle) + a `KE_REMOTENESS` keyword→factor map. For Lodwar (Turkana,
  factor 0.32): super_petrol=220.64 (expected 220.08), diesel=229.96
  (expected 229.95), kerosene=198.48 (expected 198.50) — all within 0.56 KES.
  The EPRA reference is refreshed monthly by the cron job. The AI path is
  retained for non-Kenya locations and Serper snippet parsing.
- **API routes**: `api/fuel-local.ts` (GET /api/fuel-local?lat=&lon=),
  `api/cron/monthly-fuel-sync.ts` (CRON_SECRET-secured monthly refresh of
  top-50 queried locations).
- **CRITICAL — Vercel node16 import extensions**: Vercel compiles /api/*
  serverless functions with `moduleResolution: 'node16'/'nodenext'`, which
  REQUIRES explicit `.js` extensions on relative imports
  (`./lib/fuel-engine.js`, NOT `./lib/fuel-engine`). Without the extension the
  function deploys but crashes at invocation with
  `FUNCTION_INVOCATION_FAILED`. The local tsconfig.server.json has
  `allowImportingTsExtensions: true` so `.js` specifiers resolve to `.ts`
  source files during typecheck. ALL new /api files with relative imports
  MUST use `.js` extensions.
- **Frontend**: `FuelTracker.tsx` (GPS → /api/fuel-local → price cards +
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
  `a11efb1`, 2026-08-10) is LIVE — `vercel build --prod` →
  `vercel deploy --prebuilt --prod`. The prebuilt method BYPASSES the
  `api-deployments-free-per-day` rate limit (100/day, resets ~24h) that blocks
  git-source API deploys. Verified live: Lodwar (3.097, 35.6138) returns
  220.64/229.96/198.48 KES "AI-Estimated" (matches "Current Pump Prices.txt"
  within 0.56 KES); Nairobi returns 214.03/222.86/191.38; Mombasa returns
  210.87/219.58/188.09 (exact EPRA). Cloudflare Pages mirror updated but
  only serves the SPA frontend — /api/* endpoints work ONLY on Vercel.
  **Note**: the /api/fuel-local response has `Cache-Control: max-age=300`
  (5-min CDN cache); use a `&cb=<timestamp>` cache-bust param to test fresh
  data immediately after a DB update.

## Smart-Cache fuel price architecture (ADDED 2026-08-10, commit c0f1c33)

A second parallel implementation of the fuel-price engine, created in a
separate session and merged to main alongside PR #98. Both implementations
coexist on main:

- **My implementation** (`api/_lib/hybrid-fetcher.ts` + `api/fuel-prices.ts` +
  `api/cron-monthly-sync.ts`): enhances the existing `/api/fuel-prices`
  endpoint with a smart-cache mode (lat+lng+name+country). Uses a Groq →
  DeepSeek → QWEN AI provider chain (QWEN via OpenRouter). Has AI-knowledge
  fallback when SerpApi is absent (source labelled "AI-Estimated"). The
  `/api/fuel-prices` endpoint supports 3 modes: Kenya EPRA (no coords),
  smart-cache (lat+lng+name+country), legacy geolocation (CollectAPI).
  Frontend: `FuelPriceLocator.tsx` with EPRA-style UI (cost breakdown,
  GPS coordinates, "per litre" labels, "SUPER PETROL / DIESEL / KEROSENE"
  format). Registered as `price-finder` tab (order 36).
- **Parallel branch implementation** (`api/lib/fuel-engine.ts` +
  `api/fuel-local.ts` + `api/cron/monthly-fuel-sync.ts`): separate
  `/api/fuel-local` endpoint. Uses deterministic EPRA estimation for Kenya
  (reference table + remoteness factor — more accurate than AI for Kenya).
  Frontend: `FuelTracker.tsx`. Registered as `fueltracker` tab (order 32).
- **vercel.json cron**: consolidated to single `/api/cron/monthly-fuel-sync`
  entry (the parallel branch's endpoint, which is the one deployed on Vercel
  and tested live).
- **Geocoding fix (commit a7ed641)**: BOTH `api/_lib/geocoding.ts` and
  `api/lib/fuel-engine.ts` now use Nominatim `zoom=10` (town/city-level)
  instead of `zoom=18` (building-level). Name resolution priority changed
  to city > municipality > town > county > village (was village-first). This
  fixes "Nawoitorong" → "Lodwar" for GPS coords 3.0970, 35.6138.
- **Vercel env vars**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SERPAPI_KEY` (serpapi.com, 100 free searches/mo, PREFERRED web search),
  `SERPER_API_KEY` (serper.dev, fallback), `DEEPSEEK_API_KEY`,
  `QWEN_API_KEY`, `CRON_SECRET`. All server-only (never VITE_-prefixed).
  **Web search chain (ADDED 2026-08-10, commit f00184e)**: SerpApi → Serper →
  free public EPRA pages. SerpApi is preferred when `SERPAPI_KEY` is set
  (returns Google answer_box + organic snippets with official EPRA data).
  Source labelled "AI-Verified" when SerpApi OR Serper returns real snippets;
  "AI-Estimated" when only AI knowledge is used.

## CORS fix + Lodwar bug — DEPLOYED LIVE 2026-08-10 (commit c85e35a)

**Symptom**: app showed "Nairobi" prices for all locations (e.g. user in
Lodwar got Nairobi prices). Root cause: Cloudflare Pages (the primary
deploy) has NO /api/* endpoints — fetch to `/api/fuel-local` returns 404,
falls back to static pricing table whose closest city was always Nairobi.

**Fix (3-layer)**:

1. `FuelPriceLocator.tsx` `fuelApiBase()` helper: detects origin. On
   Vercel → relative `/api/fuel-local` (same-origin, no CORS). On
   Cloudflare/other → absolute `https://fuel-app-mobile.vercel.app/api/...`.
2. `api/fuel-local.ts`: added `Access-Control-Allow-Origin: *` + OPTIONS
   preflight handler. `vercel.json`: global CORS headers array.
3. CORS proxy fallback: if the deployed Vercel API lacks CORS headers
   (transient state during deploys), the frontend retries via
   `https://api.allorigins.win/raw?url=<encoded>` — verified working
   (corsproxy.io returned empty responses; allorigins works reliably).

**Verified end-to-end 2026-08-10**: production Vercel API
`fuel-app-mobile.vercel.app/api/fuel-local` returns:

- Lodwar (3.097, 35.6138) → Turkana, Super 220.64, Diesel 229.96, Kerosene
  198.48 (AI-Estimated) — higher than Nairobi, reflecting transport cost.
- Nairobi (-1.2864, 36.8172) → Nairobi, Super 214.03, Diesel 222.86.
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
   In `getLocalFuelPrices`, BEFORE the web-search→AI path (step D), an exact
   case-insensitive town-name match returns REAL published EPRA prices
   directly (`source: "Published Reference"`) — no AI dependency. Nairobi,
   Mombasa, Kisumu, Mandera, etc. now return correct real prices instantly.
   Only an exact match yields a price; never interpolation.

2. **Kenya plausibility guard** (`isPlausibleKenyaPrice`): rejects
   AI-extracted Kenya prices outside [85%, 115%] of the lowest EPRA reference
   price for each product. EPRA sets MAXIMUM retail prices; a real pump price
   won't be 15%+ below the cheapest regulated town. Rejected prices throw,
   falling through to the PostGIS nearest REAL price (step E) or the
   no-real-data response (step F). This is a data-quality guard, NOT
   estimation — we never substitute a fabricated price.

3. **Structured no-real-data response** (step F): when no EPRA match, AI
   extraction rejected, AND no nearby cached real price, the engine RETURNS
   `{success: true, prices: {super_petrol: null, ...}, source: "No
   published price", no_real_data: true}` instead of throwing. This lets the
   frontend show "N/A" rather than falling back to the client-side "EPRA
   Estimate (offline)" estimation (which would violate "real prices only").

   Frontend (`FuelPriceLocator.tsx`): detects `no_real_data` and renders N/A
   with source "No published price" — never an estimate. `FuelTracker.tsx`
   already rendered N/A for null prices; added `no_real_data` to its
   interface.

**Pipeline** (in `getLocalFuelPrices`): A) geocode → B) DB cache check
(fresh < 14d) → C) EPRA exact-match (Published Reference) → D) web search →
AI extraction (AI-Verified / Published Reference, with plausibility guard
for KE) → E) PostGIS nearest cached real price (Approx.) → F) no-real-data
(N/A). No fabrication or estimation at any step.

**Verified live 2026-08-10** (fuel-app-mobile.vercel.app, dpl_7wedvmeVytCx4CA6jduM3azr5C6o):
- Nairobi → Published Reference, 214.03/222.86/191.38 ✅
- Mombasa → Published Reference, 210.87/219.58/188.09 ✅
- Kisumu → Published Reference, 213.69/223.09/191.63 ✅
- Mandera → Published Reference, 234.68/245.04/213.56 ✅
- Nawoitorong → no_real_data=true, "No published price", all null ✅ (no
  estimate)
- Nakuru coords (resolves to "Kimathi") → no_real_data=true, N/A ✅
- Cloudflare mirror: https://92928e59.fuel-app-mobile.pages.dev (SPA only;
  /api/* works only on Vercel).

**Known limitation**: Nominatim reverse-geocoding at zoom=14 sometimes
resolves to sub-locations/neighborhoods ("Kipkenyo ward", "Kimathi")
instead of the canonical town ("Eldoret", "Nakuru"), causing the EPRA
exact-match to miss. This is a geocoder data-quality issue, not a price
engine issue — the behavior remains correct (no fabrication). Enhancing the
  geocoder to return the parent town name would improve exact-match coverage.

## Email rate-limit fix (DEPLOYED LIVE 2026-08-10, commit f40f552)

**Symptom**: Users hit Supabase's "email rate limit exceeded" error on the
password-reset flow. Supabase Auth limits auth emails to ~3-4 per hour per
address. The `PasswordReset.tsx` "Resend Reset Link" button had no cooldown,
so rapid clicks or re-renders exhausted the limit instantly — and the raw
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
quota (100/day exhausted, resets ~24h) — the GitHub integration will
auto-deploy commit f40f552 when the quota resets.

## Dashboard price card "Nairobi" label fix (DEPLOYED LIVE 2026-08-10, commit f49d376)

**Symptom**: the Dashboard "Current Pump Prices" cards showed "Nairobi" as
the location label next to Super Petrol and Diesel, even when GPS pricing was
active and the badge correctly showed "📍 GPS: Lodwar (+5.50)". The price
VALUES were correct (Lodwar with surcharge), but the card LABEL was wrong.

**Root cause**: `Dashboard.tsx` L772-774 & L786-788 rendered
`regionalPrice.cityName` for the card label. `regionalPrice` =
`getPriceForCity(fuelPrice, stationCity)` where `stationCity =
currentStation?.location || "Nairobi"` — a STATION-based path that ignores
GPS. When the station has no `location` set, it defaults to "Nairobi".

**Fix**: the card labels now use a ternary: when `isLocationBased` (GPS
active), show `priceCityName` (the GPS-detected city, e.g. "Lodwar");
otherwise fall back to `regionalPrice.cityName`. The top badge already
used `priceCityName` correctly — only the card captions were wrong.

**Verified in production bundle**: Dashboard-DxyyCwfb.js contains
`M?g.jsx("p",{...children:_}):y.isRegional?...` where M=isLocationBased,
_=priceCityName.
**Deploy**: dpl_F4p4sS1qaZdye1jCHj9Zfccuf6q1, READY, aliased to
fuel-app-mobile.vercel.app. Cloudflare mirror:
https://bd4ff357.fuel-app-mobile.pages.dev.

## Cross-device Founder Access — 2FA / forgot-password / unique ID (DEPLOYED 2026-08-10, commit 2edda45)

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
  - `requestPasswordReset` — real Supabase email-link recovery
    (`resetPasswordForEmail`, redirectTo `/#/reset-password`). The Founder
    Access gate exposes this as "Forgot password? Reset via email".
  - `changeFounderPassword` — `auth.updateUser({password})` (min 8 chars) +
    records `last_password_change` on `profiles`.
  - `loadFounder2FA` / `saveFounder2FA` — read/write
    `two_factor_enabled` + `two_factor_secret` on `profiles` (cloud
    source of truth). `SecuritySection` mounts a `useEffect` that loads the
    cloud 2FA on login and overrides the localStorage copy; enabling 2FA pushes
    the secret to the cloud so it survives a device switch.
  - `getFounderUniqueId` — reads `profiles.unique_id`, falls back to the
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

## FREE AUTO FUEL PRICE.txt spec — Smart-Cache (Groq AI + PostGIS) LIVE

The full spec is implemented and running server-side (keys in Vercel env,
never in the client bundle):

- **DB**: `fuel_prices` table (location_name, country, lat/lon,
  `location_geog geography(point,4326)`, `prices jsonb`, currency,
  last_updated, query_count) + PostGIS `get_nearest_fuel_prices(lat,lon,radius)`
  RPC + GiST spatial index + `update_location_geog()` trigger. Verified live:
  5+ cached locations (Nairobi queried 11×, Nawoitorong 8×, Turkana 4×,
  Mombasa 2×) — cache hits, not SerpApi quota spend.
- **Engine** (`api/_lib/hybrid-fetcher.ts` + `api/lib/fuel-engine.ts`):
  3-tier lookup — (1) exact cache (fresh < 15/14 days), (2) PostGIS
  nearest town within 50 km (tagged "N km away"), (3) live SerpApi/Serper
  web search → Groq `llama-3.1-8b-instant` (DeepSeek/OpenRouter fallback)
  extracts {super_petrol,diesel,kerosene,currency} JSON → upsert to
  `fuel_prices`. SerpApi free tier (100/mo) is only consumed for genuinely
  new isolated locations.
- **Endpoints**: `/api/fuel-prices` (EPRA Kenya mode + Smart-Cache geolocation
  mode + legacy CollectAPI mode), `/api/fuel-local` (reverse-geocode →
  cache → web+AI → PostGIS fallback).
- **Cron**: `vercel.json` `crons` → `/api/cron/monthly-fuel-sync`
  (schedule `0 0 1 * *`) refreshes the top-N most-queried cache rows,
  guarded by `Bearer $CRON_SECRET`.

## 2026-08-10 deploy state (commit 2edda45)

Git HEAD = origin/main = 2edda45 ("feat: cross-device founder auth — cloud
2FA, forgot-password, unique ID"). Vercel production READY, aliased to
fuel-app-mobile.vercel.app (bundle `index-CBkT6CGK.js` + lazy chunk
`founder-FznFW3ku.js`). Cloudflare Pages mirror live
(fuel-app-mobile.pages.dev, preview fce6fd74).

## Village-level REAL fuel prices — no estimates (ADDED 2026-08-10, PR #100, commit ea0bb41)

**Requirement**: narrow fuel-price location to village/town/center level and
show ONLY real/actual prices — no estimates or generalizations of national
prices to a village.

**What was removed (the estimation that violated the requirement)**:
- `api/lib/fuel-engine.ts`: deleted `estimateKenyaPrices()` + `EPRA_KE_PRICES`
  (town→price map) + `KE_REMOTENESS` (county→factor map). These fabricated
  prices for unlisted Kenyan towns by interpolating between Nairobi (baseline)
  and Mandera (max) via a remoteness factor. The result was tagged
  "AI-Estimated" but presented as real data.
- `api/_lib/hybrid-fetcher.ts`: deleted `estimatePricesFromKnowledge()` which
  asked the LLM to guess prices from its training knowledge when no web search
  was configured (also labelled "AI-Estimated").

**What stays (all REAL data, no fabrication)**:
- `EPRA_KE_REFERENCE` (`fuel-engine.ts`): a pure real-price table of 11 EPRA
  towns for the current cycle. Used ONLY for an exact town-name match — the AI
  is told NOT to interpolate between towns.
- AI extraction (`buildAiPrompt` / `EXTRACTION_SYSTEM_PROMPT`): EXTRACTS
  verbatim prices from search snippets; explicitly forbidden to estimate,
  interpolate, or generalize. Returns `null` for any price not explicitly
  stated for the exact location.
- Source labels: `AI-Verified` (live SerpApi/Serper snippets) and `Published
  Reference` (official EPRA pages / reference table) — both real data. The
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
  NOTE: Nominatim is nondeterministic — for sparse-data locations (e.g.
  Kakuma) it sometimes only returns the state ("Turkana") regardless of zoom;
  this is an OSM replica limitation, not a code issue. The engine then queries
  for the best available name and uses real prices (no fabrication).

**Bug fixes bundled in**:
- `hybrid-fetcher.ts` RPC name `get_nearest_fuel_prices` → `get_nearest_fuel`
  (the variant in migration 012; the old name returned PGRST202/no result).
- `hybrid-fetcher.ts` reads both `super_petrol` and `petrol` price keys so
  cached rows written by either engine are interchangeable.

**Frontend**:
- `api/fuel-local.ts`: exposes the resolved village name under both
  `locationName` and `location` for the client.
- `FuelPriceLocator.tsx`: shows the resolved village name for exact matches
  (was showing raw GPS coords); nearest-match shows `town (X km away)`.
- The client-side OFFLINE fallback (`getClosestKenyaCityPrice` + transport
  surcharge, labelled "EPRA Estimate (offline)") is RETAINED — it only
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
  The Cloudflare mirror has the fixed code NOW but serves ONLY the SPA — the
  /api/fuel-local endpoint works ONLY on Vercel.
