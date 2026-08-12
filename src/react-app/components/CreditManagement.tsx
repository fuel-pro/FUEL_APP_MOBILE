import { useState, useMemo, useEffect } from "react";
import { useLocation } from "@/react-app/context/LocationContext";
import cloudStorageService from "@/react-app/lib/cloud-storage-service";
import { useAuth } from "@/react-app/context/AuthContext";
import { useStations } from "@/react-app/context/StationContext";
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
  BellRing,
  Wallet,
  Smartphone,
  FileText,
} from "lucide-react";
import { formatNumber } from "@/react-app/utils/formatUtils";
import SubTabBar from "@/react-app/components/SubTabBar";
import DebtReminder from "@/react-app/components/DebtReminder";
import {
  navigateToTab,
  onTabPayload,
  type StkPushPrefill,
  type InvoicePrefill,
  type CreditPrefill,
} from "@/react-app/lib/mpesa-integration-service";

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

/**
 * Cloud-loaded records (credit_accounts / credit_transactions) may be partial
 * or malformed, which previously crashed the UI ("Cannot read properties of
 * undefined" on .toLowerCase()/.includes()/.map()). These normalizers fill
 * every field with safe defaults so render-time access never throws.
 */
function normalizeCreditAccount(
  a: Partial<CreditAccount> | null | undefined,
): CreditAccount {
  const id =
    a?.id || `ca_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    customerName: a?.customerName ?? "",
    phone: a?.phone ?? "",
    vehicleReg: a?.vehicleReg ?? "",
    creditLimit: typeof a?.creditLimit === "number" ? a.creditLimit : 0,
    balanceUsed: typeof a?.balanceUsed === "number" ? a.balanceUsed : 0,
    status: a?.status ?? "active",
    paymentTerms: typeof a?.paymentTerms === "number" ? a.paymentTerms : 0,
    lastPayment: a?.lastPayment ?? "",
    totalPayments: typeof a?.totalPayments === "number" ? a.totalPayments : 0,
    totalPurchases:
      typeof a?.totalPurchases === "number" ? a.totalPurchases : 0,
    notes: a?.notes ?? "",
    createdDate: a?.createdDate ?? new Date().toISOString().split("T")[0],
  };
}

function normalizeCreditTransaction(
  t: Partial<CreditTransaction> | null | undefined,
): CreditTransaction {
  const id =
    t?.id || `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    accountId: t?.accountId ?? "",
    type: t?.type === "purchase" || t?.type === "payment" ? t.type : "payment",
    amount: typeof t?.amount === "number" ? t.amount : 0,
    description: t?.description ?? "",
    date: t?.date ?? new Date().toISOString(),
    recordedBy: t?.recordedBy ?? "",
  };
}

function normalizeCreditAccounts(arr: unknown): CreditAccount[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((a) => normalizeCreditAccount(a as Partial<CreditAccount>));
}

function normalizeCreditTransactions(arr: unknown): CreditTransaction[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((t) =>
    normalizeCreditTransaction(t as Partial<CreditTransaction>),
  );
}

function loadAccounts(): CreditAccount[] {
  try {
    const saved = localStorage.getItem("fuelpro_credit_accounts");
    if (saved) return normalizeCreditAccounts(JSON.parse(saved));
  } catch {
    /* ignore */
  }
  return defaultAccounts();
}

function loadTransactions(): CreditTransaction[] {
  try {
    const saved = localStorage.getItem("fuelpro_credit_tx");
    if (saved) return normalizeCreditTransactions(JSON.parse(saved));
  } catch {
    /* ignore */
  }
  return [];
}

export default function CreditManagement() {
  const location = useLocation();
  const currencySymbol = location.currencySymbol;
  const { user } = useAuth();
  const { currentStation } = useStations();
  const stationId = currentStation?.id;
  // Inner sub-tab: Accounts (credit accounts) vs Reminders (debt payment
  // reminders — formerly the standalone "Fuel Debt Payment Reminder" tab).
  const [activeView, setActiveView] = useState<"accounts" | "reminders">(
    "accounts",
  );
  const [accounts, setAccounts] = useState<CreditAccount[]>(() => {
    const cloudCached = cloudStorageService.getCached<unknown[]>(
      "credit_accounts",
      stationId,
    );
    if (Array.isArray(cloudCached)) return normalizeCreditAccounts(cloudCached);
    return loadAccounts();
  });
  const [transactions, setTransactions] = useState<CreditTransaction[]>(() => {
    const cloudCached = cloudStorageService.getCached<unknown[]>(
      "credit_transactions",
      stationId,
    );
    if (Array.isArray(cloudCached))
      return normalizeCreditTransactions(cloudCached);
    return loadTransactions();
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

  // Interlink receiver: Live Transaction Monitor calls
  // navigateToTab("credit", <CreditPrefill>) from a completed payment's
  // "Apply to Credit Account" action — open the new-account form pre-filled
  // with the sender + amount so the payment can be recorded as a credit.
  useEffect(() => {
    return onTabPayload("credit", (raw) => {
      const p = (raw || {}) as CreditPrefill;
      if (Object.keys(p).length === 0) return;
      setActiveView("accounts");
      setNewAcc((prev) => ({
        ...prev,
        customerName: p.customerName || prev.customerName,
        phone: p.phone || prev.phone,
      }));
      setPayForm((prev) => ({
        ...prev,
        amount: p.amount ?? prev.amount,
        description: p.amount
          ? `Incoming payment ${p.amount}`
          : prev.description,
      }));
      setShowAdd(true);
    });
  }, []);

  const saveAcc = (a: CreditAccount[]) => {
    setAccounts(a);
    localStorage.setItem("fuelpro_credit_accounts", JSON.stringify(a));
    cloudStorageService.set("credit_accounts", a, stationId).catch(() => {});
  };
  const saveTx = (t: CreditTransaction[]) => {
    setTransactions(t);
    localStorage.setItem("fuelpro_credit_tx", JSON.stringify(t));
    cloudStorageService
      .set("credit_transactions", t, stationId)
      .catch(() => {});
  };

  // Load from cloud on mount + real-time cross-device sync
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const cloudAccounts = await cloudStorageService.get<CreditAccount[]>(
        "credit_accounts",
        stationId,
      );
      if (!cancelled && cloudAccounts)
        setAccounts(normalizeCreditAccounts(cloudAccounts));
      const cloudTx = await cloudStorageService.get<CreditTransaction[]>(
        "credit_transactions",
        stationId,
      );
      if (!cancelled && cloudTx)
        setTransactions(normalizeCreditTransactions(cloudTx));
    })();
    // Real-time: when another device updates accounts/transactions, update instantly
    const unsubs = [
      cloudStorageService.subscribe<CreditAccount[]>(
        "credit_accounts",
        stationId,
        (val) => {
          if (val) setAccounts(normalizeCreditAccounts(val));
        },
      ),
      cloudStorageService.subscribe<CreditTransaction[]>(
        "credit_transactions",
        stationId,
        (val) => {
          if (val) setTransactions(normalizeCreditTransactions(val));
        },
      ),
    ];
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [user, stationId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return accounts.filter(
      (a) =>
        (a.customerName || "").toLowerCase().includes(q) ||
        (a.phone || "").includes(q) ||
        (a.vehicleReg || "").toLowerCase().includes(q),
    );
  }, [accounts, search]);

  const totalCredit = accounts.reduce(
    (s, a) => s + (typeof a.creditLimit === "number" ? a.creditLimit : 0),
    0,
  );
  const totalUsed = accounts.reduce(
    (s, a) => s + (typeof a.balanceUsed === "number" ? a.balanceUsed : 0),
    0,
  );
  const overdue = accounts.filter((a) => {
    const balanceUsed = typeof a.balanceUsed === "number" ? a.balanceUsed : 0;
    if (balanceUsed <= 0) return false;
    const lp = a.lastPayment || "";
    const lpTime = lp ? new Date(lp).getTime() : 0;
    if (isNaN(lpTime)) return false;
    const terms = typeof a.paymentTerms === "number" ? a.paymentTerms : 0;
    return new Date().getTime() - lpTime > terms * 86400000;
  });

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
      accounts.map((a) => {
        const curBalance =
          typeof a.balanceUsed === "number" ? a.balanceUsed : 0;
        const curPayments =
          typeof a.totalPayments === "number" ? a.totalPayments : 0;
        return a.id === accountId
          ? {
              ...a,
              balanceUsed: Math.max(0, curBalance - payForm.amount),
              totalPayments: curPayments + payForm.amount,
              lastPayment: new Date().toISOString().split("T")[0],
            }
          : a;
      }),
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
      accounts.map((a) => {
        const curBalance =
          typeof a.balanceUsed === "number" ? a.balanceUsed : 0;
        const curPurchases =
          typeof a.totalPurchases === "number" ? a.totalPurchases : 0;
        return a.id === accountId
          ? {
              ...a,
              balanceUsed: curBalance + amount,
              totalPurchases: curPurchases + amount,
            }
          : a;
      }),
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

      {/* Sub-tab switcher: Credit Accounts vs Debt Payment Reminders */}
      <SubTabBar
        tabs={[
          { id: "accounts", label: "Credit Accounts", icon: CreditCard },
          { id: "reminders", label: "Debt Payment Reminders", icon: BellRing },
        ]}
        active={activeView}
        onChange={(id) => setActiveView(id as "accounts" | "reminders")}
      />

      {activeView === "reminders" ? (
        <DebtReminder />
      ) : (
        <>
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
                onChange={(e) => setSearch(e.target.value)}
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
                  onChange={(e) =>
                    setNewAcc({ ...newAcc, customerName: e.target.value })
                  }
                  className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <input
                  placeholder="Phone"
                  value={newAcc.phone}
                  onChange={(e) =>
                    setNewAcc({ ...newAcc, phone: e.target.value })
                  }
                  className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <input
                  placeholder="Vehicle Reg"
                  value={newAcc.vehicleReg}
                  onChange={(e) =>
                    setNewAcc({ ...newAcc, vehicleReg: e.target.value })
                  }
                  className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <input
                  type="number"
                  placeholder="Credit Limit"
                  value={newAcc.creditLimit}
                  onChange={(e) =>
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
                  onChange={(e) =>
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
            {filtered.map((acc) => {
              const balanceUsed =
                typeof acc.balanceUsed === "number" ? acc.balanceUsed : 0;
              const creditLimit =
                typeof acc.creditLimit === "number" ? acc.creditLimit : 0;
              const pct =
                creditLimit > 0 ? (balanceUsed / creditLimit) * 100 : 0;
              const isOver = pct > 90;
              const lp = acc.lastPayment || "";
              const lpTime = lp ? new Date(lp).getTime() : 0;
              const terms =
                typeof acc.paymentTerms === "number" ? acc.paymentTerms : 0;
              const isDue =
                balanceUsed > 0 &&
                !isNaN(lpTime) &&
                new Date().getTime() - lpTime > terms * 86400000;
              return (
                <div
                  key={acc.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm ${isOver || isDue ? "border-red-200 dark:border-red-800" : "border-gray-200 dark:border-gray-700"}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold dark:text-white">
                          {acc.customerName || ""}
                        </h3>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${acc.status === "active" ? "bg-green-100 text-green-700" : acc.status === "suspended" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}
                        >
                          {acc.status || "active"}
                        </span>
                        {isDue && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                            <AlertTriangle size={10} /> Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {acc.phone || ""} {acc.vehicleReg || ""}
                      </p>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">
                            Used: {currencySymbol}
                            {formatNumber(balanceUsed)}
                          </span>
                          <span className="text-gray-500">
                            Limit: {currencySymbol}
                            {formatNumber(creditLimit)}
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
                          onClick={() =>
                            addPurchase(acc.id, 5000, "Fuel purchase")
                          }
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-medium"
                        >
                          + Purchase
                        </button>
                      )}
                      {isDue && (
                        <button
                          onClick={() => setActiveView("reminders")}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-medium flex items-center gap-1"
                          title="Open Debt Payment Reminders"
                        >
                          <BellRing size={12} /> Send Reminder
                        </button>
                      )}
                      {balanceUsed > 0 && (
                        <button
                          onClick={() =>
                            navigateToTab("livetransaction", {
                              phone: acc.phone || "",
                              amount: balanceUsed,
                              account_reference: acc.customerName || "",
                              transaction_desc: `Credit payment — ${acc.customerName || ""}`,
                              openStkPush: true,
                            } satisfies StkPushPrefill)
                          }
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-medium flex items-center gap-1"
                          title="Collect outstanding balance via M-PESA STK Push"
                        >
                          <Smartphone size={12} /> Collect via M-PESA
                        </button>
                      )}
                      {balanceUsed > 0 && (
                        <button
                          onClick={() =>
                            navigateToTab("invoice", {
                              customerName: acc.customerName || "",
                              amount: balanceUsed,
                              description: `Outstanding credit balance`,
                            } satisfies InvoicePrefill)
                          }
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-medium flex items-center gap-1"
                          title="Create an invoice for the outstanding balance"
                        >
                          <FileText size={12} /> Create Invoice
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
                        onChange={(e) =>
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
                        onChange={(e) =>
                          setPayForm({
                            ...payForm,
                            description: e.target.value,
                          })
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
        </>
      )}
    </div>
  );
}

function defaultAccounts(): CreditAccount[] {
  return [];
}
