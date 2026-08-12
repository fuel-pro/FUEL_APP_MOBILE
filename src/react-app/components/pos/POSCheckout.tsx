// POS Checkout Component - Payment processing with hardware integration
import React, { useState } from "react";
import {
  printerService,
  type ReceiptData,
} from "@/react-app/lib/pos/printer-service";
import { paymentService } from "@/react-app/lib/pos/payment-service";
import { silentPrintService } from "@/react-app/lib/silent-print-service";
import {
  getCurrencySymbol,
  getDetectedCurrency,
} from "@/react-app/lib/currency";
import {
  CreditCard,
  Banknote,
  Smartphone,
  Printer,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";

interface SaleItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Sale {
  id: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
}

interface POSCheckoutProps {
  sale: Sale;
  customerName?: string;
  attendantName: string;
  stationName: string;
  stationLocation: string;
  onComplete: () => void;
  onCancel: () => void;
}

type PaymentMethod = "cash" | "card" | "mpesa";
type PaymentStatus = "idle" | "processing" | "success" | "error";

export default function POSCheckout({
  sale,
  customerName,
  attendantName,
  stationName,
  stationLocation,
  onComplete,
  onCancel,
}: POSCheckoutProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [transactionRef, setTransactionRef] = useState("");

  const currencySymbol = getCurrencySymbol(getDetectedCurrency());

  const change = amountPaid ? parseFloat(amountPaid) - sale.total : 0;

  const generateReceiptNumber = () => {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RCP${dateStr}${random}`;
  };

  const buildReceiptData = (paymentRef: string): ReceiptData => {
    const now = new Date();
    return {
      stationName,
      stationLocation,
      receiptNumber: generateReceiptNumber(),
      date: now.toLocaleDateString("en-KE"),
      time: now.toLocaleTimeString("en-KE"),
      items: sale.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      subtotal: sale.subtotal,
      tax: sale.tax,
      discount: sale.discount,
      total: sale.total,
      paymentMethod,
      amountPaid: parseFloat(amountPaid) || sale.total,
      change: paymentMethod === "cash" ? Math.max(0, change) : 0,
      customerName,
      attendantName,
      transactionRef: paymentRef,
      footerMessage: "E&OE. Prices include VAT where applicable.",
    };
  };

  const handleCashPayment = async () => {
    if (!amountPaid || parseFloat(amountPaid) < sale.total) {
      setErrorMessage("Insufficient amount");
      setPaymentStatus("error");
      return;
    }

    setPaymentStatus("processing");
    setErrorMessage("");

    try {
      // Generate a reference
      const ref = `CASH-${Date.now()}`;

      // Print receipt using silent print service (offline-capable)
      const receipt = buildReceiptData(ref);
      await silentPrintService.queueReceipt(receipt);

      // Open cash drawer
      await printerService.openCashDrawer();

      setTransactionRef(ref);
      setPaymentStatus("success");

      setTimeout(onComplete, 2000);
    } catch (error) {
      // Fallback to direct print if silent print fails
      try {
        const ref = `CASH-${Date.now()}`;
        const receipt = buildReceiptData(ref);
        await printerService.printReceipt(receipt);
        await printerService.openCashDrawer();
        setTransactionRef(ref);
        setPaymentStatus("success");
        setTimeout(onComplete, 2000);
      } catch (fallbackError) {
        setErrorMessage(
          fallbackError instanceof Error
            ? fallbackError.message
            : "Payment failed",
        );
        setPaymentStatus("error");
      }
    }
  };

  const handleCardPayment = async () => {
    setPaymentStatus("processing");
    setErrorMessage("");

    try {
      // Process card payment
      const result = await paymentService.processPayment({
        amount: sale.total,
        currency: getCurrencySymbol(),
        type: "sale",
        reference: `CARD-${Date.now()}`,
      });

      if (result.success) {
        setTransactionRef(
          result.authorizationCode || result.transactionId || "",
        );

        // Print receipt using silent print service (offline-capable)
        const receipt = buildReceiptData(
          result.authorizationCode || result.transactionId || "",
        );
        await silentPrintService.queueReceipt(receipt);

        setPaymentStatus("success");
        setTimeout(onComplete, 2000);
      } else {
        setErrorMessage(result.errorMessage || "Card payment failed");
        setPaymentStatus("error");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Card payment failed",
      );
      setPaymentStatus("error");
    }
  };

  const handleMpesaPayment = async () => {
    setPaymentStatus("processing");
    setErrorMessage("");

    try {
      // Simulate M-Pesa STK push
      // In production, this would call the backend API
      const result = await new Promise<{
        success: boolean;
        transactionId?: string;
        error?: string;
      }>((resolve) => {
        setTimeout(() => {
          // Generate a deterministic transaction ID based on timestamp
          resolve({ success: true, transactionId: `MPE${Date.now()}` });
        }, 2000);
      });

      if (result.success) {
        setTransactionRef(result.transactionId || "");

        // Print receipt using silent print service (offline-capable)
        const receipt = buildReceiptData(result.transactionId || "");
        await silentPrintService.queueReceipt(receipt);

        setPaymentStatus("success");
        setTimeout(onComplete, 2000);
      } else {
        setErrorMessage(result.error || "M-Pesa payment failed");
        setPaymentStatus("error");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "M-Pesa payment failed",
      );
      setPaymentStatus("error");
    }
  };

  const handleCompleteSale = async () => {
    if (paymentMethod === "cash") {
      await handleCashPayment();
    } else if (paymentMethod === "card") {
      await handleCardPayment();
    } else {
      await handleMpesaPayment();
    }
  };

  const isProcessing = paymentStatus === "processing";

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold">Checkout</h2>
        <div className="w-10" />
      </div>

      {/* Sale Summary */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="font-semibold mb-2">Sale Summary</h3>
        <div className="space-y-1 text-sm">
          {sale.items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span>
                {item.name} x{item.quantity}
              </span>
              <span>
                {currencySymbol} {item.total.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        <div className="border-t mt-2 pt-2">
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>
              {currencySymbol} {sale.total.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Method Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Payment Method</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setPaymentMethod("cash")}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition ${
              paymentMethod === "cash"
                ? "border-green-500 bg-green-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <Banknote className="w-8 h-8" />
            <span className="font-medium">Cash</span>
          </button>
          <button
            onClick={() => setPaymentMethod("card")}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition ${
              paymentMethod === "card"
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <CreditCard className="w-8 h-8" />
            <span className="font-medium">Card</span>
          </button>
          <button
            onClick={() => setPaymentMethod("mpesa")}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition ${
              paymentMethod === "mpesa"
                ? "border-green-600 bg-green-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <Smartphone className="w-8 h-8" />
            <span className="font-medium">M-Pesa</span>
          </button>
        </div>
      </div>

      {/* Cash Payment Input */}
      {paymentMethod === "cash" && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Amount Received
          </label>
          <input
            type="number"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg"
            placeholder="0.00"
            step="0.01"
            min="0"
          />
          {change >= 0 && amountPaid && (
            <p className="mt-2 text-green-600 font-medium">
              Change: {currencySymbol} {change.toFixed(2)}
            </p>
          )}
        </div>
      )}

      {/* Payment Status */}
      {paymentStatus !== "idle" && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            paymentStatus === "processing"
              ? "bg-yellow-50"
              : paymentStatus === "success"
                ? "bg-green-50"
                : "bg-red-50"
          }`}
        >
          <div className="flex items-center gap-3">
            {paymentStatus === "processing" && (
              <>
                <Loader2 className="w-6 h-6 text-yellow-600 animate-spin" />
                <span className="text-yellow-800">Processing payment...</span>
              </>
            )}
            {paymentStatus === "success" && (
              <>
                <CheckCircle className="w-6 h-6 text-green-600" />
                <span className="text-green-800 font-medium">
                  Payment successful!
                </span>
              </>
            )}
            {paymentStatus === "error" && (
              <>
                <XCircle className="w-6 h-6 text-red-600" />
                <span className="text-red-800">{errorMessage}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          onClick={handleCompleteSale}
          disabled={
            isProcessing ||
            (paymentMethod === "cash" &&
              (!amountPaid || parseFloat(amountPaid) < sale.total))
          }
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Printer className="w-5 h-5" />
          {isProcessing ? "Processing..." : "Complete Sale & Print"}
        </button>
      </div>
    </div>
  );
}
