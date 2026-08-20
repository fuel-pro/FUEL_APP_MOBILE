import { trpc } from "@/providers/trpc";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export interface RealUser {
  id: number;
  unionId: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: "user" | "admin";
  status: "active" | "suspended" | "banned" | "pending";
  countryCode: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignInAt: Date;
}

export interface UserStats {
  total: number;
  byRole: { role: string; count: number }[];
  byStatus: { status: string; count: number }[];
  recent7Days: number;
}

// Sync localStorage users to backend and vice versa
function syncUsersWithBackend(localUsers: any[], backendUsers: any[]): any[] {
  const merged = [...backendUsers];
  for (const local of localUsers) {
    if (!merged.find(u => u.id === local.id)) {
      merged.push(local);
    }
  }
  return merged;
}

// Save users to localStorage for offline access
function saveToLocalStorage(users: any[]) {
  try {
    localStorage.setItem("fuelpro_users_v3", JSON.stringify(users));
    const bc = new BroadcastChannel("fuelpro_sync");
    bc.postMessage({ type: "users_updated", users });
  } catch {
    /* ignore */
  }
}

export function useRealUsers() {
  const queryClient = useQueryClient();

  // Try to fetch from backend first
  const {
    data: backendUsers,
    isLoading: loadingBackend,
    error: backendError,
  } = trpc.userMgmt.list.useQuery(undefined, {
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  const { data: backendStats, isLoading: loadingStats } =
    trpc.userMgmt.stats.useQuery(undefined, {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    });

  // Get localStorage users as fallback
  const [localUsers, setLocalUsers] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem("fuelpro_users_v3");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Use backend data if available, otherwise localStorage
  const users =
    backendUsers && backendUsers.length > 0
      ? backendUsers
      : localUsers.length > 0
        ? localUsers
        : [];

  // Merge stats
  const stats = backendStats
    ? backendStats
    : {
        total: localUsers.length,
        byRole: [],
        byStatus: [],
        recent7Days: 0,
      };

  // Sync local users when backend returns data
  useEffect(() => {
    if (backendUsers && backendUsers.length > 0) {
      const merged = syncUsersWithBackend(localUsers, backendUsers);
      saveToLocalStorage(merged);
      setLocalUsers(merged);
    }
  }, [backendUsers]);

  // Mutations for user management
  const updateRoleMutation = trpc.userMgmt.updateRole.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userMgmt.list"] });
      queryClient.invalidateQueries({ queryKey: ["userMgmt.stats"] });
    },
  });

  const updateStatusMutation = trpc.userMgmt.updateStatus.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userMgmt.list"] });
      queryClient.invalidateQueries({ queryKey: ["userMgmt.stats"] });
    },
  });

  // Also update local state for offline support
  const updateLocalUser = (userId: number, updates: any) => {
    const updated = localUsers.map(u =>
      u.id === userId ? { ...u, ...updates } : u
    );
    setLocalUsers(updated);
    saveToLocalStorage(updated);
  };

  // Actions
  const updateRole = useCallback(
    async (userId: number, role: "user" | "admin") => {
      try {
        await updateRoleMutation.mutateAsync({ id: userId, role });
        updateLocalUser(userId, { role });
        return { success: true };
      } catch (error) {
        console.error("Failed to update user role:", error);
        updateLocalUser(userId, { role });
        return { success: false, error: String(error) };
      }
    },
    [updateRoleMutation, localUsers]
  );

  const updateStatus = useCallback(
    async (
      userId: number,
      status: "active" | "suspended" | "banned" | "pending"
    ) => {
      try {
        await updateStatusMutation.mutateAsync({ id: userId, status });
        updateLocalUser(userId, { status });
        return { success: true };
      } catch (error) {
        console.error("Failed to update user status:", error);
        updateLocalUser(userId, { status });
        return { success: false, error: String(error) };
      }
    },
    [updateStatusMutation, localUsers]
  );

  const refreshUsers = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["userMgmt.list"] });
    queryClient.invalidateQueries({ queryKey: ["userMgmt.stats"] });
    try {
      const stored = localStorage.getItem("fuelpro_users_v3");
      if (stored) setLocalUsers(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, [queryClient]);

  return {
    users,
    stats,
    loadingUsers: loadingBackend,
    loadingStats,
    isLoading: loadingBackend || loadingStats,
    usersError: backendError,
    updateRole,
    updateStatus,
    refreshUsers,
  };
}
