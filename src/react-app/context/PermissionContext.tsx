import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";

// ============================================================
// PERMISSION CONTEXT v3 - Hierarchy: Owner > Manager > Staff > Auditor
// Owner: Full access, cannot be revoked, can grant per-role tab access
// Manager: Operational control, can invite Staff/Auditor, assign pumps/shifts
// Staff: Daily tasks, limited to assigned pumps/shifts
// Auditor: Read-only audit records and reports
// ============================================================

export type UserRole = "owner" | "manager" | "staff" | "auditor";

interface TeamMember {
  id: string;
  username: string;
  role: UserRole;
  assignedPumps: string[];
  assignedShifts: string[];
  invitedBy: string;
  invitedAt: string;
  expiresAt?: string;
  active: boolean;
}

interface AccessInvite {
  id: string;
  role: UserRole;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  usedBy?: string;
  usedAt?: string;
  maxUses: number;
  uses: number;
}

// --- TAB ACCESS MAP: which permission key gates each tab ---
export const TAB_PERMISSION_MAP: Record<string, keyof PermissionConfig> = {
  dashboard: "canViewDashboard",
  sales: "canViewSales",
  pos: "canUsePOS",
  inventory: "canViewInventory",
  livetransaction: "canViewLiveTransactions",
  offloading: "canViewInventory",
  delivery: "canViewInventory",
  invoice: "canViewSales",
  credit: "canViewCredit",
  debt: "canViewDebt",
  mpesa: "canViewMpesa",
  payroll: "canViewPayroll",
  shifts: "canViewShifts",
  customers: "canViewLoyalty",
  quality: "canViewAnalytics",
  fuelsalesreport: "canViewAnalytics",
  reports: "canViewReports",
  analytics: "canViewAnalytics",
  audit: "canViewAudit",
  communication: "canViewCommunication",
  news: "canViewNews",
  data: "canViewSettings",
  integration: "canViewIntegrations",
  regional: "canViewRegional",
  fueltypes: "canManageFuelTypes",
  team: "canViewEmployees",
  documents: "canViewDocuments",
};

// --- DEFAULT TAB ACCESS BY ROLE ---
export const DEFAULT_ROLE_TABS: Record<UserRole, string[]> = {
  owner: [
    "dashboard",
    "sales",
    "pos",
    "inventory",
    "livetransaction",
    "offloading",
    "delivery",
    "invoice",
    "credit",
    "debt",
    "mpesa",
    "payroll",
    "shifts",
    "customers",
    "quality",
    "fuelsalesreport",
    "reports",
    "analytics",
    "audit",
    "communication",
    "news",
    "data",
    "integration",
    "regional",
    "fueltypes",
    "team",
    "documents",
  ],
  manager: [
    "dashboard",
    "sales",
    "pos",
    "inventory",
    "livetransaction",
    "offloading",
    "delivery",
    "invoice",
    "credit",
    "debt",
    "mpesa",
    "payroll",
    "shifts",
    "customers",
    "quality",
    "fuelsalesreport",
    "reports",
    "analytics",
    "audit",
    "communication",
    "news",
    "data",
    "integration",
    "regional",
    "fueltypes",
    "team",
    "documents",
  ],
  staff: [
    "dashboard",
    "sales",
    "pos",
    "inventory",
    "livetransaction",
    "offloading",
    "delivery",
    "debt",
    "mpesa",
    "shifts",
    "customers",
    "communication",
    "news",
    "credit",
  ],
  auditor: [
    "dashboard",
    "sales",
    "inventory",
    "mpesa",
    "payroll",
    "shifts",
    "fuelsalesreport",
    "reports",
    "analytics",
    "audit",
    "customers",
    "credit",
    "debt",
    "communication",
    "news",
  ],
};

interface PermissionConfig {
  canViewDashboard: boolean;
  canViewSales: boolean;
  canCreateSales: boolean;
  canEditSales: boolean;
  canViewInventory: boolean;
  canManageInventory: boolean;
  canViewEmployees: boolean;
  canManageEmployees: boolean;
  canViewPayroll: boolean;
  canRunPayroll: boolean;
  canViewShifts: boolean;
  canManageShifts: boolean;
  canViewMpesa: boolean;
  canProcessMpesa: boolean;
  canViewReports: boolean;
  canExportReports: boolean;
  canViewAnalytics: boolean;
  canViewAudit: boolean;
  canManageAudit: boolean;
  canViewDocuments: boolean;
  canManageDocuments: boolean;
  canViewFuelPrices: boolean;
  canEditFuelPrices: boolean;
  canChangePumpCount: boolean;
  canManageFuelTypes: boolean;
  canViewRegional: boolean;
  canViewIntegrations: boolean;
  canManageIntegrations: boolean;
  canViewCloud: boolean;
  canManageCloud: boolean;
  canViewSettings: boolean;
  canManageSettings: boolean;
  canManageTabs: boolean;
  canInviteManager: boolean;
  canInviteStaff: boolean;
  canInviteAuditor: boolean;
  canAssignPumps: boolean;
  canAssignShifts: boolean;
  canRevokeAccess: boolean;
  canSetTimeLimits: boolean;
  canViewAI: boolean;
  canUseAI: boolean;
  canViewCommunication: boolean;
  canViewNews: boolean;
  canViewPOS: boolean;
  canUsePOS: boolean;
  canViewLoyalty: boolean;
  canManageLoyalty: boolean;
  canViewCredit: boolean;
  canManageCredit: boolean;
  canViewDebt: boolean;
  canManageDebt: boolean;
  canViewLiveTransactions: boolean;
  isOwner: boolean;
}

const ROLE_PERMISSIONS: Record<UserRole, PermissionConfig> = {
  owner: {
    canViewDashboard: true,
    canViewSales: true,
    canCreateSales: true,
    canEditSales: true,
    canViewInventory: true,
    canManageInventory: true,
    canViewEmployees: true,
    canManageEmployees: true,
    canViewPayroll: true,
    canRunPayroll: true,
    canViewShifts: true,
    canManageShifts: true,
    canViewMpesa: true,
    canProcessMpesa: true,
    canViewReports: true,
    canExportReports: true,
    canViewAnalytics: true,
    canViewAudit: true,
    canManageAudit: true,
    canViewDocuments: true,
    canManageDocuments: true,
    canViewFuelPrices: true,
    canEditFuelPrices: true,
    canChangePumpCount: true,
    canManageFuelTypes: true,
    canViewRegional: true,
    canViewIntegrations: true,
    canManageIntegrations: true,
    canViewCloud: true,
    canManageCloud: true,
    canViewSettings: true,
    canManageSettings: true,
    canManageTabs: true,
    canInviteManager: true,
    canInviteStaff: true,
    canInviteAuditor: true,
    canAssignPumps: true,
    canAssignShifts: true,
    canRevokeAccess: true,
    canSetTimeLimits: true,
    canViewAI: true,
    canUseAI: true,
    canViewCommunication: true,
    canViewNews: true,
    canViewPOS: true,
    canUsePOS: true,
    canViewLoyalty: true,
    canManageLoyalty: true,
    canViewCredit: true,
    canManageCredit: true,
    canViewDebt: true,
    canManageDebt: true,
    canViewLiveTransactions: true,
    isOwner: true,
  },
  manager: {
    canViewDashboard: true,
    canViewSales: true,
    canCreateSales: true,
    canEditSales: true,
    canViewInventory: true,
    canManageInventory: true,
    canViewEmployees: true,
    canManageEmployees: true,
    canViewPayroll: true,
    canRunPayroll: true,
    canViewShifts: true,
    canManageShifts: true,
    canViewMpesa: true,
    canProcessMpesa: true,
    canViewReports: true,
    canExportReports: true,
    canViewAnalytics: true,
    canViewAudit: true,
    canManageAudit: false,
    canViewDocuments: true,
    canManageDocuments: true,
    canViewFuelPrices: true,
    canEditFuelPrices: true,
    canChangePumpCount: false,
    canManageFuelTypes: false,
    canViewRegional: true,
    canViewIntegrations: true,
    canManageIntegrations: false,
    canViewCloud: true,
    canManageCloud: false,
    canViewSettings: true,
    canManageSettings: false,
    canManageTabs: false,
    canInviteManager: false,
    canInviteStaff: true,
    canInviteAuditor: true,
    canAssignPumps: true,
    canAssignShifts: true,
    canRevokeAccess: true,
    canSetTimeLimits: true,
    canViewAI: true,
    canUseAI: true,
    canViewCommunication: true,
    canViewNews: true,
    canViewPOS: true,
    canUsePOS: true,
    canViewLoyalty: true,
    canManageLoyalty: true,
    canViewCredit: true,
    canManageCredit: true,
    canViewDebt: true,
    canManageDebt: true,
    canViewLiveTransactions: true,
    isOwner: false,
  },
  staff: {
    canViewDashboard: true,
    canViewSales: true,
    canCreateSales: true,
    canEditSales: false,
    canViewInventory: true,
    canManageInventory: true,
    canViewEmployees: false,
    canManageEmployees: false,
    canViewPayroll: false,
    canRunPayroll: false,
    canViewShifts: true,
    canManageShifts: false,
    canViewMpesa: true,
    canProcessMpesa: false,
    canViewReports: false,
    canExportReports: false,
    canViewAnalytics: false,
    canViewAudit: false,
    canManageAudit: false,
    canViewDocuments: true,
    canManageDocuments: false,
    canViewFuelPrices: true,
    canEditFuelPrices: false,
    canChangePumpCount: false,
    canManageFuelTypes: false,
    canViewRegional: true,
    canViewIntegrations: false,
    canManageIntegrations: false,
    canViewCloud: false,
    canManageCloud: false,
    canViewSettings: false,
    canManageSettings: false,
    canManageTabs: false,
    canInviteManager: false,
    canInviteStaff: false,
    canInviteAuditor: false,
    canAssignPumps: false,
    canAssignShifts: false,
    canRevokeAccess: false,
    canSetTimeLimits: false,
    canViewAI: true,
    canUseAI: true,
    canViewCommunication: true,
    canViewNews: true,
    canViewPOS: true,
    canUsePOS: true,
    canViewLoyalty: true,
    canManageLoyalty: true,
    canViewCredit: true,
    canManageCredit: false,
    canViewDebt: true,
    canManageDebt: true,
    canViewLiveTransactions: true,
    isOwner: false,
  },
  auditor: {
    canViewDashboard: true,
    canViewSales: true,
    canCreateSales: false,
    canEditSales: false,
    canViewInventory: true,
    canManageInventory: false,
    canViewEmployees: true,
    canManageEmployees: false,
    canViewPayroll: true,
    canRunPayroll: false,
    canViewShifts: true,
    canManageShifts: false,
    canViewMpesa: true,
    canProcessMpesa: false,
    canViewReports: true,
    canExportReports: true,
    canViewAnalytics: true,
    canViewAudit: true,
    canManageAudit: false,
    canViewDocuments: true,
    canManageDocuments: false,
    canViewFuelPrices: true,
    canEditFuelPrices: false,
    canChangePumpCount: false,
    canManageFuelTypes: false,
    canViewRegional: true,
    canViewIntegrations: false,
    canManageIntegrations: false,
    canViewCloud: false,
    canManageCloud: false,
    canViewSettings: false,
    canManageSettings: false,
    canManageTabs: false,
    canInviteManager: false,
    canInviteStaff: false,
    canInviteAuditor: false,
    canAssignPumps: false,
    canAssignShifts: false,
    canRevokeAccess: false,
    canSetTimeLimits: false,
    canViewAI: false,
    canUseAI: false,
    canViewCommunication: false,
    canViewNews: true,
    canViewPOS: false,
    canUsePOS: false,
    canViewLoyalty: true,
    canManageLoyalty: false,
    canViewCredit: true,
    canManageCredit: false,
    canViewDebt: true,
    canManageDebt: false,
    canViewLiveTransactions: false,
    isOwner: false,
  },
};

interface RoleTabGrants {
  manager: string[];
  staff: string[];
  auditor: string[];
}

interface PermissionContextType {
  role: UserRole;
  permissions: PermissionConfig;
  team: TeamMember[];
  invites: AccessInvite[];
  roleTabGrants: RoleTabGrants;
  setRole: (role: UserRole) => void;
  hasPermission: (key: keyof PermissionConfig) => boolean;
  isOwner: boolean;
  isManager: boolean;
  isStaff: boolean;
  isAuditor: boolean;
  canAccessTab: (tabId: string) => boolean;
  setRoleTabGrants: (grants: RoleTabGrants) => void;
  grantTabToRole: (role: UserRole, tabId: string) => void;
  revokeTabFromRole: (role: UserRole, tabId: string) => void;
  createInvite: (
    role: UserRole,
    expiresInDays?: number,
    maxUses?: number
  ) => AccessInvite;
  acceptInvite: (inviteId: string, username: string) => boolean;
  revokeMember: (memberId: string) => void;
  extendAccess: (memberId: string, days: number) => void;
  assignPumps: (memberId: string, pumpIds: string[]) => void;
  assignShifts: (memberId: string, shiftIds: string[]) => void;
}

const PermissionContext = createContext<PermissionContextType>({
  role: "owner",
  permissions: ROLE_PERMISSIONS.owner,
  team: [],
  invites: [],
  roleTabGrants: {
    manager: [...DEFAULT_ROLE_TABS.manager],
    staff: [...DEFAULT_ROLE_TABS.staff],
    auditor: [...DEFAULT_ROLE_TABS.auditor],
  },
  setRole: () => {},
  hasPermission: () => false,
  isOwner: true,
  isManager: false,
  isStaff: false,
  isAuditor: false,
  canAccessTab: () => false,
  setRoleTabGrants: () => {},
  grantTabToRole: () => {},
  revokeTabFromRole: () => {},
  createInvite: () => ({
    id: "",
    role: "staff",
    createdBy: "",
    createdAt: "",
    maxUses: 1,
    uses: 0,
  }),
  acceptInvite: () => false,
  revokeMember: () => {},
  extendAccess: () => {},
  assignPumps: () => {},
  assignShifts: () => {},
});

const GRANTS_STORAGE_KEY = "fuelpro_role_tab_grants";

function loadGrants(): RoleTabGrants {
  try {
    const saved = localStorage.getItem(GRANTS_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    /* ignore */
  }
  return {
    manager: [...DEFAULT_ROLE_TABS.manager],
    staff: [...DEFAULT_ROLE_TABS.staff],
    auditor: [...DEFAULT_ROLE_TABS.auditor],
  };
}

export function PermissionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { getActiveBinding } = useAuth();

  const [role, setRoleState] = useState<UserRole>(() => {
    // Every new user starts as Owner - no role switching allowed
    const saved = localStorage.getItem("fuelpro_v2_role");
    if (!saved) {
      localStorage.setItem("fuelpro_v2_role", "owner");
      return "owner";
    }
    // If user somehow saved a non-owner role, reset to owner
    if (saved !== "owner" && !localStorage.getItem("fuelpro_user_invited")) {
      localStorage.setItem("fuelpro_v2_role", "owner");
      return "owner";
    }
    return (saved as UserRole) || "owner";
  });

  const [team, setTeam] = useState<TeamMember[]>(() => {
    const saved = localStorage.getItem("fuelpro_v2_team");
    return saved ? JSON.parse(saved) : [];
  });

  const [invites, setInvites] = useState<AccessInvite[]>(() => {
    const saved = localStorage.getItem("fuelpro_v2_invites");
    return saved ? JSON.parse(saved) : [];
  });

  const [roleTabGrants, setRoleTabGrantsState] =
    useState<RoleTabGrants>(loadGrants);

  // Persist grants
  useEffect(() => {
    localStorage.setItem(GRANTS_STORAGE_KEY, JSON.stringify(roleTabGrants));
  }, [roleTabGrants]);

  // setRole: OWNER cannot switch roles. Only non-owner invited users can have different roles.
  const setRole = useCallback(
    (newRole: UserRole) => {
      // Rule 1: Owner can NEVER switch to another role
      if (role === "owner" && newRole !== "owner") {
        console.warn(
          "[Role Lock] Owner cannot switch to a different role. Owner status is permanent."
        );
        return;
      }

      // Rule 2: Cannot switch TO owner from another role (owner is set at signup only)
      if (role !== "owner" && newRole === "owner") {
        console.warn(
          "[Role Lock] Cannot assume Owner role. Owner is assigned at signup only."
        );
        return;
      }

      // Rule 3: Invited users are bound to their invited role
      let currentStationId: string | null = null;
      try {
        const s = localStorage.getItem("fuelpro_current_station_v3");
        if (s) currentStationId = JSON.parse(s).stationId;
      } catch {
        /* ignore */
      }
      if (!currentStationId) {
        try {
          const s = localStorage.getItem("fuelpro_current_station");
          if (s) currentStationId = JSON.parse(s).stationId;
        } catch {
          /* ignore */
        }
      }

      const binding = currentStationId
        ? getActiveBinding(currentStationId)
        : null;
      if (binding && binding.active) {
        if (newRole !== binding.role) {
          console.warn(
            `[Role Lock] Role change rejected. User is bound as ${binding.role} at this station.`
          );
          return;
        }
      }

      setRoleState(newRole);
      localStorage.setItem("fuelpro_v2_role", newRole);
    },
    [getActiveBinding, role]
  );

  const permissions = ROLE_PERMISSIONS[role];

  const hasPermission = useCallback(
    (key: keyof PermissionConfig) => {
      return permissions[key] ?? false;
    },
    [permissions]
  );

  // Check if current role can access a specific tab
  const canAccessTab = useCallback(
    (tabId: string): boolean => {
      // Owner always has access to everything
      if (role === "owner") return true;
      // Check role-specific tab grants
      return roleTabGrants[role]?.includes(tabId) ?? false;
    },
    [role, roleTabGrants]
  );

  const setRoleTabGrants = useCallback((grants: RoleTabGrants) => {
    setRoleTabGrantsState(grants);
  }, []);

  const grantTabToRole = useCallback((targetRole: UserRole, tabId: string) => {
    if (targetRole === "owner") return; // Owner already has everything
    setRoleTabGrantsState(prev => ({
      ...prev,
      [targetRole]: [...new Set([...prev[targetRole], tabId])],
    }));
  }, []);

  const revokeTabFromRole = useCallback(
    (targetRole: UserRole, tabId: string) => {
      if (targetRole === "owner") return; // Cannot revoke from owner
      setRoleTabGrantsState(prev => ({
        ...prev,
        [targetRole]: prev[targetRole].filter(t => t !== tabId),
      }));
    },
    []
  );

  const createInvite = useCallback(
    (
      inviteRole: UserRole,
      expiresInDays?: number,
      maxUses = 1
    ): AccessInvite => {
      const invite: AccessInvite = {
        id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role: inviteRole,
        createdBy: role,
        createdAt: new Date().toISOString(),
        expiresAt: expiresInDays
          ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
          : undefined,
        maxUses,
        uses: 0,
      };
      setInvites(prev => [...prev, invite]);
      return invite;
    },
    [role]
  );

  const acceptInvite = useCallback(
    (inviteId: string, username: string): boolean => {
      const invite = invites.find(i => i.id === inviteId);
      if (!invite) return false;
      if (invite.usedBy) return false;
      if (invite.expiresAt && new Date(invite.expiresAt) < new Date())
        return false;
      if (invite.uses >= invite.maxUses) return false;

      const member: TeamMember = {
        id: `mem_${Date.now()}`,
        username,
        role: invite.role,
        assignedPumps: [],
        assignedShifts: [],
        invitedBy: invite.createdBy,
        invitedAt: new Date().toISOString(),
        expiresAt: invite.expiresAt,
        active: true,
      };

      setTeam(prev => [...prev, member]);
      setInvites(prev =>
        prev.map(i =>
          i.id === inviteId
            ? {
                ...i,
                uses: i.uses + 1,
                usedBy: username,
                usedAt: new Date().toISOString(),
              }
            : i
        )
      );
      return true;
    },
    [invites]
  );

  const revokeMember = useCallback((memberId: string) => {
    setTeam(prev => prev.filter(m => m.id !== memberId));
  }, []);

  const extendAccess = useCallback((memberId: string, days: number) => {
    setTeam(prev =>
      prev.map(m =>
        m.id === memberId
          ? {
              ...m,
              expiresAt: new Date(Date.now() + days * 86400000).toISOString(),
            }
          : m
      )
    );
  }, []);

  const assignPumps = useCallback((memberId: string, pumpIds: string[]) => {
    setTeam(prev =>
      prev.map(m => (m.id === memberId ? { ...m, assignedPumps: pumpIds } : m))
    );
  }, []);

  const assignShifts = useCallback((memberId: string, shiftIds: string[]) => {
    setTeam(prev =>
      prev.map(m =>
        m.id === memberId ? { ...m, assignedShifts: shiftIds } : m
      )
    );
  }, []);

  useEffect(() => {
    localStorage.setItem("fuelpro_v2_team", JSON.stringify(team));
  }, [team]);
  useEffect(() => {
    localStorage.setItem("fuelpro_v2_invites", JSON.stringify(invites));
  }, [invites]);

  return (
    <PermissionContext.Provider
      value={{
        role,
        permissions,
        team,
        invites,
        roleTabGrants,
        setRole,
        hasPermission,
        isOwner: role === "owner",
        isManager: role === "manager",
        isStaff: role === "staff",
        isAuditor: role === "auditor",
        canAccessTab,
        setRoleTabGrants,
        grantTabToRole,
        revokeTabFromRole,
        createInvite,
        acceptInvite,
        revokeMember,
        extendAccess,
        assignPumps,
        assignShifts,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}

export { ROLE_PERMISSIONS };
export type { PermissionConfig, TeamMember, AccessInvite, RoleTabGrants };
