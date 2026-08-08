import { useState, useEffect } from "react";
import {
  Plus,
  Save,
  Trash2,
  MessageCircle,
  Bot,
  Send,
  Building2,
  Printer,
  Loader2,
} from "lucide-react";
import { useFuel } from "@/react-app/context/FuelContext";
import ExportDropdown from "@/react-app/components/ExportDropdown";
import {
  exportInvoicePDF,
  exportInvoiceExcel,
  exportInvoiceTXT,
} from "@/react-app/utils/exportUtils";
import { formatNumber } from "@/react-app/utils/formatUtils";
import { silentPrintService } from "@/react-app/lib/silent-print-service";

export default function Invoice() {
  const { state, dispatch } = useFuel();
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [quantityLabel, setQuantityLabel] = useState(
    state.invoiceSettings.quantityLabel
  );
  const [isPrinting, setIsPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    // Auto-fill today's date
    const today = new Date().toISOString().split("T")[0];
    setInvoiceDate(today);
  }, []);

  useEffect(() => {
    // Update quantity label when invoice settings change
    setQuantityLabel(state.invoiceSettings.quantityLabel);
  }, [state.invoiceSettings.quantityLabel]);

  const updateQuantityLabel = (newLabel: string) => {
    setQuantityLabel(newLabel);
    dispatch({
      type: "SET_INVOICE_SETTINGS",
      payload: { quantityLabel: newLabel },
    });
  };

  const getInvoiceNumber = () => {
    const num = String(state.invoiceCounter).padStart(3, "0");
    return `INV-${new Date().getFullYear()}-${num}`;
  };

  const addInvoiceItem = () => {
    const newItem = { desc: "", qty: 1, price: 0, total: 0 };
    dispatch({
      type: "SET_INVOICE_ITEMS",
      payload: [...state.invoiceItems, newItem],
    });
  };

  const updateInvoiceItem = (index: number, field: string, value: any) => {
    const item = state.invoiceItems[index];
    let newValue: any = value;
    
    if (field === "qty" || field === "price") {
      newValue = parseFloat(value) || 0;
    }

    // Create new item object to ensure React detects the change
    const updatedItem = {
      ...item,
      [field]: newValue,
      total: field === "qty" || field === "price"
        ? Math.round((field === "qty" ? (parseFloat(value) || 0) : item.qty) * (field === "price" ? (parseFloat(value) || 0) : item.price) * 100) / 100
        : item.total
    };

    // Recalculate total if qty or price changed
    if (field === "qty" || field === "price") {
      const qty = field === "qty" ? newValue : item.qty;
      const price = field === "price" ? newValue : item.price;
      updatedItem.total = Math.round((qty * price) * 100) / 100;
    }

    const updatedItems = [...state.invoiceItems];
    updatedItems[index] = updatedItem;

    dispatch({ type: "SET_INVOICE_ITEMS", payload: updatedItems });
  };

  const deleteInvoiceItem = (index: number) => {
    const updatedItems = [...state.invoiceItems];
    updatedItems.splice(index, 1);
    dispatch({ type: "SET_INVOICE_ITEMS", payload: updatedItems });
  };

  const calculateTotals = () => {
    // FIX: Round to 2 decimal places to prevent floating point errors
    const totalDue = Math.round(
      state.invoiceItems.reduce((sum, item) => sum + item.total, 0) * 100
    ) / 100;
    return { totalDue };
  };

  const { totalDue } = calculateTotals();

  const saveInvoice = () => {
    if (!customerName || state.invoiceItems.length === 0) {
      alert("Please add customer details and invoice items before saving.");
      return;
    }

    const invNum = getInvoiceNumber();
    const invoiceData = {
      customer: {
        name: customerName,
        address: customerAddress,
        phone: customerPhone,
      },
      date: invoiceDate,
      items: [...state.invoiceItems],
      quantityLabel: quantityLabel,
      total: `Ksh${formatNumber(totalDue, 0)}`,
      totalAmount: totalDue,
    };

    dispatch({
      type: "SET_INVOICES",
      payload: { ...state.invoices, [invNum]: invoiceData },
    });

    dispatch({
      type: "SET_INVOICE_COUNTER",
      payload: state.invoiceCounter + 1,
    });

    alert(`Invoice ${invNum} saved successfully!`);
  };

  // Silent print invoice using print service
  const handleSilentPrint = async () => {
    if (!customerName || state.invoiceItems.length === 0) {
      setPrintError("Please add customer details and invoice items before printing.");
      return;
    }

    setIsPrinting(true);
    setPrintError(null);

    try {
      const invoiceData = {
        invoiceNumber: getInvoiceNumber(),
        stationName: state.companyData.name || 'FuelPro Station',
        stationLocation: state.companyData.poBox || state.companyData.physicalAddress || state.companyData.town || '',
        date: invoiceDate,
        time: new Date().toLocaleTimeString(),
        customerName,
        customerAddress,
        customerPhone,
        items: state.invoiceItems.map(item => ({
          desc: item.desc || item.name || '',
          qty: item.qty || 1,
          price: item.price || 0,
          total: item.total || (item.qty * item.price),
        })),
        subtotal: totalDue,
        tax: 0,
        discount: 0,
        totalDue: totalDue,
        currency: state.companyData.currency || 'Ksh',
        attendantName: 'System',
        footerMessage: 'Thank you for your business',
      };

      await silentPrintService.queueInvoice(invoiceData);
      
      // Show brief success indicator
      setTimeout(() => {
        setIsPrinting(false);
      }, 1500);
    } catch (error) {
      console.error("Print error:", error);
      setPrintError(error instanceof Error ? error.message : "Print failed");
      setIsPrinting(false);
    }
  };

  const loadInvoice = (num: string) => {
    const inv = state.invoices[num];
    if (!inv) return;

    setCustomerName(inv.customer.name);
    setCustomerAddress(inv.customer.address);
    setCustomerPhone(inv.customer.phone);
    setInvoiceDate(inv.date);

    // Load custom quantity label if saved with invoice
    if (inv.quantityLabel) {
      setQuantityLabel(inv.quantityLabel);
      dispatch({
        type: "SET_INVOICE_SETTINGS",
        payload: { quantityLabel: inv.quantityLabel },
      });
    }

    dispatch({ type: "SET_INVOICE_ITEMS", payload: inv.items });
  };

  const deleteInvoice = (num: string) => {
    if (confirm(`Delete invoice ${num}?`)) {
      const updatedInvoices = { ...state.invoices };
      delete updatedInvoices[num];
      dispatch({ type: "SET_INVOICES", payload: updatedInvoices });
    }
  };

  const editBankInfo = () => {
    const bankName =
      prompt("Bank Name:", state.companyData.bankName) ||
      state.companyData.bankName;
    const branchName =
      prompt("Branch Name:", state.companyData.branchName) ||
      state.companyData.branchName;
    const accountHolder =
      prompt("Account Holder Name:", state.companyData.accountHolder) ||
      state.companyData.accountHolder;
    const accountNumber =
      prompt("Account Number:", state.companyData.accountNumber) ||
      state.companyData.accountNumber;

    dispatch({
      type: "SET_COMPANY_DATA",
      payload: {
        ...state.companyData,
        bankName,
        branchName,
        accountHolder,
        accountNumber,
      },
    });

    alert("Bank details updated successfully!");
  };

  const sendAIMessage = async () => {
    if (!aiMessage.trim() || aiLoading) return;

    setAiLoading(true);
    setAiResponse("");

    try {
      const invoiceContext = {
        invoiceNumber: getInvoiceNumber(),
        customer: customerName,
        items: state.invoiceItems,
        total: totalDue,
        date: invoiceDate,
      };

      // Local AI analysis for invoice
      await new Promise(r => setTimeout(r, 800));
      const items = state.invoiceItems;
      const itemSummary = items
        .map(
          (item: any, i: number) =>
            `${i + 1}. ${item.name}: ${item.qty} x Ksh ${item.price?.toLocaleString()} = Ksh ${(item.qty * item.price)?.toLocaleString()}`
        )
        .join("\n");
      const vatTotal = items.reduce((s: number, i: any) => s + (i.vat || 0), 0);
      const localResponse = `**Invoice Analysis**\n\n**Invoice #${getInvoiceNumber()}**\n**Customer:** ${customerName || "Walk-in"}\n**Date:** ${invoiceDate}\n\n**Items (${items.length}):**\n${itemSummary}\n\n**Totals:**\n• Subtotal: Ksh ${(totalDue - vatTotal)?.toLocaleString()}\n• VAT: Ksh ${vatTotal?.toLocaleString()}\n• **Total Due: Ksh ${totalDue?.toLocaleString()}**\n\n💡 *Add more items or proceed to save this invoice.*`;
      setAiResponse(localResponse);
      /*
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: aiMessage,
          context: { type: 'invoice_analysis', invoice_data: invoiceContext, timestamp: new Date().toISOString() }
        }),
      });
      const data = await response.json();
      setAiResponse(data.response || 'AI Assistant is currently offline.');
      */
    } catch (error) {
      console.error("AI Error:", error);
      setAiResponse(
        "FuelPro AI Assistant is temporarily unavailable. Please check your subscription or try again later."
      );
    } finally {
      setAiLoading(false);
      setAiMessage("");
    }
  };

  const exportHandlers = {
    pdf: () => {
      if (!customerName || state.invoiceItems.length === 0) {
        alert(
          "Please add customer details and invoice items before exporting."
        );
        return;
      }
      exportInvoicePDF({
        ...state,
        customerName,
        customerAddress,
        customerPhone,
        invoiceDate,
        totalDue,
        invoiceNumber: getInvoiceNumber(),
        invoiceItems: state.invoiceItems,
        quantityLabel: quantityLabel,
      });
    },
    excel: () => {
      if (!customerName || state.invoiceItems.length === 0) {
        alert(
          "Please add customer details and invoice items before exporting."
        );
        return;
      }
      exportInvoiceExcel({
        ...state,
        customerName,
        customerAddress,
        customerPhone,
        invoiceDate,
        invoiceNumber: getInvoiceNumber(),
        invoiceItems: state.invoiceItems,
        quantityLabel: quantityLabel,
        totalDue,
      });
    },
    txt: () => {
      if (!customerName || state.invoiceItems.length === 0) {
        alert(
          "Please add customer details and invoice items before exporting."
        );
        return;
      }
      exportInvoiceTXT({
        ...state,
        customerName,
        customerAddress,
        customerPhone,
        invoiceDate,
        invoiceNumber: getInvoiceNumber(),
        invoiceItems: state.invoiceItems,
        quantityLabel: quantityLabel,
        totalDue,
      });
    },
    whatsapp: () => {
      if (!customerName || state.invoiceItems.length === 0) {
        alert("Please add customer details and invoice items before sharing.");
        return;
      }
      const data = getInvoiceData();
      const companyName = state.companyData.name;
      if (!companyName) {
        alert("Please set your company name in business info before sharing.");
        return;
      }
      const msg = `*${companyName}*\n\n*INVOICE ${getInvoiceNumber()}*\n\n${data}\n\n*CONTACTS:* ${state.companyData.contacts}\n*EMAIL:* ${state.companyData.email}`;
      const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    },
    email: () => {
      if (!customerName || state.invoiceItems.length === 0) {
        alert("Please add customer details and invoice items before emailing.");
        return;
      }
      const data = getInvoiceData();
      const companyName = state.companyData.name;
      if (!companyName) {
        alert("Please set your company name in business info before emailing.");
        return;
      }
      const subject = `Invoice ${getInvoiceNumber()} from ${companyName}`;
      const body = `Dear ${customerName},\n\nPlease find your invoice details below:\n\n${data}\n\nThank you for your business!\n\nBest regards,\n${companyName}\n\nContacts: ${state.companyData.contacts}\nEmail: ${state.companyData.email}`;
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    },
  };

  const getInvoiceData = () => {
    const itemsList = state.invoiceItems
      .map(
        i =>
          `${i.desc} | ${i.qty} ${quantityLabel.replace("Qty ", "").replace("(", "").replace(")", "")} | Ksh${formatNumber(i.price, 0)} | Ksh${formatNumber(i.total, 0)}`
      )
      .join("\n");

    return `Bill To: ${customerName}\nInvoice #: ${getInvoiceNumber()}\nDate: ${invoiceDate}\n\nDescription | ${quantityLabel} | Unit Price | Total\n${itemsList}\n\n Total Due: Ksh${formatNumber(totalDue, 0)}`;
  };

  return (
    <div className="p-6 space-y-3">
      {/* Professional Invoice Preview */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8 max-w-4xl mx-auto">
        {/* Logo and Company Header */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex-1">
            {state.companyData.logo && (
              <img
                src={state.companyData.logo}
                alt="Logo"
                className="h-16 w-auto mb-4"
              />
            )}
            <div className="text-3xl font-bold text-blue-900 mb-2">INVOICE</div>
            {state.companyData.name && (
              <div className="text-xl font-semibold text-gray-800 mb-2">
                {state.companyData.name}
              </div>
            )}
            {(state.companyData.poBox || state.companyData.contacts) && (
              <div className="text-sm text-gray-600 mb-1">
                {state.companyData.poBox &&
                  `P.O. Box: ${state.companyData.poBox}`}
                {state.companyData.poBox && state.companyData.contacts && " "}
                {state.companyData.contacts}
              </div>
            )}
            {state.companyData.email && (
              <div className="text-sm text-gray-600">
                {state.companyData.email}
              </div>
            )}
          </div>
        </div>

        {/* Invoice Details */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <div className="font-semibold text-gray-800 mb-4">Bill To:</div>
            <div className="space-y-2">
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Client Name"
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={customerAddress}
                onChange={e => setCustomerAddress(e.target.value)}
                placeholder="Client Address"
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="Phone Number"
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="text-right">
            <div className="space-y-2">
              <div className="flex justify-end">
                <span className="font-semibold mr-4">Invoice #:</span>
                <span className="bg-gray-100 px-3 py-1 rounded">
                  {getInvoiceNumber()}
                </span>
              </div>
              <div className="flex justify-end">
                <span className="font-semibold mr-4">Date:</span>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quantity Label Customization */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-blue-900 dark:text-blue-200 whitespace-nowrap">
              Quantity Column Label:
            </label>
            <input
              type="text"
              value={quantityLabel}
              onChange={e => updateQuantityLabel(e.target.value)}
              placeholder="e.g., Qty (DAYS), Litres, Units, Hours"
              className="flex-1 px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <div className="text-xs text-blue-700 dark:text-blue-300">
              This label will appear in all exports (PDF, Excel, TXT)
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-8">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 p-3 text-left font-semibold">
                  Description
                </th>
                <th className="border border-gray-300 p-3 text-center font-semibold">
                  {quantityLabel}
                </th>
                <th className="border border-gray-300 p-3 text-right font-semibold">
                  Unit Price
                </th>
                <th className="border border-gray-300 p-3 text-right font-semibold">
                  Total
                </th>
                <th className="border border-gray-300 p-3 text-center font-semibold w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {state.invoiceItems.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-3">
                    <input
                      type="text"
                      value={item.desc}
                      onChange={e =>
                        updateInvoiceItem(index, "desc", e.target.value)
                      }
                      className="w-full bg-transparent border-none outline-none"
                      placeholder="Item description"
                    />
                  </td>
                  <td className="border border-gray-300 p-3 text-center">
                    <input
                      type="number"
                      value={item.qty ?? ""}
                      onChange={e =>
                        updateInvoiceItem(index, "qty", e.target.value)
                      }
                      className="w-full bg-transparent border-none outline-none text-center cursor-text"
                      min="0"
                      step="1"
                    />
                  </td>
                  <td className="border border-gray-300 p-3 text-right">
                    <div className="flex items-center justify-end">
                      <span className="mr-1">Ksh</span>
                      <input
                        type="number"
                        value={item.price ?? ""}
                        onChange={e =>
                          updateInvoiceItem(index, "price", e.target.value)
                        }
                        className="w-24 bg-transparent border-none outline-none text-right cursor-text"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </td>
                  <td className="border border-gray-300 p-3 text-right font-medium">
                    Ksh{formatNumber(item.total, 0)}
                  </td>
                  <td className="border border-gray-300 p-3 text-center">
                    <button
                      onClick={() => deleteInvoiceItem(index)}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Delete item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex justify-between items-center">
            <button onClick={addInvoiceItem} className="btn btn-primary">
              <Plus size={16} />
              Add Item
            </button>

            <div className="text-right">
              <div className="text-2xl font-bold text-blue-900">
                Total Due: Ksh{formatNumber(totalDue, 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Payment Information */}
        <div className="border-t border-gray-300 pt-6">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-4">
              <div className="font-semibold text-gray-800">
                Payment Should Be Made Through
              </div>
              <button
                onClick={editBankInfo}
                className="btn btn-outline btn-sm"
                title="Edit bank details"
              >
                <Building2 size={14} />
                Edit Bank Details
              </button>
            </div>

            {state.companyData.bankName ||
            state.companyData.branchName ||
            state.companyData.accountHolder ||
            state.companyData.accountNumber ? (
              <div className="space-y-1 text-sm text-gray-700">
                {state.companyData.bankName && (
                  <div>
                    <strong>BANK:</strong> {state.companyData.bankName}
                  </div>
                )}
                {state.companyData.branchName && (
                  <div>
                    <strong>BRANCH:</strong> {state.companyData.branchName}
                  </div>
                )}
                {state.companyData.accountHolder && (
                  <div>{state.companyData.accountHolder}</div>
                )}
                {state.companyData.accountNumber && (
                  <div>
                    <strong>ACCOUNT NO:</strong>{" "}
                    {state.companyData.accountNumber}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500 text-sm italic">
                Click "Edit Bank Details" to add payment information
              </div>
            )}
          </div>

          <div className="mt-8 pt-4">
            <div className="text-sm text-gray-600">Signature:…………………………..</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Save Invoice */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Save Invoice</h3>
            <button onClick={saveInvoice} className="btn btn-primary">
              <Save size={16} />
              Save
            </button>
          </div>
          <div className="text-sm text-gray-600">
            Save this invoice to your records and generate the invoice number.
          </div>
        </div>

        {/* Silent Print */}
        <div className="card">
          <div className="mb-4">
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Printer size={20} className="text-blue-600" />
              Silent Print
            </h3>
            <div className="text-sm text-gray-600 mb-4">
              Print directly to connected printer (works offline)
            </div>
          </div>
          <button
            onClick={handleSilentPrint}
            disabled={isPrinting || !customerName || state.invoiceItems.length === 0}
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            {isPrinting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Printing...
              </>
            ) : (
              <>
                <Printer size={16} />
                Print Invoice
              </>
            )}
          </button>
          {printError && (
            <div className="mt-2 text-sm text-red-600">{printError}</div>
          )}
        </div>

        {/* Export Options */}
        <div className="card">
          <div className="mb-4">
            <h3 className="text-xl font-bold mb-2">Export Invoice</h3>
            <div className="text-sm text-gray-600 mb-4">
              Export invoice in multiple formats for sharing and printing.
            </div>
          </div>
          <ExportDropdown onExport={exportHandlers} title="Export Invoice" />
        </div>

        {/* AI Assistant */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Bot className="text-blue-600" size={20} />
              AI Assistant
            </h3>
            <button
              onClick={() => setShowAIAssistant(!showAIAssistant)}
              className="btn btn-outline"
            >
              <MessageCircle size={16} />
              {showAIAssistant ? "Hide" : "Show"}
            </button>
          </div>

          {showAIAssistant && (
            <div className="space-y-2">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg min-h-[120px]">
                {aiResponse ? (
                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {aiResponse}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm italic">
                    Ask FuelPro AI about this invoice - analysis, calculations,
                    payment terms, or business insights...
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiMessage}
                  onChange={e => setAiMessage(e.target.value)}
                  placeholder="Ask FuelPro AI about this invoice..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  onKeyPress={e => e.key === "Enter" && sendAIMessage()}
                  disabled={aiLoading}
                />
                <button
                  onClick={sendAIMessage}
                  disabled={aiLoading || !aiMessage.trim()}
                  className="btn btn-primary px-4"
                >
                  {aiLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </div>

              <div className="text-xs text-gray-500">
                FuelPro AI powered by Google Gemini AI - Invoice analysis,
                payment insights, and business recommendations.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Saved Invoices */}
      {Object.keys(state.invoices).length > 0 && (
        <div className="card">
          <h3 className="text-xl font-bold mb-4">Saved Invoices</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.keys(state.invoices).map(key => (
              <div
                key={key}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="font-semibold text-blue-900 mb-2">{key}</div>
                <div className="text-sm text-gray-600 mb-2">
                  Customer: {state.invoices[key].customer?.name || "N/A"}
                </div>
                <div className="text-sm font-medium text-green-600 mb-3">
                  {state.invoices[key].total || "Ksh0"}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadInvoice(key)}
                    className="btn btn-sm btn-outline flex-1"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => deleteInvoice(key)}
                    className="btn btn-sm btn-outline text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
