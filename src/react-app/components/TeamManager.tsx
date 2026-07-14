import { useState } from "react";
import {
  Users,
  Link2,
  Plus,
  Clock,
  ShieldCheck,
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
  LayoutDashboard,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useAuth } from "@/react-app/context/AuthContext";
import {
  usePermissions,
  type UserRole,
  DEFAULT_ROLE_TABS,
} from "@/react-app/context/PermissionContext";
import { useStations } from "@/react-app/context/StationContext";

const ROLE_LABELS: Record<
  UserRole,
  { label: string; color: string; desc: string }
> = {
  owner: {
    label: "Owner",
    color: "bg-purple-100 text-purple-700",
    desc: "Full access, cannot be revoked",
  },
  manager: {
    label: "Manager",
    color: "bg-blue-100 text-blue-700",
    desc: "Operational control, can invite Staff/Auditor",
  },
  staff: {
    label: "Staff",
    color: "bg-green-100 text-green-700",
    desc: "Daily tasks, assigned pumps/shifts",
  },
  auditor: {
    label: "Auditor",
    color: "bg-amber-100 text-amber-700",
    desc: "Read-only audit and reports",
  },
};

const ROLE_ICONS: Record<UserRole, any> = {
  owner: ShieldCheck,
  manager: UserCheck,
  staff: User,
  auditor: Eye,
};

function makeInviteLink(inv: any, station: any): string {
  const payload = JSON.stringify({
    id: inv.id,
    role: inv.role,
    stationName: station?.name || "Fuel Station",
    stationId: station?.id || "default",
    createdBy: inv.createdBy,
    expiresAt: inv.expiresAt,
    maxUses: inv.maxUses,
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
  const {
    role,
    team,
    invites,
    hasPermission,
    isOwner,
    isManager,
    createInvite,
    revokeMember,
    extendAccess,
    assignPumps,
    assignShifts,
    roleTabGrants,
    setRoleTabGrants,
    grantTabToRole,
    revokeTabFromRole,
  } = usePermissions();
  const [showCreate, setShowCreate] = useState(false);
  const [inviteRole, setInviteRole] = useState<UserRole>("staff");
  const [expireDays, setExpireDays] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [copiedId, setCopiedId] = useState("");
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState("30");
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false);
  const [showFeatureGrant, setShowFeatureGrant] = useState(false);

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
    b => b.active && b.authId === user?.authId
  );

  const canCreateManager = isOwner && hasPermission("canInviteManager");
  const canCreateStaff =
    (isOwner || isManager) && hasPermission("canInviteStaff");
  const canCreateAuditor =
    (isOwner || isManager) && hasPermission("canInviteAuditor");
  const canRevoke = hasPermission("canRevokeAccess");
  const canSetLimits = hasPermission("canSetTimeLimits");
  const canAssign =
    hasPermission("canAssignPumps") || hasPermission("canAssignShifts");

  const handleCreateInvite = () => {
    const r = inviteRole;
    if (r === "manager" && !canCreateManager) return;
    if (r === "staff" && !canCreateStaff) return;
    if (r === "auditor" && !canCreateAuditor) return;
    const days = expireDays ? parseInt(expireDays) : undefined;
    const uses = parseInt(maxUses) || 1;
    createInvite(r, days, uses);
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
      `You're invited to join ${currentStation?.name || "Fuel Station"} as ${inv.role}! Click the link to accept:`
    );
    window.open(`https://wa.me/?text=${text}%20${link}`, "_blank");
  };

  const handleShareEmail = (inv: (typeof invites)[0]) => {
    const link = getLink(inv);
    const subject = encodeURIComponent(
      `Invitation to join ${currentStation?.name || "Fuel Station"}`
    );
    const body = encodeURIComponent(
      `Hello,\n\nYou've been invited to join ${currentStation?.name || "Fuel Station"} as a ${inv.role}.\n\nClick the link below to accept your invitation:\n\n${link}\n\nThis link works on any device.`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  const availableRoles: UserRole[] = [];
  if (canCreateManager) availableRoles.push("manager");
  if (canCreateStaff) availableRoles.push("staff");
  if (canCreateAuditor) availableRoles.push("auditor");

  const activeInvites = invites.filter(
    i => !i.usedBy && (!i.expiresAt || new Date(i.expiresAt) > new Date())
  );
  const usedInvites = invites.filter(i => i.usedBy);
  const expiredInvites = invites.filter(
    i => i.expiresAt && new Date(i.expiresAt) < new Date() && !i.usedBy
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

      {/* Current User Badge */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${ROLE_LABELS[role].color}`}
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
                      ({ triggerSoftReload }) => triggerSoftReload(500)
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
            value: team.filter(m => m.active).length,
            color: "text-purple-600",
          },
          {
            label: "Managers",
            value: team.filter(m => m.role === "manager").length,
            color: "text-blue-600",
          },
          {
            label: "Staff",
            value: team.filter(m => m.role === "staff").length,
            color: "text-green-600",
          },
          {
            label: "Active Invites",
            value: activeInvites.length,
            color: "text-amber-600",
          },
        ].map(s => (
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
                <div className="flex gap-2">
                  {availableRoles.map(r => (
                    <button
                      key={r}
                      onClick={() => setInviteRole(r)}
                      className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${inviteRole === r ? ROLE_LABELS[r].color + " ring-2 ring-offset-1" : "bg-white dark:bg-gray-800 text-gray-600"}`}
                    >
                      {ROLE_LABELS[r].label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {ROLE_LABELS[inviteRole].desc}
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
                    onChange={e => setExpireDays(e.target.value)}
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
                    onChange={e => setMaxUses(e.target.value)}
                    min="1"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                  />
                </div>
              </div>
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
          {activeInvites.map(inv => (
            <div
              key={inv.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`px-2 py-1 rounded text-[10px] font-medium ${ROLE_LABELS[inv.role].color}`}
                  >
                    {ROLE_LABELS[inv.role].label}
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
                      navigator.share({
                        title: "FuelPro Invite",
                        text: `Join ${currentStation?.name || "Fuel Station"} as ${inv.role}`,
                        url: link,
                      });
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

      {/* Feature Access Control — Owner Only */}
      {isOwner && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => setShowFeatureGrant(!showFeatureGrant)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                <LayoutDashboard
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
                  <ToggleRight size={14} className="text-green-500" /> Allowed
                </span>
                <span className="flex items-center gap-1">
                  <ToggleLeft size={14} className="text-gray-400" /> Denied
                </span>
                <span className="ml-auto text-gray-400">Click to toggle</span>
              </div>

              {/* Roles to manage */}
              {(["manager", "staff", "auditor"] as UserRole[]).map(
                targetRole => (
                  <div key={targetRole}>
                    <h4
                      className={`text-xs font-semibold mb-2 px-2 py-1 rounded inline-block ${ROLE_LABELS[targetRole].color.replace("text-", "text-opacity-100 ")}`}
                    >
                      {ROLE_LABELS[targetRole].label} Access
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {Object.keys(tabIdToLabel).map(tabId => {
                        const isAllowed =
                          roleTabGrants[targetRole]?.includes(tabId) ?? false;
                        const isDefault =
                          DEFAULT_ROLE_TABS[targetRole]?.includes(tabId) ??
                          false;
                        return (
                          <button
                            key={tabId}
                            onClick={() => {
                              if (isAllowed)
                                revokeTabFromRole(targetRole, tabId);
                              else grantTabToRole(targetRole, tabId);
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
                            {!isAllowed && isDefault && (
                              <span className="text-[9px] text-amber-500 ml-auto">
                                was on
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )
              )}

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
        {team.map(member => {
          const isExpanded = expandedMember === member.id;
          const RoleIcon = ROLE_ICONS[member.role];
          const isExpired =
            member.expiresAt && new Date(member.expiresAt) < new Date();
          return (
            <div
              key={member.id}
              className={`bg-white dark:bg-gray-800 rounded-xl border overflow-hidden ${isExpired ? "border-red-200 dark:border-red-800 opacity-60" : "border-gray-200 dark:border-gray-700"}`}
            >
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                onClick={() => setExpandedMember(isExpanded ? null : member.id)}
              >
                <div
                  className={`p-2 rounded-lg ${ROLE_LABELS[member.role].color.split(" ")[0]}`}
                >
                  <RoleIcon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {member.username}
                    </p>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ROLE_LABELS[member.role].color}`}
                    >
                      {ROLE_LABELS[member.role].label}
                    </span>
                    {isExpired && (
                      <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                        Expired
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Invited by {member.invitedBy} on{" "}
                    {new Date(member.invitedAt).toLocaleDateString()}
                  </p>
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
                          {["PMS-1", "PMS-2", "AGO-1", "AGO-2", "IK-1"].map(
                            p => (
                              <button
                                key={p}
                                onClick={() => {
                                  const next = member.assignedPumps.includes(p)
                                    ? member.assignedPumps.filter(
                                        (x: string) => x !== p
                                      )
                                    : [...member.assignedPumps, p];
                                  assignPumps(member.id, next);
                                }}
                                className={`text-[10px] px-2 py-1 rounded-full border transition-all ${member.assignedPumps.includes(p) ? "bg-green-100 text-green-700 border-green-300" : "bg-gray-50 text-gray-500 border-gray-200"}`}
                              >
                                {p}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                          <Calendar size={10} /> Assigned Shifts
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {[
                            "Morning (6AM-2PM)",
                            "Afternoon (2PM-10PM)",
                            "Night (10PM-6AM)",
                          ].map(s => (
                            <button
                              key={s}
                              onClick={() => {
                                const next = member.assignedShifts.includes(s)
                                  ? member.assignedShifts.filter(
                                      (x: string) => x !== s
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
                          value={extendDays}
                          onChange={e => setExtendDays(e.target.value)}
                          className="w-16 px-2 py-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded text-xs dark:text-white"
                          placeholder="Days"
                        />
                        <button
                          onClick={() =>
                            extendAccess(member.id, parseInt(extendDays) || 30)
                          }
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 text-[11px] font-medium rounded-lg flex items-center gap-1"
                        >
                          <RefreshCw size={10} /> Extend
                        </button>
                      </div>
                    )}
                    {canRevoke && !isOwner && (
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${member.username}'s access?`))
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
          {usedInvites.map(inv => (
            <div
              key={inv.id}
              className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs text-gray-500"
            >
              <CheckCircle2 size={14} className="text-green-400" />
              <span
                className={`px-2 py-0.5 rounded ${ROLE_LABELS[inv.role].color}`}
              >
                {ROLE_LABELS[inv.role].label}
              </span>
              <span>
                used by <strong>{inv.usedBy}</strong> on{" "}
                {inv.usedAt
                  ? new Date(inv.usedAt).toLocaleDateString()
                  : "unknown"}
              </span>
            </div>
          ))}
          {expiredInvites.map(inv => (
            <div
              key={inv.id}
              className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs text-gray-500"
            >
              <AlertTriangle size={14} className="text-amber-400" />
              <span
                className={`px-2 py-0.5 rounded ${ROLE_LABELS[inv.role].color}`}
              >
                {ROLE_LABELS[inv.role].label}
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
    </div>
  );
}
