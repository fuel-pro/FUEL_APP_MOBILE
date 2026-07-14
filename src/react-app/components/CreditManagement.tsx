import { useState, useMemo } from "react";
import { useFuel } from "@/react-app/context/FuelContext";
import { useLocation } from "@/react-app/context/LocationContext";
import {
  CreditCard,
  Plus,
  Search,
  AlertTriangle,
  TrendingUp,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
  Receipt,
} from "lucide-react";
import { formatNumber } from "@/react-app/utils/formatUtils";

interface CreditAccount {
  id: string;
  customerName: string;
  phone: string;
  vehicleReg: string;
  creditLimit: number;
  balanceUsed: number;
  status: "active" | "suspended" | "blacklisted";
  paymentTerms: number; // days
  lastPayment: string;
  totalPayments: number;
  totalPurchases: number;
  notes: string;
  createdDate: string;
}

interface CreditTransaction {
  id: string;
  accountId: string;
  type: "purchase" | "payment";
  amount: number;
  description: string;
  date: string;
  recordedBy: string;
}

export default function CreditManagement() {
  const { state } = useFuel();
  const location = useLocation();
  const currencySymbol = location.currencySymbol;
  const [accounts, setAccounts] = useState<CreditAccount[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("fuelpro_credit_accounts") || "[]"
      );
    } catch {
      return defaultAccounts();
    }
  });
  const [transactions, setTransactions] = useState<CreditTransaction[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("fuelpro_credit_tx") || "[]");
    } catch {
      return [];
    }
  });
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showPay, setShowPay] = useState<string | null>(null);
  const [newAcc, setNewAcc] = useState({
    customerName: "",
    phone: "",
    vehicleReg: "",
    creditLimit: 10000,
    paymentTerms: 30,
    notes: "",
  });
  const [payForm, setPayForm] = useState({ amount: 0, description: "" });

  const saveAcc = (a: CreditAccount[]) => {
    setAccounts(a);
    localStorage.setItem("fuelpro_credit_accounts", JSON.stringify(a));
  };
  const saveTx = (t: CreditTransaction[]) => {
    setTransactions(t);
    localStorage.setItem("fuelpro_credit_tx", JSON.stringify(t));
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return accounts.filter(
      a =>
        a.customerName.toLowerCase().includes(q) ||
        a.phone.includes(q) ||
        a.vehicleReg.toLowerCase().includes(q)
    );
  }, [accounts, search]);

  const totalCredit = accounts.reduce((s, a) => s + a.creditLimit, 0);
  const totalUsed = accounts.reduce((s, a) => s + a.balanceUsed, 0);
  const overdue = accounts.filter(
    a =>
      a.balanceUsed > 0 &&
      new Date().getTime() - new Date(a.lastPayment).getTime() >
        a.paymentTerms * 86400000
  );

  const addAccount = () => {
    if (!newAcc.customerName) return;
    const acc: CreditAccount = {
      id: `ca_${Date.now()}`,
      ...newAcc,
      balanceUsed: 0,
      status: "active",
      totalPayments: 0,
      totalPurchases: 0,
      lastPayment: new Date().toISOString().split("T")[0],
      createdDate: new Date().toISOString().split("T")[0],
    };
    saveAcc([acc, ...accounts]);
    setShowAdd(false);
    setNewAcc({
      customerName: "",
      phone: "",
      vehicleReg: "",
      creditLimit: 10000,
      paymentTerms: 30,
      notes: "",
    });
  };

  const addPayment = (accountId: string) => {
    if (payForm.amount <= 0) return;
    const tx: CreditTransaction = {
      id: `ctx_${Date.now()}`,
      accountId,
      type: "payment",
      amount: payForm.amount,
      description: payForm.description || "Payment received",
      date: new Date().toISOString(),
      recordedBy: "System",
    };
    saveTx([tx, ...transactions]);
    saveAcc(
      accounts.map(a =>
        a.id === accountId
          ? {
              ...a,
              balanceUsed: Math.max(0, a.balanceUsed - payForm.amount),
              totalPayments: a.totalPayments + payForm.amount,
              lastPayment: new Date().toISOString().split("T")[0],
            }
          : a
      )
    );
    setShowPay(null);
    setPayForm({ amount: 0, description: "" });
  };

  const addPurchase = (accountId: string, amount: number, desc: string) => {
    const tx: CreditTransaction = {
      id: `ctx_${Date.now()}`,
      accountId,
      type: "purchase",
      amount,
      description: desc,
      date: new Date().toISOString(),
      recordedBy: "System",
    };
    saveTx([tx, ...transactions]);
    saveAcc(
      accounts.map(a =>
        a.id === accountId
          ? {
              ...a,
              balanceUsed: a.balanceUsed + amount,
              totalPurchases: a.totalPurchases + amount,
            }
          : a
      )
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-pink-100 dark:bg-pink-900/30 rounded-xl">
          <CreditCard size={24} className="text-pink-600 dark:text-pink-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Credit Management
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage customer credit, track payments
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Credit Accounts</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {accounts.length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Total Limit</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {currencySymbol}
            {formatNumber(totalCredit)}
          </p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-600">Balance Used</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {currencySymbol}
            {formatNumber(totalUsed)}
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 border border-red-200 dark:border-red-800">
          <p className="text-xs text-red-600 flex items-center gap-1">
            <AlertTriangle size={12} /> Overdue
          </p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {overdue.length}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            placeholder="Search credit accounts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white"
          />
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-sm font-medium flex items-center gap-2"
        >
          <Plus size={16} /> New Account
        </button>
      </div>

      {showAdd && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-lg">
          <h3 className="text-sm font-semibold dark:text-white mb-3">
            New Credit Account
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              placeholder="Customer Name *"
              value={newAcc.customerName}
              onChange={e =>
                setNewAcc({ ...newAcc, customerName: e.target.value })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <input
              placeholder="Phone"
              value={newAcc.phone}
              onChange={e => setNewAcc({ ...newAcc, phone: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <input
              placeholder="Vehicle Reg"
              value={newAcc.vehicleReg}
              onChange={e =>
                setNewAcc({ ...newAcc, vehicleReg: e.target.value })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <input
              type="number"
              placeholder="Credit Limit"
              value={newAcc.creditLimit}
              onChange={e =>
                setNewAcc({
                  ...newAcc,
                  creditLimit: parseFloat(e.target.value) || 0,
                })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <input
              type="number"
              placeholder="Payment Terms (days)"
              value={newAcc.paymentTerms}
              onChange={e =>
                setNewAcc({
                  ...newAcc,
                  paymentTerms: parseInt(e.target.value) || 30,
                })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <div className="flex gap-2">
              <button
                onClick={addAccount}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg text-sm"
              >
                Create
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm dark:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accounts */}
      <div className="space-y-3">
        {filtered.map(acc => {
          const pct = (acc.balanceUsed / acc.creditLimit) * 100;
          const isOver = pct > 90;
          const isDue =
            acc.balanceUsed > 0 &&
            new Date().getTime() - new Date(acc.lastPayment).getTime() >
              acc.paymentTerms * 86400000;
          return (
            <div
              key={acc.id}
              className={`bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm ${isOver || isDue ? "border-red-200 dark:border-red-800" : "border-gray-200 dark:border-gray-700"}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold dark:text-white">
                      {acc.customerName}
                    </h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${acc.status === "active" ? "bg-green-100 text-green-700" : acc.status === "suspended" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}
                    >
                      {acc.status}
                    </span>
                    {isDue && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                        <AlertTriangle size={10} /> Overdue
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {acc.phone} {acc.vehicleReg}
                  </p>
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">
                        Used: {currencySymbol}
                        {formatNumber(acc.balanceUsed)}
                      </span>
                      <span className="text-gray-500">
                        Limit: {currencySymbol}
                        {formatNumber(acc.creditLimit)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                      <div
                        className={`h-full rounded-full ${isOver ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-green-500"}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 ml-4">
                  <button
                    onClick={() => setShowPay(acc.id)}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[11px] font-medium"
                  >
                    Record Payment
                  </button>
                  {acc.status === "active" && (
                    <button
                      onClick={() => addPurchase(acc.id, 5000, "Fuel purchase")}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-medium"
                    >
                      + Purchase
                    </button>
                  )}
                </div>
              </div>
              {showPay === acc.id && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                  <input
                    type="number"
                    placeholder="Amount"
                    value={payForm.amount || ""}
                    onChange={e =>
                      setPayForm({
                        ...payForm,
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="flex-1 px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <input
                    placeholder="Description"
                    value={payForm.description}
                    onChange={e =>
                      setPayForm({ ...payForm, description: e.target.value })
                    }
                    className="flex-1 px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <button
                    onClick={() => addPayment(acc.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm"
                  >
                    Pay
                  </button>
                  <button
                    onClick={() => setShowPay(null)}
                    className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm dark:text-white"
                  >
                    X
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function defaultAccounts(): CreditAccount[] {
  return [];
}
