/**
 * FuelPro Customer Loyalty Portal
 * Customer-facing interface for viewing loyalty status and rewards
 */

import { useState, useMemo } from "react";
import {
  Star,
  Gift,
  History,
  Award,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  TrendingUp,
  Zap,
  Settings,
  LogOut,
  Shield,
  Clock,
} from "lucide-react";
import LoyaltyCard from "../lib/LoyaltyCard";
import { useLoyalty } from "../lib/useLoyalty";
import {
  LoyaltyCustomer,
  LoyaltyTransaction,
  TIER_COLORS,
  getTierProgress,
} from "../lib/loyaltyProgram";

interface CustomerLoyaltyPortalProps {
  customerId: string;
  stationId: string;
  stationName: string;
  onLogout?: () => void;
  onSettings?: () => void;
}

export default function CustomerLoyaltyPortal({
  customerId,
  stationId,
  stationName,
  onLogout,
  onSettings,
}: CustomerLoyaltyPortalProps) {
  const { getCustomer, transactions, rewards, config } = useLoyalty(stationId);
  const [activeTab, setActiveTab] = useState<"card" | "rewards" | "history">(
    "card"
  );
  const [showCard, setShowCard] = useState(true);

  const customer = getCustomer(customerId);

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-full bg-amber-100 mx-auto mb-4 flex items-center justify-center">
            <Star size={32} className="text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Loyalty Account Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            We couldn't find your loyalty account. Please contact the station.
          </p>
        </div>
      </div>
    );
  }

  const tierColors = TIER_COLORS[customer.tier];
  const tierProgress = config
    ? getTierProgress(customer.points, customer.tier, config.tierThresholds)
    : 0;
  const nextTier =
    customer.tier === "Bronze"
      ? "Silver"
      : customer.tier === "Silver"
        ? "Gold"
        : customer.tier === "Gold"
          ? "Platinum"
          : null;
  const pointsToNextTier =
    nextTier && config ? config.tierThresholds[nextTier] - customer.points : 0;

  // Filter rewards customer can redeem
  const availableRewards = useMemo(
    () =>
      rewards.filter(r => {
        if (r.minPointsRequired && customer.points < r.minPointsRequired)
          return false;
        if (r.remainingQuantity !== undefined && r.remainingQuantity <= 0)
          return false;
        return true;
      }),
    [rewards, customer.points]
  );

  const customerTransactions = transactions
    .filter(t => t.customerId === customerId)
    .slice(0, 20);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-4 py-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
                <Award size={20} className="text-white" />
              </div>
              <div>
                <p className="font-bold">{stationName}</p>
                <p className="text-xs text-gray-400">Loyalty Program</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onSettings && (
                <button
                  onClick={onSettings}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20"
                >
                  <Settings size={18} />
                </button>
              )}
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20"
                >
                  <LogOut size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Customer greeting */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`w-12 h-12 rounded-full ${tierColors.bg} flex items-center justify-center`}
            >
              <span className={`text-xl font-bold ${tierColors.text}`}>
                {customer.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold">{customer.name}</h1>
              <p className={`text-sm ${tierColors.text}`}>
                {customer.tier} Member
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-amber-400">
                {customer.points.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">Points</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{customer.totalVisits}</p>
              <p className="text-xs text-gray-400">Visits</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">
                {(customer.totalSpent / 1000).toFixed(0)}K
              </p>
              <p className="text-xs text-gray-400">Spent</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tier Progress */}
      {nextTier && (
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Progress to {nextTier}
              </p>
              <p className="text-sm font-semibold text-amber-600">
                {pointsToNextTier.toLocaleString()} pts needed
              </p>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${tierColors.gradient} transition-all duration-500`}
                style={{ width: `${tierProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-lg mx-auto px-4">
        <div className="flex bg-white dark:bg-gray-800 rounded-xl p-1 shadow-sm">
          {[
            { id: "card", label: "My Card", icon: Star },
            { id: "rewards", label: "Rewards", icon: Gift },
            { id: "history", label: "History", icon: History },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-amber-500 text-white"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-4 pb-8">
        {activeTab === "card" && (
          <div className="space-y-4">
            {/* Loyalty Card */}
            {showCard && (
              <LoyaltyCard
                customer={customer}
                stationName={stationName}
                compact={false}
              />
            )}

            {/* Toggle Card View */}
            <button
              onClick={() => setShowCard(!showCard)}
              className="w-full py-3 bg-white dark:bg-gray-800 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400"
            >
              {showCard ? "Hide Card" : "Show Card"}
            </button>

            {/* Station Info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                Station Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                  <MapPin size={16} />
                  <span>{stationName}</span>
                </div>
                {customer.phone && (
                  <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                    <Phone size={16} />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                    <Mail size={16} />
                    <span>{customer.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Member Since */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock size={20} className="text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Member Since
                    </p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {new Date(customer.joinDate).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last Visit
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {customer.lastVisit === "-"
                      ? "N/A"
                      : new Date(customer.lastVisit).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "rewards" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {availableRewards.length} rewards available
            </p>

            {availableRewards.map(reward => {
              const canRedeem = customer.points >= reward.pointsCost;
              const discount =
                reward.valueType === "percentage"
                  ? `${reward.value}% off`
                  : reward.valueType === "fixed"
                    ? `KSh ${reward.value} off`
                    : "Free";

              return (
                <div
                  key={reward.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-2 ${
                    canRedeem
                      ? "border-green-200 dark:border-green-800"
                      : "border-gray-100 dark:border-gray-700"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">
                          {reward.category === "discount"
                            ? "💰"
                            : reward.category === "free_item"
                              ? "🎁"
                              : reward.category === "service"
                                ? "🔧"
                                : "🎟️"}
                        </span>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {reward.name}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {reward.description}
                      </p>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-amber-600 font-medium">
                          {reward.pointsCost.toLocaleString()} pts
                        </span>
                        <span className="text-green-600 font-medium">
                          {discount}
                        </span>
                        {reward.minPurchaseAmount && (
                          <span className="text-gray-500">
                            Min: KSh {reward.minPurchaseAmount.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      disabled={!canRedeem}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        canRedeem
                          ? "bg-green-600 hover:bg-green-700 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {canRedeem ? "Redeem" : "Need more pts"}
                    </button>
                  </div>
                </div>
              );
            })}

            {availableRewards.length === 0 && (
              <div className="text-center py-8">
                <Gift size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-600 dark:text-gray-400">
                  No rewards available at the moment.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-3">
            {customerTransactions.map(tx => (
              <div
                key={tx.id}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.type === "earn"
                          ? "bg-green-100 text-green-600"
                          : tx.type === "redeem"
                            ? "bg-amber-100 text-amber-600"
                            : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      {tx.type === "earn" ? (
                        <Zap size={18} />
                      ) : tx.type === "redeem" ? (
                        <Gift size={18} />
                      ) : (
                        <TrendingUp size={18} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {tx.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(tx.processedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`text-right font-semibold ${
                      tx.type === "earn"
                        ? "text-green-600"
                        : tx.type === "redeem"
                          ? "text-amber-600"
                          : "text-blue-600"
                    }`}
                  >
                    {tx.type === "earn" ? "+" : tx.type === "redeem" ? "-" : ""}
                    {Math.abs(tx.points).toLocaleString()} pts
                  </div>
                </div>
              </div>
            ))}

            {customerTransactions.length === 0 && (
              <div className="text-center py-8">
                <History size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-600 dark:text-gray-400">
                  No transaction history yet.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
