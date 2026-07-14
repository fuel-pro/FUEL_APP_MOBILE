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
} from "lucide-react";
import { useFuel } from "@/react-app/context/FuelContext";
import { useAuth } from "@/react-app/context/AuthContext";

interface PaymentSource {
  id: number;
  source_type: string;
  source_name: string;
  identifier: string;
  account_info: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface LiveTransaction {
  id: number;
  transaction_ref: string;
  transaction_type: string;
  amount: number;
  currency: string;
  sender_info: string;
  description: string;
  status: string;
  payment_method: string;
  transaction_time: string;
  source_name?: string;
  source_type?: string;
}

interface STKPushRequest {
  phone_number: string;
  amount: number;
  account_reference: string;
  transaction_desc: string;
}

export default function LiveTransaction() {
  const { state } = useFuel();
  const { user } = useAuth();

  // State management
  const [paymentSources, setPaymentSources] = useState<PaymentSource[]>([]);
  const [liveTransactions, setLiveTransactions] = useState<LiveTransaction[]>(
    []
  );
  const [filteredTransactions, setFilteredTransactions] = useState<
    LiveTransaction[]
  >([]);
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
  const [selectedSource, setSelectedSource] = useState<PaymentSource | null>(
    null
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
    checkout_request_id?: string;
  }>({
    loading: false,
    success: false,
    error: "",
  });

  // Load data on component mount
  useEffect(() => {
    if (user) {
      loadPaymentSources();
      loadLiveTransactions();

      // Auto-refresh every 10 seconds for real-time updates
      const interval = setInterval(() => {
        loadLiveTransactions();
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [user]);

  // Filter transactions when search parameters change
  useEffect(() => {
    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);

      const filtered = liveTransactions.filter(tx => {
        const txTime = new Date(tx.transaction_time);
        return txTime >= start && txTime <= end;
      });

      setFilteredTransactions(filtered);
    } else {
      setFilteredTransactions(liveTransactions);
    }
  }, [liveTransactions, startTime, endTime]);

  const loadPaymentSources = async () => {
    try {
      const response = await fetch("/api/payment-sources");
      if (response.ok) {
        const data = await response.json();
        setPaymentSources(data.sources || []);
      } else {
        console.error("Failed to load payment sources");
      }
    } catch (error) {
      console.error("Error loading payment sources:", error);
    }
  };

  const loadLiveTransactions = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch("/api/live-transactions");
      if (response.ok) {
        const data = await response.json();
        setLiveTransactions(data.transactions || []);
      } else {
        console.error("Failed to load live transactions");
      }
    } catch (error) {
      console.error("Error loading live transactions:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const addPaymentSource = async () => {
    if (!newSource.source_name.trim() || !newSource.identifier.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const response = await fetch("/api/payment-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSource),
      });

      if (response.ok) {
        setSuccess("Payment source added successfully");
        setShowAddSource(false);
        resetNewSource();
        loadPaymentSources();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to add payment source");
      }
    } catch (error) {
      setError("Network error. Please try again.");
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

      const response = await fetch(
        `/api/payment-sources/${selectedSource.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSource),
        }
      );

      if (response.ok) {
        setSuccess("Payment source updated successfully");
        setShowEditSource(false);
        setSelectedSource(null);
        resetNewSource();
        loadPaymentSources();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to update payment source");
      }
    } catch (error) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const deletePaymentSource = async () => {
    if (!selectedSource) return;

    try {
      setIsLoading(true);
      setError("");

      const response = await fetch(
        `/api/payment-sources/${selectedSource.id}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        setSuccess("Payment source deleted successfully");
        setShowDeleteConfirm(false);
        setSelectedSource(null);
        loadPaymentSources();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to delete payment source");
      }
    } catch (error) {
      setError("Network error. Please try again.");
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
        loading: false,
        success: false,
        error: "Please fill in all required fields",
      });
      return;
    }

    try {
      setStkPushStatus({ loading: true, success: false, error: "" });

      const response = await fetch("/api/mpesa/stk-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stkPushData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStkPushStatus({
          loading: false,
          success: true,
          error: "",
          checkout_request_id: data.checkout_request_id,
        });

        // Reset form
        setStkPushData({
          phone_number: "",
          amount: 0,
          account_reference: "",
          transaction_desc: "",
        });

        // Start polling for transaction status
        if (data.checkout_request_id) {
          startTransactionPolling(data.checkout_request_id);
        }

        // Refresh transactions after a delay
        setTimeout(() => {
          loadLiveTransactions();
        }, 3000);
      } else {
        setStkPushStatus({
          loading: false,
          success: false,
          error: data.error || "Failed to initiate STK push",
        });
      }
    } catch (error) {
      setStkPushStatus({
        loading: false,
        success: false,
        error: "Network error. Please try again.",
      });
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
    `${state.companyData.currency || "KSH"} ${amount.toLocaleString()}`;

  const startTransactionPolling = async (checkoutRequestId: string) => {
    let attempts = 0;
    const maxAttempts = 20; // Poll for up to 2 minutes (20 * 6 seconds)

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/mpesa/query/${checkoutRequestId}`);
        if (response.ok) {
          const data = await response.json();

          if (data.status === "completed") {
            // Transaction successful, refresh the list
            loadLiveTransactions();
            setSuccess("Payment received successfully!");
            return true; // Stop polling
          } else if (data.status === "failed" || data.status === "cancelled") {
            // Transaction failed, stop polling
            setError(`Payment ${data.status}: ${data.message}`);
            return true; // Stop polling
          }
        }
      } catch (error) {
        console.error("Error polling transaction status:", error);
      }

      attempts++;
      if (attempts < maxAttempts) {
        // Continue polling every 6 seconds
        setTimeout(pollStatus, 6000);
      } else {
        setError(
          "Transaction status check timed out. Please refresh to see latest status."
        );
      }

      return false;
    };

    // Start first poll after 3 seconds
    setTimeout(pollStatus, 3000);
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, "");

    if (digits.startsWith("0")) {
      return "254" + digits.slice(1);
    } else if (digits.startsWith("254")) {
      return digits;
    } else if (digits.startsWith("7") || digits.startsWith("1")) {
      return "254" + digits;
    }

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
      <div className="flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
          <CreditCard className="text-green-400" />
          Live Transaction Monitor
        </h2>
        <div className="flex gap-2">
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
            paymentSources.map(source => (
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
              onChange={e => setStartTime(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">End Time</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
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
              <span className="text-blue-400">
                {filteredTransactions.length}
              </span>{" "}
              transaction(s) totaling{" "}
              <span className="text-green-400">
                {formatCurrency(
                  filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0)
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Live Transaction Feed */}
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
            onClick={loadLiveTransactions}
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

        <div className="bg-blue-900/30 border border-blue-600 p-3 rounded mb-3">
          <p className="text-sm text-blue-200 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <strong>Live Server Integration Active</strong>
          </p>
          <p className="text-xs text-blue-300 mt-1">
            Real-time M-PESA STK Push connected to Safaricom servers
            <br />
            Webhook callbacks enabled for instant payment notifications
            <br />
            Auto-polling every 10 seconds for transaction updates
          </p>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredTransactions.length === 0 ? (
            <div className="text-gray-400 italic text-center py-8">
              <Clock size={24} className="mx-auto mb-2" />
              <div className="font-medium">
                No live transactions recorded yet
              </div>
              <div className="text-sm mt-2">
                Real payments will appear here when received through your
                registered sources.
              </div>
              <div className="text-xs mt-1">
                Use STK Push to test M-PESA payments or add more payment
                sources.
              </div>
            </div>
          ) : (
            filteredTransactions.map(tx => (
              <div
                key={tx.id}
                className={`p-3 rounded border-l-4 transition-all duration-300 ${
                  tx.payment_method.toLowerCase().includes("mpesa")
                    ? "border-green-500 bg-green-900/20"
                    : tx.payment_method.toLowerCase().includes("paypal")
                      ? "border-blue-500 bg-blue-900/20"
                      : "border-yellow-500 bg-yellow-900/20"
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
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(tx.transaction_time).toLocaleString()}
                  </div>
                </div>
                <div className="text-sm text-gray-300">
                  {tx.transaction_type.toUpperCase()} • Ref:{" "}
                  {tx.transaction_ref}
                </div>
                <div className="text-xs text-blue-400">
                  Source: {tx.source_name || "Unknown Source"} (
                  {tx.payment_method})
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
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={stkPushData.phone_number}
                    onChange={e =>
                      setStkPushData({
                        ...stkPushData,
                        phone_number: formatPhoneNumber(e.target.value),
                      })
                    }
                    placeholder="254712345678"
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Amount (KSH) *
                  </label>
                  <input
                    type="number"
                    value={stkPushData.amount || ""}
                    onChange={e =>
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
                    onChange={e =>
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
                    onChange={e =>
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
                  onChange={e =>
                    setNewSource({ ...newSource, source_type: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                >
                  <option value="mpesa_paybill">M-PESA Paybill</option>
                  <option value="mpesa_buygoods">M-PESA Buy Goods</option>
                  <option value="bank_account">Bank Account</option>
                  <option value="cash_register">Cash Register</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  {newSource.source_type.includes("mpesa")
                    ? "Shortcode/Till Number"
                    : newSource.source_type === "bank_account"
                      ? "Account Number"
                      : "Register ID"}
                </label>
                <input
                  type="text"
                  value={newSource.identifier}
                  onChange={e =>
                    setNewSource({ ...newSource, identifier: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  placeholder={
                    newSource.source_type.includes("mpesa")
                      ? "589252"
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
                  onChange={e =>
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
                  onChange={e =>
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
                  onChange={e =>
                    setNewSource({ ...newSource, source_type: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                >
                  <option value="mpesa_paybill">M-PESA Paybill</option>
                  <option value="mpesa_buygoods">M-PESA Buy Goods</option>
                  <option value="bank_account">Bank Account</option>
                  <option value="cash_register">Cash Register</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  {newSource.source_type.includes("mpesa")
                    ? "Shortcode/Till Number"
                    : newSource.source_type === "bank_account"
                      ? "Account Number"
                      : "Register ID"}
                </label>
                <input
                  type="text"
                  value={newSource.identifier}
                  onChange={e =>
                    setNewSource({ ...newSource, identifier: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  value={newSource.source_name}
                  onChange={e =>
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
                  onChange={e =>
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
    </div>
  );
}
