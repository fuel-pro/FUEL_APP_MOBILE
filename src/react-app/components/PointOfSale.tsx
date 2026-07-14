import { useState, useRef, useEffect } from "react";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Printer,
  CreditCard,
  Smartphone,
  Banknote,
  Receipt,
  X,
  Check,
  Settings,
  QrCode,
  Star,
  Award,
} from "lucide-react";
import { useFuel } from "@/react-app/context/FuelContext";
import { useLocation } from "@/react-app/context/LocationContext";
import { formatNumber } from "@/react-app/utils/formatUtils";
import QRCode from "qrcode";
import { useLoyalty } from "@/react-app/lib/useLoyalty";
import { LoyaltyCustomer, TIER_COLORS } from "@/react-app/lib/loyaltyProgram";

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  fuelType?: "PMS" | "AGO";
  litres?: number;
  vatCategory: "A" | "B" | "E"; // A=16%, B=0%, E=Exempt
  hsCode?: string;
}

interface POSTransaction {
  id: string;
  items: CartItem[];
  subtotal: number;
  vatA: number; // 16% VAT
  vatB: number; // 0% VAT
  vatE: number; // Exempt
  totalVat: number;
  total: number;
  paymentMethod: string;
  customerPhone?: string;
  customerName?: string;
  customerPin?: string;
  timestamp: string;
  receiptNumber: string;
  invoiceNumber: string;
  cashier: string;
  cuInvoiceNo: string;
  cuSignature: string;
  fiscalCounter: number;
  qrCodeData: string;
}

export default function PointOfSale() {
  const { state, dispatch } = useFuel();
  const location = useLocation();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "mpesa" | "card" | "bank"
  >("cash");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPin, setCustomerPin] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentTransaction, setCurrentTransaction] =
    useState<POSTransaction | null>(null);
  const [transactions, setTransactions] = useState<POSTransaction[]>([]);
  const [fiscalCounter, setFiscalCounter] = useState(1);
  const [quickSaleType, setQuickSaleType] = useState<
    "petrol" | "diesel" | "custom"
  >("petrol");
  const [quickSaleLitres, setQuickSaleLitres] = useState("");
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState("");
  const [stkPushStatus, setStkPushStatus] = useState<
    "idle" | "pending" | "success" | "failed"
  >("idle");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const receiptRef = useRef<HTMLDivElement>(null);

  // ─── Loyalty Integration ───
  const stationId = location.currentLocation?.stationId || "default";
  const {
    customers,
    earnPoints,
    findCustomerByPhone,
    findCustomerByCard,
    config: loyaltyConfig,
  } = useLoyalty(stationId);
  const [loyaltyCustomer, setLoyaltyCustomer] =
    useState<LoyaltyCustomer | null>(null);
  const [showLoyaltyScanner, setShowLoyaltyScanner] = useState(false);
  const [loyaltyLookupMode, setLoyaltyLookupMode] = useState<"phone" | "card">(
    "phone"
  );

  // Loyalty lookup by phone or card number
  const lookupLoyaltyCustomer = (input: string) => {
    let customer = findCustomerByPhone(input);
    if (!customer) {
      customer = findCustomerByCard(input);
    }
    setLoyaltyCustomer(customer || null);
    return customer;
  };

  // Auto-lookup when phone changes
  useEffect(() => {
    if (customerPhone && customerPhone.length >= 7) {
      const found = lookupLoyaltyCustomer(customerPhone);
      if (!found) {
        setLoyaltyCustomer(null);
      }
    } else if (!customerPhone) {
      setLoyaltyCustomer(null);
    }
  }, [customerPhone]);

  // Award points after successful transaction
  const awardLoyaltyPoints = (transaction: POSTransaction) => {
    if (!loyaltyCustomer || !loyaltyConfig?.isEnabled) return;

    // Calculate total liters from fuel items
    const fuelItems = transaction.items.filter(item => item.litres);
    const totalLiters = fuelItems.reduce(
      (sum, item) => sum + (item.litres || 0),
      0
    );
    const fuelType = fuelItems[0]?.fuelType || "PMS";

    if (totalLiters > 0) {
      earnPoints(
        loyaltyCustomer.id,
        transaction.id,
        transaction.total,
        totalLiters,
        fuelType,
        transaction.cashier || "POS"
      );

      // Refresh customer data
      setLoyaltyCustomer(prev =>
        prev ? findCustomerByPhone(prev.phone) || prev : null
      );
    }
  };

  // KRA ETR Settings from company data
  const etrConfig = {
    kraPin: state.companyData.kraPin || "P000000000X",
    vatRegNo: state.companyData.vatRegNo || "",
    etrSerialNo: state.companyData.etrSerialNo || "ETR-00000000",
    cuSerialNo: state.companyData.cuSerialNo || "CU-00000000",
    invoicePrefix: state.companyData.etrInvoicePrefix || "INV",
    businessName: state.companyData.name || "FuelPro Station",
    address: state.companyData.physicalAddress || state.companyData.poBox || "",
    town: state.companyData.town || "",
    county: state.companyData.county || "",
    phone: state.companyData.contacts || "",
    email: state.companyData.email || "",
  };

  const VAT_RATE = 0.16; // 16% VAT in Kenya

  // Generate unique invoice number in KRA format
  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const counter = String(fiscalCounter).padStart(6, "0");
    return `${etrConfig.invoicePrefix}${year}${month}${day}${counter}`;
  };

  // Generate CU Invoice Number (Control Unit format)
  const generateCUInvoiceNo = () => {
    const date = new Date();
    const timestamp = date.getTime().toString().slice(-10);
    return `${etrConfig.cuSerialNo.slice(-8)}${timestamp}`;
  };

  // Generate verification signature (simulated - real implementation needs KRA API)
  const generateSignature = (invoiceNo: string, total: number) => {
    const data = `${invoiceNo}${total.toFixed(2)}${Date.now()}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash)
      .toString(16)
      .toUpperCase()
      .padStart(16, "0")
      .slice(0, 16);
  };

  // Generate QR code for receipt verification
  const generateQRData = async (
    transaction: Omit<POSTransaction, "qrCodeData">
  ) => {
    const qrData = {
      pin: etrConfig.kraPin,
      inv: transaction.invoiceNumber,
      date: transaction.timestamp,
      total: transaction.total.toFixed(2),
      vat: transaction.totalVat.toFixed(2),
      cu: etrConfig.cuSerialNo,
      sig: transaction.cuSignature,
    };

    const qrString = `https://itax.kra.go.ke/etims/validate?data=${encodeURIComponent(JSON.stringify(qrData))}`;

    try {
      const qrUrl = await QRCode.toDataURL(qrString, {
        width: 120,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
      return { qrString, qrUrl };
    } catch (err) {
      console.error("QR generation error:", err);
      return { qrString, qrUrl: "" };
    }
  };

  const generateReceiptNumber = () => {
    const date = new Date();
    const prefix = "FP";
    const timestamp = date.getTime().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `${prefix}${timestamp}${random}`;
  };

  const addFuelToCart = () => {
    const litres = parseFloat(quickSaleLitres) || 0;
    if (litres <= 0) return;

    const price =
      quickSaleType === "petrol" ? state.petrolPrice : state.dieselPrice;
    const total = litres * price;
    const fuelName =
      quickSaleType === "petrol" ? "Super Petrol (PMS)" : "Diesel (AGO)";

    const newItem: CartItem = {
      id: `fuel-${Date.now()}`,
      name: fuelName,
      quantity: 1,
      unitPrice: total,
      total: total,
      fuelType: quickSaleType === "petrol" ? "PMS" : "AGO",
      litres: litres,
      vatCategory: "A", // Fuel is VAT-able at 16%
      hsCode: quickSaleType === "petrol" ? "2710.12.10" : "2710.19.20",
    };

    setCart([...cart, newItem]);
    setQuickSaleLitres("");
  };

  const addCustomItem = () => {
    if (!customItemName || !customItemPrice) return;

    const price = parseFloat(customItemPrice) || 0;
    const newItem: CartItem = {
      id: `custom-${Date.now()}`,
      name: customItemName,
      quantity: 1,
      unitPrice: price,
      total: price,
      vatCategory: "A", // Default to 16% VAT
    };

    setCart([...cart, newItem]);
    setCustomItemName("");
    setCustomItemPrice("");
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(
      cart.map(item => {
        if (item.id === itemId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty, total: item.unitPrice * newQty };
        }
        return item;
      })
    );
  };

  const removeItem = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Calculate VAT by category
  const calculateVAT = () => {
    let vatA = 0,
      vatB = 0,
      vatE = 0;
    let taxableA = 0,
      taxableB = 0,
      exemptE = 0;

    cart.forEach(item => {
      const itemTotal = item.total;
      if (item.vatCategory === "A") {
        // VAT inclusive calculation
        const taxable = itemTotal / (1 + VAT_RATE);
        const vat = itemTotal - taxable;
        taxableA += taxable;
        vatA += vat;
      } else if (item.vatCategory === "B") {
        taxableB += itemTotal;
        // 0% VAT
      } else {
        exemptE += itemTotal;
      }
    });

    return { vatA, vatB, vatE, taxableA, taxableB, exemptE };
  };

  const { vatA, taxableA, taxableB, exemptE } = calculateVAT();
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const totalVat = vatA;
  const total = subtotal;

  const initiateSTKPush = async () => {
    if (!customerPhone) {
      import("@/react-app/lib/toast").then(({ toastWarning }) =>
        toastWarning("Please enter customer phone number for M-Pesa payment")
      );
      return;
    }

    setStkPushStatus("pending");

    // Simulate STK push delay for local mode
    setTimeout(() => {
      setStkPushStatus("success");
      // Auto-process the payment after simulated confirmation
      setTimeout(() => {
        processPayment();
      }, 1500);
    }, 2000);
  };

  const processPayment = async () => {
    if (cart.length === 0) return;

    const invoiceNumber = generateInvoiceNumber();
    const cuInvoiceNo = generateCUInvoiceNo();
    const cuSignature = generateSignature(invoiceNumber, total);
    const receiptNumber = generateReceiptNumber();
    const timestamp = new Date().toISOString();

    const transactionData: Omit<POSTransaction, "qrCodeData"> = {
      id: `txn-${Date.now()}`,
      items: [...cart],
      subtotal: taxableA + taxableB + exemptE,
      vatA,
      vatB: 0,
      vatE: exemptE,
      totalVat,
      total,
      paymentMethod,
      customerPhone: paymentMethod === "mpesa" ? customerPhone : undefined,
      customerName: customerName || undefined,
      customerPin: customerPin || undefined,
      timestamp,
      receiptNumber,
      invoiceNumber,
      cashier: "Cashier 1",
      cuInvoiceNo,
      cuSignature,
      fiscalCounter,
    };

    const { qrString, qrUrl } = await generateQRData(transactionData);
    setQrCodeUrl(qrUrl);

    const transaction: POSTransaction = {
      ...transactionData,
      qrCodeData: qrString,
    };

    // Save transaction locally (serverless mode)
    try {
      const localTransactions = JSON.parse(
        localStorage.getItem("fuelpro_pos_transactions") || "[]"
      );
      localTransactions.push({
        ...transaction,
        savedAt: new Date().toISOString(),
      });
      localStorage.setItem(
        "fuelpro_pos_transactions",
        JSON.stringify(localTransactions.slice(-100))
      );
    } catch (error) {
      console.error("Failed to save POS transaction locally:", error);
    }

    // Sync fuel sales to salesHistory for reporting
    syncFuelSalesToHistory(cart, timestamp, paymentMethod);

    // ─── Award Loyalty Points ───
    const transactionForLoyalty: POSTransaction = {
      ...transactionData,
      qrCodeData: "",
    };
    awardLoyaltyPoints(transactionForLoyalty);

    // Add credit sale to delivery tracking if customer has a name
    if (customerName && paymentMethod !== "cash" && paymentMethod !== "mpesa") {
      addToDeliveryTracking(cart, customerName, timestamp);
    }

    setCurrentTransaction(transaction);
    setTransactions([transaction, ...transactions]);
    setShowReceipt(true);
    setCart([]);
    setCustomerPhone("");
    setCustomerName("");
    setCustomerPin("");
    setStkPushStatus("idle");
    setFiscalCounter(fiscalCounter + 1);
  };

  // Sync POS fuel sales to salesHistory for integrated reporting
  const syncFuelSalesToHistory = (
    items: CartItem[],
    timestamp: string,
    payment: string
  ) => {
    const date = timestamp.split("T")[0];
    const shift = new Date(timestamp).getHours() < 14 ? "Day" : "Night";
    const key = `${date}_${shift}`;

    // Calculate fuel totals from POS items
    let pmsLitres = 0,
      pmsAmount = 0;
    let agoLitres = 0,
      agoAmount = 0;

    items.forEach(item => {
      if (item.fuelType === "PMS") {
        pmsLitres += item.litres || item.quantity;
        pmsAmount += item.total;
      } else if (item.fuelType === "AGO") {
        agoLitres += item.litres || item.quantity;
        agoAmount += item.total;
      }
    });

    if (pmsLitres === 0 && agoLitres === 0) return;

    // Get existing sales data or create new
    const existingSales = state.salesHistory[key] || {
      date,
      shift,
      pmsPumps: state.pmsPumps,
      agoPumps: state.agoPumps,
      expenses: [],
      tillPayment: 0,
      pmsPrice: state.pmsPrice,
      agoPrice: state.agoPrice,
      pmsTankOpening: state.pmsTankOpening,
      pmsTankClosing: state.pmsTankClosing,
      agoTankOpening: state.agoTankOpening,
      agoTankClosing: state.agoTankClosing,
      posSales: { pmsLitres: 0, pmsAmount: 0, agoLitres: 0, agoAmount: 0 },
    };

    // Accumulate POS sales
    const posSales = existingSales.posSales || {
      pmsLitres: 0,
      pmsAmount: 0,
      agoLitres: 0,
      agoAmount: 0,
    };
    posSales.pmsLitres += pmsLitres;
    posSales.pmsAmount += pmsAmount;
    posSales.agoLitres += agoLitres;
    posSales.agoAmount += agoAmount;

    // Update till payment for M-Pesa transactions
    const tillPayment =
      existingSales.tillPayment +
      (payment === "mpesa" ? pmsAmount + agoAmount : 0);

    dispatch({
      type: "SET_SALES_HISTORY",
      payload: {
        ...state.salesHistory,
        [key]: { ...existingSales, posSales, tillPayment },
      },
    });
  };

  // Add credit sales to delivery tracking for customer accounts
  const addToDeliveryTracking = (
    items: CartItem[],
    customer: string,
    timestamp: string
  ) => {
    const fuelItems = items.filter(item => item.fuelType);
    if (fuelItems.length === 0) return;

    const date = timestamp.split("T")[0];
    const totalLitres = fuelItems.reduce(
      (sum, item) => sum + (item.litres || item.quantity),
      0
    );
    const totalAmount = fuelItems.reduce((sum, item) => sum + item.total, 0);
    const fuelType = fuelItems[0].fuelType || "PMS";

    const newRow = {
      date,
      reg: "POS",
      fuel: fuelType,
      litres: totalLitres,
      amount: totalAmount,
      name: customer,
      debt: totalAmount,
    };

    const updatedRows = [...state.deliveryData.rows, newRow];
    const totals = {
      totalSupplied: updatedRows.reduce(
        (sum, row) => sum + (row.amount || 0),
        0
      ),
      totalPayments: state.deliveryData.totals.totalPayments,
      balanceDue: updatedRows.reduce((sum, row) => sum + (row.debt || 0), 0),
    };

    dispatch({
      type: "SET_DELIVERY_DATA",
      payload: { ...state.deliveryData, rows: updatedRows, totals },
    });
  };

  const printReceipt = () => {
    if (!receiptRef.current) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const receiptContent = receiptRef.current.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Tax Invoice - ${currentTransaction?.invoiceNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 11px; 
              padding: 5px;
              max-width: 80mm;
              margin: 0 auto;
              line-height: 1.3;
            }
            .receipt-header { text-align: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #000; }
            .receipt-header h2 { font-size: 14px; margin: 4px 0; font-weight: bold; }
            .receipt-header p { margin: 2px 0; font-size: 10px; }
            .tax-invoice-title { font-size: 12px; font-weight: bold; margin: 8px 0; text-align: center; background: #000; color: #fff; padding: 4px; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .double-divider { border-top: 2px solid #000; margin: 6px 0; }
            .info-row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 10px; }
            .info-row span:first-child { font-weight: bold; }
            .item-header { display: flex; justify-content: space-between; font-weight: bold; font-size: 10px; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px; }
            .item-row { margin: 4px 0; }
            .item-name { font-weight: bold; font-size: 10px; }
            .item-details { display: flex; justify-content: space-between; font-size: 9px; margin-left: 8px; }
            .vat-summary { margin: 8px 0; font-size: 10px; }
            .vat-row { display: flex; justify-content: space-between; margin: 2px 0; }
            .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; margin: 4px 0; }
            .grand-total { font-size: 14px; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4px 0; }
            .etr-section { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #000; text-align: center; font-size: 9px; }
            .etr-section p { margin: 2px 0; }
            .etr-section .signature { font-family: monospace; font-size: 8px; letter-spacing: 1px; margin: 4px 0; word-break: break-all; }
            .qr-code { text-align: center; margin: 8px 0; }
            .qr-code img { max-width: 100px; height: auto; }
            .footer { text-align: center; margin-top: 10px; font-size: 9px; }
            .footer p { margin: 2px 0; }
            @media print { body { margin: 0; padding: 2mm; } }
          </style>
        </head>
        <body>
          ${receiptContent}
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-KE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Generate QR code when transaction changes
  useEffect(() => {
    if (currentTransaction) {
      QRCode.toDataURL(currentTransaction.qrCodeData, {
        width: 120,
        margin: 1,
      })
        .then(url => setQrCodeUrl(url))
        .catch(console.error);
    }
  }, [currentTransaction]);

  const updateCompanyData = (field: string, value: string) => {
    dispatch({
      type: "SET_COMPANY_DATA",
      payload: { ...state.companyData, [field]: value },
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
          <ShoppingCart size={24} />
          Point of Sale
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(true)}
            className="btn btn-outline btn-sm flex items-center gap-1"
          >
            <Settings size={16} />
            KRA Settings
          </button>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Fiscal #{fiscalCounter} | Today: {transactions.length}
          </div>
        </div>
      </div>

      {/* KRA Compliance Banner */}
      {!etrConfig.kraPin || etrConfig.kraPin === "P000000000X" ? (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
            <QrCode size={16} />
            <span>
              <strong>KRA eTIMS Setup Required:</strong> Configure your KRA PIN
              and ETR details in Settings for tax-compliant receipts.
            </span>
          </p>
        </div>
      ) : (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-2">
          <p className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
            <Check size={16} />
            <span>
              <strong>KRA eTIMS Ready:</strong> PIN: {etrConfig.kraPin} | ETR:{" "}
              {etrConfig.etrSerialNo}
            </span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Sale Panel */}
        <div className="lg:col-span-2 space-y-2">
          {/* Fuel Quick Sale */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Quick Fuel Sale</h3>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex gap-2">
                <button
                  onClick={() => setQuickSaleType("petrol")}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    quickSaleType === "petrol"
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  Petrol (Ksh {state.petrolPrice}/L)
                </button>
                <button
                  onClick={() => setQuickSaleType("diesel")}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    quickSaleType === "diesel"
                      ? "bg-yellow-500 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  Diesel (Ksh {state.dieselPrice}/L)
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={quickSaleLitres}
                  onChange={e => setQuickSaleLitres(e.target.value)}
                  placeholder="Litres"
                  className="w-32 px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-600"
                  step="0.1"
                />
                <span className="text-gray-500">
                  = Ksh{" "}
                  {formatNumber(
                    (parseFloat(quickSaleLitres) || 0) *
                      (quickSaleType === "petrol"
                        ? state.petrolPrice
                        : state.dieselPrice)
                  )}
                </span>
                <button onClick={addFuelToCart} className="btn btn-primary">
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>
          </div>

          {/* Custom Item */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Add Custom Item</h3>
            <div className="flex flex-wrap gap-4 items-end">
              <input
                type="text"
                value={customItemName}
                onChange={e => setCustomItemName(e.target.value)}
                placeholder="Item name"
                className="flex-1 min-w-[150px] px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-600"
              />
              <input
                type="number"
                value={customItemPrice}
                onChange={e => setCustomItemPrice(e.target.value)}
                placeholder="Price (Ksh)"
                className="w-32 px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-600"
              />
              <button onClick={addCustomItem} className="btn btn-outline">
                <Plus size={16} /> Add Item
              </button>
            </div>
          </div>

          {/* Cart */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Current Sale</h3>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Clear All
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart size={48} className="mx-auto mb-2 opacity-30" />
                <p>No items in cart</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        {item.litres && <span>{item.litres} Litres</span>}
                        <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                          VAT-{item.vatCategory}
                        </span>
                        {item.hsCode && (
                          <span className="text-xs">HS: {item.hsCode}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {!item.litres && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="p-1 rounded bg-gray-200 dark:bg-gray-700"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-8 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-1 rounded bg-gray-200 dark:bg-gray-700"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                      <span className="font-semibold w-24 text-right">
                        Ksh {formatNumber(item.total)}
                      </span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Payment Panel */}
        <div className="space-y-2">
          {/* Customer Info (Optional) */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                Customer Info (Optional)
              </h3>
              {loyaltyConfig?.isEnabled && (
                <button
                  onClick={() => setShowLoyaltyScanner(!showLoyaltyScanner)}
                  className="flex items-center gap-1 text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg"
                >
                  <Award size={12} />
                  {loyaltyCustomer ? "Loyalty Active" : "Add Loyalty"}
                </button>
              )}
            </div>

            {/* Loyalty Customer Status */}
            {loyaltyCustomer && (
              <div
                className={`mb-3 p-3 rounded-lg ${TIER_COLORS[loyaltyCustomer.tier].bg}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star
                      size={16}
                      className={TIER_COLORS[loyaltyCustomer.tier].text}
                    />
                    <div>
                      <p
                        className={`text-sm font-semibold ${TIER_COLORS[loyaltyCustomer.tier].text}`}
                      >
                        {loyaltyCustomer.name}
                      </p>
                      <p
                        className={`text-xs ${TIER_COLORS[loyaltyCustomer.tier].text}`}
                      >
                        {loyaltyCustomer.tier} Member •{" "}
                        {loyaltyCustomer.points.toLocaleString()} pts
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setLoyaltyCustomer(null);
                      setCustomerPhone("");
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Loyalty Scanner Modal */}
            {showLoyaltyScanner && (
              <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">
                  Enter phone number or card number
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={e => {
                      setCustomerPhone(e.target.value);
                      if (e.target.value.length >= 7) {
                        lookupLoyaltyCustomer(e.target.value);
                      }
                    }}
                    placeholder="Phone or Card Number"
                    className="flex-1 px-3 py-2 text-sm rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                  />
                  <button
                    onClick={() => setShowLoyaltyScanner(false)}
                    className="px-3 py-2 text-sm text-gray-500"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Customer Name"
                className="w-full px-3 py-2 text-sm rounded-lg border dark:bg-gray-800 dark:border-gray-600"
              />
              <input
                type="text"
                value={customerPin}
                onChange={e => setCustomerPin(e.target.value.toUpperCase())}
                placeholder="Customer KRA PIN (for B2B)"
                className="w-full px-3 py-2 text-sm rounded-lg border dark:bg-gray-800 dark:border-gray-600"
              />
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Payment Summary</h3>

            {/* VAT Breakdown */}
            <div className="space-y-1 mb-4 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Taxable (A-16%):</span>
                <span>Ksh {formatNumber(taxableA)}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>VAT (16%):</span>
                <span>Ksh {formatNumber(vatA)}</span>
              </div>
              {taxableB > 0 && (
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Zero-rated (B-0%):</span>
                  <span>Ksh {formatNumber(taxableB)}</span>
                </div>
              )}
              {exemptE > 0 && (
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Exempt (E):</span>
                  <span>Ksh {formatNumber(exemptE)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold border-t pt-2">
                <span>Total:</span>
                <span>Ksh {formatNumber(total)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium">
                Payment Method
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`p-3 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === "cash"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <Banknote size={20} />
                  <span className="text-sm">Cash</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("mpesa")}
                  className={`p-3 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === "mpesa"
                      ? "border-green-500 bg-green-50 dark:bg-green-900/30"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <Smartphone size={20} />
                  <span className="text-sm">M-Pesa</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`p-3 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === "card"
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <CreditCard size={20} />
                  <span className="text-sm">Card</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("bank")}
                  className={`p-3 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === "bank"
                      ? "border-orange-500 bg-orange-50 dark:bg-orange-900/30"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <Receipt size={20} />
                  <span className="text-sm">Bank</span>
                </button>
              </div>

              {paymentMethod === "mpesa" && (
                <div className="space-y-2">
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="Phone (e.g. 0712345678)"
                    className="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-600"
                  />
                  <button
                    onClick={initiateSTKPush}
                    disabled={
                      stkPushStatus === "pending" ||
                      !customerPhone ||
                      cart.length === 0
                    }
                    className="w-full btn bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                  >
                    {stkPushStatus === "pending" ? (
                      <>Processing STK Push...</>
                    ) : stkPushStatus === "success" ? (
                      <>
                        <Check size={16} /> Payment Received
                      </>
                    ) : (
                      <>Send STK Push</>
                    )}
                  </button>
                </div>
              )}

              {paymentMethod !== "mpesa" && (
                <button
                  onClick={processPayment}
                  disabled={cart.length === 0}
                  className="w-full btn btn-primary text-lg py-3 disabled:opacity-50"
                >
                  Complete Sale
                </button>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {transactions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No transactions yet
                </p>
              ) : (
                transactions.slice(0, 5).map(txn => (
                  <div
                    key={txn.id}
                    className="p-2 bg-gray-50 dark:bg-gray-800 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => {
                      setCurrentTransaction(txn);
                      setShowReceipt(true);
                    }}
                  >
                    <div className="flex justify-between text-sm">
                      <span className="font-mono text-xs">
                        {txn.invoiceNumber}
                      </span>
                      <span className="font-semibold">
                        Ksh {formatNumber(txn.total)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{txn.paymentMethod.toUpperCase()}</span>
                      <span>{formatDate(txn.timestamp)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KRA Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
              <h3 className="font-semibold">KRA eTIMS / ETR Configuration</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-2">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                <p>
                  <strong>Note:</strong> To enable full KRA eTIMS compliance,
                  you must register with KRA at{" "}
                  <a
                    href="https://itax.kra.go.ke"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    itax.kra.go.ke
                  </a>{" "}
                  and obtain your ETR device credentials.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={state.companyData.name}
                    onChange={e => updateCompanyData("name", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    KRA PIN *
                  </label>
                  <input
                    type="text"
                    value={state.companyData.kraPin}
                    onChange={e =>
                      updateCompanyData("kraPin", e.target.value.toUpperCase())
                    }
                    placeholder="P000000000X"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    VAT Reg. No.
                  </label>
                  <input
                    type="text"
                    value={state.companyData.vatRegNo}
                    onChange={e =>
                      updateCompanyData("vatRegNo", e.target.value)
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Physical Address
                  </label>
                  <input
                    type="text"
                    value={state.companyData.physicalAddress}
                    onChange={e =>
                      updateCompanyData("physicalAddress", e.target.value)
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Town</label>
                  <input
                    type="text"
                    value={state.companyData.town}
                    onChange={e => updateCompanyData("town", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    County
                  </label>
                  <input
                    type="text"
                    value={state.companyData.county}
                    onChange={e => updateCompanyData("county", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    ETR Serial No.
                  </label>
                  <input
                    type="text"
                    value={state.companyData.etrSerialNo}
                    onChange={e =>
                      updateCompanyData("etrSerialNo", e.target.value)
                    }
                    placeholder="ETR-00000000"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    CU Serial No.
                  </label>
                  <input
                    type="text"
                    value={state.companyData.cuSerialNo}
                    onChange={e =>
                      updateCompanyData("cuSerialNo", e.target.value)
                    }
                    placeholder="CU-00000000"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Invoice Prefix
                  </label>
                  <input
                    type="text"
                    value={state.companyData.etrInvoicePrefix}
                    onChange={e =>
                      updateCompanyData(
                        "etrInvoicePrefix",
                        e.target.value.toUpperCase()
                      )
                    }
                    placeholder="INV"
                    maxLength={5}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={state.companyData.contacts}
                    onChange={e =>
                      updateCompanyData("contacts", e.target.value)
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
              </div>

              <button
                onClick={() => setShowSettings(false)}
                className="w-full btn btn-primary"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal - KRA Compliant */}
      {showReceipt && currentTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
              <h3 className="font-semibold">Tax Invoice / Receipt</h3>
              <div className="flex gap-2">
                <button
                  onClick={printReceipt}
                  className="btn btn-primary btn-sm"
                >
                  <Printer size={14} /> Print
                </button>
                <button
                  onClick={() => setShowReceipt(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div
              ref={receiptRef}
              className="p-6 font-mono text-sm bg-white text-black"
            >
              {/* Receipt Header */}
              <div className="receipt-header text-center mb-4 pb-4 border-b border-dashed border-gray-400">
                <h2 className="text-lg font-bold">{etrConfig.businessName}</h2>
                {etrConfig.address && (
                  <p className="text-xs">{etrConfig.address}</p>
                )}
                {(etrConfig.town || etrConfig.county) && (
                  <p className="text-xs">
                    {[etrConfig.town, etrConfig.county]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
                {etrConfig.phone && (
                  <p className="text-xs">Tel: {etrConfig.phone}</p>
                )}
                {etrConfig.email && (
                  <p className="text-xs">{etrConfig.email}</p>
                )}
                <p className="text-xs mt-1">
                  <strong>PIN:</strong> {etrConfig.kraPin}
                </p>
                {etrConfig.vatRegNo && (
                  <p className="text-xs">
                    <strong>VAT:</strong> {etrConfig.vatRegNo}
                  </p>
                )}
              </div>

              <div className="tax-invoice-title bg-black text-white text-center py-1 font-bold text-sm mb-3">
                TAX INVOICE
              </div>

              {/* Invoice Details */}
              <div className="space-y-1 text-xs mb-3">
                <div className="flex justify-between">
                  <span>
                    <strong>Invoice No:</strong>
                  </span>
                  <span>{currentTransaction.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>
                    <strong>Date/Time:</strong>
                  </span>
                  <span>{formatDate(currentTransaction.timestamp)}</span>
                </div>
                <div className="flex justify-between">
                  <span>
                    <strong>Cashier:</strong>
                  </span>
                  <span>{currentTransaction.cashier}</span>
                </div>
                <div className="flex justify-between">
                  <span>
                    <strong>Payment:</strong>
                  </span>
                  <span>{currentTransaction.paymentMethod.toUpperCase()}</span>
                </div>
                {currentTransaction.customerName && (
                  <div className="flex justify-between">
                    <span>
                      <strong>Customer:</strong>
                    </span>
                    <span>{currentTransaction.customerName}</span>
                  </div>
                )}
                {currentTransaction.customerPin && (
                  <div className="flex justify-between">
                    <span>
                      <strong>Buyer PIN:</strong>
                    </span>
                    <span>{currentTransaction.customerPin}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-gray-400 my-3"></div>

              {/* Items Header */}
              <div className="flex justify-between text-xs font-bold border-b border-gray-400 pb-1 mb-2">
                <span>ITEM</span>
                <span>AMOUNT</span>
              </div>

              {/* Items */}
              <div className="space-y-2 mb-3">
                {currentTransaction.items.map((item, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{item.name}</span>
                      <span>Ksh {formatNumber(item.total)}</span>
                    </div>
                    <div className="text-[10px] text-gray-600 ml-2">
                      {item.litres
                        ? `${item.litres} L`
                        : `${item.quantity} x Ksh ${formatNumber(item.unitPrice)}`}
                      {" | VAT-"}
                      {item.vatCategory}
                      {item.hsCode && ` | HS:${item.hsCode}`}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-gray-400 my-3"></div>

              {/* VAT Summary */}
              <div className="vat-summary text-xs space-y-1 mb-3">
                <div className="font-bold border-b pb-1">VAT SUMMARY</div>
                <div className="flex justify-between">
                  <span>A-16.00%:</span>
                  <span>
                    Taxable:{" "}
                    {formatNumber(
                      currentTransaction.subtotal - currentTransaction.vatE
                    )}{" "}
                    | VAT: {formatNumber(currentTransaction.vatA)}
                  </span>
                </div>
                {currentTransaction.vatB > 0 && (
                  <div className="flex justify-between">
                    <span>B-0.00%:</span>
                    <span>
                      Taxable: {formatNumber(currentTransaction.vatB)} | VAT:
                      0.00
                    </span>
                  </div>
                )}
                {currentTransaction.vatE > 0 && (
                  <div className="flex justify-between">
                    <span>E-Exempt:</span>
                    <span>{formatNumber(currentTransaction.vatE)}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-400 my-3"></div>

              {/* Totals */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Subtotal (Excl. VAT):</span>
                  <span>
                    Ksh{" "}
                    {formatNumber(
                      currentTransaction.subtotal - currentTransaction.totalVat
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total VAT:</span>
                  <span>Ksh {formatNumber(currentTransaction.totalVat)}</span>
                </div>
              </div>

              <div className="flex justify-between text-lg font-bold border-t-2 border-b-2 border-black py-2 my-3">
                <span>TOTAL:</span>
                <span>Ksh {formatNumber(currentTransaction.total)}</span>
              </div>

              {/* ETR/KRA Section */}
              <div className="etr-section mt-4 pt-3 border-t border-dashed border-gray-400 text-center">
                <p className="font-bold text-xs">ELECTRONIC TAX REGISTER</p>
                <p className="text-[10px] mt-1">
                  ETR S/N: {etrConfig.etrSerialNo}
                </p>
                <p className="text-[10px]">CU S/N: {etrConfig.cuSerialNo}</p>
                <p className="text-[10px]">
                  CU Invoice No: {currentTransaction.cuInvoiceNo}
                </p>
                <p className="text-[10px]">
                  Fiscal Counter: #{currentTransaction.fiscalCounter}
                </p>
                <div className="mt-2 text-[9px] font-mono break-all bg-gray-100 p-1 rounded">
                  <strong>Signature:</strong> {currentTransaction.cuSignature}
                </div>

                {/* QR Code */}
                {qrCodeUrl && (
                  <div className="qr-code mt-3">
                    <img
                      src={qrCodeUrl}
                      alt="Verification QR"
                      className="mx-auto"
                      style={{ width: "100px", height: "100px" }}
                    />
                    <p className="text-[8px] mt-1">
                      Scan to verify at KRA iTax
                    </p>
                  </div>
                )}

                <p className="mt-2 text-[9px] font-bold">
                  *KRA eTIMS COMPLIANT INVOICE*
                </p>
                <p className="text-[8px]">Powered by TIMS</p>
              </div>

              {/* Footer */}
              <div className="footer mt-4 text-center text-xs border-t border-dashed border-gray-400 pt-3">
                <p className="font-semibold">Thank you for your business!</p>
                <p className="text-[10px]">
                  Goods once sold are not returnable
                </p>
                <p className="text-[10px] mt-2 opacity-60">
                  {window.location.hostname}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
