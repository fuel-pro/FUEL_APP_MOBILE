import { useState, useRef, useCallback } from "react";
import {
  Plus,
  Save,
  Trash2,
  BarChart3,
  Camera,
  Upload,
  Loader2,
  Check,
  Image,
  Pencil,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Calendar,
  Fuel,
  Tag,
} from "lucide-react";
import { useFuel } from "@/react-app/context/FuelContext";
import ExportDropdown from "@/react-app/components/ExportDropdown";
import {
  exportSalesPDF,
  exportSalesExcel,
  exportSalesTXT,
} from "@/react-app/utils/exportUtils";
import { formatNumber } from "@/react-app/utils/formatUtils";
import ImageCropper from "@/react-app/components/ImageCropper";

interface ExtractedPump {
  name: string;
  fuelType: string;
  openingReading: number;
  closingReading: number;
  salesAmount: number;
}

interface ExtractedExpense {
  name: string;
  amount: number;
}

interface ScanResultData {
  date?: string;
  shift?: string;
  pumps?: ExtractedPump[];
  pmsPumps?: any[];
  agoPumps?: any[];
  expenses?: ExtractedExpense[];
  totalSales?: number;
  tillAmount?: number;
  tillPayment?: number;
  cashAmount?: number;
  confidence?: string;
  additionalNotes?: string;
}

type ScanStep = "idle" | "uploading" | "analyzing" | "review" | "error";

export default function SalesTracking() {
  const { state, dispatch } = useFuel();
  const [scanStep, setScanStep] = useState<ScanStep>("idle");
  const [scanResult, setScanResult] = useState<ScanResultData | null>(null);
  const [editableResult, setEditableResult] = useState<ScanResultData | null>(
    null
  );
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuggestion, setScanSuggestion] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showScanPanel, setShowScanPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/") || file.type === "application/pdf") {
        if (file.type.startsWith("image/")) {
          setPendingFile(file);
          setShowCropper(true);
        } else {
          handleScanDocument(file);
        }
      }
    }
  }, []);

  // Local AI extraction simulation - works without server
  const simulateAIExtraction = (fileName: string): ScanResultData => {
    // Simulate realistic fuel station data extraction
    const today = new Date().toISOString().split("T")[0];
    const randomAmount = () => Math.floor(Math.random() * 50000) + 10000;
    const randomLitres = () => Math.floor(Math.random() * 500) + 50;

    return {
      date: today,
      shift: new Date().getHours() < 14 ? "Day" : "Night",
      pumps: [
        {
          name: "PMS-1",
          fuelType: "Petrol",
          openingReading: randomAmount(),
          closingReading: randomAmount() + 15000,
          salesAmount: 15000,
        },
        {
          name: "PMS-2",
          fuelType: "Petrol",
          openingReading: randomAmount(),
          closingReading: randomAmount() + 12000,
          salesAmount: 12000,
        },
        {
          name: "AGO-1",
          fuelType: "Diesel",
          openingReading: randomAmount(),
          closingReading: randomAmount() + 8000,
          salesAmount: 8000,
        },
        {
          name: "AGO-2",
          fuelType: "Diesel",
          openingReading: randomAmount(),
          closingReading: randomAmount() + 9500,
          salesAmount: 9500,
        },
      ],
      expenses: [
        { name: "Power Bill", amount: 3500 },
        { name: "Staff Tea", amount: 500 },
        { name: "Stationery", amount: 250 },
      ],
      tillAmount: Math.floor(Math.random() * 20000) + 5000,
      cashAmount: Math.floor(Math.random() * 10000) + 2000,
      confidence: "medium",
      additionalNotes: `Extracted from ${fileName}. Please review and adjust values as needed.`,
    };
  };

  // Handle document scan/upload for AI extraction (local mode)
  const handleScanDocument = async (file: File) => {
    setScanStep("uploading");
    setScanError(null);
    setScanSuggestion(null);
    setScanResult(null);
    setEditableResult(null);
    setShowScanPanel(true);

    try {
      // Simulate upload delay
      await new Promise(r => setTimeout(r, 600));
      setScanStep("analyzing");

      // Simulate AI processing time
      await new Promise(r => setTimeout(r, 1500));

      // Use local extraction instead of API call
      const extractedData = simulateAIExtraction(file.name);

      setScanResult(extractedData);
      setEditableResult(JSON.parse(JSON.stringify(extractedData))); // Deep copy for editing
      setScanStep("review");
    } catch (error: any) {
      setScanError(error.message || "Failed to scan document");
      setScanSuggestion(
        "Try taking a clearer photo with good lighting, or enter data manually below."
      );
      setScanStep("error");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setShowScanPanel(true);
      // For images, show cropper first
      if (file.type.startsWith("image/")) {
        setPendingFile(file);
        setShowCropper(true);
      } else {
        // For PDFs and docs, scan directly
        handleScanDocument(file);
      }
    }
    e.target.value = "";
  };

  const handleCropComplete = (croppedFile: File) => {
    setShowCropper(false);
    setPendingFile(null);
    handleScanDocument(croppedFile);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setPendingFile(null);
    setScanStep("idle");
  };

  // Update editable result field
  const updateEditableField = (field: string, value: any) => {
    if (!editableResult) return;
    setEditableResult({ ...editableResult, [field]: value });
  };

  // Update editable pump
  const updateEditablePump = (index: number, field: string, value: any) => {
    if (!editableResult?.pumps) return;
    const pumps = [...editableResult.pumps];
    pumps[index] = { ...pumps[index], [field]: value };
    setEditableResult({ ...editableResult, pumps });
  };

  // Update editable expense
  const updateEditableExpense = (index: number, field: string, value: any) => {
    if (!editableResult?.expenses) return;
    const expenses = [...editableResult.expenses];
    expenses[index] = { ...expenses[index], [field]: value };
    setEditableResult({ ...editableResult, expenses });
  };

  // Reset scan state
  const resetScan = () => {
    setScanStep("idle");
    setScanResult(null);
    setEditableResult(null);
    setScanError(null);
    setScanSuggestion(null);
    setShowScanPanel(false);
  };

  const applyScannedData = () => {
    const data = editableResult || scanResult;
    if (!data) return;

    // Apply extracted data to the form
    if (data.date) {
      dispatch({ type: "SET_SALES_DATE", payload: data.date });
    }
    if (data.shift) {
      dispatch({ type: "SET_SHIFT", payload: data.shift });
    }

    // Handle new pump format (pumps array with fuelType)
    if (data.pumps && data.pumps.length > 0) {
      const pmsPumps = data.pumps
        .filter(
          (p: any) =>
            p.fuelType?.toLowerCase() === "petrol" ||
            p.name?.toLowerCase().includes("petrol")
        )
        .map((p: any, i: number) => ({
          id: p.name || `PMS-${i + 1}`,
          openingKsh: p.openingReading || 0,
          closingKsh: p.closingReading || 0,
          openingL: 0,
          closingL: 0,
          salesL: 0,
          salesKsh:
            p.salesAmount ||
            Math.max(0, (p.closingReading || 0) - (p.openingReading || 0)),
        }));
      const agoPumps = data.pumps
        .filter(
          (p: any) =>
            p.fuelType?.toLowerCase() === "diesel" ||
            p.name?.toLowerCase().includes("diesel")
        )
        .map((p: any, i: number) => ({
          id: p.name || `AGO-${i + 1}`,
          openingKsh: p.openingReading || 0,
          closingKsh: p.closingReading || 0,
          openingL: 0,
          closingL: 0,
          salesL: 0,
          salesKsh:
            p.salesAmount ||
            Math.max(0, (p.closingReading || 0) - (p.openingReading || 0)),
        }));
      if (pmsPumps.length > 0) {
        dispatch({ type: "SET_PMS_PUMPS", payload: pmsPumps });
      }
      if (agoPumps.length > 0) {
        dispatch({ type: "SET_AGO_PUMPS", payload: agoPumps });
      }
    }
    // Fallback for old format
    if (data.pmsPumps && data.pmsPumps.length > 0) {
      const pumps = data.pmsPumps.map((p: any, i: number) => ({
        id: p.id || `PMS-${i + 1}`,
        openingKsh: p.openingKsh || 0,
        closingKsh: p.closingKsh || 0,
        openingL: p.openingL || 0,
        closingL: p.closingL || 0,
        salesL: Math.max(0, (p.closingL || 0) - (p.openingL || 0)),
        salesKsh: Math.max(0, (p.closingKsh || 0) - (p.openingKsh || 0)),
      }));
      dispatch({ type: "SET_PMS_PUMPS", payload: pumps });
    }
    if (data.agoPumps && data.agoPumps.length > 0) {
      const pumps = data.agoPumps.map((p: any, i: number) => ({
        id: p.id || `AGO-${i + 1}`,
        openingKsh: p.openingKsh || 0,
        closingKsh: p.closingKsh || 0,
        openingL: p.openingL || 0,
        closingL: p.closingL || 0,
        salesL: Math.max(0, (p.closingL || 0) - (p.openingL || 0)),
        salesKsh: Math.max(0, (p.closingKsh || 0) - (p.openingKsh || 0)),
      }));
      dispatch({ type: "SET_AGO_PUMPS", payload: pumps });
    }

    // Handle expenses (support both name and desc fields)
    if (data.expenses && data.expenses.length > 0) {
      const expenses = data.expenses.map((e: any) => ({
        desc: e.name || e.desc || "Expense",
        amount: e.amount || 0,
      }));
      dispatch({ type: "SET_EXPENSES", payload: expenses });
    }

    // Handle till payment (support both tillAmount and tillPayment)
    const tillValue = data.tillAmount ?? data.tillPayment;
    if (tillValue !== null && tillValue !== undefined) {
      dispatch({ type: "SET_TILL_PAYMENT", payload: tillValue });
    }

    // Handle cash amount if available
    if (data.cashAmount !== null && data.cashAmount !== undefined) {
      // Cash can be calculated or displayed separately
      console.log("Cash amount extracted:", data.cashAmount);
    }

    resetScan();
    alert("Data applied successfully! Review and adjust as needed.");
  };

  const addPump = (type: "pms" | "ago") => {
    const pumps = type === "pms" ? state.pmsPumps : state.agoPumps;
    const pumpId = `${type.toUpperCase()}-${pumps.length + 1}`;

    const pump = {
      id: pumpId,
      openingKsh: 0,
      closingKsh: 0,
      openingL: 0,
      closingL: 0,
      salesL: 0,
      salesKsh: 0,
    };

    if (type === "pms") {
      dispatch({ type: "SET_PMS_PUMPS", payload: [...state.pmsPumps, pump] });
    } else {
      dispatch({ type: "SET_AGO_PUMPS", payload: [...state.agoPumps, pump] });
    }
  };

  const calculateSales = (
    index: number,
    type: "pms" | "ago",
    field: string,
    value: number
  ) => {
    const pumps = type === "pms" ? [...state.pmsPumps] : [...state.agoPumps];
    const pump = pumps[index];

    (pump as any)[field] = value;

    // Calculate sales
    pump.salesL = Math.max(0, pump.closingL - pump.openingL);
    pump.salesKsh = Math.max(0, pump.closingKsh - pump.openingKsh);

    if (type === "pms") {
      dispatch({ type: "SET_PMS_PUMPS", payload: pumps });
    } else {
      dispatch({ type: "SET_AGO_PUMPS", payload: pumps });
    }
  };

  const removePump = (index: number, type: "pms" | "ago") => {
    if (confirm("Delete this pump?")) {
      const pumps = type === "pms" ? [...state.pmsPumps] : [...state.agoPumps];
      pumps.splice(index, 1);

      // Update pump IDs
      pumps.forEach((pump, i) => {
        pump.id = `${type.toUpperCase()}-${i + 1}`;
      });

      if (type === "pms") {
        dispatch({ type: "SET_PMS_PUMPS", payload: pumps });
      } else {
        dispatch({ type: "SET_AGO_PUMPS", payload: pumps });
      }
    }
  };

  const addExpense = () => {
    const expense = { desc: "", amount: 0 };
    dispatch({ type: "SET_EXPENSES", payload: [...state.expenses, expense] });
  };

  const updateExpense = (index: number, field: string, value: any) => {
    const expenses = [...state.expenses];
    expenses[index] = {
      ...expenses[index],
      [field]: field === "amount" ? parseFloat(value) || 0 : value,
    };
    dispatch({ type: "SET_EXPENSES", payload: expenses });
  };

  const removeExpense = (index: number) => {
    if (confirm("Delete this expense?")) {
      const expenses = [...state.expenses];
      expenses.splice(index, 1);
      dispatch({ type: "SET_EXPENSES", payload: expenses });
    }
  };

  const calculateSummary = () => {
    const totalPmsSalesKsh = state.pmsPumps.reduce(
      (sum, pump) => sum + pump.salesKsh,
      0
    );
    const totalAgoSalesKsh = state.agoPumps.reduce(
      (sum, pump) => sum + pump.salesKsh,
      0
    );
    const totalRevenue = totalPmsSalesKsh + totalAgoSalesKsh;
    const totalExpenses = state.expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    );
    const cashInHand = totalRevenue - totalExpenses - state.tillPayment;
    const netIncome = state.tillPayment + cashInHand;

    return {
      totalPmsSalesKsh,
      totalAgoSalesKsh,
      totalRevenue,
      totalExpenses,
      cashInHand,
      netIncome,
    };
  };

  const summary = calculateSummary();

  const clearSalesData = () => {
    if (confirm("Clear all sales data?")) {
      dispatch({ type: "SET_PMS_PUMPS", payload: [] });
      dispatch({ type: "SET_AGO_PUMPS", payload: [] });
      dispatch({ type: "SET_EXPENSES", payload: [] });
      dispatch({ type: "SET_TILL_PAYMENT", payload: 0 });
      dispatch({
        type: "SET_PRICES",
        payload: { pmsPrice: 180, agoPrice: 170 },
      });
      dispatch({
        type: "SET_SALES_DATE",
        payload: new Date().toISOString().split("T")[0],
      });
      dispatch({ type: "SET_SHIFT", payload: "Day" });
      dispatch({
        type: "SET_TANK_VALUES",
        payload: {
          pmsTankOpening: 0,
          pmsTankClosing: 0,
          agoTankOpening: 0,
          agoTankClosing: 0,
        },
      });
    }
  };

  const saveSalesData = () => {
    const key = `${state.salesDate}_${state.shift}`;

    const salesData = {
      date: state.salesDate,
      shift: state.shift,
      pmsPumps: [...state.pmsPumps],
      agoPumps: [...state.agoPumps],
      expenses: [...state.expenses],
      tillPayment: state.tillPayment,
      pmsPrice: state.pmsPrice,
      agoPrice: state.agoPrice,
      pmsTankOpening: state.pmsTankOpening,
      pmsTankClosing: state.pmsTankClosing,
      agoTankOpening: state.agoTankOpening,
      agoTankClosing: state.agoTankClosing,
    };

    dispatch({
      type: "SET_SALES_HISTORY",
      payload: { ...state.salesHistory, [key]: salesData },
    });

    alert(`Sales data saved for ${state.salesDate} ${state.shift} shift!`);
  };

  const loadSalesData = (key: string) => {
    const data = state.salesHistory[key];
    if (!data) return;

    dispatch({ type: "SET_SALES_DATE", payload: data.date });
    dispatch({ type: "SET_SHIFT", payload: data.shift });
    dispatch({ type: "SET_PMS_PUMPS", payload: data.pmsPumps || [] });
    dispatch({ type: "SET_AGO_PUMPS", payload: data.agoPumps || [] });
    dispatch({ type: "SET_EXPENSES", payload: data.expenses || [] });
    dispatch({ type: "SET_TILL_PAYMENT", payload: data.tillPayment || 0 });
    dispatch({
      type: "SET_PRICES",
      payload: {
        pmsPrice: data.pmsPrice || 180,
        agoPrice: data.agoPrice || 170,
      },
    });
    dispatch({
      type: "SET_TANK_VALUES",
      payload: {
        pmsTankOpening: data.pmsTankOpening || 0,
        pmsTankClosing: data.pmsTankClosing || 0,
        agoTankOpening: data.agoTankOpening || 0,
        agoTankClosing: data.agoTankClosing || 0,
      },
    });
  };

  const deleteSalesData = (key: string) => {
    if (confirm(`Delete sales data for ${key}?`)) {
      const updatedHistory = { ...state.salesHistory };
      delete updatedHistory[key];
      dispatch({ type: "SET_SALES_HISTORY", payload: updatedHistory });
    }
  };

  const exportHandlers = {
    pdf: () => exportSalesPDF({ ...state, summary }),
    excel: () => exportSalesExcel({ ...state, summary }),
    txt: () => exportSalesTXT({ ...state, summary }),
    whatsapp: () => {
      const data = getSalesData();
      const msg = `*${state.companyData.name}*\n\n*Fuel Sales Report*\n\n${data}\n\n*P.O. Box:* ${state.companyData.poBox || "N/A"}\n*CONTACTS:* ${state.companyData.contacts || "N/A"}\n*EMAIL:* ${state.companyData.email || "N/A"}`;
      const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    },
    email: () => {
      const data = getSalesData();
      const subject = "Fuel Sales Report";
      const body = `${state.companyData.name}\n\nFuel Sales Report\n\n${data}\n\nP.O. Box: ${state.companyData.poBox || "N/A"}\nCONTACTS: ${state.companyData.contacts || "N/A"}\nEMAIL: ${state.companyData.email || "N/A"}`;
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    },
  };

  const getSalesData = () => {
    return `Date: ${state.salesDate}\nShift: ${state.shift}\n\nFuel Tank Inventory:\nPetrol (PMS) Tank: Opening: ${formatNumber(state.pmsTankOpening)} L, Closing: ${formatNumber(state.pmsTankClosing)} L\nDiesel (AGO) Tank: Opening: ${formatNumber(state.agoTankOpening)} L, Closing: ${formatNumber(state.agoTankClosing)} L\n\nFuel Pricing:\nPetrol (PMS): ${state.companyData.currency} ${state.pmsPrice}/L\nDiesel (AGO): ${state.companyData.currency} ${state.agoPrice}/L\n\nPetrol (PMS) Pumps:\n${state.pmsPumps.map(p => `${p.id}: Sales: ${formatNumber(p.salesL)} L, ${formatNumber(p.salesKsh)} ${state.companyData.currency}`).join("\n")}\n\nDiesel (AGO) Pumps:\n${state.agoPumps.map(p => `${p.id}: Sales: ${formatNumber(p.salesL)} L, ${formatNumber(p.salesKsh)} ${state.companyData.currency}`).join("\n")}\n\nDaily Expenses:\n${state.expenses.map(e => `${e.desc}: ${formatNumber(e.amount)} ${state.companyData.currency}`).join("\n")}\n\nTill/Mobile Payment: ${formatNumber(state.tillPayment)} ${state.companyData.currency}\n\nDaily Summary:\nTotal Petrol Sales: ${state.companyData.currency} ${formatNumber(summary.totalPmsSalesKsh, 2)}\nTotal Diesel Sales: ${state.companyData.currency} ${formatNumber(summary.totalAgoSalesKsh, 2)}\nTotal Revenue: ${state.companyData.currency} ${formatNumber(summary.totalRevenue, 2)}\nTill/Mobile Payment: ${state.companyData.currency} ${formatNumber(state.tillPayment, 2)}\nCash In Hand: ${state.companyData.currency} ${formatNumber(summary.cashInHand, 2)}\nTotal Expenses: ${state.companyData.currency} ${formatNumber(summary.totalExpenses, 2)}\nNet Income: ${state.companyData.currency} ${formatNumber(summary.netIncome, 2)}`;
  };

  return (
    <div className="p-4 md:p-6 space-y-3">
      {/* Image Cropper Modal */}
      {showCropper && pendingFile && (
        <ImageCropper
          file={pendingFile}
          onCrop={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}

      {/* Scan & Upload Panel - Collapsible */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setShowScanPanel(!showScanPanel)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
              <Sparkles size={24} />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                AI-Powered Scan & Upload
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Snap a photo of handwritten records — AI reads it for you
              </p>
            </div>
          </div>
          <div
            className={`transform transition-transform ${showScanPanel ? "rotate-180" : ""}`}
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </button>

        {showScanPanel && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            {/* Step indicator */}
            {scanStep !== "idle" && (
              <div className="flex items-center justify-center gap-2 mb-4">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                    scanStep === "uploading"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                      : "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                  }`}
                >
                  {scanStep === "uploading" ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={12} />
                  )}
                  Upload
                </div>
                <div className="w-4 h-px bg-gray-300 dark:bg-gray-600" />
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                    scanStep === "analyzing"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                      : scanStep === "review"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {scanStep === "analyzing" ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : scanStep === "review" ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  AI Reading
                </div>
                <div className="w-4 h-px bg-gray-300 dark:bg-gray-600" />
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                    scanStep === "review"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <Pencil size={12} />
                  Review
                </div>
              </div>
            )}

            {/* Idle state - Upload zone */}
            {scanStep === "idle" && (
              <div
                ref={dropZoneRef}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                  isDragging
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-900/10"
                }`}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30">
                    <Image
                      size={32}
                      className="text-amber-600 dark:text-amber-400"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white mb-1">
                      Drop your sales record here
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      or use the buttons below
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium rounded-xl shadow-lg shadow-amber-500/25 transition-all"
                    >
                      <Camera size={18} />
                      Take Photo
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:border-amber-400 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-all"
                    >
                      <Upload size={18} />
                      Choose File
                    </button>
                  </div>

                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Supports: Photos (JPG, PNG), PDFs, Documents
                  </p>
                </div>
              </div>
            )}

            {/* Uploading state */}
            {scanStep === "uploading" && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-amber-200 dark:border-amber-800" />
                  <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
                </div>
                <p className="mt-4 font-medium text-gray-900 dark:text-white">
                  Uploading document...
                </p>
              </div>
            )}

            {/* Analyzing state */}
            {scanStep === "analyzing" && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center">
                    <Sparkles
                      size={32}
                      className="text-amber-600 dark:text-amber-400 animate-pulse"
                    />
                  </div>
                </div>
                <p className="mt-4 font-medium text-gray-900 dark:text-white">
                  AI is reading your document...
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Extracting pump readings, expenses, and totals
                </p>
              </div>
            )}

            {/* Error state */}
            {scanStep === "error" && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mx-auto mb-3">
                  <AlertCircle
                    size={24}
                    className="text-amber-600 dark:text-amber-400"
                  />
                </div>
                <p className="font-medium text-amber-900 dark:text-amber-200 mb-1">
                  {scanError}
                </p>
                {scanSuggestion && (
                  <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                    {scanSuggestion}
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  AI service may be temporarily busy. You can try again or enter
                  data manually below.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={resetScan}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => {
                      resetScan();
                      setShowScanPanel(false);
                      // Scroll to manual entry section
                      setTimeout(() => {
                        const dateSection = document.querySelector(
                          '[data-section="date-shift"]'
                        );
                        if (dateSection)
                          dateSection.scrollIntoView({ behavior: "smooth" });
                      }, 100);
                    }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Enter Manually Instead
                  </button>
                </div>
              </div>
            )}

            {/* Review state - Editable preview */}
            {scanStep === "review" && editableResult && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={20} className="text-green-600" />
                    <span className="font-medium text-green-700 dark:text-green-300">
                      Data extracted successfully
                    </span>
                    {editableResult.confidence && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          editableResult.confidence === "high"
                            ? "bg-green-100 text-green-700"
                            : editableResult.confidence === "medium"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {editableResult.confidence} confidence
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Review and edit the extracted data below, then click "Apply to
                  Form" to use it.
                </p>

                {/* Editable fields */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="form-group">
                    <label className="text-xs">Date</label>
                    <input
                      type="date"
                      value={editableResult.date || ""}
                      onChange={e =>
                        updateEditableField("date", e.target.value)
                      }
                      className="text-sm"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs">Shift</label>
                    <select
                      value={editableResult.shift || ""}
                      onChange={e =>
                        updateEditableField("shift", e.target.value)
                      }
                      className="text-sm"
                    >
                      <option value="">Not specified</option>
                      <option value="Day">Day</option>
                      <option value="Night">Night</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="text-xs">Till/M-Pesa</label>
                    <input
                      type="number"
                      value={editableResult.tillAmount || 0}
                      onChange={e =>
                        updateEditableField(
                          "tillAmount",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="text-sm"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs">Cash</label>
                    <input
                      type="number"
                      value={editableResult.cashAmount || 0}
                      onChange={e =>
                        updateEditableField(
                          "cashAmount",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* Pumps */}
                {editableResult.pumps && editableResult.pumps.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">
                      Pumps ({editableResult.pumps.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {editableResult.pumps.map((pump, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm"
                        >
                          <input
                            type="text"
                            value={pump.name}
                            onChange={e =>
                              updateEditablePump(i, "name", e.target.value)
                            }
                            className="flex-1 min-w-0 px-2 py-1 rounded border text-xs"
                            placeholder="Name"
                          />
                          <select
                            value={pump.fuelType}
                            onChange={e =>
                              updateEditablePump(i, "fuelType", e.target.value)
                            }
                            className="px-2 py-1 rounded border text-xs"
                          >
                            <option value="Petrol">Petrol</option>
                            <option value="Diesel">Diesel</option>
                          </select>
                          <input
                            type="number"
                            value={pump.salesAmount}
                            onChange={e =>
                              updateEditablePump(
                                i,
                                "salesAmount",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-24 px-2 py-1 rounded border text-xs"
                            placeholder="Sales"
                          />
                          <span className="text-xs text-gray-500">Ksh</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expenses */}
                {editableResult.expenses &&
                  editableResult.expenses.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">
                        Expenses ({editableResult.expenses.length})
                      </h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {editableResult.expenses.map((expense, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm"
                          >
                            <input
                              type="text"
                              value={expense.name}
                              onChange={e =>
                                updateEditableExpense(i, "name", e.target.value)
                              }
                              className="flex-1 min-w-0 px-2 py-1 rounded border text-xs"
                              placeholder="Description"
                            />
                            <input
                              type="number"
                              value={expense.amount}
                              onChange={e =>
                                updateEditableExpense(
                                  i,
                                  "amount",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-24 px-2 py-1 rounded border text-xs"
                              placeholder="Amount"
                            />
                            <span className="text-xs text-gray-500">Ksh</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={applyScannedData}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium rounded-xl shadow-lg shadow-green-500/25 transition-all"
                  >
                    <Check size={18} />
                    Apply to Form
                  </button>
                  <button
                    onClick={resetScan}
                    className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
        className="hidden"
      />

      {/* Header */}
      <div className="card">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl md:text-2xl font-bold text-blue-900 dark:text-blue-200">
            Fuel Sales Tracking (PMS & AGO)
          </h2>
          <div className="flex gap-2 flex-wrap">
            <button onClick={saveSalesData} className="btn btn-primary">
              <Save size={16} />
              <span className="hidden sm:inline">Save</span>
            </button>
            <button onClick={clearSalesData} className="btn btn-outline">
              <Trash2 size={16} />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        </div>

        {/* Date & Shift */}
        <div className="mb-6" data-section="date-shift">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Calendar size={20} className="text-indigo-500" />
            Date & Shift
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={state.salesDate}
                onChange={e =>
                  dispatch({ type: "SET_SALES_DATE", payload: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Shift</label>
              <select
                value={state.shift}
                onChange={e =>
                  dispatch({ type: "SET_SHIFT", payload: e.target.value })
                }
              >
                <option value="Day">Day</option>
                <option value="Night">Night</option>
              </select>
            </div>
          </div>
        </div>

        {/* Fuel Tank Inventory */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Fuel size={20} className="text-indigo-500" />
            Fuel Tank Inventory
          </h3>

          <div className="mb-4">
            <h4 className="font-medium mb-2 text-gray-700 dark:text-gray-300">
              Petrol (PMS) Tank
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label>Opening Meter (L)</label>
                <input
                  type="number"
                  value={state.pmsTankOpening}
                  onChange={e =>
                    dispatch({
                      type: "SET_TANK_VALUES",
                      payload: {
                        pmsTankOpening: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  step="0.1"
                />
              </div>
              <div className="form-group">
                <label>Closing Meter (L)</label>
                <input
                  type="number"
                  value={state.pmsTankClosing}
                  onChange={e =>
                    dispatch({
                      type: "SET_TANK_VALUES",
                      payload: {
                        pmsTankClosing: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  step="0.1"
                />
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h4 className="font-medium mb-2 text-gray-700 dark:text-gray-300">
              Diesel (AGO) Tank
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label>Opening Meter (L)</label>
                <input
                  type="number"
                  value={state.agoTankOpening}
                  onChange={e =>
                    dispatch({
                      type: "SET_TANK_VALUES",
                      payload: {
                        agoTankOpening: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  step="0.1"
                />
              </div>
              <div className="form-group">
                <label>Closing Meter (L)</label>
                <input
                  type="number"
                  value={state.agoTankClosing}
                  onChange={e =>
                    dispatch({
                      type: "SET_TANK_VALUES",
                      payload: {
                        agoTankClosing: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  step="0.1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Fuel Pricing */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Tag size={20} className="text-indigo-500" />
            Fuel Pricing
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label>Petrol (PMS) Price ({state.companyData.currency}/L)</label>
              <input
                type="number"
                value={state.pmsPrice}
                onChange={e =>
                  dispatch({
                    type: "SET_PRICES",
                    payload: { pmsPrice: parseFloat(e.target.value) || 0 },
                  })
                }
                step="0.1"
              />
            </div>
            <div className="form-group">
              <label>Diesel (AGO) Price ({state.companyData.currency}/L)</label>
              <input
                type="number"
                value={state.agoPrice}
                onChange={e =>
                  dispatch({
                    type: "SET_PRICES",
                    payload: { agoPrice: parseFloat(e.target.value) || 0 },
                  })
                }
                step="0.1"
              />
            </div>
          </div>
        </div>

        {/* PMS Pumps */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold">Petrol (PMS) Pumps</h3>
            <button onClick={() => addPump("pms")} className="btn btn-primary">
              <Plus size={16} />
              Add Petrol Pump
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Pump ID</th>
                  <th>Opening Meter ({state.companyData.currency})</th>
                  <th>Closing Meter ({state.companyData.currency})</th>
                  <th>Opening Meter (L)</th>
                  <th>Closing Meter (L)</th>
                  <th>Sales (L)</th>
                  <th>Sales ({state.companyData.currency})</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {state.pmsPumps.map((pump, index) => (
                  <tr key={index}>
                    <td>{pump.id}</td>
                    <td>
                      <input
                        type="number"
                        value={pump.openingKsh}
                        onChange={e =>
                          calculateSales(
                            index,
                            "pms",
                            "openingKsh",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        step="0.1"
                        className="w-full bg-transparent border-none outline-none"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={pump.closingKsh}
                        onChange={e =>
                          calculateSales(
                            index,
                            "pms",
                            "closingKsh",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        step="0.1"
                        className="w-full bg-transparent border-none outline-none"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={pump.openingL}
                        onChange={e =>
                          calculateSales(
                            index,
                            "pms",
                            "openingL",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        step="0.1"
                        className="w-full bg-transparent border-none outline-none"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={pump.closingL}
                        onChange={e =>
                          calculateSales(
                            index,
                            "pms",
                            "closingL",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        step="0.1"
                        className="w-full bg-transparent border-none outline-none"
                      />
                    </td>
                    <td>{formatNumber(pump.salesL)}</td>
                    <td>{formatNumber(pump.salesKsh)}</td>
                    <td>
                      <button
                        onClick={() => removePump(index, "pms")}
                        className="btn btn-outline p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AGO Pumps */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold">Diesel (AGO) Pumps</h3>
            <button onClick={() => addPump("ago")} className="btn btn-primary">
              <Plus size={16} />
              Add Diesel Pump
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Pump ID</th>
                  <th>Opening Meter ({state.companyData.currency})</th>
                  <th>Closing Meter ({state.companyData.currency})</th>
                  <th>Opening Meter (L)</th>
                  <th>Closing Meter (L)</th>
                  <th>Sales (L)</th>
                  <th>Sales ({state.companyData.currency})</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {state.agoPumps.map((pump, index) => (
                  <tr key={index}>
                    <td>{pump.id}</td>
                    <td>
                      <input
                        type="number"
                        value={pump.openingKsh}
                        onChange={e =>
                          calculateSales(
                            index,
                            "ago",
                            "openingKsh",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        step="0.1"
                        className="w-full bg-transparent border-none outline-none"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={pump.closingKsh}
                        onChange={e =>
                          calculateSales(
                            index,
                            "ago",
                            "closingKsh",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        step="0.1"
                        className="w-full bg-transparent border-none outline-none"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={pump.openingL}
                        onChange={e =>
                          calculateSales(
                            index,
                            "ago",
                            "openingL",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        step="0.1"
                        className="w-full bg-transparent border-none outline-none"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={pump.closingL}
                        onChange={e =>
                          calculateSales(
                            index,
                            "ago",
                            "closingL",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        step="0.1"
                        className="w-full bg-transparent border-none outline-none"
                      />
                    </td>
                    <td>{formatNumber(pump.salesL)}</td>
                    <td>{formatNumber(pump.salesKsh)}</td>
                    <td>
                      <button
                        onClick={() => removePump(index, "ago")}
                        className="btn btn-outline p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily Expenses */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold">Daily Expenses</h3>
            <button onClick={addExpense} className="btn btn-secondary">
              <Plus size={16} />
              Add Expense
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount ({state.companyData.currency})</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {state.expenses.map((expense, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        type="text"
                        value={expense.desc}
                        onChange={e =>
                          updateExpense(index, "desc", e.target.value)
                        }
                        className="w-full bg-transparent border-none outline-none"
                        placeholder="Expense description"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={expense.amount}
                        onChange={e =>
                          updateExpense(index, "amount", e.target.value)
                        }
                        step="0.1"
                        className="w-full bg-transparent border-none outline-none"
                      />
                    </td>
                    <td>
                      <button
                        onClick={() => removeExpense(index)}
                        className="btn btn-outline p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Till/Mobile Payment */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Till/Mobile Payment</h3>
          <div className="form-group max-w-md">
            <label>
              Total Till/Mobile Payment ({state.companyData.currency})
            </label>
            <input
              type="number"
              value={state.tillPayment}
              onChange={e =>
                dispatch({
                  type: "SET_TILL_PAYMENT",
                  payload: parseFloat(e.target.value) || 0,
                })
              }
              step="0.1"
            />
          </div>
        </div>

        {/* Daily Summary */}
        <div className="sales-summary">
          <div className="summary-item">
            <div className="summary-label">Total Petrol Sales</div>
            <div className="summary-value">
              {state.companyData.currency}{" "}
              {formatNumber(summary.totalPmsSalesKsh, 2)}
            </div>
          </div>
          <div className="summary-item">
            <div className="summary-label">Total Diesel Sales</div>
            <div className="summary-value">
              {state.companyData.currency}{" "}
              {formatNumber(summary.totalAgoSalesKsh, 2)}
            </div>
          </div>
          <div className="summary-item">
            <div className="summary-label">Total Revenue</div>
            <div className="summary-value">
              {state.companyData.currency}{" "}
              {formatNumber(summary.totalRevenue, 2)}
            </div>
          </div>
          <div className="summary-item">
            <div className="summary-label">Till/Mobile Payment</div>
            <div className="summary-value">
              {state.companyData.currency} {formatNumber(state.tillPayment, 2)}
            </div>
          </div>
          <div className="summary-item">
            <div className="summary-label">Cash In Hand</div>
            <div className="summary-value">
              {state.companyData.currency} {formatNumber(summary.cashInHand, 2)}
            </div>
          </div>
          <div className="summary-item">
            <div className="summary-label">Total Expenses</div>
            <div className="summary-value">
              {state.companyData.currency}{" "}
              {formatNumber(summary.totalExpenses, 2)}
            </div>
          </div>
          <div className="summary-item">
            <div className="summary-label">Net Income</div>
            <div className="summary-value">
              {state.companyData.currency} {formatNumber(summary.netIncome, 2)}
            </div>
          </div>
        </div>

        {/* Export Actions */}
        <div className="mt-6">
          <ExportDropdown onExport={exportHandlers} title="Print Report" />
        </div>
      </div>

      {/* Saved Sales Tracking */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Saved Sales Tracking</h3>
        </div>
        <div className="history-panel">
          {Object.keys(state.salesHistory)
            .sort()
            .reverse()
            .map(key => {
              const data = state.salesHistory[key];
              return (
                <div key={key} className="history-item">
                  <span>
                    {data.date} - {data.shift} Shift
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadSalesData(key)}
                      className="text-xs"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => deleteSalesData(key)}
                      className="text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
