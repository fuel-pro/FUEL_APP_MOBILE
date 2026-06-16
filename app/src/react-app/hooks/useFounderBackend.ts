import { trpc } from "@/providers/trpc";
import { useCallback, useMemo } from "react";

export type AuditSeverity = "info" | "success" | "warning" | "danger";

export interface AuditEntry {
  id: string;
  event: string;
  detail: string;
  user: string;
  severity: "success" | "warning" | "danger" | "info";
  timestamp: string;
}

export interface FounderSessionData {
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  passwordHash: string | null;
}

/**
 * Check if we're in a static deployment (no API server)
 * In static mode, tRPC queries will fail, so we skip them
 */
function isStaticDeployment(): boolean {
  // On Vercel static deployment, /api/trpc doesn't exist
  // We detect this by checking if we're on a known static host
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  // Vercel static deployments don't have serverless functions
  // Check if this is a static deployment by attempting a quick HEAD request
  return host.includes("vercel.app") || host.includes("netlify.app");
}

/**
 * useFounderBackend — Integrates Founder Access with the tRPC backend.
 *
 * Provides:
 *   - Audit logging (persisted to MySQL via audit.log, or localStorage in static mode)
 *   - Audit log retrieval (from DB, falls back to localStorage)
 *   - Founder session management (2FA, password, contact via founder_sessions table)
 *   - Station & sales analytics (from DB)
 * 
 * In static deployment mode, skips backend queries and uses localStorage only.
 */
export function useFounderBackend() {
  const utils = trpc.useUtils();
  
  // Detect static deployment and skip backend queries
  const isStatic = useMemo(() => isStaticDeployment(), []);

  /* ─── Audit Logging ─── */
  // Skip mutation in static mode - only log to localStorage
  const logMutation = isStatic 
    ? { mutate: () => {}, mutateAsync: () => Promise.resolve(), reset: () => {} }
    : trpc.audit.log.useMutation({
        onSuccess: () => {
          // Invalidate cached lists after a new log entry
          utils.audit.listAll.invalidate();
          utils.audit.summary.invalidate();
        },
      });

  const logAudit = useCallback(
    (event: string, detail: string, severity: AuditSeverity = "info") => {
      // Always write to localStorage for immediate UI and offline support
      try {
        const entry: AuditEntry = {
          id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          event,
          detail,
          user: "FOUNDER",
          severity,
          timestamp: new Date().toISOString(),
        };
        const existing = JSON.parse(
          localStorage.getItem("fuelpro_founder_audit") || "[]"
        );
        existing.unshift(entry);
        localStorage.setItem(
          "fuelpro_founder_audit",
          JSON.stringify(existing.slice(0, 1000))
        );
      } catch {
        /* ignore */
      }

      // Also persist to backend (non-blocking)
      logMutation.mutate({ event, detail, severity });
    },
    [logMutation]
  );

  /* ─── Audit Log List ─── */
  // Skip query in static mode - use localStorage directly
  const { data: dbAuditLogs, isLoading: auditLoading } = isStatic
    ? { data: undefined, isLoading: false }
    : trpc.audit.listAll.useQuery(undefined, {
        staleTime: 1000 * 60 * 2, // 2 min cache
        retry: 1,
      });

  // Merge DB logs with localStorage fallback
  const auditLog: AuditEntry[] = useMemo(() => {
    if (dbAuditLogs && dbAuditLogs.length > 0) {
      return dbAuditLogs.map((log: any) => ({
        id: String(log.id),
        event: log.event,
        detail: log.detail || "",
        user: "FOUNDER",
        severity: (log.severity as AuditSeverity) || "info",
        timestamp: log.createdAt
          ? new Date(log.createdAt).toISOString()
          : new Date().toISOString(),
      }));
    }
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem("fuelpro_founder_audit");
      if (stored) return JSON.parse(stored);
    } catch {
      /* ignore */
    }
    return [
      {
        id: "1",
        event: "System Initialized",
        detail: "FuelPro admin panel created",
        user: "SYSTEM",
        severity: "info" as const,
        timestamp: new Date().toISOString(),
      },
    ];
  }, [dbAuditLogs]);

  /* ─── Audit Summary (analytics) ─── */
  // Skip query in static mode
  const { data: auditSummary } = isStatic
    ? { data: undefined }
    : trpc.audit.summary.useQuery(undefined, {
        staleTime: 1000 * 60 * 5,
        retry: 1,
      });

  /* ─── Founder Session (2FA / Password / Contact) ─── */
  // Skip query in static mode
  const { data: dbFounderSession } = isStatic
    ? { data: undefined }
    : trpc.audit.getFounderSession.useQuery(undefined, {
        staleTime: 1000 * 60 * 5,
        retry: 1,
      });

  // Skip mutation in static mode
  const upsertSessionMutation = isStatic
    ? { mutate: () => {}, mutateAsync: () => Promise.resolve(), reset: () => {} }
    : trpc.audit.upsertFounderSession.useMutation({
        onSuccess: () => {
          utils.audit.getFounderSession.invalidate();
        },
      });

  const founderSession: FounderSessionData = useMemo(() => {
    if (dbFounderSession) {
      return {
        twoFactorEnabled: dbFounderSession.twoFactorEnabled || false,
        twoFactorSecret: dbFounderSession.twoFactorSecret || null,
        contactEmail: dbFounderSession.contactEmail || null,
        contactPhone: dbFounderSession.contactPhone || null,
        passwordHash: dbFounderSession.passwordHash || null,
      };
    }
    // Fallback to localStorage
    try {
      const saved = localStorage.getItem("fuelpro_founder_2fa");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          twoFactorEnabled: parsed.enabled || false,
          twoFactorSecret: parsed.secret || null,
          contactEmail: null,
          contactPhone: null,
          passwordHash: null,
        };
      }
    } catch {
      /* ignore */
    }
    return {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      contactEmail: null,
      contactPhone: null,
      passwordHash: null,
    };
  }, [dbFounderSession]);

  const saveFounderSession = useCallback(
    (data: Partial<FounderSessionData>) => {
      // Persist to backend
      upsertSessionMutation.mutate({
        twoFactorEnabled: data.twoFactorEnabled,
        twoFactorSecret: data.twoFactorSecret,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        passwordHash: data.passwordHash,
      });

      // Also persist to localStorage for offline fallback
      if (data.twoFactorEnabled !== undefined) {
        try {
          const existing = JSON.parse(
            localStorage.getItem("fuelpro_founder_2fa") || "{}"
          );
          existing.enabled = data.twoFactorEnabled;
          if (data.twoFactorSecret) existing.secret = data.twoFactorSecret;
          localStorage.setItem("fuelpro_founder_2fa", JSON.stringify(existing));
        } catch {
          /* ignore */
        }
      }
      if (data.contactEmail || data.contactPhone) {
        try {
          const existing = JSON.parse(
            localStorage.getItem("fuelpro_founder_contact") || "{}"
          );
          if (data.contactEmail) existing.email = data.contactEmail;
          if (data.contactPhone) existing.phone = data.contactPhone;
          localStorage.setItem(
            "fuelpro_founder_contact",
            JSON.stringify(existing)
          );
        } catch {
          /* ignore */
        }
      }
      if (data.passwordHash) {
        try {
          const existing = JSON.parse(
            localStorage.getItem("fuelpro_founder_password") || "{}"
          );
          existing.password = data.passwordHash;
          localStorage.setItem(
            "fuelpro_founder_password",
            JSON.stringify(existing)
          );
        } catch {
          /* ignore */
        }
      }
    },
    [upsertSessionMutation]
  );

  /* ─── Stations (from backend) ─── */
  // Skip query in static mode
  const { data: stationsData, isLoading: stationsLoading } = isStatic
    ? { data: undefined, isLoading: false }
    : trpc.station.list.useQuery(undefined, {
        staleTime: 1000 * 60 * 2,
        retry: 1,
      });

  const stationCount = stationsData?.length || 0;

  /* ─── Sales Analytics (from backend) ─── */
  // Skip query in static mode
  const { data: salesAnalytics } = isStatic
    ? { data: undefined }
    : trpc.sale.analytics.useQuery(undefined, {
        staleTime: 1000 * 60 * 2,
        retry: 1,
      });

  /* ─── All Users (from backend founder auth) ─── */
  // Skip query in static mode
  const { data: allBackendUsers, isLoading: usersLoading } = isStatic
    ? { data: undefined, isLoading: false }
    : trpc.founderAuth.getAllUsers.useQuery(undefined, {
        staleTime: 1000 * 60 * 2,
        retry: 1,
      });

  /* ─── All Stations (from backend founder auth) ─── */
  // Skip query in static mode
  const { data: allBackendStations, isLoading: allStationsLoading } = isStatic
    ? { data: undefined, isLoading: false }
    : trpc.founderAuth.getAllStations.useQuery(undefined, {
        staleTime: 1000 * 60 * 2,
        retry: 1,
      });

  return {
    // Audit
    logAudit,
    auditLog,
    auditLoading,
    auditSummary,

    // Founder Session (2FA / Password)
    founderSession,
    saveFounderSession,
    sessionSaving: upsertSessionMutation.isPending,

    // Stations
    stationsData,
    stationsLoading,
    stationCount,

    // All Users (for founder dashboard)
    allBackendUsers,
    usersLoading,

    // All Stations (for founder dashboard)
    allBackendStations,
    allStationsLoading,

    // Sales Analytics
    salesAnalytics,

    // Refresh helpers
    refresh: useCallback(() => {
      utils.audit.listAll.invalidate();
      utils.audit.summary.invalidate();
      utils.audit.getFounderSession.invalidate();
      utils.station.list.invalidate();
      utils.sale.analytics.invalidate();
      utils.founderAuth.getAllUsers.invalidate();
      utils.founderAuth.getAllStations.invalidate();
    }, [utils]),
  };
}
