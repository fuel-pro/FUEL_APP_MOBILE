/**
 * FuelPro Station Loyalty Manager
 * Station admin interface for managing loyalty program
 */

import { useState } from "react";
import {
  Users,
  Gift,
  Settings,
  TrendingUp,
  Star,
  Award,
  Plus,
  Edit2,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
  QrCode,
  Download,
  BarChart3,
  AlertCircle,
  Check,
  X,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useLoyalty } from "../lib/useLoyalty";
import LoyaltyCard from "../lib/LoyaltyCard";
import {
  LoyaltyCustomer,
  StationReward,
  TIER_COLORS,
  getTierProgress,
} from "../lib/loyaltyProgram";
import { formatNumber } from "@/react-app/utils/formatUtils";

interface StationLoyaltyManagerProps {
  stationId: string;
  stationName: string;
  currencySymbol?: string;
}

export default function StationLoyaltyManager({
  stationId,
  stationName,
  currencySymbol = "KSh",
}: StationLoyaltyManagerProps) {
  const {
    customers,
    rewards,
    transactions,
    config,
    stats,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    earnPoints,
    redeemPoints,
    adjustPoints,
    addReward,
    updateReward,
    deleteReward,
    updateConfig,
    exportData,
  } = useLoyalty(stationId);

  const [activeTab, setActiveTab] = useState<
    "customers" | "rewards" | "settings" | "stats"
  >("customers");
  const [search, setSearch] = useState("");
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddReward, setShowAddReward] = useState(false);
  const [selectedCustomer, setSelectedCustomer] =
    useState<LoyaltyCustomer | null>(null);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [pointsAction, setPointsAction] = useState<
    "earn" | "redeem" | "adjust"
  >("earn");
  const [pointsAmount, setPointsAmount] = useState(0);
  const [pointsReason, setPointsReason] = useState("");

  const filteredCustomers = customers.filter(
    c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.cardNumber.includes(search) ||
      (c.vehicleReg &&
        c.vehicleReg.toLowerCase().includes(search.toLowerCase()))
  );

  const handleEarnPoints = () => {
    if (!selectedCustomer || pointsAmount <= 0) return;

    earnPoints(
      selectedCustomer.id,
      `manual_${Date.now()}`,
      pointsAmount * 10, // Simulate sale amount
      pointsAmount, // Liters
      "PMS",
      "admin"
    );

    setShowPointsModal(false);
    setPointsAmount(0);
    setPointsReason("");
    setSelectedCustomer(null);
  };

  const handleRedeemPoints = () => {
    if (!selectedCustomer || pointsAmount <= 0) return;

    redeemPoints(
      selectedCustomer.id,
      rewards[0]?.id || "",
      pointsAmount,
      "admin"
    );

    setShowPointsModal(false);
    setPointsAmount(0);
    setSelectedCustomer(null);
  };

  const handleAdjustPoints = () => {
    if (!selectedCustomer || pointsAmount === 0) return;

    adjustPoints(
      selectedCustomer.id,
      pointsAction === "adjust" ? pointsAmount : 0,
      pointsReason,
      "admin"
    );

    setShowPointsModal(false);
    setPointsAmount(0);
    setPointsReason("");
    setSelectedCustomer(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
            <Award size={24} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {stationName} Loyalty
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage customers, points & rewards
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const data = exportData();
              const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `loyalty_export_${stationId}.json`;
              a.click();
            }}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Download size={16} /> Export
          </button>
          <button
            onClick={() => setShowAddCustomer(true)}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <Plus size={16} /> Add Customer
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 mb-1">Total Members</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.totalCustomers}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 mb-1">Active Members</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {stats.activeCustomers}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 mb-1">Points Issued</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {formatNumber(stats.totalPointsIssued)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 mb-1">Revenue</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {currencySymbol} {formatNumber(stats.totalRevenue)}
          </p>
        </div>
      </div>

      {/* Tier Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Tier Distribution
        </h3>
        <div className="flex gap-2">
          {(["Bronze", "Silver", "Gold", "Platinum"] as const).map(tier => (
            <div
              key={tier}
              className={`flex-1 p-3 rounded-lg ${TIER_COLORS[tier].bg}`}
            >
              <p className={`text-xs font-medium ${TIER_COLORS[tier].text}`}>
                {tier}
              </p>
              <p className={`text-xl font-bold ${TIER_COLORS[tier].text}`}>
                {stats.topTierBreakdown[tier]}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 overflow-x-auto">
        {[
          { id: "customers", label: "Customers", icon: Users },
          { id: "rewards", label: "Rewards", icon: Gift },
          { id: "settings", label: "Settings", icon: Settings },
          { id: "stats", label: "Statistics", icon: BarChart3 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-fit flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "customers" && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search by name, phone, card number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white"
            />
          </div>

          {/* Add Customer Form */}
          {showAddCustomer && (
            <AddCustomerForm
              onAdd={data => {
                addCustomer(data, "admin");
                setShowAddCustomer(false);
              }}
              onCancel={() => setShowAddCustomer(false)}
            />
          )}

          {/* Customer Detail */}
          {selectedCustomer && (
            <CustomerDetail
              customer={selectedCustomer}
              config={config}
              rewards={rewards}
              currencySymbol={currencySymbol}
              onClose={() => setSelectedCustomer(null)}
              onEarnPoints={() => {
                setPointsAction("earn");
                setShowPointsModal(true);
              }}
              onRedeemPoints={() => {
                setPointsAction("redeem");
                setShowPointsModal(true);
              }}
              onAdjustPoints={() => {
                setPointsAction("adjust");
                setShowPointsModal(true);
              }}
              onDelete={() => {
                deleteCustomer(selectedCustomer.id);
                setSelectedCustomer(null);
              }}
            />
          )}

          {/* Customers List */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">
                      Customer
                    </th>
                    <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">
                      Contact
                    </th>
                    <th className="text-right px-4 py-3 text-gray-600 dark:text-gray-400">
                      Points
                    </th>
                    <th className="text-center px-4 py-3 text-gray-600 dark:text-gray-400">
                      Tier
                    </th>
                    <th className="text-right px-4 py-3 text-gray-600 dark:text-gray-400">
                      Visits
                    </th>
                    <th className="text-center px-4 py-3 text-gray-600 dark:text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map(c => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomer(c)}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {c.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {c.cardNumber} {c.vehicleReg && `• ${c.vehicleReg}`}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {c.phone}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                        {formatNumber(c.points)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${TIER_COLORS[c.tier].bg} ${TIER_COLORS[c.tier].text} ${TIER_COLORS[c.tier].border}`}
                        >
                          {c.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                        {c.totalVisits}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedCustomer(c);
                            setPointsAction("earn");
                            setShowPointsModal(true);
                          }}
                          className="p-1.5 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 rounded-lg text-green-600"
                        >
                          <Plus size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredCustomers.length === 0 && (
              <div className="text-center py-12">
                <Users size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-600 dark:text-gray-400">
                  No customers found
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "rewards" && (
        <div className="space-y-4">
          <button
            onClick={() => setShowAddReward(true)}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2"
          >
            <Plus size={16} /> Add Reward
          </button>

          {showAddReward && (
            <AddRewardForm
              onAdd={data => {
                addReward(data);
                setShowAddReward(false);
              }}
              onCancel={() => setShowAddReward(false)}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rewards.map(r => (
              <div
                key={r.id}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {r.name}
                    </h3>
                    <p className="text-sm text-gray-500">{r.description}</p>
                  </div>
                  <div className="flex gap-1">
                    <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                      <Edit2 size={14} className="text-gray-400" />
                    </button>
                    <button
                      onClick={() => deleteReward(r.id)}
                      className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-amber-600 font-semibold">
                    {r.pointsCost.toLocaleString()} pts
                  </span>
                  <span className="text-green-600">
                    {r.valueType === "percentage"
                      ? `${r.value}% off`
                      : r.valueType === "fixed"
                        ? `KSh ${r.value} off`
                        : "Free"}
                  </span>
                </div>
                {r.remainingQuantity !== undefined && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{
                          width: `${(r.remainingQuantity / (r.totalQuantity || 1)) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {r.remainingQuantity} remaining
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "settings" && config && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Loyalty Settings
          </h3>

          <div className="space-y-4 max-w-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Enable Loyalty Program
                </p>
                <p className="text-sm text-gray-500">
                  Allow customers to earn and redeem points
                </p>
              </div>
              <button
                onClick={() => updateConfig({ isEnabled: !config.isEnabled })}
                className={`w-12 h-6 rounded-full transition-colors ${config.isEnabled ? "bg-green-500" : "bg-gray-300"}`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${config.isEnabled ? "translate-x-6" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Points Per Liter
              </label>
              <input
                type="number"
                value={config.pointsPerLiter}
                onChange={e =>
                  updateConfig({
                    pointsPerLiter: parseFloat(e.target.value) || 1,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Minimum Liters to Earn
              </label>
              <input
                type="number"
                value={config.minimumLiters}
                onChange={e =>
                  updateConfig({
                    minimumLiters: parseFloat(e.target.value) || 1,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Auto-upgrade Tiers
                </p>
                <p className="text-sm text-gray-500">
                  Automatically upgrade customer tier when they earn enough
                  points
                </p>
              </div>
              <button
                onClick={() =>
                  updateConfig({ autoUpgradeTier: !config.autoUpgradeTier })
                }
                className={`w-12 h-6 rounded-full transition-colors ${config.autoUpgradeTier ? "bg-green-500" : "bg-gray-300"}`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${config.autoUpgradeTier ? "translate-x-6" : "translate-x-0.5"}`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "stats" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500">Avg. Spend per Customer</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {currencySymbol} {formatNumber(stats.averageSpend)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500">Points Redeemed</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {formatNumber(stats.totalPointsRedeemed)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Points Modal */}
      {showPointsModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {pointsAction === "earn"
                ? "Earn Points"
                : pointsAction === "redeem"
                  ? "Redeem Points"
                  : "Adjust Points"}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Points Amount
                </label>
                <input
                  type="number"
                  value={pointsAmount}
                  onChange={e => setPointsAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              {pointsAction === "adjust" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reason
                  </label>
                  <input
                    type="text"
                    value={pointsReason}
                    onChange={e => setPointsReason(e.target.value)}
                    placeholder="Enter reason for adjustment"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (pointsAction === "earn") handleEarnPoints();
                    else if (pointsAction === "redeem") handleRedeemPoints();
                    else handleAdjustPoints();
                  }}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium"
                >
                  Confirm
                </button>
                <button
                  onClick={() => {
                    setShowPointsModal(false);
                    setSelectedCustomer(null);
                  }}
                  className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper Components ───

function AddCustomerForm({
  onAdd,
  onCancel,
}: {
  onAdd: (data: any) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    vehicleReg: "",
    preferredFuel: "Both" as const,
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-lg">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3">
        New Customer
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          placeholder="Full Name *"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        <input
          placeholder="Phone *"
          value={form.phone}
          onChange={e => setForm({ ...form, phone: e.target.value })}
          className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        <input
          placeholder="Email"
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        <input
          placeholder="Vehicle Registration"
          value={form.vehicleReg}
          onChange={e => setForm({ ...form, vehicleReg: e.target.value })}
          className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        <select
          value={form.preferredFuel}
          onChange={e =>
            setForm({ ...form, preferredFuel: e.target.value as any })
          }
          className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="PMS">PMS</option>
          <option value="AGO">AGO</option>
          <option value="Both">Both</option>
        </select>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onAdd(form)}
          disabled={!form.name || !form.phone}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium"
        >
          Add Customer
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AddRewardForm({
  onAdd,
  onCancel,
}: {
  onAdd: (data: any) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "discount" as const,
    pointsCost: 500,
    value: 10,
    valueType: "percentage" as const,
    validFrom: new Date().toISOString().split("T")[0],
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    isActive: true,
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-lg">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3">
        New Reward
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          placeholder="Reward Name *"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        <input
          placeholder="Description"
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        <input
          type="number"
          placeholder="Points Cost *"
          value={form.pointsCost}
          onChange={e =>
            setForm({ ...form, pointsCost: parseInt(e.target.value) || 0 })
          }
          className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        <input
          type="number"
          placeholder="Value *"
          value={form.value}
          onChange={e =>
            setForm({ ...form, value: parseFloat(e.target.value) || 0 })
          }
          className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        <select
          value={form.category}
          onChange={e => setForm({ ...form, category: e.target.value as any })}
          className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="discount">Discount</option>
          <option value="free_item">Free Item</option>
          <option value="service">Service</option>
          <option value="voucher">Voucher</option>
        </select>
        <select
          value={form.valueType}
          onChange={e => setForm({ ...form, valueType: e.target.value as any })}
          className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="percentage">Percentage</option>
          <option value="fixed">Fixed Amount</option>
          <option value="free">Free</option>
        </select>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onAdd(form)}
          disabled={!form.name || form.pointsCost <= 0}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium"
        >
          Add Reward
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CustomerDetail({
  customer,
  config,
  rewards,
  currencySymbol,
  onClose,
  onEarnPoints,
  onRedeemPoints,
  onAdjustPoints,
  onDelete,
}: {
  customer: LoyaltyCustomer;
  config: any;
  rewards: StationReward[];
  currencySymbol: string;
  onClose: () => void;
  onEarnPoints: () => void;
  onRedeemPoints: () => void;
  onAdjustPoints: () => void;
  onDelete: () => void;
}) {
  const tierColors = TIER_COLORS[customer.tier];
  const tierProgress = config
    ? getTierProgress(customer.points, customer.tier, config.tierThresholds)
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Customer Card */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-full ${tierColors.bg} flex items-center justify-center`}
            >
              <span className={`text-xl font-bold ${tierColors.text}`}>
                {customer.name.charAt(0)}
              </span>
            </div>
            <div>
              <h3 className="font-bold">{customer.name}</h3>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${tierColors.bg} ${tierColors.text}`}
              >
                {customer.tier}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="space-y-2 text-sm mb-4">
          <p>📱 {customer.phone}</p>
          {customer.email && <p>✉️ {customer.email}</p>}
          {customer.vehicleReg && <p>🚗 {customer.vehicleReg}</p>}
          <p>💳 {customer.cardNumber}</p>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-gray-400">Points</p>
            <p className="text-3xl font-bold text-amber-400">
              {customer.points.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Lifetime</p>
            <p className="font-semibold">
              {customer.lifetimePoints.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Tier Progress */}
        <div className="mt-4">
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500"
              style={{ width: `${tierProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {tierProgress}% to next tier
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onEarnPoints}
            className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium"
          >
            + Points
          </button>
          <button
            onClick={onRedeemPoints}
            className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg text-sm font-medium"
          >
            Redeem
          </button>
          <button
            onClick={onAdjustPoints}
            className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm font-medium"
          >
            Adjust
          </button>
        </div>

        <button
          onClick={onDelete}
          className="w-full mt-3 py-2 text-red-400 hover:text-red-300 text-sm"
        >
          Delete Customer
        </button>
      </div>

      {/* Available Rewards */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
          Available Rewards
        </h3>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {rewards
            .filter(r => r.isActive)
            .map(r => {
              const canRedeem = customer.points >= r.pointsCost;
              return (
                <div
                  key={r.id}
                  className={`p-3 rounded-lg border ${canRedeem ? "border-green-200 bg-green-50" : "border-gray-200"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{r.name}</p>
                      <p className="text-xs text-gray-500">
                        {r.pointsCost} pts
                      </p>
                    </div>
                    {canRedeem ? (
                      <button className="px-3 py-1 bg-green-600 text-white rounded text-xs">
                        Redeem
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">
                        Need {r.pointsCost - customer.points} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
