import { useState, useEffect } from "react";
import {
  CreditCard,
  Phone,
  Building2,
  Search,
  DollarSign,
  Clock,
  RefreshCw,
  Edit,
  Trash2,
  AlertTriangle,
  Plus,
  Loader2,
  CheckCircle,
  XCircle,
  BarChart3,
  ArrowRight,
  TrendingUp,
  Users,
  FileText,
  Plug,
  Smartphone,
  Wallet,
  Settings,
  Link2,
  ExternalLink,
  HandCoins,
} from "lucide-react";
import { useFuel } from "@/react-app/context/FuelContext";
import { useAuth } from "@/react-app/context/AuthContext";
import { useStations } from "@/react-app/context/StationContext";
import cloudStorageService from "@/react-app/lib/cloud-storage-service";
import {
  getCurrencySymbol,
  getDetectedCurrency,
} from "@/react-app/lib/currency";
import {
  getTransactions,
  addTransaction,
  subscribeToTransactions,
  calculateSummary,
  switchToTab,
  onTabPayload,
  navigateToTab,
  type StkPushPrefill,
  type CreditPrefill,
  getMpesaConfig,
  getKopokopoConfig,
  type UnifiedTransaction,
  type TransactionSummary,
  type MpesaIntegrationConfig,
  type KopokopoIntegrationConfig,
} from "@/react-app/lib/mpesa-integration-service";
import { formatNumber } from "@/react-app/utils/formatUtils";

interface PaymentSource {
  id: string;
  source_type: string;
  source_name: string;
  identifier: string;
  account_info: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface STKPushRequest {
  phone_number: string;
  amount: number;
  account_reference: string;
  transaction_desc: string;
}

interface ManualPayment {
  sender_info: string;
  amount: number;
  account_reference: string;
  transaction_desc: string;
  payment_method: string;
  source_id: string;
}

const PAYMENT_METHODS = [
  "M-PESA",
  "Cash",
  "Bank Transfer",
  "Card",
  "Cheque",
  "Other",
] as const;

const SOURCE_TYPES = [
  { value: "mpesa_paybill", label: "M-PESA Paybill" },
  { value: "mpesa_buygoods", label: "M-PESA Buy Goods" },
  { value: "kopo_kopo", label: "Kopo Kopo (Till / Buy Goods)" },
  { value: "bank_account", label: "Bank Account" },
  { value: "cash_register", label: "Cash Register" },
] as const;

function generateId(prefix = "src"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function LiveTransaction() {
  const { state } = useFuel();
  const { user } = useAuth();
  const { currentStation } = useStations();
  const stationId = currentStation?.id;

  // State management
  const [paymentSources, setPaymentSources] = useState<PaymentSource[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal states
  const [showAddSource, setShowAddSource] = useState(false);
  const [showEditSource, setShowEditSource] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSTKPush, setShowSTKPush] = useState(false);
  const [showManualPayment, setShowManualPayment] = useState(false);
  const [selectedSource, setSelectedSource] = useState<PaymentSource | null>(
    null,
  );

  // Form states
  const [newSource, setNewSource] = useState({
    source_type: "mpesa_paybill",
    source_name: "",
    identifier: "",
    account_info: "",
  });

  const [stkPushData, setStkPushData] = useState<STKPushRequest>({
    phone_number: "",
    amount: 0,
    account_reference: "",
    transaction_desc: "",
  });

  const [stkPushStatus, setStkPushStatus] = useState<{
    loading: boolean;
    success: boolean;
    error: string;
    pending?: boolean;
    pendingMessage?: string;
    checkout_request_id?: string;
  }>({
    loading: false,
    success: false,
    error: "",
  });

  const [manualPayment, setManualPayment] = useState<ManualPayment>({
    sender_info: "",
    amount: 0,
    account_reference: "",
    transaction_desc: "",
    payment_method: "M-PESA",
    source_id: "",
  });

  // Shared unified transactions — the SINGLE source of truth for both the
  // Live Payment Feed and the Shared Transaction Records section. STK Push,
  // statement imports, and manual entries all write here, so everything
  // appears in one feed (interlinked with M-PESA Analyzer).
  const [sharedTxns, setSharedTxns] = useState<UnifiedTransaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);

  // Filtered view of sharedTxns (by time range)
  const [filteredTxns, setFilteredTxns] = useState<UnifiedTransaction[]>([]);

  // Integration Hub linkage — M-PESA (Daraja) + Kopo Kopo config status,
  // so the STK Push and Add Source flows reflect whether a payment
  // integration is actually connected (configured in Integration Hub).
  const [mpesaConfig, setMpesaConfig] = useState<MpesaIntegrationConfig | null>(
    null,
  );
  const [kopoConfig, setKopoConfig] =
    useState<KopokopoIntegrationConfig | null>(null);
  const mpesaConnected = !!(
    mpesaConfig?.enabled &&
    mpesaConfig?.consumerKey &&
    mpesaConfig?.consumerSecret &&
    mpesaConfig?.shortcode
  );
  const kopoConnected = !!(
    kopoConfig?.enabled &&
    kopoConfig?.tillNumber &&
    kopoConfig?.apiKey
  );

  // Load payment sources on mount + subscribe to real-time changes.
  // Uses the shared cloud store so sources added on another device appear
  // instantly without a page reload.
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const sources =
        (await cloudStorageService.get<PaymentSource[]>(
          "payment_sources",
          stationId,
        )) || [];
      if (mounted) setPaymentSources(Array.isArray(sources) ? sources : []);
    })();
    const unsub = cloudStorageService.subscribe<PaymentSource[]>(
      "payment_sources",
      stationId,
      (sources) => {
        if (!mounted) return;
        setPaymentSources(Array.isArray(sources) ? sources : []);
      },
    );
    return () => {
      mounted = false;
      unsub();
    };
  }, [user, stationId]);

  // Load + subscribe to shared transactions (interlinked with M-PESA Analyzer).
  // This is the SINGLE source of truth for the Live Payment Feed — STK Push,
  // statement imports, and manual entries all write to this store.
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    setIsRefreshing(true);
    (async () => {
      const txns = await getTransactions(stationId);
      if (!mounted) return;
      setSharedTxns(txns);
      setSummary(calculateSummary(txns));
      setIsRefreshing(false);
    })();
    const unsub = subscribeToTransactions(stationId, (txns) => {
      if (!mounted) return;
      const data = txns || [];
      setSharedTxns(data);
      setSummary(calculateSummary(data));
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, [user, stationId]);

  // Load Integration Hub payment configs so STK Push / Add Source reflect
  // the real M-PESA Daraja + Kopo Kopo connection status.
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const [mpesa, kopo] = await Promise.all([
        getMpesaConfig(stationId),
        getKopokopoConfig(stationId),
      ]);
      if (!mounted) return;
      setMpesaConfig(mpesa);
      setKopoConfig(kopo);
    })();
    return () => {
      mounted = false;
    };
  }, [user, stationId]);

  // Interlink receiver: another tab (Credit Management, Invoice) calls
  // navigateToTab("livetransaction", <StkPushPrefill>) to collect a payment —
  // pre-fill the STK Push form and open the modal.
  useEffect(() => {
    return onTabPayload("livetransaction", (raw) => {
      const p = (raw || {}) as StkPushPrefill;
      if (Object.keys(p).length === 0) return;
      setStkPushData((prev) => ({
        ...prev,
        phone_number: p.phone ? formatPhoneNumber(p.phone) : prev.phone_number,
        amount: p.amount ?? prev.amount,
        account_reference: p.account_reference ?? prev.account_reference,
        transaction_desc: p.transaction_desc ?? prev.transaction_desc,
      }));
      if (p.openStkPush) {
        setStkPushStatus({ loading: false, success: false, error: "" });
        setShowSTKPush(true);
      }
    });
  }, []);

  // Filter transactions when search parameters change — operates on the
  // unified sharedTxns store (the single source of truth for the feed).
  useEffect(() => {
    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      const filtered = sharedTxns.filter((tx) => {
        const txTime = new Date(tx.transaction_time);
        return txTime >= start && txTime <= end;
      });
      setFilteredTxns(filtered);
    } else {
      setFilteredTxns(sharedTxns);
    }
  }, [sharedTxns, startTime, endTime]);

  const addPaymentSource = async () => {
    if (!newSource.source_name.trim() || !newSource.identifier.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const existing =
        (await cloudStorageService.get<PaymentSource[]>(
          "payment_sources",
          stationId,
        )) || [];
      const newSourceRecord: PaymentSource = {
        id: generateId("src"),
        source_type: newSource.source_type,
        source_name: newSource.source_name,
        identifier: newSource.identifier,
        account_info: newSource.account_info,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const updated = [...existing, newSourceRecord];
      await cloudStorageService.set<PaymentSource[]>(
        "payment_sources",
        updated,
        stationId,
      );

      setSuccess("Payment source added successfully");
      setShowAddSource(false);
      resetNewSource();
      setPaymentSources(updated);
    } catch (error) {
      console.error("Error adding payment source:", error);
      setError("Failed to add payment source. Please try again.");
      alert("Failed to add payment source. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const updatePaymentSource = async () => {
    if (
      !selectedSource ||
      !newSource.source_name.trim() ||
      !newSource.identifier.trim()
    ) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const existing =
        (await cloudStorageService.get<PaymentSource[]>(
          "payment_sources",
          stationId,
        )) || [];
      const updated = existing.map((source) =>
        source.id === selectedSource.id
          ? {
              ...source,
              source_type: newSource.source_type,
              source_name: newSource.source_name,
              identifier: newSource.identifier,
              account_info: newSource.account_info,
              updated_at: new Date().toISOString(),
            }
          : source,
      );
      await cloudStorageService.set<PaymentSource[]>(
        "payment_sources",
        updated,
        stationId,
      );

      setSuccess("Payment source updated successfully");
      setShowEditSource(false);
      setSelectedSource(null);
      resetNewSource();
      setPaymentSources(updated);
    } catch (error) {
      console.error("Error updating payment source:", error);
      setError("Failed to update payment source. Please try again.");
      alert("Failed to update payment source. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const deletePaymentSource = async () => {
    if (!selectedSource) return;

    try {
      setIsLoading(true);
      setError("");

      const existing =
        (await cloudStorageService.get<PaymentSource[]>(
          "payment_sources",
          stationId,
        )) || [];
      const updated = existing.filter(
        (source) => source.id !== selectedSource.id,
      );
      await cloudStorageService.set<PaymentSource[]>(
        "payment_sources",
        updated,
        stationId,
      );

      setSuccess("Payment source deleted successfully");
      setShowDeleteConfirm(false);
      setSelectedSource(null);
      setPaymentSources(updated);
    } catch (error) {
      console.error("Error deleting payment source:", error);
      setError("Failed to delete payment source. Please try again.");
      alert("Failed to delete payment source. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const initiateStkPush = async () => {
    if (
      !stkPushData.phone_number ||
      !stkPushData.amount ||
      !stkPushData.account_reference
    ) {
      setStkPushStatus({
        pending: false,
        loading: false,
        success: false,
        error: "Please fill in all required fields",
      });
      return;
    }

    try {
      setStkPushStatus({ loading: true, success: false, error: "" });

      // Attempt the real Daraja STK Push API. If the backend is unavailable
      // (e.g. on Cloudflare static deploys or Vercel without the endpoint),
      // we still record the STK Push request as a "pending" transaction in
      // the shared store so it appears in the Live Payment Feed + Analyzer.
      let checkoutRequestId: string | undefined;
      let apiSuccess = false;
      let apiError = "";

      try {
        const response = await fetch("/api/mpesa/stk-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stkPushData),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            apiSuccess = true;
            checkoutRequestId = data.checkout_request_id;
          } else {
            apiError = data.error || "Failed to initiate STK push";
          }
        } else if (response.status === 404) {
          // Backend endpoint doesn't exist (static deployment).
          apiError =
            "M-PESA Daraja backend is not deployed. The STK Push request has been recorded as pending — configure M-PESA in Integration Hub and deploy the backend to send live prompts.";
        } else {
          apiError = `M-Pesa STK push failed (HTTP ${response.status}).`;
        }
      } catch {
        apiError =
          "Network error reaching the M-Pesa STK push service. The request has been recorded as pending.";
      }

      // ALWAYS record the STK Push request in the shared store — even if the
      // API failed, the operator initiated a push and it should be tracked.
      const ref = checkoutRequestId || `STK_${Date.now()}`;
      await addTransaction(
        {
          transaction_ref: ref,
          origin: "stk_push",
          transaction_type: "STK Push",
          amount: stkPushData.amount,
          currency: state.companyData.currency || getDetectedCurrency(),
          sender_info: stkPushData.phone_number,
          description: stkPushData.transaction_desc || "STK Push payment",
          status: "pending",
          payment_method: "M-PESA STK Push",
          transaction_time: new Date().toISOString(),
          account_reference: stkPushData.account_reference,
        },
        stationId,
      ).catch(() => {});

      if (apiSuccess) {
        setStkPushStatus({
          pending: false,
          loading: false,
          success: true,
          error: "",
          checkout_request_id: checkoutRequestId,
        });
        setStkPushData({
          phone_number: "",
          amount: 0,
          account_reference: "",
          transaction_desc: "",
        });
        if (checkoutRequestId) {
          startTransactionPolling(checkoutRequestId);
        }
      } else {
        // The API didn't succeed, but we still recorded the transaction as
        // pending. Show a clear, non-contradictory message — do NOT set
        // stkPushStatus.success=true (that would show the "sent successfully"
        // message alongside the failure notice). Instead, set a `pending`
        // flag so the modal shows a yellow "recorded as pending" notice.
        setStkPushStatus({
          loading: false,
          success: false,
          error: "",
          pending: true,
          pendingMessage:
            "STK Push request recorded as pending. " +
            (apiError || "The M-Pesa backend is not deployed yet.") +
            " The request is saved and will sync across all devices.",
        });
        setStkPushData({
          phone_number: "",
          amount: 0,
          account_reference: "",
          transaction_desc: "",
        });
      }
    } catch (error) {
      console.error("Error initiating STK push:", error);
      setStkPushStatus({
        pending: false,
        loading: false,
        success: false,
        error: "An unexpected error occurred. Please try again.",
      });
    }
  };

  // Record a manually-received payment (cash, bank transfer, M-PESA confirmation
  // SMS, etc.) directly into the shared transaction store. This ensures the
  // Live Payment Feed is never empty — operators can log any payment received
  // outside the automated STK Push / statement import flows.
  const recordManualPayment = async () => {
    if (
      !manualPayment.sender_info.trim() ||
      !manualPayment.amount ||
      !manualPayment.payment_method
    ) {
      setError("Please fill in sender, amount, and payment method");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const source = paymentSources.find(
        (s) => s.id === manualPayment.source_id,
      );

      await addTransaction(
        {
          transaction_ref: `MAN_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          origin: "manual",
          transaction_type: "Manual Payment",
          amount: manualPayment.amount,
          currency: state.companyData.currency || getDetectedCurrency(),
          sender_info: manualPayment.sender_info,
          description:
            manualPayment.transaction_desc || "Manual payment record",
          status: "completed",
          payment_method: manualPayment.payment_method,
          transaction_time: new Date().toISOString(),
          source_name: source?.source_name,
          source_type: source?.source_type,
          account_reference: manualPayment.account_reference,
        },
        stationId,
      );

      setSuccess("Payment recorded successfully");
      setShowManualPayment(false);
      setManualPayment({
        sender_info: "",
        amount: 0,
        account_reference: "",
        transaction_desc: "",
        payment_method: "M-PESA",
        source_id: "",
      });
    } catch (error) {
      console.error("Error recording manual payment:", error);
      setError("Failed to record payment. Please try again.");
      alert("Failed to record payment. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const openEditModal = (source: PaymentSource) => {
    setSelectedSource(source);
    setNewSource({
      source_type: source.source_type,
      source_name: source.source_name,
      identifier: source.identifier,
      account_info: source.account_info || "",
    });
    setShowEditSource(true);
  };

  const openDeleteModal = (source: PaymentSource) => {
    setSelectedSource(source);
    setShowDeleteConfirm(true);
  };

  const resetNewSource = () => {
    setNewSource({
      source_type: "mpesa_paybill",
      source_name: "",
      identifier: "",
      account_info: "",
    });
  };

  const formatCurrency = (amount: number) =>
    `${state.companyData.currency || getCurrencySymbol(getDetectedCurrency())} ${amount.toLocaleString()}`;

  const startTransactionPolling = async (checkoutRequestId: string) => {
    let attempts = 0;
    const maxAttempts = 20; // Poll for up to 2 minutes (20 * 6 seconds)
    let alerted = false;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/mpesa/query/${checkoutRequestId}`);
        if (!response.ok) {
          // Backend missing on static deployments — stop polling silently.
          if (!alerted) {
            alerted = true;
            setSuccess(
              "STK Push recorded. Status polling unavailable (backend not deployed).",
            );
          }
          return true; // Stop polling
        }
        const data = await response.json();

        if (data.status === "completed") {
          setSuccess("Payment received successfully!");
          return true; // Stop polling
        } else if (data.status === "failed" || data.status === "cancelled") {
          setError(`Payment ${data.status}: ${data.message || ""}`);
          return true; // Stop polling
        }
      } catch {
        // Network error — stop polling silently instead of alerting repeatedly.
        if (!alerted) {
          alerted = true;
        }
        return true;
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(pollStatus, 6000);
      } else {
        setError(
          "Transaction status check timed out. Please refresh to see latest status.",
        );
      }

      return false;
    };

    // Start first poll after 3 seconds
    setTimeout(pollStatus, 3000);
  };

  // Format phone number for M-PESA STK Push. Kenya numbers are converted to
  // 254 format (Safaricom Daraja requirement). International numbers with a
  // leading + or country code are preserved as-is (digits only).
  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, "");

    // Kenya: 07xx / 01xx → 2547xx / 2541xx
    if (digits.startsWith("0")) {
      return "254" + digits.slice(1);
    } else if (digits.startsWith("254")) {
      return digits;
    } else if (digits.startsWith("7") || digits.startsWith("1")) {
      // Bare Kenyan number without leading 0
      return "254" + digits;
    }

    // International: keep as-is
    return digits;
  };

  // Clear success/error messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess("");
        setError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  return (
    <div className="p-4 md:p-6 space-y-6 text-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
          <CreditCard className="text-green-400" />
          Live Transaction Monitor
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowManualPayment(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
          >
            <HandCoins size={16} />
            Record Payment
          </button>
          <button
            onClick={() => setShowSTKPush(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
          >
            <Phone size={16} />
            STK Push
          </button>
          <button
            onClick={() => setShowAddSource(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
          >
            <Plus size={16} />
            Add Source
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-500/20 border border-green-500 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle className="text-green-400" size={20} />
          <span className="text-green-200">{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 flex items-center gap-2">
          <XCircle className="text-red-400" size={20} />
          <span className="text-red-200">{error}</span>
        </div>
      )}

      {/* Interlinked Analytics Summary (shared with M-PESA Analyzer) */}
      {summary && summary.totalCount > 0 && (
        <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-600/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <BarChart3 size={18} className="text-green-400" />
              Shared Analytics
              <span className="text-xs text-gray-400 font-normal">
                (interlinked with M-PESA Analyzer)
              </span>
            </h3>
            <button
              onClick={() => switchToTab("mpesa")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs"
            >
              <FileText size={14} /> View in Analyzer
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard
              icon={<TrendingUp size={14} className="text-green-400" />}
              label="Total Revenue"
              value={`${state.companyData.currency || getCurrencySymbol(getDetectedCurrency())} ${formatNumber(summary.total, 0)}`}
            />
            <SummaryCard
              icon={<FileText size={14} className="text-blue-400" />}
              label="Total Transactions"
              value={summary.totalCount.toLocaleString()}
            />
            <SummaryCard
              icon={<Users size={14} className="text-purple-400" />}
              label="Unique Senders"
              value={summary.uniqueSenders.toLocaleString()}
            />
            <SummaryCard
              icon={<TrendingUp size={14} className="text-amber-400" />}
              label="Top Sender"
              value={summary.topSender.name || "N/A"}
              subValue={
                summary.topSender.name
                  ? `${state.companyData.currency || getCurrencySymbol(getDetectedCurrency())} ${formatNumber(summary.topSender.amount, 0)}`
                  : undefined
              }
            />
          </div>
          {summary.byOrigin.statement.count > 0 && (
            <div className="mt-3 pt-3 border-t border-green-600/30 flex items-center gap-4 text-xs">
              <span className="text-gray-300">
                <span className="text-green-400 font-semibold">
                  {summary.byOrigin.stk_push.count}
                </span>{" "}
                STK Push
              </span>
              <span className="text-gray-300">
                <span className="text-blue-400 font-semibold">
                  {summary.byOrigin.statement.count}
                </span>{" "}
                from Statements
              </span>
              <span className="text-gray-300">
                <span className="text-amber-400 font-semibold">
                  {summary.completed}
                </span>{" "}
                completed
              </span>
              {summary.pending > 0 && (
                <span className="text-gray-300">
                  <span className="text-yellow-400 font-semibold">
                    {summary.pending}
                  </span>{" "}
                  pending
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Payment Sources */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Building2 size={18} />
          Registered Payment Sources
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {paymentSources.length === 0 ? (
            <div className="col-span-full text-center text-gray-400 py-8">
              <Phone size={24} className="mx-auto mb-2" />
              <p>No payment sources configured yet.</p>
              <p className="text-sm">
                Add your M-PESA or bank details to start monitoring.
              </p>
            </div>
          ) : (
            paymentSources.map((source) => (
              <div
                key={source.id}
                className="bg-gray-700 p-3 rounded border-l-4 border-green-500 relative group"
              >
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditModal(source)}
                    className="p-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                    title="Edit source"
                  >
                    <Edit size={12} />
                  </button>
                  <button
                    onClick={() => openDeleteModal(source)}
                    className="p-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                    title="Delete source"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <div className="font-medium text-white pr-16">
                  {source.source_name}
                </div>
                <div className="text-sm text-gray-300">
                  {source.source_type.replace("_", " ").toUpperCase()}:{" "}
                  {source.identifier}
                </div>
                {source.account_info && (
                  <div className="text-xs text-gray-400">
                    Info: {source.account_info}
                  </div>
                )}
                <div className="flex items-center gap-1 mt-2">
                  <div
                    className={`w-2 h-2 rounded-full ${source.is_active ? "bg-green-500" : "bg-gray-500"}`}
                  ></div>
                  <span
                    className={`text-xs ${source.is_active ? "text-green-400" : "text-gray-400"}`}
                  >
                    {source.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Integration Hub quick-connect — links M-PESA + Kopo Kopo setup */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <Plug size={14} className="text-indigo-400" />
              Live Payment Integrations
            </h4>
            <button
              onClick={() => switchToTab("integration")}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              Open Integration Hub <ArrowRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => switchToTab("integration")}
              className="flex items-center gap-3 p-3 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-700/50 rounded-lg transition-colors text-left"
            >
              <div className="w-9 h-9 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <Smartphone size={16} className="text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">M-PESA Payment</p>
                <p className="text-[11px] text-gray-400">
                  Daraja STK Push, Paybill & Buy Goods
                </p>
                <span
                  className={`mt-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${mpesaConnected ? "bg-green-500/20 text-green-300" : "bg-amber-500/20 text-amber-300"}`}
                >
                  {mpesaConnected ? (
                    <Link2 size={9} />
                  ) : (
                    <AlertTriangle size={9} />
                  )}
                  {mpesaConnected ? "Connected" : "Not connected"}
                </span>
              </div>
              <ArrowRight size={14} className="text-emerald-400" />
            </button>
            <button
              onClick={() => switchToTab("integration")}
              className="flex items-center gap-3 p-3 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-700/50 rounded-lg transition-colors text-left"
            >
              <div className="w-9 h-9 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Wallet size={16} className="text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">
                  Kopo Kopo Payment
                </p>
                <p className="text-[11px] text-gray-400">
                  Till number & webhook transactions
                </p>
                <span
                  className={`mt-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${kopoConnected ? "bg-green-500/20 text-green-300" : "bg-amber-500/20 text-amber-300"}`}
                >
                  {kopoConnected ? (
                    <Link2 size={9} />
                  ) : (
                    <AlertTriangle size={9} />
                  )}
                  {kopoConnected ? "Connected" : "Not connected"}
                </span>
              </div>
              <ArrowRight size={14} className="text-blue-400" />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            Tip: configure M-PESA Daraja or Kopo Kopo in the Integration Hub
            (Payment Setup) to enable live STK Push and automatic transaction
            import here.
          </p>
        </div>
      </div>

      {/* Time Range Search */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Search size={18} />
          Search By Time Range
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Start Time
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">End Time</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
            />
          </div>
          <button
            onClick={() => {
              // Clear time filters to show all transactions
              setStartTime("");
              setEndTime("");
            }}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded flex items-center gap-2"
          >
            <XCircle size={16} />
            Clear
          </button>
        </div>

        {startTime && endTime && (
          <div className="mt-4 bg-blue-900/30 border border-blue-600 p-3 rounded">
            <div className="text-white font-medium">
              Showing{" "}
              <span className="text-blue-400">{filteredTxns.length}</span>{" "}
              transaction(s) totaling{" "}
              <span className="text-green-400">
                {formatCurrency(
                  filteredTxns.reduce((sum, tx) => sum + tx.amount, 0),
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Live Transaction Feed — unified with the shared mpesa_transactions
          store. STK Push, statement imports, and manual entries all appear
          here in real-time (Supabase Realtime subscription). */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            Live Payment Feed
            {isRefreshing && (
              <Loader2 size={16} className="animate-spin text-blue-400" />
            )}
          </h3>
          <button
            onClick={async () => {
              setIsRefreshing(true);
              const txns = await getTransactions(stationId);
              setSharedTxns(txns);
              setSummary(calculateSummary(txns));
              setIsRefreshing(false);
            }}
            disabled={isRefreshing}
            className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-sm disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={isRefreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {/* Status banner — reflects the ACTUAL integration status, not a
            misleading "always active" message. */}
        <div
          className={`p-3 rounded mb-3 border ${mpesaConnected || kopoConnected ? "bg-green-900/20 border-green-600/50" : "bg-amber-900/20 border-amber-600/50"}`}
        >
          <p className="text-sm flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full animate-pulse ${mpesaConnected || kopoConnected ? "bg-green-500" : "bg-amber-500"}`}
            ></div>
            <strong
              className={
                mpesaConnected || kopoConnected
                  ? "text-green-200"
                  : "text-amber-200"
              }
            >
              {mpesaConnected || kopoConnected
                ? "Payment Integration Active"
                : "No Payment Integration Connected"}
            </strong>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {mpesaConnected || kopoConnected
              ? `Real-time sync via Supabase Realtime. M-PESA Daraja ${mpesaConnected ? "connected" : "not connected"}, Kopo Kopo ${kopoConnected ? "connected" : "not connected"}. STK Push and statement imports appear here instantly.`
              : "Configure M-PESA Daraja or Kopo Kopo in Integration Hub for automated STK Push and webhook ingestion. You can still record payments manually — they sync across all devices via cloud."}
          </p>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredTxns.length === 0 ? (
            <div className="text-gray-400 italic text-center py-8">
              <Clock size={24} className="mx-auto mb-2" />
              <div className="font-medium">
                No live transactions recorded yet
              </div>
              <div className="text-sm mt-2">
                Payments will appear here when received through STK Push,
                statement import, or manual entry.
              </div>
              <div className="text-xs mt-1">
                Use "Record Payment" to log a received payment, or "STK Push" to
                send an M-PESA prompt.
              </div>
            </div>
          ) : (
            filteredTxns.map((tx) => (
              <div
                key={tx.id}
                className={`p-3 rounded border-l-4 transition-all duration-300 ${
                  tx.payment_method.toLowerCase().includes("mpesa")
                    ? "border-green-500 bg-green-900/20"
                    : tx.payment_method.toLowerCase().includes("cash")
                      ? "border-yellow-500 bg-yellow-900/20"
                      : tx.payment_method.toLowerCase().includes("bank")
                        ? "border-blue-500 bg-blue-900/20"
                        : tx.payment_method.toLowerCase().includes("card")
                          ? "border-purple-500 bg-purple-900/20"
                          : "border-gray-500 bg-gray-900/20"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <DollarSign size={16} className="text-green-400" />
                    {formatCurrency(tx.amount)}
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        tx.status === "completed"
                          ? "bg-green-600"
                          : tx.status === "pending"
                            ? "bg-yellow-600"
                            : "bg-red-600"
                      }`}
                    >
                      {tx.status.toUpperCase()}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                      {tx.origin === "stk_push"
                        ? "STK Push"
                        : tx.origin === "statement"
                          ? "Statement"
                          : tx.origin === "manual"
                            ? "Manual"
                            : tx.origin === "kopokopo"
                              ? "Kopo Kopo"
                              : tx.origin}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(tx.transaction_time).toLocaleString()}
                  </div>
                </div>
                <div className="text-sm text-gray-300">
                  {tx.transaction_type} • Ref: {tx.transaction_ref}
                </div>
                <div className="text-xs text-blue-400">
                  Source: {tx.source_name || "Direct"} ({tx.payment_method})
                </div>
                {tx.sender_info && (
                  <div className="text-xs text-green-400">
                    From: {tx.sender_info}
                  </div>
                )}
                {tx.description && (
                  <div className="text-xs text-gray-400 mt-1">
                    {tx.description}
                  </div>
                )}
                {tx.status === "completed" && (
                  <button
                    onClick={() =>
                      navigateToTab("credit", {
                        customerName: tx.sender_info || tx.account_reference,
                        amount: tx.amount,
                      } satisfies CreditPrefill)
                    }
                    className="mt-1 text-[11px] text-pink-300 hover:text-pink-200 flex items-center gap-1"
                    title="Apply this payment to a Credit Management account"
                  >
                    <Wallet size={10} /> Apply to Credit Account
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* STK Push Modal */}
      {showSTKPush && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">
              M-PESA STK Push
            </h3>

            {/* Integration Hub status banner — links STK Push to the
                configured M-PESA Daraja integration. */}
            <div
              className={`mb-4 rounded-lg p-3 border flex items-start gap-2 ${mpesaConnected ? "bg-green-500/10 border-green-500/40" : "bg-amber-500/10 border-amber-500/40"}`}
            >
              {mpesaConnected ? (
                <Link2
                  className="text-green-400 mt-0.5 flex-shrink-0"
                  size={16}
                />
              ) : (
                <AlertTriangle
                  className="text-amber-400 mt-0.5 flex-shrink-0"
                  size={16}
                />
              )}
              <div className="flex-1">
                <p
                  className={`text-xs ${mpesaConnected ? "text-green-200" : "text-amber-200"}`}
                >
                  {mpesaConnected
                    ? `Connected to M-PESA Daraja (${mpesaConfig?.environment === "production" ? "Production" : "Sandbox"}, shortcode ${mpesaConfig?.shortcode}).`
                    : "M-PESA Daraja is not configured. STK Push requires a connected M-PESA payment source."}
                </p>
                <button
                  onClick={() => switchToTab("integration")}
                  className="mt-1.5 text-xs text-blue-300 hover:text-blue-200 flex items-center gap-1"
                >
                  <Settings size={11} /> Configure in Integration Hub
                  <ExternalLink size={10} />
                </button>
              </div>
            </div>

            {stkPushStatus.success ? (
              <div className="text-center">
                <CheckCircle
                  className="text-green-400 mx-auto mb-4"
                  size={48}
                />
                <p className="text-green-200 mb-4">
                  STK push sent successfully!
                </p>
                <p className="text-gray-300 text-sm mb-4">
                  The customer will receive a prompt on their phone to complete
                  the payment.
                </p>
                <button
                  onClick={() => {
                    setShowSTKPush(false);
                    setStkPushStatus({
                      pending: false,
                      loading: false,
                      success: false,
                      error: "",
                    });
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                  Close
                </button>
              </div>
            ) : stkPushStatus.pending ? (
              <div className="text-center">
                <Clock className="text-amber-400 mx-auto mb-4" size={48} />
                <p className="text-amber-200 mb-4 font-semibold">
                  STK Push recorded as pending
                </p>
                <p className="text-gray-300 text-sm mb-4">
                  {stkPushStatus.pendingMessage}
                </p>
                <button
                  onClick={() => {
                    setShowSTKPush(false);
                    setStkPushStatus({
                      pending: false,
                      loading: false,
                      success: false,
                      error: "",
                    });
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={stkPushData.phone_number}
                    onChange={(e) =>
                      setStkPushData({
                        ...stkPushData,
                        phone_number: formatPhoneNumber(e.target.value),
                      })
                    }
                    placeholder="Enter phone number"
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Amount (
                    {getCurrencySymbol(
                      state.companyData.currency || getDetectedCurrency(),
                    )}
                    ) *
                  </label>
                  <input
                    type="number"
                    value={stkPushData.amount || ""}
                    onChange={(e) =>
                      setStkPushData({
                        ...stkPushData,
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="1000"
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Account Reference *
                  </label>
                  <input
                    type="text"
                    value={stkPushData.account_reference}
                    onChange={(e) =>
                      setStkPushData({
                        ...stkPushData,
                        account_reference: e.target.value,
                      })
                    }
                    placeholder="INV-001 or Customer Name"
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={stkPushData.transaction_desc}
                    onChange={(e) =>
                      setStkPushData({
                        ...stkPushData,
                        transaction_desc: e.target.value,
                      })
                    }
                    placeholder="Payment for fuel"
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  />
                </div>

                {stkPushStatus.error && (
                  <div className="bg-red-500/20 border border-red-500 rounded p-3">
                    <p className="text-red-200 text-sm">
                      {stkPushStatus.error}
                    </p>
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={initiateStkPush}
                    disabled={stkPushStatus.loading}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded flex items-center justify-center gap-2"
                  >
                    {stkPushStatus.loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Phone size={16} />
                        Send STK Push
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowSTKPush(false);
                      setStkPushStatus({
                        pending: false,
                        loading: false,
                        success: false,
                        error: "",
                      });
                      setStkPushData({
                        phone_number: "",
                        amount: 0,
                        account_reference: "",
                        transaction_desc: "",
                      });
                    }}
                    disabled={stkPushStatus.loading}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white py-2 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Source Modal */}
      {showAddSource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">
              Add Payment Source
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Source Type
                </label>
                <select
                  value={newSource.source_type}
                  onChange={(e) =>
                    setNewSource({ ...newSource, source_type: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                >
                  {SOURCE_TYPES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Integration Hub linkage — reflect the configured payment
                  integration status for the selected source type. */}
              {newSource.source_type === "mpesa_paybill" && (
                <div
                  className={`rounded-lg p-3 border flex items-start gap-2 ${mpesaConnected ? "bg-green-500/10 border-green-500/40" : "bg-amber-500/10 border-amber-500/40"}`}
                >
                  {mpesaConnected ? (
                    <Link2
                      className="text-green-400 mt-0.5 flex-shrink-0"
                      size={14}
                    />
                  ) : (
                    <AlertTriangle
                      className="text-amber-400 mt-0.5 flex-shrink-0"
                      size={14}
                    />
                  )}
                  <div className="flex-1">
                    <p
                      className={`text-xs ${mpesaConnected ? "text-green-200" : "text-amber-200"}`}
                    >
                      {mpesaConnected
                        ? "M-PESA Daraja (Paybill) is configured in Integration Hub."
                        : "M-PESA Daraja is not configured. Set it up for live Paybill STK Push."}
                    </p>
                    <button
                      onClick={() => switchToTab("integration")}
                      className="mt-1 text-xs text-blue-300 hover:text-blue-200 flex items-center gap-1"
                    >
                      <Settings size={11} /> Configure M-PESA in Integration Hub
                      <ExternalLink size={10} />
                    </button>
                  </div>
                </div>
              )}
              {newSource.source_type === "mpesa_buygoods" && (
                <div
                  className={`rounded-lg p-3 border flex items-start gap-2 ${kopoConnected ? "bg-green-500/10 border-green-500/40" : "bg-amber-500/10 border-amber-500/40"}`}
                >
                  {kopoConnected ? (
                    <Link2
                      className="text-green-400 mt-0.5 flex-shrink-0"
                      size={14}
                    />
                  ) : (
                    <AlertTriangle
                      className="text-amber-400 mt-0.5 flex-shrink-0"
                      size={14}
                    />
                  )}
                  <div className="flex-1">
                    <p
                      className={`text-xs ${kopoConnected ? "text-green-200" : "text-amber-200"}`}
                    >
                      {kopoConnected
                        ? "Kopo Kopo (Buy Goods / Till) is configured in Integration Hub."
                        : "Kopo Kopo is not configured. Set it up for automated Buy Goods reconciliation."}
                    </p>
                    <button
                      onClick={() => switchToTab("integration")}
                      className="mt-1 text-xs text-blue-300 hover:text-blue-200 flex items-center gap-1"
                    >
                      <Settings size={11} /> Configure Kopo Kopo in Integration
                      Hub
                      <ExternalLink size={10} />
                    </button>
                  </div>
                </div>
              )}
              {newSource.source_type === "kopo_kopo" && (
                <div
                  className={`rounded-lg p-3 border flex items-start gap-2 ${kopoConnected ? "bg-green-500/10 border-green-500/40" : "bg-amber-500/10 border-amber-500/40"}`}
                >
                  {kopoConnected ? (
                    <Link2
                      className="text-green-400 mt-0.5 flex-shrink-0"
                      size={14}
                    />
                  ) : (
                    <AlertTriangle
                      className="text-amber-400 mt-0.5 flex-shrink-0"
                      size={14}
                    />
                  )}
                  <div className="flex-1">
                    <p
                      className={`text-xs ${kopoConnected ? "text-green-200" : "text-amber-200"}`}
                    >
                      {kopoConnected
                        ? "Kopo Kopo is connected — automated till reconciliation & webhook ingestion are active."
                        : "Kopo Kopo is not configured. Connect it to auto-ingest Buy Goods payments into this live feed."}
                    </p>
                    <button
                      onClick={() => switchToTab("integration")}
                      className="mt-1 text-xs text-blue-300 hover:text-blue-200 flex items-center gap-1"
                    >
                      <Settings size={11} /> Configure Kopo Kopo in Integration
                      Hub
                      <ExternalLink size={10} />
                    </button>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  {newSource.source_type.includes("mpesa") ||
                  newSource.source_type === "kopo_kopo"
                    ? "Shortcode/Till Number"
                    : newSource.source_type === "bank_account"
                      ? "Account Number"
                      : "Register ID"}
                </label>
                <input
                  type="text"
                  value={newSource.identifier}
                  onChange={(e) =>
                    setNewSource({ ...newSource, identifier: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  placeholder={
                    newSource.source_type.includes("mpesa") ||
                    newSource.source_type === "kopo_kopo"
                      ? "e.g., 589252"
                      : "Enter identifier"
                  }
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  value={newSource.source_name}
                  onChange={(e) =>
                    setNewSource({ ...newSource, source_name: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  placeholder="e.g., Main Fuel Station Till"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Additional Info
                </label>
                <input
                  type="text"
                  value={newSource.account_info}
                  onChange={(e) =>
                    setNewSource({ ...newSource, account_info: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  placeholder="Optional account details"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={addPaymentSource}
                disabled={isLoading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                Add Source
              </button>
              <button
                onClick={() => {
                  setShowAddSource(false);
                  resetNewSource();
                }}
                disabled={isLoading}
                className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Source Modal */}
      {showEditSource && selectedSource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">
              Edit Payment Source
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Source Type
                </label>
                <select
                  value={newSource.source_type}
                  onChange={(e) =>
                    setNewSource({ ...newSource, source_type: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                >
                  {SOURCE_TYPES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  {newSource.source_type.includes("mpesa") ||
                  newSource.source_type === "kopo_kopo"
                    ? "Shortcode/Till Number"
                    : newSource.source_type === "bank_account"
                      ? "Account Number"
                      : "Register ID"}
                </label>
                <input
                  type="text"
                  value={newSource.identifier}
                  onChange={(e) =>
                    setNewSource({ ...newSource, identifier: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  placeholder={
                    newSource.source_type.includes("mpesa") ||
                    newSource.source_type === "kopo_kopo"
                      ? "e.g., 589252"
                      : "Enter identifier"
                  }
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  value={newSource.source_name}
                  onChange={(e) =>
                    setNewSource({ ...newSource, source_name: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Additional Info
                </label>
                <input
                  type="text"
                  value={newSource.account_info}
                  onChange={(e) =>
                    setNewSource({ ...newSource, account_info: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={updatePaymentSource}
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Edit size={16} />
                )}
                Save Changes
              </button>
              <button
                onClick={() => {
                  setShowEditSource(false);
                  setSelectedSource(null);
                  resetNewSource();
                }}
                disabled={isLoading}
                className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedSource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-red-400" size={24} />
              <h3 className="text-lg font-semibold text-white">
                Confirm Deletion
              </h3>
            </div>

            <div className="space-y-4">
              <p className="text-gray-300">
                Are you sure you want to delete{" "}
                <strong>"{selectedSource.source_name}"</strong>?
              </p>
              <p className="text-sm text-red-300">
                This action cannot be undone. If this source has existing
                transactions, deletion may be prevented.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={deletePaymentSource}
                  disabled={isLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                  Delete
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedSource(null);
                  }}
                  disabled={isLoading}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white py-2 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Modal — record a received payment directly into the
          shared store. This ensures the feed is never empty even without a
          backend: operators can log cash, bank transfers, M-PESA
          confirmations, etc. */}
      {showManualPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <HandCoins className="text-amber-400" size={20} />
              Record Payment
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Sender / Customer Name *
                </label>
                <input
                  type="text"
                  value={manualPayment.sender_info}
                  onChange={(e) =>
                    setManualPayment({
                      ...manualPayment,
                      sender_info: e.target.value,
                    })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  placeholder="e.g., John Mwangi"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Amount (
                  {getCurrencySymbol(
                    state.companyData.currency || getDetectedCurrency(),
                  )}
                  ) *
                </label>
                <input
                  type="number"
                  value={manualPayment.amount || ""}
                  onChange={(e) =>
                    setManualPayment({
                      ...manualPayment,
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  placeholder="1000"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Payment Method *
                </label>
                <select
                  value={manualPayment.payment_method}
                  onChange={(e) =>
                    setManualPayment({
                      ...manualPayment,
                      payment_method: e.target.value,
                    })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Payment Source (optional)
                </label>
                <select
                  value={manualPayment.source_id}
                  onChange={(e) =>
                    setManualPayment({
                      ...manualPayment,
                      source_id: e.target.value,
                    })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                >
                  <option value="">— Direct / Unspecified —</option>
                  {paymentSources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.source_name} ({s.source_type.replace(/_/g, " ")})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Account Reference
                </label>
                <input
                  type="text"
                  value={manualPayment.account_reference}
                  onChange={(e) =>
                    setManualPayment({
                      ...manualPayment,
                      account_reference: e.target.value,
                    })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  placeholder="INV-001 or Customer Account"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={manualPayment.transaction_desc}
                  onChange={(e) =>
                    setManualPayment({
                      ...manualPayment,
                      transaction_desc: e.target.value,
                    })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  placeholder="Payment for fuel"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={recordManualPayment}
                disabled={isLoading}
                className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white py-2 rounded flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <HandCoins size={16} />
                )}
                Record Payment
              </button>
              <button
                onClick={() => {
                  setShowManualPayment(false);
                  setManualPayment({
                    sender_info: "",
                    amount: 0,
                    account_reference: "",
                    transaction_desc: "",
                    payment_method: "M-PESA",
                    source_id: "",
                  });
                }}
                disabled={isLoading}
                className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Summary card for the analytics panel
function SummaryCard({
  icon,
  label,
  value,
  subValue,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] text-gray-400 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-sm font-bold text-white truncate">{value}</p>
      {subValue && <p className="text-xs text-gray-400 truncate">{subValue}</p>}
    </div>
  );
}
