import { useState } from "react";
import {
  Users,
  Link2,
  Plus,
  Clock,
  UserCheck,
  User,
  Eye,
  Fuel,
  Calendar,
  Copy,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Ban,
  Mail,
  MessageCircle,
  ToggleLeft,
  ToggleRight,
  Crown,
  KeyRound,
  Settings2,
  Trash2,
  BadgeCheck,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/react-app/context/AuthContext";
import {
  usePermissions,
  type UserRole,
  type BaseUserRole,
  type CustomRole,
  type PermissionConfig,
  DEFAULT_ROLE_TABS,
  rankOf,
} from "@/react-app/context/PermissionContext";
import { useStations } from "@/react-app/context/StationContext";
import { useFuel } from "@/react-app/context/FuelContext";
import SubTabBar from "@/react-app/components/SubTabBar";
import ShiftManagement from "@/react-app/components/ShiftManagement";

const BASE_ROLES: BaseUserRole[] = ["manager", "staff", "auditor"];

const ROLE_LABELS: Record<
  string,
  { label: string; color: string; desc: string }
> = {
  owner: {
    label: "Owner",
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    desc: "Full access, cannot be revoked. Root authority.",
  },
  manager: {
    label: "Manager",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    desc: "Operational control, can invite Staff/Auditor (if delegated).",
  },
  staff: {
    label: "Staff",
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    desc: "Daily tasks, assigned pumps/shifts.",
  },
  auditor: {
    label: "Auditor",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    desc: "Read-only audit and reports.",
  },
};

const ROLE_ICONS: Record<string, any> = {
  owner: Crown,
  manager: UserCheck,
  staff: User,
  auditor: Eye,
};

// Safe accessors with fallback so an unknown/custom role never crashes the UI.
const getRoleIcon = (role: string): any => ROLE_ICONS[role] || BadgeCheck;
const getRoleLabel = (role: string) =>
  ROLE_LABELS[role] || {
    label: role.charAt(0).toUpperCase() + role.slice(1),
    color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
    desc: "Custom role defined by the Owner.",
  };

// Human-readable labels for the PermissionConfig booleans (grouped).
const PERMISSION_GROUPS: {
  group: string;
  perms: { key: keyof PermissionConfig; label: string }[];
}[] = [
  {
    group: "Sales & POS",
    perms: [
      { key: "canViewSales", label: "View Sales" },
      { key: "canCreateSales", label: "Create Sales" },
      { key: "canEditSales", label: "Edit Sales" },
      { key: "canViewPOS", label: "View POS" },
      { key: "canUsePOS", label: "Use POS" },
      { key: "canViewLiveTransactions", label: "Live Transactions" },
    ],
  },
  {
    group: "Inventory & Fuel",
    perms: [
      { key: "canViewInventory", label: "View Inventory" },
      { key: "canManageInventory", label: "Manage Inventory" },
      { key: "canViewFuelPrices", label: "View Fuel Prices" },
      { key: "canEditFuelPrices", label: "Edit Fuel Prices" },
      { key: "canChangePumpCount", label: "Change Pump Count" },
      { key: "canManageFuelTypes", label: "Manage Fuel Types" },
    ],
  },
  {
    group: "Money & Payments",
    perms: [
      { key: "canViewMpesa", label: "View M-PESA" },
      { key: "canProcessMpesa", label: "Process M-PESA" },
      { key: "canViewCredit", label: "View Credit" },
      { key: "canManageCredit", label: "Manage Credit" },
      { key: "canViewDebt", label: "View Debts" },
      { key: "canManageDebt", label: "Manage Debts" },
      { key: "canViewLoyalty", label: "View Loyalty" },
      { key: "canManageLoyalty", label: "Manage Loyalty" },
    ],
  },
  {
    group: "People & HR",
    perms: [
      { key: "canViewEmployees", label: "View Team" },
      { key: "canManageEmployees", label: "Manage Team" },
      { key: "canViewPayroll", label: "View Payroll" },
      { key: "canRunPayroll", label: "Run Payroll" },
      { key: "canViewShifts", label: "View Shifts" },
      { key: "canManageShifts", label: "Manage Shifts" },
      { key: "canAssignPumps", label: "Assign Pumps" },
      { key: "canAssignShifts", label: "Assign Shifts" },
    ],
  },
  {
    group: "Reports & Audit",
    perms: [
      { key: "canViewReports", label: "View Reports" },
      { key: "canExportReports", label: "Export Reports" },
      { key: "canViewAnalytics", label: "View Analytics" },
      { key: "canViewAudit", label: "View Audit Trail" },
      { key: "canManageAudit", label: "Manage Audit Trail" },
    ],
  },
  {
    group: "System & Documents",
    perms: [
      { key: "canViewDocuments", label: "View Documents" },
      { key: "canManageDocuments", label: "Upload/Manage Docs" },
      { key: "canViewSettings", label: "View Settings" },
      { key: "canManageSettings", label: "Manage Settings" },
      { key: "canViewIntegrations", label: "View Integrations" },
      { key: "canManageIntegrations", label: "Manage Integrations" },
      { key: "canViewCloud", label: "View Cloud Data" },
      { key: "canManageCloud", label: "Manage Cloud Data" },
      { key: "canViewRegional", label: "Regional/Compliance" },
      { key: "canViewCommunication", label: "Communication" },
      { key: "canViewNews", label: "News" },
      { key: "canViewAI", label: "View AI" },
      { key: "canUseAI", label: "Use AI" },
    ],
  },
  {
    group: "Delegation & Invite Power",
    perms: [
      { key: "canInviteManager", label: "Invite Managers" },
      { key: "canInviteStaff", label: "Invite Staff" },
      { key: "canInviteAuditor", label: "Invite Auditors" },
      { key: "canCreateSubUsers", label: "Create Sub-Users (delegation)" },
      { key: "canGrantPermissions", label: "Grant Permissions (delegation)" },
      { key: "canRevokeAccess", label: "Revoke Access" },
      { key: "canSetTimeLimits", label: "Set Time Limits" },
      { key: "canManageTabs", label: "Manage Tab Access" },
    ],
  },
];

function makeInviteLink(inv: any, station: any): string {
  const payload = JSON.stringify({
    id: inv.id,
    role: inv.role,
    stationName: station?.name || "Fuel Station",
    stationId: station?.id || "default",
    createdBy: inv.createdBy,
    createdByName: inv.createdByName,
    createdByUniqueId: inv.createdByUniqueId,
    expiresAt: inv.expiresAt,
    maxUses: inv.maxUses,
    canCreateSubUsers: inv.canCreateSubUsers,
    canGrantPermissions: inv.canGrantPermissions,
    permissionsSnapshot: inv.permissionsSnapshot,
    tabGrants: inv.tabGrants,
  });
  const base64 = btoa(payload)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return window.location.origin + "/#/join/" + base64;
}

export default function TeamManager() {
  const { user, bindings, terminateRole } = useAuth();
  const { currentStation } = useStations();
  const { state } = useFuel();
  const {
    role,
    team,
    invites,
    customRoles,
    hasPermission,
    isOwner,
    canInviteRole,
    createInvite,
    revokeMember,
    extendAccess,
    assignPumps,
    assignShifts,
    roleTabGrants,
    setRoleTabGrants,
    grantTabToRole,
    revokeTabFromRole,
    setRolePermission,
    createCustomRole,
    deleteCustomRole,
    updateCustomRole,
    resolvePermissions,
    resolveTabGrants,
    outranks,
  } = usePermissions();
  const [showCreate, setShowCreate] = useState(false);
  const [inviteRole, setInviteRole] = useState<UserRole>("staff");
  const [expireDays, setExpireDays] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [inviteCanCreateSubUsers, setInviteCanCreateSubUsers] = useState(false);
  const [inviteCanGrantPermissions, setInviteCanGrantPermissions] =
    useState(false);
  const [copiedId, setCopiedId] = useState("");
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  // Per-member extend-days state so editing one member doesn't change another's.
  const [extendDaysByMember, setExtendDaysByMember] = useState<
    Record<string, string>
  >({});
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false);
  const [showFeatureGrant, setShowFeatureGrant] = useState(false);
  // Custom role creator state
  const [showRoleCreator, setShowRoleCreator] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [newRoleBase, setNewRoleBase] = useState<BaseUserRole>("staff");
  // Per-role permission editor state: which role's permission panel is open
  const [permEditorRole, setPermEditorRole] = useState<string | null>(null);
  // Inner sub-tab: "Team" (this component) vs "Shifts" (the formerly-standalone
  // ShiftManagement module, now hosted here).
  const [activeView, setActiveView] = useState<"team" | "shifts" | "roles">(
    "team",
  );

  // Tab ID to human-readable label mapping
  const tabIdToLabel: Record<string, string> = {
    dashboard: "Dashboard",
    sales: "Sales",
    pos: "POS",
    inventory: "Inventory",
    livetransaction: "M-PESA Live",
    offloading: "Offloading",
    delivery: "Deliveries",
    invoice: "Invoices",
    credit: "Credit",
    debt: "Debts",
    mpesa: "M-PESA",
    payroll: "Payroll",
    shifts: "Shifts",
    customers: "Customers",
    quality: "Quality",
    fuelsalesreport: "Fuel Report",
    reports: "Reports",
    analytics: "Analytics",
    audit: "Audit Trail",
    communication: "Communication",
    news: "News",
    data: "Data Manager",
    integration: "Integrations",
    regional: "Regional",
    fueltypes: "Fuel Types",
    team: "Team Manager",
    documents: "Documents",
  };

  const currentBinding = bindings.find(
    (b) => b.active && b.authId === user?.authId,
  );

  // The current user can manage permissions if they are the Owner OR have the
  // canGrantPermissions delegation flag.
  const canManagePermissions = isOwner || hasPermission("canGrantPermissions");
  const canRevoke = isOwner || hasPermission("canRevokeAccess");
  const canSetLimits = isOwner || hasPermission("canSetTimeLimits");
  const canAssign =
    isOwner ||
    hasPermission("canAssignPumps") ||
    hasPermission("canAssignShifts");
  // Can create custom roles: Owner, or a delegated role with canCreateSubUsers.
  const canCreateRoles = isOwner || hasPermission("canCreateSubUsers");

  // Derive the real pump options from the station's configured pumps so pump
  // assignments reference actual pumps (not the old hardcoded PMS-/AGO-/IK-
  // list which rarely matched a station's real pumps). Includes ALL fuel
  // types (petrol, diesel, kerosene, LPG, V-Power, etc.) so a station with
  // 5 fuel types shows all its pumps. Falls back to sensible defaults only
  // when no pumps are configured yet (pre-setup wizard).
  const pumpOptions: { id: string; label: string }[] = (() => {
    const out: { id: string; label: string }[] = [];
    const addPumps = (
      pumps: { id: string; name?: string }[] | undefined,
      fallbackPrefix: string,
    ) => {
      if (pumps && pumps.length > 0) {
        pumps.forEach((p, i) =>
          out.push({
            id: p.id || `${fallbackPrefix}-${i + 1}`,
            label: p.name || `${fallbackPrefix.toUpperCase()} Pump ${i + 1}`,
          }),
        );
      }
    };
    addPumps(state.pmsPumps as { id: string; name?: string }[], "pms");
    addPumps(state.agoPumps as { id: string; name?: string }[], "ago");
    // Also include pumps for non-petrol/diesel fuel types (kerosene, LPG,
    // V-Power, etc.) stored in state.fuelPumpsByType.
    if (state.fuelPumpsByType) {
      for (const [canonical, pumps] of Object.entries(state.fuelPumpsByType)) {
        if (canonical === "petrol" || canonical === "diesel") continue;
        addPumps(pumps as { id: string; name?: string }[], canonical);
      }
    }
    // Fallback when the station has no pumps configured yet.
    if (out.length === 0) {
      return [
        { id: "pms-1", label: "PMS Pump 1" },
        { id: "pms-2", label: "PMS Pump 2" },
        { id: "ago-1", label: "AGO Pump 1" },
        { id: "ago-2", label: "AGO Pump 2" },
        { id: "ik-1", label: "IK Pump 1" },
        { id: "lpg-1", label: "LPG Pump 1" },
        { id: "vpw-1", label: "VPW Pump 1" },
      ];
    }
    return out;
  })();

  // Shift options — match the ShiftManagement module's templates so a member's
  // assigned shift can be cross-referenced with the live shift schedule.
  const shiftOptions = [
    "Morning (06:00-14:00)",
    "Afternoon (14:00-22:00)",
    "Night (22:00-06:00)",
  ];

  const handleCreateInvite = () => {
    const r = inviteRole;
    // Escalation guard: the context's createInvite also guards, but we check
    // here so the UI can disable the button.
    if (!canInviteRole(r)) return;
    const days = expireDays ? parseInt(expireDays) : undefined;
    const uses = parseInt(maxUses) || 1;
    // Pass the delegation options. The context clamps them to what the
    // inviter is actually allowed to grant (escalation guard).
    createInvite(r, days, uses, {
      canCreateSubUsers: inviteCanCreateSubUsers,
      canGrantPermissions: inviteCanGrantPermissions,
    });
    // Reset delegation toggles for the next invite.
    setInviteCanCreateSubUsers(false);
    setInviteCanGrantPermissions(false);
    setShowCreate(false);
  };

  const getLink = (inv: (typeof invites)[0]) =>
    makeInviteLink(inv, currentStation);

  const copyToClipboard = async (text: string): Promise<boolean> => {
    // Try modern Clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        /* fallback */
      }
    }
    // Fallback: create textarea and use execCommand
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  const handleCopyLink = async (inv: (typeof invites)[0]) => {
    const link = getLink(inv);
    const ok = await copyToClipboard(link);
    if (ok) {
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(""), 3000);
    }
  };

  const handleShareWhatsApp = (inv: (typeof invites)[0]) => {
    const link = encodeURIComponent(getLink(inv));
    const text = encodeURIComponent(
      `You're invited to join ${currentStation?.name || "Fuel Station"} as ${inv.role}! Click the link to accept:`,
    );
    window.open(`https://wa.me/?text=${text}%20${link}`, "_blank");
  };

  const handleShareEmail = (inv: (typeof invites)[0]) => {
    const link = getLink(inv);
    const subject = encodeURIComponent(
      `Invitation to join ${currentStation?.name || "Fuel Station"}`,
    );
    const body = encodeURIComponent(
      `Hello,\n\nYou've been invited to join ${currentStation?.name || "Fuel Station"} as a ${inv.role}.\n\nClick the link below to accept your invitation:\n\n${link}\n\nThis link works on any device.`,
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  // Build the list of roles the current user can invite into. Uses the
  // escalation-aware canInviteRole helper so a delegated Manager sees only
  // roles below their rank (staff/auditor/custom), and the Owner sees all.
  const availableRoles: { id: string; label: string }[] = [];
  for (const r of BASE_ROLES) {
    if (canInviteRole(r))
      availableRoles.push({ id: r, label: getRoleLabel(r).label });
  }
  for (const cr of customRoles) {
    if (canInviteRole(cr.name)) {
      availableRoles.push({ id: cr.name, label: cr.label });
    }
  }

  const activeInvites = invites.filter(
    (i) => !i.usedBy && (!i.expiresAt || new Date(i.expiresAt) > new Date()),
  );
  const usedInvites = invites.filter((i) => i.usedBy);
  const expiredInvites = invites.filter(
    (i) => i.expiresAt && new Date(i.expiresAt) < new Date() && !i.usedBy,
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
          <Users size={24} className="text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Team Manager
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Invite, manage, and control access for your team
          </p>
        </div>
      </div>

      {/* Sub-tab switcher: Team access vs Shift scheduling */}
      <SubTabBar
        tabs={[
          { id: "team", label: "Team Access", icon: Users },
          { id: "roles", label: "Roles & Permissions", icon: KeyRound },
          { id: "shifts", label: "Shifts", icon: Calendar },
        ]}
        active={activeView}
        onChange={(id) => setActiveView(id as "team" | "shifts" | "roles")}
      />

      {activeView === "shifts" ? (
        <ShiftManagement />
      ) : activeView === "roles" ? (
        <RolesAndPermissionsView
          isOwner={isOwner}
          canManagePermissions={canManagePermissions}
          canCreateRoles={canCreateRoles}
          customRoles={customRoles}
          resolvePermissions={resolvePermissions}
          resolveTabGrants={resolveTabGrants}
          roleTabGrants={roleTabGrants}
          setRolePermission={setRolePermission}
          grantTabToRole={grantTabToRole}
          revokeTabFromRole={revokeTabFromRole}
          setRoleTabGrants={setRoleTabGrants}
          createCustomRole={createCustomRole}
          deleteCustomRole={deleteCustomRole}
          updateCustomRole={updateCustomRole}
          outranks={outranks}
          hasPermission={hasPermission}
          tabIdToLabel={tabIdToLabel}
          permEditorRole={permEditorRole}
          setPermEditorRole={setPermEditorRole}
          showRoleCreator={showRoleCreator}
          setShowRoleCreator={setShowRoleCreator}
          newRoleName={newRoleName}
          setNewRoleName={setNewRoleName}
          newRoleLabel={newRoleLabel}
          setNewRoleLabel={setNewRoleLabel}
          newRoleBase={newRoleBase}
          setNewRoleBase={setNewRoleBase}
        />
      ) : (
        <>
          {/* Current User Badge */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${getRoleLabel(role).color}`}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Your access level
                </p>
              </div>
              <p className="text-xs text-gray-400">
                Hierarchy: Owner &gt; Manager &gt; Staff &gt; Auditor
              </p>
            </div>

            {!isOwner && currentBinding && (
              <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
                {showTerminateConfirm ? (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-red-600 dark:text-red-400 flex-1">
                      Are you sure? You will lose access to this station.
                    </p>
                    <button
                      onClick={() => setShowTerminateConfirm(false)}
                      className="px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        terminateRole(currentBinding.stationId);
                        setShowTerminateConfirm(false);
                        import("@/react-app/lib/app-reloader").then(
                          ({ triggerSoftReload }) => triggerSoftReload(500),
                        );
                      }}
                      className="px-3 py-1 text-[11px] bg-red-600 hover:bg-red-700 text-white rounded font-medium"
                    >
                      Confirm
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowTerminateConfirm(true)}
                    className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1"
                  >
                    <Ban size={12} /> Terminate My Role
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Team Members",
                value: team.filter((m) => m.active).length,
                color: "text-purple-600",
              },
              {
                label: "Managers",
                value: team.filter((m) => m.role === "manager").length,
                color: "text-blue-600",
              },
              {
                label: "Staff",
                value: team.filter((m) => m.role === "staff").length,
                color: "text-green-600",
              },
              {
                label: "Active Invites",
                value: activeInvites.length,
                color: "text-amber-600",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center"
              >
                <p
                  className={`text-2xl font-bold ${s.color} dark:${s.color.replace("text-", "text-")}`}
                >
                  {s.value}
                </p>
                <p className="text-[10px] text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Create Invite */}
          {availableRoles.length > 0 && (
            <div>
              {!showCreate ? (
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg"
                >
                  <Plus size={18} /> Create Invite Link
                </button>
              ) : (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 p-6 space-y-4">
                  <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-300">
                    Create Access Invite
                  </h3>
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 block mb-2">
                      Role
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableRoles.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setInviteRole(r.id)}
                          className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${inviteRole === r.id ? getRoleLabel(r.id).color + " ring-2 ring-offset-1 ring-indigo-400" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700"}`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {getRoleLabel(inviteRole).desc}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                        Expires in (days) - optional
                      </label>
                      <input
                        type="number"
                        value={expireDays}
                        onChange={(e) => setExpireDays(e.target.value)}
                        placeholder="Never"
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                        Max uses
                      </label>
                      <input
                        type="number"
                        value={maxUses}
                        onChange={(e) => setMaxUses(e.target.value)}
                        min="1"
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                      />
                    </div>
                  </div>
                  {/* Delegation toggles — only shown if the inviter may grant
                      them. The context clamps to what the inviter actually has. */}
                  {(isOwner || hasPermission("canCreateSubUsers")) && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                        <ShieldAlert size={12} /> Delegation (optional)
                      </p>
                      <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inviteCanCreateSubUsers}
                          onChange={(e) =>
                            setInviteCanCreateSubUsers(e.target.checked)
                          }
                          disabled={
                            !isOwner && !hasPermission("canCreateSubUsers")
                          }
                        />
                        Allow this sub-user to create further sub-users
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inviteCanGrantPermissions}
                          onChange={(e) =>
                            setInviteCanGrantPermissions(e.target.checked)
                          }
                          disabled={
                            !isOwner && !hasPermission("canGrantPermissions")
                          }
                        />
                        Allow this sub-user to grant permissions to others
                      </label>
                      {!isOwner && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400">
                          You can only delegate powers you yourself hold.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateInvite}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5"
                    >
                      <Link2 size={14} /> Generate Link
                    </button>
                    <button
                      onClick={() => setShowCreate(false)}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active Invites */}
          {activeInvites.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Active Invite Links
              </h3>
              {activeInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`px-2 py-1 rounded text-[10px] font-medium ${getRoleLabel(inv.role).color}`}
                      >
                        {getRoleLabel(inv.role).label}
                      </div>
                      <code className="text-xs text-gray-500 font-mono bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                        {inv.id}
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      {inv.expiresAt && (
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                          <Clock size={10} /> Expires{" "}
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-500">
                        Uses: {inv.uses}/{inv.maxUses}
                      </span>
                    </div>
                  </div>
                  {/* Link row */}
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      readOnly
                      value={getLink(inv)}
                      className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-[10px] font-mono dark:text-gray-300 truncate"
                    />
                    <button
                      onClick={() => handleCopyLink(inv)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors flex-shrink-0 ${copiedId === inv.id ? "bg-green-100 text-green-700" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"}`}
                    >
                      {copiedId === inv.id ? (
                        <>
                          <CheckCircle2 size={14} /> Copied
                        </>
                      ) : (
                        <>
                          <Copy size={14} /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  {/* Share buttons */}
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => handleShareWhatsApp(inv)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </button>
                    <button
                      onClick={() => handleShareEmail(inv)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      <Mail size={14} /> Email
                    </button>
                    <button
                      onClick={() => {
                        const link = getLink(inv);
                        if (navigator.share) {
                          navigator
                            .share({
                              title: "FuelPro Invite",
                              text: `Join ${currentStation?.name || "Fuel Station"} as ${inv.role}`,
                              url: link,
                            })
                            .catch(() => handleCopyLink(inv));
                        } else {
                          handleCopyLink(inv);
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      <Link2 size={14} /> More
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Feature Access Control — Owner or delegated canGrantPermissions */}
          {canManagePermissions && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setShowFeatureGrant(!showFeatureGrant)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                    <Settings2
                      size={16}
                      className="text-indigo-600 dark:text-indigo-400"
                    />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      Feature Access Control
                    </h3>
                    <p className="text-xs text-gray-500">
                      Grant or revoke tab access per role
                    </p>
                  </div>
                </div>
                {showFeatureGrant ? (
                  <ChevronUp size={16} className="text-gray-400" />
                ) : (
                  <ChevronDown size={16} className="text-gray-400" />
                )}
              </button>

              {showFeatureGrant && (
                <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
                  {/* Legend */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <ToggleRight size={14} className="text-green-500" />{" "}
                      Allowed
                    </span>
                    <span className="flex items-center gap-1">
                      <ToggleLeft size={14} className="text-gray-400" /> Denied
                    </span>
                    <span className="ml-auto text-gray-400">
                      Click to toggle
                    </span>
                  </div>

                  {/* Roles to manage: base roles (manager/staff/auditor) +
                      any custom roles the current user outranks. */}
                  {(
                    [
                      ...BASE_ROLES,
                      ...customRoles
                        .filter((c) => outranks(c.name))
                        .map((c) => c.name),
                    ] as string[]
                  ).map((targetRole) => (
                    <div key={targetRole}>
                      <h4
                        className={`text-xs font-semibold mb-2 px-2 py-1 rounded inline-block ${getRoleLabel(targetRole).color}`}
                      >
                        {getRoleLabel(targetRole).label} Access
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {Object.keys(tabIdToLabel).map((tabId) => {
                          const isAllowed =
                            resolveTabGrants(targetRole).includes(tabId);
                          return (
                            <button
                              key={tabId}
                              onClick={() => {
                                if (isAllowed)
                                  revokeTabFromRole(
                                    targetRole as UserRole,
                                    tabId,
                                  );
                                else
                                  grantTabToRole(targetRole as UserRole, tabId);
                              }}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                                isAllowed
                                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                                  : "bg-gray-50 dark:bg-gray-900 text-gray-400 border border-gray-200 dark:border-gray-700"
                              }`}
                            >
                              {isAllowed ? (
                                <ToggleRight size={16} />
                              ) : (
                                <ToggleLeft size={16} />
                              )}
                              <span>{tabIdToLabel[tabId]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Reset to defaults */}
                  <button
                    onClick={() => {
                      if (confirm("Reset all role tab grants to default?")) {
                        setRoleTabGrants({
                          manager: [...DEFAULT_ROLE_TABS.manager],
                          staff: [...DEFAULT_ROLE_TABS.staff],
                          auditor: [...DEFAULT_ROLE_TABS.auditor],
                        });
                      }
                    }}
                    className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 bg-gray-50 dark:bg-gray-900 rounded-lg transition-colors"
                  >
                    Reset to Default Access
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Team Members */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Team Members
            </h3>
            {team.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-4">
                No team members yet. Create an invite link above.
              </p>
            )}
            {team.map((member) => {
              const isExpanded = expandedMember === member.id;
              const RoleIcon = getRoleIcon(member.role);
              const roleInfo = getRoleLabel(member.role);
              const isExpired =
                member.expiresAt && new Date(member.expiresAt) < new Date();
              return (
                <div
                  key={member.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl border overflow-hidden ${isExpired ? "border-red-200 dark:border-red-800 opacity-60" : "border-gray-200 dark:border-gray-700"}`}
                >
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    onClick={() =>
                      setExpandedMember(isExpanded ? null : member.id)
                    }
                  >
                    <div
                      className={`p-2 rounded-lg ${roleInfo.color.split(" ")[0]}`}
                    >
                      <RoleIcon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {member.username}
                        </p>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${roleInfo.color}`}
                        >
                          {roleInfo.label}
                        </span>
                        {isExpired && (
                          <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                            Expired
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Invited by {member.invitedBy}
                        {member.invitedByUniqueId && (
                          <span className="text-gray-400">
                            {" "}
                            (ID: {member.invitedByUniqueId})
                          </span>
                        )}{" "}
                        on {new Date(member.invitedAt).toLocaleDateString()}
                      </p>
                      {(member.email || member.uniqueId) && (
                        <p className="text-[10px] text-gray-400 truncate">
                          {member.email && (
                            <span className="flex items-center gap-1">
                              <Mail size={9} /> {member.email}
                            </span>
                          )}
                          {member.uniqueId && (
                            <span className="ml-2">ID: {member.uniqueId}</span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {member.expiresAt && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock size={10} />{" "}
                          {new Date(member.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={16} className="text-gray-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-3">
                      {canAssign && (
                        <>
                          <div>
                            <label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                              <Fuel size={10} /> Assigned Pumps
                            </label>
                            <div className="flex flex-wrap gap-1">
                              {pumpOptions.length === 0 && (
                                <span className="text-[10px] text-gray-400">
                                  No pumps configured for this station.
                                </span>
                              )}
                              {pumpOptions.map((p) => {
                                const selected = member.assignedPumps.includes(
                                  p.id,
                                );
                                return (
                                  <button
                                    key={p.id}
                                    onClick={() => {
                                      const next = selected
                                        ? member.assignedPumps.filter(
                                            (x: string) => x !== p.id,
                                          )
                                        : [...member.assignedPumps, p.id];
                                      assignPumps(member.id, next);
                                    }}
                                    className={`text-[10px] px-2 py-1 rounded-full border transition-all ${selected ? "bg-green-100 text-green-700 border-green-300" : "bg-gray-50 text-gray-500 border-gray-200"}`}
                                  >
                                    {p.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                              <Calendar size={10} /> Assigned Shifts
                            </label>
                            <div className="flex flex-wrap gap-1">
                              {shiftOptions.map((s) => (
                                <button
                                  key={s}
                                  onClick={() => {
                                    const next = member.assignedShifts.includes(
                                      s,
                                    )
                                      ? member.assignedShifts.filter(
                                          (x: string) => x !== s,
                                        )
                                      : [...member.assignedShifts, s];
                                    assignShifts(member.id, next);
                                  }}
                                  className={`text-[10px] px-2 py-1 rounded-full border transition-all ${member.assignedShifts.includes(s) ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-gray-50 text-gray-500 border-gray-200"}`}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                        {canSetLimits && (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="number"
                              value={extendDaysByMember[member.id] ?? "30"}
                              onChange={(e) =>
                                setExtendDaysByMember((prev) => ({
                                  ...prev,
                                  [member.id]: e.target.value,
                                }))
                              }
                              className="w-16 px-2 py-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded text-xs dark:text-white"
                              placeholder="Days"
                            />
                            <button
                              onClick={() =>
                                extendAccess(
                                  member.id,
                                  parseInt(
                                    extendDaysByMember[member.id] ?? "30",
                                  ) || 30,
                                )
                              }
                              className="px-3 py-1.5 bg-blue-50 text-blue-700 text-[11px] font-medium rounded-lg flex items-center gap-1"
                            >
                              <RefreshCw size={10} /> Extend
                            </button>
                          </div>
                        )}
                        {canRevoke && member.role !== "owner" && (
                          <button
                            onClick={() => {
                              if (
                                confirm(`Remove ${member.username}'s access?`)
                              )
                                revokeMember(member.id);
                            }}
                            className="px-3 py-1.5 bg-red-50 text-red-700 text-[11px] font-medium rounded-lg flex items-center gap-1"
                          >
                            <Ban size={10} /> Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Used/Expired Invites */}
          {(usedInvites.length > 0 || expiredInvites.length > 0) && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400">
                History
              </h3>
              {usedInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs text-gray-500"
                >
                  <CheckCircle2 size={14} className="text-green-400" />
                  <span
                    className={`px-2 py-0.5 rounded ${getRoleLabel(inv.role).color}`}
                  >
                    {getRoleLabel(inv.role).label}
                  </span>
                  <span>
                    used by <strong>{inv.usedBy}</strong> on{" "}
                    {inv.usedAt
                      ? new Date(inv.usedAt).toLocaleDateString()
                      : "unknown"}
                  </span>
                </div>
              ))}
              {expiredInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs text-gray-500"
                >
                  <AlertTriangle size={14} className="text-amber-400" />
                  <span
                    className={`px-2 py-0.5 rounded ${getRoleLabel(inv.role).color}`}
                  >
                    {getRoleLabel(inv.role).label}
                  </span>
                  <span>
                    expired on{" "}
                    {inv.expiresAt
                      ? new Date(inv.expiresAt).toLocaleDateString()
                      : "unknown"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// Roles & Permissions View — full per-role permission editor + custom role
// creator. This is the heart of the hierarchy/delegation system: the Owner
// (or a delegated canGrantPermissions role) can toggle every boolean in the
// PermissionConfig for each role, create custom roles (accountant, cashier,
// ...), and the escalation guard prevents granting powers the granter doesn't
// hold themselves.
// =============================================================================

interface RolesAndPermissionsViewProps {
  isOwner: boolean;
  canManagePermissions: boolean;
  canCreateRoles: boolean;
  customRoles: CustomRole[];
  resolvePermissions: (roleName: string) => PermissionConfig;
  resolveTabGrants: (roleName: string) => string[];
  roleTabGrants: Record<string, string[]>;
  setRolePermission: (
    targetRole: UserRole,
    perm: keyof PermissionConfig,
    value: boolean,
  ) => void;
  grantTabToRole: (targetRole: UserRole, tabId: string) => void;
  revokeTabFromRole: (targetRole: UserRole, tabId: string) => void;
  setRoleTabGrants: (grants: Record<string, string[]>) => void;
  createCustomRole: (
    slug: string,
    label: string,
    baseRole?: BaseUserRole,
    rank?: number,
  ) => CustomRole | null;
  deleteCustomRole: (slug: string) => void;
  updateCustomRole: (slug: string, updates: Partial<CustomRole>) => void;
  outranks: (otherRole: string) => boolean;
  hasPermission: (key: keyof PermissionConfig) => boolean;
  tabIdToLabel: Record<string, string>;
  permEditorRole: string | null;
  setPermEditorRole: (r: string | null) => void;
  showRoleCreator: boolean;
  setShowRoleCreator: (v: boolean) => void;
  newRoleName: string;
  setNewRoleName: (v: string) => void;
  newRoleLabel: string;
  setNewRoleLabel: (v: string) => void;
  newRoleBase: BaseUserRole;
  setNewRoleBase: (v: BaseUserRole) => void;
}

function RolesAndPermissionsView(props: RolesAndPermissionsViewProps) {
  const {
    isOwner,
    canManagePermissions,
    canCreateRoles,
    customRoles,
    resolvePermissions,
    setRolePermission,
    createCustomRole,
    deleteCustomRole,
    outranks,
    hasPermission,
    permEditorRole,
    setPermEditorRole,
    showRoleCreator,
    setShowRoleCreator,
    newRoleName,
    setNewRoleName,
    newRoleLabel,
    setNewRoleLabel,
    newRoleBase,
    setNewRoleBase,
    // tabIdToLabel is intentionally not destructured — the per-role tab
    // grants grid lives in the Feature Access Control panel (Team Access
    // sub-tab), not here. Kept on the props interface for future use.
  } = props;

  // All roles the current user can edit: base roles they outrank + custom roles
  // they outrank. Owner outranks everything.
  const allRoles: { id: string; label: string; isCustom: boolean }[] = [];
  for (const r of ["manager", "staff", "auditor"]) {
    if (outranks(r))
      allRoles.push({ id: r, label: getRoleLabel(r).label, isCustom: false });
  }
  for (const cr of customRoles) {
    if (outranks(cr.name)) {
      allRoles.push({ id: cr.name, label: cr.label, isCustom: true });
    }
  }

  const handleCreateRole = () => {
    if (!newRoleName.trim()) return;
    const created = createCustomRole(newRoleName, newRoleLabel, newRoleBase);
    if (created) {
      setNewRoleName("");
      setNewRoleLabel("");
      setShowRoleCreator(false);
      setPermEditorRole(created.name);
    } else {
      alert(
        "Could not create role. The name may be reserved (owner/manager/staff/auditor) or already exists.",
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
            <KeyRound
              size={20}
              className="text-indigo-600 dark:text-indigo-400"
            />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Roles &amp; Permissions Hierarchy
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Owner &gt; Manager &gt; Staff &gt; Auditor (+ custom roles).
              {isOwner
                ? " You have full control as the Owner."
                : " You can only manage roles below your rank and grant powers you yourself hold."}
            </p>
          </div>
        </div>
      </div>

      {/* Custom role creator */}
      {canCreateRoles && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          {!showRoleCreator ? (
            <button
              onClick={() => setShowRoleCreator(true)}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={16} /> Create Custom Role
            </button>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                New Custom Role
              </h3>
              <p className="text-xs text-gray-500">
                Custom roles (e.g. Accountant, Cashier) inherit from a base role
                and can be finely tuned below. They always rank below the Owner.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Slug (internal name)
                  </label>
                  <input
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="accountant"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Display label
                  </label>
                  <input
                    value={newRoleLabel}
                    onChange={(e) => setNewRoleLabel(e.target.value)}
                    placeholder="Accountant"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Inherit from
                  </label>
                  <select
                    value={newRoleBase}
                    onChange={(e) =>
                      setNewRoleBase(e.target.value as BaseUserRole)
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                  >
                    <option value="manager">Manager</option>
                    <option value="staff">Staff</option>
                    <option value="auditor">Auditor</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateRole}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5"
                >
                  <Plus size={14} /> Create Role
                </button>
                <button
                  onClick={() => setShowRoleCreator(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Permission editors per role */}
      {allRoles.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-sm text-gray-400">
          No roles available for you to manage.
        </div>
      )}
      {allRoles.map((r) => {
        const isOpen = permEditorRole === r.id;
        const perms = resolvePermissions(r.id);
        const cr = customRoles.find((c) => c.name === r.id);
        return (
          <div
            key={r.id}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <button
              onClick={() => setPermEditorRole(isOpen ? null : r.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${getRoleLabel(r.id).color}`}
                >
                  {r.label}
                </div>
                {r.isCustom && (
                  <span className="text-[10px] px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                    Custom
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  Rank {rankOf(r.id)}
                </span>
              </div>
              {isOpen ? (
                <ChevronUp size={16} className="text-gray-400" />
              ) : (
                <ChevronDown size={16} className="text-gray-400" />
              )}
            </button>
            {isOpen && (
              <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
                {r.isCustom && canManagePermissions && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Delete the custom role "${r.label}"? This cannot be undone.`,
                          )
                        ) {
                          deleteCustomRole(r.id);
                          setPermEditorRole(null);
                        }
                      }}
                      className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg flex items-center gap-1.5 hover:bg-red-100 dark:hover:bg-red-900/40"
                    >
                      <Trash2 size={12} /> Delete Role
                    </button>
                  </div>
                )}
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.group}>
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      {group.group}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {group.perms.map((p) => {
                        const value = Boolean(perms[p.key]);
                        // Escalation guard: the granter must hold the permission
                        // themselves to grant it. The context double-checks.
                        const canToggle =
                          canManagePermissions &&
                          (isOwner ||
                            p.key === "canViewDashboard" || // view-dashboard is safe
                            hasPermission(p.key));
                        return (
                          <label
                            key={String(p.key)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border cursor-pointer transition-all ${
                              value
                                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                                : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500"
                            } ${!canToggle ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={value}
                              disabled={!canToggle}
                              onChange={(e) =>
                                setRolePermission(
                                  r.id as UserRole,
                                  p.key,
                                  e.target.checked,
                                )
                              }
                              className="sr-only"
                            />
                            {value ? (
                              <ToggleRight
                                size={16}
                                className="flex-shrink-0"
                              />
                            ) : (
                              <ToggleLeft size={16} className="flex-shrink-0" />
                            )}
                            <span>{p.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {!canManagePermissions && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <ShieldAlert size={12} /> You need the &quot;Grant
                    Permissions&quot; power to edit these settings.
                  </p>
                )}
                {/* Rank display for custom roles */}
                {cr && (
                  <div className="text-xs text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
                    Base: {cr.label} · Rank: {cr.rank} · Created{" "}
                    {new Date(cr.createdAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
