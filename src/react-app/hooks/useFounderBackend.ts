import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  fetchFounderAuditLog,
  writeFounderAudit,
  fetchAuditSummary,
  fetchFounderSession,
  updateFounderSession,
  fetchFounderUsers,
  fetchFounderStations,
  fetchFounderSalesAnalytics,
  AuditSeverity,
  AuditEntry,
  FounderSessionData,
  CloudUser,
  CloudStation,
} from "@/react-app/features/founder/founderAccessApi";

export type { AuditSeverity, AuditEntry, FounderSessionData, CloudUser, CloudStation };

/**
 * useFounderBackend — Real Supabase-backed integration for Founder Access Panel.
 *
 * Replaces the stubbed tRPC layer with actual Supabase queries.
 * Provides:
 *   - Audit logging (persisted to Supabase via writeFounderAudit)
 *   - Audit log retrieval (from Supabase founder_audit_log table)
 *   - Founder session management (2FA, password, contact)
 *   - Station & sales analytics (from Supabase)
 *   - User management (from Supabase profiles table)
 *
 * Falls back to localStorage only if Supabase is unavailable.
 */
export function useFounderBackend() {
  const queryClient = useQueryClient();

  /* ─── Audit Log List ─── */
  const {
    data: auditLogData,
    isLoading: auditLoading,
    refetch: refetchAudit,
  } = useQuery({
    queryKey: ["founder", "audit"],
    queryFn: () => fetchFounderAuditLog({ limit: 100 }),
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  // Transform data or use localStorage fallback
  const auditLog: AuditEntry[] = useMemo(() => {
    if (auditLogData && auditLogData.length > 0) {
      return auditLogData;
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
  }, [auditLogData]);

  /* ─── Audit Summary ─── */
  const { data: auditSummary } = useQuery({
    queryKey: ["founder", "audit", "summary"],
    queryFn: fetchAuditSummary,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  /* ─── Audit Logging Mutation ─── */
  const logAuditMutation = useMutation({
    mutationFn: ({
      event,
      detail,
      severity,
    }: {
      event: string;
      detail: string;
      severity: AuditSeverity;
    }) => writeFounderAudit(event, detail, severity),
    // Don't throw on error - audit logging is fire-and-forget
    onError: () => {/* ignore */},
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

      // Also persist to Supabase (non-blocking)
      logAuditMutation.mutate({ event, detail, severity });
    },
    [logAuditMutation]
  );

  /* ─── Founder Session ─── */
  const {
    data: founderSessionData,
    isLoading: sessionLoading,
    refetch: refetchSession,
  } = useQuery({
    queryKey: ["founder", "session"],
    queryFn: fetchFounderSession,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const founderSession: FounderSessionData = useMemo(() => {
    if (founderSessionData) {
      return founderSessionData;
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
  }, [founderSessionData]);

  const saveFounderSessionMutation = useMutation({
    mutationFn: (data: Partial<FounderSessionData>) => updateFounderSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["founder", "session"] });
    },
  });

  const saveFounderSession = useCallback(
    (data: Partial<FounderSessionData>) => {
      // Persist to Supabase
      saveFounderSessionMutation.mutate(data);

      // Always persist to localStorage for offline fallback
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
    [saveFounderSessionMutation]
  );

  /* ─── Users (from Supabase profiles) ─── */
  const {
    data: allBackendUsers,
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ["founder", "users"],
    queryFn: fetchFounderUsers,
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  /* ─── Stations (from Supabase) ─── */
  const {
    data: allBackendStations,
    isLoading: allStationsLoading,
    refetch: refetchStations,
  } = useQuery({
    queryKey: ["founder", "stations"],
    queryFn: fetchFounderStations,
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  const stationCount = allBackendStations?.length || 0;

  /* ─── Sales Analytics ─── */
  const { data: salesAnalytics, refetch: refetchAnalytics } = useQuery({
    queryKey: ["founder", "sales", "analytics"],
    queryFn: fetchFounderSalesAnalytics,
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  /* ─── Refresh Helper ─── */
  const refresh = useCallback(() => {
    refetchAudit();
    refetchSession();
    refetchUsers();
    refetchStations();
    refetchAnalytics();
  }, [refetchAudit, refetchSession, refetchUsers, refetchStations, refetchAnalytics]);

  return {
    // Audit
    logAudit,
    auditLog,
    auditLoading,
    auditSummary,

    // Founder Session (2FA / Password)
    founderSession,
    saveFounderSession,
    sessionSaving: saveFounderSessionMutation.isPending,

    // Stations
    stationsLoading: allStationsLoading,
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
    refresh,
  };
}
