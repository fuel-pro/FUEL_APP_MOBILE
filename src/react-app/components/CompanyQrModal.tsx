/**
 * CompanyQrModal.tsx
 * Secure, revocable, expiry-scoped Company QR Code.
 *
 * Replaces the old Header QR modal, which encoded only static company data
 * (VAT/taxId/phone) through a THIRD-PARTY provider (api.qrserver.com) with
 * no access grant, no expiry and no revocation. This version:
 *
 *   1. Generates the QR ON-DEVICE (bundled `qrcode` lib) — no external
 *      service, no company data leaves the device.
 *   2. The QR encodes a deep link carrying an OPAQUE random token (32 bytes)
 *      tied to a station_qr_grants row (cloud Supabase table). Scanning it
 *      opens /#/station-access?qr=<token>&sid=<stationId> where the
 *      recipient is auto-authenticated into the READ-ONLY Station Access
 *      viewer — no username/password entry.
 *   3. The owner sets an EXPIRY (default 7 days) and can revoke instantly
 *      (disable/delete). The token is validated SERVER-SIDE by the SECURITY
 *      DEFINER RPC `redeem_station_qr_access` (expiry + enabled + maxUses
 *      checked atomically), so a revoked/expired QR stops working
 *      immediately everywhere.
 *   4. Share buttons: WhatsApp (wa.me), email (mailto), copy link.
 */
import { useState, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import { useAuth } from "@/react-app/context/AuthContext";
import { useStations } from "@/react-app/context/StationContext";
import {
  createQrGrant,
  listQrGrants,
  setQrGrantEnabled,
  deleteQrGrant,
  buildQrGrantUrl,
  formatGrantExpiry,
  isGrantActive,
  type StationQrGrant,
} from "@/react-app/lib/station-qr-access-service";
import { toastSuccess, toastError } from "@/react-app/lib/toast";
import {
  X,
  Download,
  Trash2,
  Power,
  Copy,
  MessageCircle,
  Mail,
} from "lucide-react";

interface Props {
  onClose: () => void;
}

function expiryOptions(): { label: string; ms: number }[] {
  return [
    { label: "1 hour", ms: 60 * 60 * 1000 },
    { label: "1 day", ms: 24 * 60 * 60 * 1000 },
    { label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
    { label: "30 days", ms: 30 * 24 * 60 * 60 * 1000 },
    { label: "90 days", ms: 90 * 24 * 60 * 60 * 1000 },
  ];
}

export default function CompanyQrModal({ onClose }: Props) {
  const { currentStation } = useStations();
  const { user } = useAuth();
  const [grants, setGrants] = useState<StationQrGrant[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [selectedGrant, setSelectedGrant] = useState<StationQrGrant | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<"new" | "active">("new");
  const [expiryKey, setExpiryKey] = useState("7 days");
  const [memberLabel, setMemberLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const stationId = currentStation?.id || "";

  const refresh = useCallback(async () => {
    if (!stationId) return;
    const list = await listQrGrants(stationId);
    setGrants(list);
    setSelectedGrant((prev) =>
      prev && list.some((g) => g.token === prev.token && isGrantActive(g))
        ? prev
        : null,
    );
  }, [stationId]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, user?.id]);

  // Regenerate the QR whenever the selected grant changes.
  useEffect(() => {
    if (!selectedGrant) return;
    const url = buildQrGrantUrl(selectedGrant.token, selectedGrant.stationId);
    QRCode.toDataURL(url, { width: 260, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [selectedGrant]);

  const handleCreate = async () => {
    if (!stationId) {
      toastError("No station selected.");
      return;
    }
    setCreating(true);
    try {
      const opt =
        expiryOptions().find((o) => o.label === expiryKey) ||
        expiryOptions()[2];
      const expiresAt = new Date(Date.now() + opt.ms).toISOString();
      const grant = await createQrGrant({
        stationId,
        memberLabel: memberLabel.trim() || "Guest",
        memberRole: "Guest",
        allowedTabs: [],
        readOnly: true,
        maxUses: 0,
        expiresAt,
        note: `QR access · ${opt.label}`,
      });
      setSelectedGrant(grant);
      toastSuccess(`QR access created (valid ${opt.label}).`);
      await refresh();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Could not create QR grant");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = () => {
    if (!selectedGrant) return;
    navigator.clipboard
      .writeText(buildQrGrantUrl(selectedGrant.token, selectedGrant.stationId))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  const handleWhatsApp = () => {
    if (!selectedGrant) return;
    const url = buildQrGrantUrl(selectedGrant.token, selectedGrant.stationId);
    const msg = `Scan this QR code to securely view our station dashboard (read-only). Valid until ${formatGrantExpiry(selectedGrant.expiresAt)}.`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${msg} ${url}`)}`,
      "_blank",
    );
  };

  const handleEmail = () => {
    if (!selectedGrant) return;
    const url = buildQrGrantUrl(selectedGrant.token, selectedGrant.stationId);
    const subject = `Secure access to ${currentStation?.name || "our"} station dashboard`;
    const body = `Scan the QR code (or open the link) to view our station dashboard read-only.\n\nLink: ${url}\n\nValid until ${formatGrantExpiry(selectedGrant.expiresAt)}.`;
    window.open(
      `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      "_blank",
    );
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `company_qr_${stationId.slice(0, 8)}.png`;
    link.click();
  };

  const activeGrants = grants.filter(isGrantActive);
  const selected = selectedGrant || activeGrants[0] || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-white/20 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Company QR Code</h3>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Secure one-tap read-only access to this station. The QR expires after
          the period you choose and can be revoked at any time. Scans open the
          Station Access viewer directly — no password needed.
        </p>

        {/* Tab switch: new grant / active grants */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab("new")}
            className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-colors ${
              activeTab === "new"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
            }`}
          >
            New Grant
          </button>
          <button
            onClick={() => setActiveTab("active")}
            className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-colors ${
              activeTab === "active"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
            }`}
          >
            Active Grants ({activeGrants.length})
          </button>
        </div>

        {activeTab === "active" && activeGrants.length > 0 && (
          <div className="mb-4 space-y-2">
            {activeGrants.map((g) => (
              <div
                key={g.token}
                className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
                  selected?.token === g.token
                    ? "border-amber-500 bg-amber-500/5"
                    : "border-gray-200 dark:border-gray-600"
                }`}
                onClick={() => setSelectedGrant(g)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {g.memberLabel} · expires {formatGrantExpiry(g.expiresAt)}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    Used {g.usedCount}
                    {g.maxUses > 0 ? ` / ${g.maxUses}` : ""} ·{" "}
                    {g.readOnly ? "read-only" : "editable"}
                  </p>
                </div>
                <button
                  title={g.enabled ? "Revoke" : "Re-enable"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setQrGrantEnabled(g.token, !g.enabled)
                      .then(refresh)
                      .catch(() => {});
                  }}
                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500"
                >
                  <Power
                    size={13}
                    className={
                      g.enabled
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-400"
                    }
                  />
                </button>
                <button
                  title="Delete grant"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Revoke this QR access permanently?")) {
                      deleteQrGrant(g.token)
                        .then(() => {
                          setSelectedGrant(null);
                          refresh();
                        })
                        .catch(() => {});
                    }
                  }}
                  className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "new" && (
          <div className="mb-4 space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1">
                Recipient label (optional)
              </label>
              <input
                value={memberLabel}
                onChange={(e) => setMemberLabel(e.target.value)}
                placeholder="e.g. Supplier, Auditor, HQ Team"
                className="w-full px-3 py-2 text-sm rounded-lg border dark:bg-gray-800 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Access duration
              </label>
              <select
                value={expiryKey}
                onChange={(e) => setExpiryKey(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border dark:bg-gray-800 dark:border-gray-600"
              >
                {expiryOptions().map((o) => (
                  <option key={o.label} value={o.label}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-gray-900 dark:text-white font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create QR access grant"}
            </button>
          </div>
        )}

        {selected && (
          <>
            <div className="bg-white p-4 rounded-xl flex items-center justify-center mb-4">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Company QR Code"
                  className="w-52 h-52"
                />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-gray-400 text-xs">
                  Generating…
                </div>
              )}
            </div>
            <p className="text-xs text-center text-gray-500 dark:text-gray-500 mb-4 break-all">
              {buildQrGrantUrl(selected.token, selected.stationId)}
            </p>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={handleDownload}
                className="py-2 px-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium flex items-center justify-center gap-1.5"
              >
                <Download size={13} /> Download QR
              </button>
              <button
                onClick={handleCopy}
                className="py-2 px-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium flex items-center justify-center gap-1.5"
              >
                <Copy size={13} /> {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleWhatsApp}
                className="py-2 px-3 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium flex items-center justify-center gap-1.5"
              >
                <MessageCircle size={13} /> WhatsApp
              </button>
              <button
                onClick={handleEmail}
                className="py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center justify-center gap-1.5"
              >
                <Mail size={13} /> Email
              </button>
            </div>
          </>
        )}

        {!selected && (
          <div className="text-center text-xs text-gray-500 dark:text-gray-400 py-6">
            No active QR grants. Create one above to generate a secure access
            QR.
          </div>
        )}
      </div>
    </div>
  );
}
