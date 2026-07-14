import { useState, useMemo } from "react";
import { useFuel } from "@/react-app/context/FuelContext";
import { useLocation } from "@/react-app/context/LocationContext";
import {
  Users,
  Star,
  Plus,
  Search,
  Award,
  Gift,
  TrendingUp,
  Phone,
  Mail,
  MapPin,
  ChevronDown,
  Crown,
  Medal,
  User,
} from "lucide-react";
import { formatNumber } from "@/react-app/utils/formatUtils";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  vehicleReg: string;
  loyaltyPoints: number;
  totalSpent: number;
  visits: number;
  lastVisit: string;
  preferredFuel: "PMS" | "AGO" | "Both";
  tier: "Bronze" | "Silver" | "Gold" | "Platinum";
  notes: string;
  joinDate: string;
}

interface Reward {
  id: string;
  name: string;
  points: number;
  description: string;
  category: "discount" | "free_item" | "service";
}

const REWARDS: Reward[] = [
  {
    id: "r1",
    name: "5% Off Next Fill",
    points: 500,
    description: "Get 5% discount on your next fuel purchase",
    category: "discount",
  },
  {
    id: "r2",
    name: "Free Oil Check",
    points: 300,
    description: "Complimentary engine oil level check",
    category: "service",
  },
  {
    id: "r3",
    name: "Free Car Wash",
    points: 1000,
    description: "Premium car wash service on us",
    category: "service",
  },
  {
    id: "r4",
    name: "10% Off Total",
    points: 2000,
    description: "10% discount on entire purchase",
    category: "discount",
  },
  {
    id: "r5",
    name: "Free Engine Oil (1L)",
    points: 5000,
    description: "1L of engine oil (5W-30)",
    category: "free_item",
  },
  {
    id: "r6",
    name: "Free Tire Pressure Service",
    points: 200,
    description: "Tire pressure check and fill",
    category: "service",
  },
];

function getTier(points: number): Customer["tier"] {
  if (points >= 10000) return "Platinum";
  if (points >= 5000) return "Gold";
  if (points >= 1000) return "Silver";
  return "Bronze";
}

function tierColor(tier: Customer["tier"]): string {
  switch (tier) {
    case "Platinum":
      return "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300";
    case "Gold":
      return "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300";
    case "Silver":
      return "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-300";
    default:
      return "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300";
  }
}

export default function CustomerLoyalty() {
  const { state } = useFuel();
  const location = useLocation();
  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("fuelpro_customers") || "[]");
    } catch {
      return defaultCustomers();
    }
  });
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newCustomer, setNewCustomer] = useState<{
    name: string;
    phone: string;
    email: string;
    vehicleReg: string;
    preferredFuel: "PMS" | "AGO" | "Both";
    notes: string;
  }>({
    name: "",
    phone: "",
    email: "",
    vehicleReg: "",
    preferredFuel: "Both",
    notes: "",
  });
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [showRewards, setShowRewards] = useState(false);

  const currencySymbol = location.currencySymbol;
  const save = (c: Customer[]) => {
    setCustomers(c);
    localStorage.setItem("fuelpro_customers", JSON.stringify(c));
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.vehicleReg.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const totalPoints = customers.reduce((s, c) => s + c.loyaltyPoints, 0);
  const avgSpend =
    customers.length > 0
      ? customers.reduce((s, c) => s + c.totalSpent, 0) / customers.length
      : 0;

  const addCustomer = () => {
    if (!newCustomer.name || !newCustomer.phone) return;
    const c: Customer = {
      ...newCustomer,
      id: `cust_${Date.now()}`,
      loyaltyPoints: 0,
      totalSpent: 0,
      visits: 0,
      lastVisit: "-",
      tier: "Bronze",
      joinDate: new Date().toISOString().split("T")[0],
    };
    save([c, ...customers]);
    setNewCustomer({
      name: "",
      phone: "",
      email: "",
      vehicleReg: "",
      preferredFuel: "Both",
      notes: "",
    });
    setShowAdd(false);
  };

  const addPoints = (id: string, points: number) => {
    save(
      customers.map(c => {
        if (c.id === id) {
          const newPoints = c.loyaltyPoints + points;
          return {
            ...c,
            loyaltyPoints: newPoints,
            tier: getTier(newPoints),
            lastVisit: new Date().toISOString().split("T")[0],
          };
        }
        return c;
      })
    );
  };

  const redeem = (customerId: string, points: number) => {
    save(
      customers.map(c =>
        c.id === customerId
          ? { ...c, loyaltyPoints: Math.max(0, c.loyaltyPoints - points) }
          : c
      )
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
            <Users size={24} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Customer Loyalty
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage customers, points & rewards
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          <Plus size={16} /> Add Customer
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Total Members</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {customers.length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Points Issued</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {formatNumber(totalPoints)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Avg. Spend</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {currencySymbol} {formatNumber(avgSpend)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Avg. Visits</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {customers.length > 0
              ? (
                  customers.reduce((s, c) => s + c.visits, 0) / customers.length
                ).toFixed(1)
              : "0"}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="Search by name, phone, or vehicle..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white"
        />
      </div>

      {/* Add Customer Modal */}
      {showAdd && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-lg">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3">
            New Customer
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Full Name *"
              value={newCustomer.name}
              onChange={e =>
                setNewCustomer({ ...newCustomer, name: e.target.value })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <input
              placeholder="Phone *"
              value={newCustomer.phone}
              onChange={e =>
                setNewCustomer({ ...newCustomer, phone: e.target.value })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <input
              placeholder="Email"
              value={newCustomer.email}
              onChange={e =>
                setNewCustomer({ ...newCustomer, email: e.target.value })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <input
              placeholder="Vehicle Registration"
              value={newCustomer.vehicleReg}
              onChange={e =>
                setNewCustomer({ ...newCustomer, vehicleReg: e.target.value })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <select
              value={newCustomer.preferredFuel}
              onChange={e =>
                setNewCustomer({
                  ...newCustomer,
                  preferredFuel: e.target.value as "PMS" | "AGO" | "Both",
                })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="PMS">PMS</option>
              <option value="AGO">AGO</option>
              <option value="Both">Both</option>
            </select>
            <input
              placeholder="Notes"
              value={newCustomer.notes}
              onChange={e =>
                setNewCustomer({ ...newCustomer, notes: e.target.value })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={addCustomer}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium"
            >
              Add Customer
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Customer Detail + Rewards */}
      {selectedCustomer && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10 rounded-xl p-5 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center">
                  <User
                    size={24}
                    className="text-amber-700 dark:text-amber-300"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {selectedCustomer.name}
                  </h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${tierColor(selectedCustomer.tier)}`}
                  >
                    {selectedCustomer.tier}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Phone size={14} />
                {selectedCustomer.phone}
              </div>
              {selectedCustomer.email && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Mail size={14} />
                  {selectedCustomer.email}
                </div>
              )}
              {selectedCustomer.vehicleReg && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <MapPin size={14} />
                  {selectedCustomer.vehicleReg}
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Star size={14} className="text-amber-500" />
                {formatNumber(selectedCustomer.loyaltyPoints)} pts
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => addPoints(selectedCustomer.id, 100)}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium"
              >
                +100 pts
              </button>
              <button
                onClick={() => addPoints(selectedCustomer.id, 500)}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium"
              >
                +500 pts
              </button>
              <button
                onClick={() => addPoints(selectedCustomer.id, 1000)}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium"
              >
                +1000 pts
              </button>
              <button
                onClick={() => setShowRewards(!showRewards)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium flex items-center gap-1"
              >
                <Gift size={12} /> Redeem
              </button>
            </div>
          </div>
          {showRewards && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3">
                Available Rewards
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {REWARDS.map(r => {
                  const canRedeem = selectedCustomer.loyaltyPoints >= r.points;
                  return (
                    <div
                      key={r.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${canRedeem ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10" : "border-gray-200 dark:border-gray-700 opacity-50"}`}
                    >
                      <div>
                        <p className="text-sm font-medium dark:text-white">
                          {r.name}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {r.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-amber-600">
                          {r.points} pts
                        </p>
                        {canRedeem && (
                          <button
                            onClick={() =>
                              redeem(selectedCustomer.id, r.points)
                            }
                            className="text-[10px] px-2 py-1 bg-green-600 text-white rounded mt-1"
                          >
                            Redeem
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Customers Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Contact</th>
                <th className="text-right px-4 py-3">Points</th>
                <th className="text-right px-4 py-3">Spent</th>
                <th className="text-center px-4 py-3">Tier</th>
                <th className="text-right px-4 py-3">Visits</th>
                <th className="text-center px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedCustomer(c)}
                  className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium dark:text-white">{c.name}</p>
                    <p className="text-[11px] text-gray-500">
                      {c.vehicleReg} {c.preferredFuel}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {c.phone}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                    {formatNumber(c.loyaltyPoints)}
                  </td>
                  <td className="px-4 py-3 text-right dark:text-white">
                    {currencySymbol}
                    {formatNumber(c.totalSpent)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${tierColor(c.tier)}`}
                    >
                      {c.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right dark:text-white">
                    {c.visits}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedCustomer(c);
                        setShowRewards(true);
                      }}
                      className="p-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 rounded-lg text-amber-600"
                    >
                      <Gift size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function defaultCustomers(): Customer[] {
  return [];
}
