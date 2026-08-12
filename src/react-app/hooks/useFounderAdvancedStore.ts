/**
 * useFounderAdvancedStore — cloud-backed, real-time store for the advanced
 * Founder Access Global Console datasets.
 *
 * This hook extends the original `useFounderConsoleStore` (secrets / flags /
 * audit / settings) with 14 additional cloud-backed datasets, each real-time
 * synced across every signed-in founder device via Supabase `app_kv` +
 * Realtime. Any change made in the console on one device is written to the
 * cloud row AND broadcast instantly to every other subscribed device — zero
 * polling.
 *
 * Datasets managed here:
 *   - founder_console_webhooks
 *   - founder_console_apikeys
 *   - founder_console_announcements
 *   - founder_console_maintenance_windows
 *   - founder_console_blocklist
 *   - founder_console_cors
 *   - founder_console_envvars
 *   - founder_console_jobs
 *   - founder_console_experiments
 *   - founder_console_health_checks
 *   - founder_console_localization
 *   - founder_console_secret_access
 *
 * All keys are owner-scoped by cloudStorageService (RLS `auth.uid() = owner_id`)
 * so founder accounts are isolated. localStorage is only a read-through cache.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import cloudStorageService from "@/react-app/lib/cloud-storage-service";

/* ───────────────────────── Types ───────────────────────── */

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[]; // e.g. ["sale.completed", "user.created"]
  active: boolean;
  secret: string; // signing secret (masked in UI)
  retryCount: number;
  retryDelayMs: number;
  timeoutMs: number;
  createdAt: string;
  updatedAt?: string;
  lastTriggered?: string;
  lastStatus?: "success" | "failed" | "pending";
}

export interface ApiKeyConfig {
  id: string;
  name: string;
  key: string; // the actual key (masked in UI)
  scopes: string[];
  rateLimitPerMin: number;
  expiresAt?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  lastUsed?: string;
  usageCount: number;
}

export type AnnouncementType = "info" | "success" | "warning" | "danger";
export type AnnouncementTarget = "all" | "founders" | "users" | "station";

export interface AnnouncementConfig {
  id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  target: AnnouncementTarget;
  active: boolean;
  dismissible: boolean;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  updatedAt?: string;
  dismissCount: number;
}

export interface MaintenanceWindow {
  id: string;
  title: string;
  message: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
  showBanner: boolean;
  affectedServices: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface BlocklistEntry {
  id: string;
  ip: string;
  reason: string;
  addedBy: string;
  expiresAt?: string; // undefined = permanent
  createdAt: string;
  active: boolean;
}

export interface CorsOrigin {
  id: string;
  origin: string; // exact or wildcard pattern
  allowCredentials: boolean;
  allowedMethods: string[];
  createdAt: string;
}

export interface EnvVar {
  id: string;
  key: string;
  value: string; // masked in UI
  masked: boolean; // whether the value is secret
  category: string;
  createdAt: string;
  updatedAt?: string;
}

export type JobStatus = "idle" | "running" | "success" | "failed" | "disabled";

export interface ScheduledJob {
  id: string;
  name: string;
  description: string;
  schedule: string; // cron expression
  enabled: boolean;
  lastRun?: string;
  lastStatus: JobStatus;
  lastDurationMs?: number;
  endpoint: string;
  createdAt: string;
}

export type ExperimentStatus = "draft" | "running" | "paused" | "completed";

export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number; // 0-100
  description?: string;
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  variants: ExperimentVariant[];
  metric: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface HealthCheck {
  id: string;
  name: string;
  url: string;
  expectedStatus: number;
  intervalSec: number;
  enabled: boolean;
  lastChecked?: string;
  lastStatus?: "up" | "down" | "unknown";
  lastLatencyMs?: number;
  createdAt: string;
}

export interface LocalizationLanguage {
  id: string;
  code: string; // e.g. "en", "sw"
  name: string;
  nativeName: string;
  active: boolean;
  isDefault: boolean;
  coverage: number; // 0-100 translation coverage
  createdAt: string;
}

export interface SecretAccessLogEntry {
  id: string;
  secretKey: string;
  accessedBy: string;
  action: "view" | "rotate" | "update" | "delete" | "create";
  timestamp: string;
  ip?: string;
}

/* ───────────────────────── Keys ───────────────────────── */

const KEYS = {
  webhooks: "founder_console_webhooks",
  apikeys: "founder_console_apikeys",
  announcements: "founder_console_announcements",
  maintenance: "founder_console_maintenance_windows",
  blocklist: "founder_console_blocklist",
  cors: "founder_console_cors",
  envvars: "founder_console_envvars",
  jobs: "founder_console_jobs",
  experiments: "founder_console_experiments",
  health: "founder_console_health_checks",
  localization: "founder_console_localization",
  secretAccess: "founder_console_secret_access",
} as const;

/* ───────────────────────── Defaults ───────────────────────── */

const DEFAULT_WEBHOOK_EVENTS = [
  "sale.completed",
  "user.created",
  "user.deleted",
  "station.created",
  "station.updated",
  "flag.toggled",
  "secret.rotated",
  "payment.received",
  "payment.failed",
  "invoice.created",
];

const DEFAULT_API_SCOPES = [
  "read:stations",
  "write:stations",
  "read:users",
  "write:users",
  "read:sales",
  "write:sales",
  "read:reports",
  "admin:all",
];

const DEFAULT_CORS_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
];

const DEFAULT_ENV_CATEGORIES = [
  "Auth",
  "API",
  "Database",
  "Payments",
  "Feature",
];

const DEFAULT_LANGUAGES: LocalizationLanguage[] = [
  {
    id: "en",
    code: "en",
    name: "English",
    nativeName: "English",
    active: true,
    isDefault: true,
    coverage: 100,
    createdAt: new Date().toISOString(),
  },
  {
    id: "sw",
    code: "sw",
    name: "Swahili",
    nativeName: "Kiswahili",
    active: true,
    isDefault: false,
    coverage: 78,
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_JOBS: ScheduledJob[] = [
  {
    id: "fuel-price-sync",
    name: "Monthly Fuel Price Sync",
    description: "Refresh cached fuel prices for the most-queried locations",
    schedule: "0 0 1 * *",
    enabled: true,
    lastStatus: "success",
    endpoint: "/api/cron/monthly-fuel-sync",
    createdAt: new Date().toISOString(),
  },
  {
    id: "audit-archive",
    name: "Audit Log Archive",
    description: "Archive audit entries older than the retention threshold",
    schedule: "0 3 * * 0",
    enabled: false,
    lastStatus: "idle",
    endpoint: "/api/cron/audit-archive",
    createdAt: new Date().toISOString(),
  },
];

/* ───────────────────────── Helpers ───────────────────────── */

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function randomKey(prefix = "fpa"): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}_${hex}`;
}

function maskValue(value: string, visibleChars = 4): string {
  if (!value) return "";
  if (value.length <= visibleChars) return "•".repeat(value.length);
  return `${value.slice(0, visibleChars)}${"•".repeat(Math.min(value.length - visibleChars, 20))}`;
}

/** Generic cloud-backed real-time list manager for one key. */
function useCloudList<T>(
  key: string,
  stationId: string | undefined,
  defaultValue: T[],
  isValue: (v: unknown) => v is T[],
): {
  data: T[];
  loading: boolean;
  setData: (next: T[]) => void;
  reload: () => void;
} {
  const [data, setDataState] = useState<T[]>(defaultValue);
  const [loading, setLoading] = useState(true);
  const skipEcho = useRef(false);

  const load = useCallback(async () => {
    const cloud = await cloudStorageService.get<T[]>(key, stationId);
    if (cloud && isValue(cloud)) {
      setDataState(cloud);
    } else {
      setDataState(defaultValue);
      cloudStorageService.set(key, defaultValue, stationId).catch(() => {});
    }
    setLoading(false);
  }, [key, stationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    const unsub = cloudStorageService.subscribe<T[]>(
      key,
      stationId,
      (value) => {
        if (skipEcho.current) {
          skipEcho.current = false;
          return;
        }
        if (value && isValue(value)) setDataState(value);
      },
    );
    return () => unsub();
  }, [load, key, stationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setData = useCallback(
    (next: T[]) => {
      skipEcho.current = true;
      setDataState(next);
      cloudStorageService.set(key, next, stationId).catch(() => {});
    },
    [key, stationId],
  );

  const reload = useCallback(() => {
    cloudStorageService.invalidate(key, stationId);
    load();
  }, [load, key, stationId]);

  return { data, loading, setData, reload };
}

const isArr =
  <T>() =>
  (v: unknown): v is T[] =>
    Array.isArray(v);

/* ───────────────────────── Main hook ───────────────────────── */

export function useFounderAdvancedStore(stationId?: string) {
  /* Webhooks */
  const webhooksStore = useCloudList<WebhookConfig>(
    KEYS.webhooks,
    stationId,
    [],
    isArr<WebhookConfig>(),
  );
  /* API Keys */
  const apikeysStore = useCloudList<ApiKeyConfig>(
    KEYS.apikeys,
    stationId,
    [],
    isArr<ApiKeyConfig>(),
  );
  /* Announcements */
  const announcementsStore = useCloudList<AnnouncementConfig>(
    KEYS.announcements,
    stationId,
    [],
    isArr<AnnouncementConfig>(),
  );
  /* Maintenance Windows */
  const maintenanceStore = useCloudList<MaintenanceWindow>(
    KEYS.maintenance,
    stationId,
    [],
    isArr<MaintenanceWindow>(),
  );
  /* Blocklist */
  const blocklistStore = useCloudList<BlocklistEntry>(
    KEYS.blocklist,
    stationId,
    [],
    isArr<BlocklistEntry>(),
  );
  /* CORS Origins */
  const corsStore = useCloudList<CorsOrigin>(
    KEYS.cors,
    stationId,
    [],
    isArr<CorsOrigin>(),
  );
  /* Env Vars */
  const envvarsStore = useCloudList<EnvVar>(
    KEYS.envvars,
    stationId,
    [],
    isArr<EnvVar>(),
  );
  /* Scheduled Jobs */
  const jobsStore = useCloudList<ScheduledJob>(
    KEYS.jobs,
    stationId,
    DEFAULT_JOBS,
    isArr<ScheduledJob>(),
  );
  /* Experiments */
  const experimentsStore = useCloudList<Experiment>(
    KEYS.experiments,
    stationId,
    [],
    isArr<Experiment>(),
  );
  /* Health Checks */
  const healthStore = useCloudList<HealthCheck>(
    KEYS.health,
    stationId,
    [],
    isArr<HealthCheck>(),
  );
  /* Localization */
  const localizationStore = useCloudList<LocalizationLanguage>(
    KEYS.localization,
    stationId,
    DEFAULT_LANGUAGES,
    isArr<LocalizationLanguage>(),
  );
  /* Secret Access Log */
  const secretAccessStore = useCloudList<SecretAccessLogEntry>(
    KEYS.secretAccess,
    stationId,
    [],
    isArr<SecretAccessLogEntry>(),
  );

  /* ─── Webhook actions ─── */
  const upsertWebhook = useCallback(
    (wh: WebhookConfig) => {
      const exists = webhooksStore.data.some((w) => w.id === wh.id);
      const next = exists
        ? webhooksStore.data.map((w) =>
            w.id === wh.id ? { ...wh, updatedAt: new Date().toISOString() } : w,
          )
        : [...webhooksStore.data, wh];
      webhooksStore.setData(next);
    },
    [webhooksStore],
  );
  const deleteWebhook = useCallback(
    (id: string) =>
      webhooksStore.setData(webhooksStore.data.filter((w) => w.id !== id)),
    [webhooksStore],
  );
  const toggleWebhook = useCallback(
    (id: string) =>
      webhooksStore.setData(
        webhooksStore.data.map((w) =>
          w.id === id
            ? { ...w, active: !w.active, updatedAt: new Date().toISOString() }
            : w,
        ),
      ),
    [webhooksStore],
  );
  const rotateWebhookSecret = useCallback(
    (id: string) =>
      webhooksStore.setData(
        webhooksStore.data.map((w) =>
          w.id === id
            ? {
                ...w,
                secret: randomKey("whsec"),
                updatedAt: new Date().toISOString(),
              }
            : w,
        ),
      ),
    [webhooksStore],
  );
  const recordWebhookTrigger = useCallback(
    (id: string, status: "success" | "failed" | "pending") =>
      webhooksStore.setData(
        webhooksStore.data.map((w) =>
          w.id === id
            ? {
                ...w,
                lastTriggered: new Date().toISOString(),
                lastStatus: status,
              }
            : w,
        ),
      ),
    [webhooksStore],
  );

  /* ─── API Key actions ─── */
  const upsertApiKey = useCallback(
    (ak: ApiKeyConfig) => {
      const exists = apikeysStore.data.some((k) => k.id === ak.id);
      const next = exists
        ? apikeysStore.data.map((k) =>
            k.id === ak.id ? { ...ak, updatedAt: new Date().toISOString() } : k,
          )
        : [...apikeysStore.data, ak];
      apikeysStore.setData(next);
    },
    [apikeysStore],
  );
  const deleteApiKey = useCallback(
    (id: string) =>
      apikeysStore.setData(apikeysStore.data.filter((k) => k.id !== id)),
    [apikeysStore],
  );
  const toggleApiKey = useCallback(
    (id: string) =>
      apikeysStore.setData(
        apikeysStore.data.map((k) =>
          k.id === id
            ? { ...k, active: !k.active, updatedAt: new Date().toISOString() }
            : k,
        ),
      ),
    [apikeysStore],
  );
  const rotateApiKey = useCallback(
    (id: string) =>
      apikeysStore.setData(
        apikeysStore.data.map((k) =>
          k.id === id
            ? {
                ...k,
                key: randomKey("fpa"),
                usageCount: 0,
                updatedAt: new Date().toISOString(),
              }
            : k,
        ),
      ),
    [apikeysStore],
  );
  const recordApiKeyUsage = useCallback(
    (id: string) =>
      apikeysStore.setData(
        apikeysStore.data.map((k) =>
          k.id === id
            ? {
                ...k,
                usageCount: k.usageCount + 1,
                lastUsed: new Date().toISOString(),
              }
            : k,
        ),
      ),
    [apikeysStore],
  );

  /* ─── Announcement actions ─── */
  const upsertAnnouncement = useCallback(
    (a: AnnouncementConfig) => {
      const exists = announcementsStore.data.some((x) => x.id === a.id);
      const next = exists
        ? announcementsStore.data.map((x) =>
            x.id === a.id ? { ...a, updatedAt: new Date().toISOString() } : x,
          )
        : [...announcementsStore.data, a];
      announcementsStore.setData(next);
    },
    [announcementsStore],
  );
  const deleteAnnouncement = useCallback(
    (id: string) =>
      announcementsStore.setData(
        announcementsStore.data.filter((a) => a.id !== id),
      ),
    [announcementsStore],
  );
  const toggleAnnouncement = useCallback(
    (id: string) =>
      announcementsStore.setData(
        announcementsStore.data.map((a) =>
          a.id === id
            ? { ...a, active: !a.active, updatedAt: new Date().toISOString() }
            : a,
        ),
      ),
    [announcementsStore],
  );
  const recordDismiss = useCallback(
    (id: string) =>
      announcementsStore.setData(
        announcementsStore.data.map((a) =>
          a.id === id ? { ...a, dismissCount: a.dismissCount + 1 } : a,
        ),
      ),
    [announcementsStore],
  );

  /* ─── Maintenance window actions ─── */
  const upsertMaintenance = useCallback(
    (m: MaintenanceWindow) => {
      const exists = maintenanceStore.data.some((x) => x.id === m.id);
      const next = exists
        ? maintenanceStore.data.map((x) =>
            x.id === m.id ? { ...m, updatedAt: new Date().toISOString() } : x,
          )
        : [...maintenanceStore.data, m];
      maintenanceStore.setData(next);
    },
    [maintenanceStore],
  );
  const deleteMaintenance = useCallback(
    (id: string) =>
      maintenanceStore.setData(
        maintenanceStore.data.filter((m) => m.id !== id),
      ),
    [maintenanceStore],
  );
  const toggleMaintenance = useCallback(
    (id: string) =>
      maintenanceStore.setData(
        maintenanceStore.data.map((m) =>
          m.id === id
            ? { ...m, active: !m.active, updatedAt: new Date().toISOString() }
            : m,
        ),
      ),
    [maintenanceStore],
  );

  /* ─── Blocklist actions ─── */
  const addBlocklist = useCallback(
    (entry: BlocklistEntry) =>
      blocklistStore.setData([entry, ...blocklistStore.data]),
    [blocklistStore],
  );
  const deleteBlocklist = useCallback(
    (id: string) =>
      blocklistStore.setData(blocklistStore.data.filter((b) => b.id !== id)),
    [blocklistStore],
  );
  const toggleBlocklist = useCallback(
    (id: string) =>
      blocklistStore.setData(
        blocklistStore.data.map((b) =>
          b.id === id ? { ...b, active: !b.active } : b,
        ),
      ),
    [blocklistStore],
  );
  const bulkAddBlocklist = useCallback(
    (entries: BlocklistEntry[]) =>
      blocklistStore.setData([...entries, ...blocklistStore.data]),
    [blocklistStore],
  );
  const clearBlocklist = useCallback(
    () => blocklistStore.setData([]),
    [blocklistStore],
  );

  /* ─── CORS actions ─── */
  const upsertCors = useCallback(
    (c: CorsOrigin) => {
      const exists = corsStore.data.some((x) => x.id === c.id);
      const next = exists
        ? corsStore.data.map((x) => (x.id === c.id ? c : x))
        : [...corsStore.data, c];
      corsStore.setData(next);
    },
    [corsStore],
  );
  const deleteCors = useCallback(
    (id: string) =>
      corsStore.setData(corsStore.data.filter((c) => c.id !== id)),
    [corsStore],
  );

  /* ─── Env var actions ─── */
  const upsertEnvVar = useCallback(
    (e: EnvVar) => {
      const exists = envvarsStore.data.some((x) => x.id === e.id);
      const next = exists
        ? envvarsStore.data.map((x) =>
            x.id === e.id ? { ...e, updatedAt: new Date().toISOString() } : x,
          )
        : [...envvarsStore.data, e];
      envvarsStore.setData(next);
    },
    [envvarsStore],
  );
  const deleteEnvVar = useCallback(
    (id: string) =>
      envvarsStore.setData(envvarsStore.data.filter((e) => e.id !== id)),
    [envvarsStore],
  );
  const bulkImportEnvVars = useCallback(
    (entries: EnvVar[]) =>
      envvarsStore.setData([...envvarsStore.data, ...entries]),
    [envvarsStore],
  );

  /* ─── Job actions ─── */
  const toggleJob = useCallback(
    (id: string) =>
      jobsStore.setData(
        jobsStore.data.map((j) =>
          j.id === id ? { ...j, enabled: !j.enabled } : j,
        ),
      ),
    [jobsStore],
  );
  const runJobNow = useCallback(
    (id: string) =>
      jobsStore.setData(
        jobsStore.data.map((j) =>
          j.id === id
            ? {
                ...j,
                lastStatus: "running",
                lastRun: new Date().toISOString(),
              }
            : j,
        ),
      ),
    [jobsStore],
  );
  const finishJob = useCallback(
    (id: string, status: "success" | "failed", durationMs: number) =>
      jobsStore.setData(
        jobsStore.data.map((j) =>
          j.id === id
            ? {
                ...j,
                lastStatus: status,
                lastDurationMs: durationMs,
                lastRun: new Date().toISOString(),
              }
            : j,
        ),
      ),
    [jobsStore],
  );
  const upsertJob = useCallback(
    (job: ScheduledJob) => {
      const exists = jobsStore.data.some((j) => j.id === job.id);
      const next = exists
        ? jobsStore.data.map((j) => (j.id === job.id ? job : j))
        : [...jobsStore.data, job];
      jobsStore.setData(next);
    },
    [jobsStore],
  );
  const deleteJob = useCallback(
    (id: string) =>
      jobsStore.setData(jobsStore.data.filter((j) => j.id !== id)),
    [jobsStore],
  );

  /* ─── Experiment actions ─── */
  const upsertExperiment = useCallback(
    (e: Experiment) => {
      const exists = experimentsStore.data.some((x) => x.id === e.id);
      const next = exists
        ? experimentsStore.data.map((x) =>
            x.id === e.id ? { ...e, updatedAt: new Date().toISOString() } : x,
          )
        : [...experimentsStore.data, e];
      experimentsStore.setData(next);
    },
    [experimentsStore],
  );
  const deleteExperiment = useCallback(
    (id: string) =>
      experimentsStore.setData(
        experimentsStore.data.filter((e) => e.id !== id),
      ),
    [experimentsStore],
  );
  const setExperimentStatus = useCallback(
    (id: string, status: ExperimentStatus) =>
      experimentsStore.setData(
        experimentsStore.data.map((e) =>
          e.id === id
            ? { ...e, status, updatedAt: new Date().toISOString() }
            : e,
        ),
      ),
    [experimentsStore],
  );

  /* ─── Health check actions ─── */
  const upsertHealthCheck = useCallback(
    (h: HealthCheck) => {
      const exists = healthStore.data.some((x) => x.id === h.id);
      const next = exists
        ? healthStore.data.map((x) => (x.id === h.id ? h : x))
        : [...healthStore.data, h];
      healthStore.setData(next);
    },
    [healthStore],
  );
  const deleteHealthCheck = useCallback(
    (id: string) =>
      healthStore.setData(healthStore.data.filter((h) => h.id !== id)),
    [healthStore],
  );
  const toggleHealthCheck = useCallback(
    (id: string) =>
      healthStore.setData(
        healthStore.data.map((h) =>
          h.id === id ? { ...h, enabled: !h.enabled } : h,
        ),
      ),
    [healthStore],
  );
  const recordHealthCheck = useCallback(
    (id: string, status: "up" | "down", latencyMs: number) =>
      healthStore.setData(
        healthStore.data.map((h) =>
          h.id === id
            ? {
                ...h,
                lastChecked: new Date().toISOString(),
                lastStatus: status,
                lastLatencyMs: latencyMs,
              }
            : h,
        ),
      ),
    [healthStore],
  );

  /* ─── Localization actions ─── */
  const upsertLanguage = useCallback(
    (l: LocalizationLanguage) => {
      const exists = localizationStore.data.some((x) => x.id === l.id);
      let next: LocalizationLanguage[];
      if (exists) {
        next = localizationStore.data.map((x) => (x.id === l.id ? l : x));
      } else {
        next = [...localizationStore.data, l];
      }
      // Only one default at a time.
      if (l.isDefault) {
        next = next.map((x) =>
          x.id === l.id ? x : { ...x, isDefault: false },
        );
      }
      localizationStore.setData(next);
    },
    [localizationStore],
  );
  const deleteLanguage = useCallback(
    (id: string) =>
      localizationStore.setData(
        localizationStore.data.filter((l) => l.id !== id),
      ),
    [localizationStore],
  );
  const toggleLanguage = useCallback(
    (id: string) =>
      localizationStore.setData(
        localizationStore.data.map((l) =>
          l.id === id ? { ...l, active: !l.active } : l,
        ),
      ),
    [localizationStore],
  );
  const setDefaultLanguage = useCallback(
    (id: string) =>
      localizationStore.setData(
        localizationStore.data.map((l) => ({
          ...l,
          isDefault: l.id === id,
        })),
      ),
    [localizationStore],
  );

  /* ─── Secret access log actions ─── */
  const recordSecretAccess = useCallback(
    (entry: Omit<SecretAccessLogEntry, "id" | "timestamp">) =>
      secretAccessStore.setData(
        [
          {
            ...entry,
            id: uid(),
            timestamp: new Date().toISOString(),
          },
          ...secretAccessStore.data,
        ].slice(0, 1000),
      ),
    [secretAccessStore],
  );
  const clearSecretAccess = useCallback(
    () => secretAccessStore.setData([]),
    [secretAccessStore],
  );

  return {
    loading:
      webhooksStore.loading ||
      apikeysStore.loading ||
      announcementsStore.loading ||
      maintenanceStore.loading ||
      blocklistStore.loading ||
      corsStore.loading ||
      envvarsStore.loading ||
      jobsStore.loading ||
      experimentsStore.loading ||
      healthStore.loading ||
      localizationStore.loading ||
      secretAccessStore.loading,
    /* webhooks */
    webhooks: webhooksStore.data,
    upsertWebhook,
    deleteWebhook,
    toggleWebhook,
    rotateWebhookSecret,
    recordWebhookTrigger,
    /* api keys */
    apiKeys: apikeysStore.data,
    upsertApiKey,
    deleteApiKey,
    toggleApiKey,
    rotateApiKey,
    recordApiKeyUsage,
    /* announcements */
    announcements: announcementsStore.data,
    upsertAnnouncement,
    deleteAnnouncement,
    toggleAnnouncement,
    recordDismiss,
    /* maintenance */
    maintenanceWindows: maintenanceStore.data,
    upsertMaintenance,
    deleteMaintenance,
    toggleMaintenance,
    /* blocklist */
    blocklist: blocklistStore.data,
    addBlocklist,
    deleteBlocklist,
    toggleBlocklist,
    bulkAddBlocklist,
    clearBlocklist,
    /* cors */
    corsOrigins: corsStore.data,
    upsertCors,
    deleteCors,
    /* env vars */
    envVars: envvarsStore.data,
    upsertEnvVar,
    deleteEnvVar,
    bulkImportEnvVars,
    /* jobs */
    jobs: jobsStore.data,
    toggleJob,
    runJobNow,
    finishJob,
    upsertJob,
    deleteJob,
    /* experiments */
    experiments: experimentsStore.data,
    upsertExperiment,
    deleteExperiment,
    setExperimentStatus,
    /* health checks */
    healthChecks: healthStore.data,
    upsertHealthCheck,
    deleteHealthCheck,
    toggleHealthCheck,
    recordHealthCheck,
    /* localization */
    languages: localizationStore.data,
    upsertLanguage,
    deleteLanguage,
    toggleLanguage,
    setDefaultLanguage,
    /* secret access log */
    secretAccessLog: secretAccessStore.data,
    recordSecretAccess,
    clearSecretAccess,
    /* utility */
    uid,
    randomKey,
    maskValue,
    DEFAULT_WEBHOOK_EVENTS,
    DEFAULT_API_SCOPES,
    DEFAULT_CORS_METHODS,
    DEFAULT_ENV_CATEGORIES,
  };
}

export type FounderAdvancedStore = ReturnType<typeof useFounderAdvancedStore>;
