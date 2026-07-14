import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Mic,
  MicOff,
  X,
  Volume2,
  VolumeX,
  Bot,
  User,
  Minimize2,
  Maximize2,
  Sparkles,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useFuel } from "@/react-app/context/FuelContext";

// Declare Speech Recognition types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface SpeechRecognitionResult {
  [index: number]: {
    transcript: string;
    confidence: number;
  };
  length: number;
}

interface SpeechRecognitionEvent {
  results: {
    [index: number]: SpeechRecognitionResult;
    length: number;
  };
}

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  errorCode?: string;
  canRetry?: boolean;
  suggestions?: string[];
  isError?: boolean;
}

export default function AIChatbot() {
  const { state } = useFuel();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "assistant",
      content:
        "Hello! I'm your FuelPro AI Assistant powered by Google Gemini. I have access to all your business data - sales, deliveries, invoices, M-PESA transactions, payroll, and more. Ask me anything about your fuel station operations!",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "error" | "checking"
  >("connected");
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(
    null
  );
  const [retryCount, setRetryCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Build comprehensive business context from ALL state data - dynamically includes all tabs
  const buildBusinessContext = () => {
    const context: any = {
      timestamp: new Date().toISOString(),
      businessName: state.companyData.name || "Fuel Station",
      currency: state.companyData.currency || "Ksh",
      theme: state.theme,
      currentDate: state.salesDate,
      currentShift: state.shift,
    };

    // Available Tabs Configuration (for AI to know what features exist)
    context.availableTabs = state.tabConfigurations
      .filter(t => t.visible)
      .map(t => ({ id: t.id, name: t.label, description: t.description }));

    // Company Information (complete)
    context.company = {
      name: state.companyData.name,
      contacts: state.companyData.contacts,
      email: state.companyData.email,
      physicalAddress: state.companyData.physicalAddress,
      poBox: state.companyData.poBox,
      county: state.companyData.county,
      town: state.companyData.town,
      kraPin: state.companyData.kraPin,
      vatRegNo: state.companyData.vatRegNo,
      etrSerialNo: state.companyData.etrSerialNo,
      bank: state.companyData.bankName
        ? {
            name: state.companyData.bankName,
            branch: state.companyData.branchName,
            accountHolder: state.companyData.accountHolder,
            accountNumber: state.companyData.accountNumber,
          }
        : null,
    };

    // Fuel Prices & Tank Levels
    context.fuelPrices = {
      petrol: state.petrolPrice || state.pmsPrice,
      diesel: state.dieselPrice || state.agoPrice,
      pms: state.pmsPrice,
      ago: state.agoPrice,
    };

    context.tankLevels = {
      pms: {
        opening: state.pmsTankOpening,
        closing: state.pmsTankClosing,
        consumed: state.pmsTankOpening - state.pmsTankClosing,
      },
      ago: {
        opening: state.agoTankOpening,
        closing: state.agoTankClosing,
        consumed: state.agoTankOpening - state.agoTankClosing,
      },
    };

    // TODAY'S SALES - Full pump details
    const pmsTotal = state.pmsPumps.reduce(
      (sum, p) => sum + (Number(p.salesKsh) || 0),
      0
    );
    const agoTotal = state.agoPumps.reduce(
      (sum, p) => sum + (Number(p.salesKsh) || 0),
      0
    );
    const pmsLitres = state.pmsPumps.reduce(
      (sum, p) => sum + (Number(p.salesL) || 0),
      0
    );
    const agoLitres = state.agoPumps.reduce(
      (sum, p) => sum + (Number(p.salesL) || 0),
      0
    );
    const totalExpenses = state.expenses.reduce(
      (sum, e) => sum + (Number(e.amount) || 0),
      0
    );

    context.todaySales = {
      date: state.salesDate,
      shift: state.shift,
      petrol: {
        litres: pmsLitres,
        amount: pmsTotal,
        pumpCount: state.pmsPumps.length,
        pumps: state.pmsPumps,
      },
      diesel: {
        litres: agoLitres,
        amount: agoTotal,
        pumpCount: state.agoPumps.length,
        pumps: state.agoPumps,
      },
      totalLitres: pmsLitres + agoLitres,
      totalRevenue: pmsTotal + agoTotal,
      tillPayment: state.tillPayment,
      cashInHand: pmsTotal + agoTotal - totalExpenses - state.tillPayment,
      expenses: state.expenses,
      totalExpenses,
      netIncome:
        state.tillPayment +
        (pmsTotal + agoTotal - totalExpenses - state.tillPayment),
    };

    // DELIVERY TRACKER - All delivery data
    if (state.deliveryData.rows.length > 0) {
      const deliveries = state.deliveryData.rows;
      const totalSupplied = deliveries.reduce(
        (sum, d) => sum + (Number(d.amount) || 0),
        0
      );
      const totalDebt = deliveries.reduce(
        (sum, d) => sum + (Number(d.debt) || 0),
        0
      );
      const uniqueCustomers = [...new Set(deliveries.map(d => d.name))].filter(
        n => n
      );

      context.deliveryTracker = {
        totalRecords: deliveries.length,
        totalSupplied,
        totalDebt,
        uniqueCustomers: uniqueCustomers.length,
        customerNames: uniqueCustomers,
        deliveryYear: state.deliveryYear,
        deliveredTo: state.deliveredTo,
        totalOrder: state.totalOrder,
        totals: state.deliveryData.totals,
        recentDeliveries: deliveries.slice(-10),
      };
    }

    // CLIENTS - Full client data with debt details
    if (Object.keys(state.clients).length > 0) {
      const clientsList = Object.entries(state.clients).map(
        ([name, data]: [string, any]) => ({
          name,
          phone: data.phone,
          balance: data.balance || 0,
          deliveryCount: data.deliveries?.length || 0,
          recentDeliveries: data.deliveries?.slice(-3),
        })
      );

      const clientsWithDebt = clientsList.filter(c => c.balance > 0);

      context.clients = {
        totalClients: clientsList.length,
        clientsWithDebt: clientsWithDebt.length,
        totalDebtAmount: clientsWithDebt.reduce((sum, c) => sum + c.balance, 0),
        topDebtors: clientsWithDebt
          .sort((a, b) => b.balance - a.balance)
          .slice(0, 10),
        allClients: clientsList,
      };
    }

    // INVOICES - Current and history
    context.invoices = {
      currentItems: state.invoiceItems,
      currentTotal: state.invoiceItems.reduce(
        (sum, item) => sum + (Number(item.total) || 0),
        0
      ),
      invoiceCounter: state.invoiceCounter,
      invoiceSettings: state.invoiceSettings,
      savedInvoices: Object.keys(state.invoices).length,
      invoiceHistory: state.invoices,
    };

    // DEBT HISTORY
    if (Object.keys(state.debtHistory).length > 0) {
      context.debtHistory = {
        totalRecords: Object.keys(state.debtHistory).length,
        history: state.debtHistory,
      };
    }

    // OFFLOADING RECORDS - Fuel received from suppliers
    if (state.offloadingRecords.length > 0) {
      const totalOffloaded = state.offloadingRecords.reduce(
        (sum, r) => sum + (Number(r.quantity) || 0),
        0
      );
      const totalCost = state.offloadingRecords.reduce(
        (sum, r) => sum + (Number(r.totalAmount) || 0),
        0
      );
      const suppliers = [
        ...new Set(state.offloadingRecords.map(r => r.supplier)),
      ].filter(s => s);

      context.offloading = {
        totalRecords: state.offloadingRecords.length,
        totalLitres: totalOffloaded,
        totalCost,
        suppliers,
        records: state.offloadingRecords.slice(-10),
      };
    }

    // M-PESA TRANSACTIONS - All transaction data
    if (state.mpesaTransactions.length > 0) {
      const totalMpesa = state.mpesaTransactions.reduce(
        (sum, t) => sum + (Number(t.amount) || 0),
        0
      );
      context.mpesaTransactions = {
        totalTransactions: state.mpesaTransactions.length,
        totalAmount: totalMpesa,
        transactions: state.mpesaTransactions.slice(-20),
      };
    }

    // EMPLOYEES & PAYROLL
    if (state.employees.length > 0) {
      const totalPayroll = state.employees.reduce(
        (sum, e) => sum + (Number(e.basicSalary) || 0),
        0
      );
      const activeEmployees = state.employees.filter(e => e.isActive);

      context.payroll = {
        totalEmployees: state.employees.length,
        activeEmployees: activeEmployees.length,
        totalMonthlyPayroll: totalPayroll,
        positions: [...new Set(state.employees.map(e => e.position))].filter(
          r => r
        ),
        employees: state.employees,
        payrollRecords: state.payrollRecords.slice(-20),
      };
    }

    // SALES HISTORY - Historical records
    if (Object.keys(state.salesHistory).length > 0) {
      const salesDates = Object.keys(state.salesHistory).sort();
      const recentSales = salesDates.slice(-10).map(key => ({
        key,
        ...state.salesHistory[key],
      }));

      context.salesHistory = {
        totalDaysRecorded: salesDates.length,
        dateRange: {
          from: salesDates[0],
          to: salesDates[salesDates.length - 1],
        },
        recentRecords: recentSales,
      };
    }

    // REPORT SETTINGS
    context.reportSettings = state.reportSettings;

    // USER PREFERENCES
    context.userPreferences = state.userPreferences;

    // SIGNATURES
    if (state.signatures.manager || state.signatures.director) {
      context.signatures = {
        hasManager: !!state.signatures.manager,
        hasDirector: !!state.signatures.director,
      };
    }

    // DATA BACKUPS
    if (state.dataBackups.length > 0) {
      context.dataBackups = {
        count: state.dataBackups.length,
        lastBackup: state.dataBackups[state.dataBackups.length - 1]?.date,
      };
    }

    return context;
  };

  // Initialize speech recognition and synthesis
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Speech Recognition
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript;
          setInputMessage(transcript);
          setIsListening(false);
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }

      // Speech Synthesis
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Local AI response generator - analyzes business data and generates intelligent responses
  const generateLocalResponse = (message: string, context: any): string => {
    const lowerMsg = message.toLowerCase();
    const currency = context.currency || "Ksh";
    const {
      todaySales,
      deliveryTracker,
      invoices,
      fuelPrices,
      tankLevels,
      payroll,
      offloading,
      salesHistory,
    } = context;

    // Today's Sales queries
    if (
      lowerMsg.includes("today") &&
      (lowerMsg.includes("sale") ||
        lowerMsg.includes("revenue") ||
        lowerMsg.includes("income"))
    ) {
      if (!todaySales || todaySales.totalRevenue === 0) {
        return `**Today's Sales Summary**\n\nNo sales have been recorded for today (${context.currentDate}).\n\nTo record sales:\n1. Go to **Sales Tracking** tab\n2. Enter pump opening and closing readings\n3. Add any expenses\n4. Save the data\n\nCurrent fuel prices:\n• Petrol (PMS): ${currency} ${fuelPrices?.petrol || "N/A"}/L\n• Diesel (AGO): ${currency} ${fuelPrices?.diesel || "N/A"}/L`;
      }
      return `**Today's Sales Summary**\n\n**Date:** ${todaySales.date} (${todaySales.shift} Shift)\n\n**Petrol (PMS):**\n• Litres: ${todaySales.petrol?.litres?.toLocaleString() || 0} L\n• Amount: ${currency} ${todaySales.petrol?.amount?.toLocaleString() || 0}\n• Pumps: ${todaySales.petrol?.pumpCount || 0}\n\n🛢️ **Diesel (AGO):**\n• Litres: ${todaySales.diesel?.litres?.toLocaleString() || 0} L\n• Amount: ${currency} ${todaySales.diesel?.amount?.toLocaleString() || 0}\n• Pumps: ${todaySales.diesel?.pumpCount || 0}\n\n💰 **Totals:**\n• Total Revenue: ${currency} ${todaySales.totalRevenue?.toLocaleString()}\n• Till/M-Pesa: ${currency} ${todaySales.tillPayment?.toLocaleString()}\n• Total Expenses: ${currency} ${todaySales.totalExpenses?.toLocaleString()}\n• Cash in Hand: ${currency} ${todaySales.cashInHand?.toLocaleString()}\n• Net Income: ${currency} ${todaySales.netIncome?.toLocaleString()}`;
    }

    // Debt queries
    if (
      lowerMsg.includes("debt") ||
      lowerMsg.includes("outstanding") ||
      lowerMsg.includes("owe")
    ) {
      if (!deliveryTracker || deliveryTracker.totalDebt === 0) {
        return `**Debt Status**\n\nNo outstanding debts recorded.\n\nTo track customer debts:\n1. Go to **Delivery Tracker** tab\n2. Add deliveries with customer names\n3. The system will auto-calculate balances\n\nYou can also use the **Debt Reminder** tab to send payment reminders.`;
      }
      return `**Outstanding Debts Summary**\n\n• Total Balance Due: ${currency} ${deliveryTracker.totalDebt?.toLocaleString()}\n• Total Records: ${deliveryTracker.totalRecords}\n• Unique Customers: ${deliveryTracker.uniqueCustomers}\n• Delivered To: ${deliveryTracker.deliveredTo || "N/A"}\n\n💡 Tip: Use the **Debt Reminder** tab to generate payment reminder letters.`;
    }

    // Invoice queries
    if (lowerMsg.includes("invoice")) {
      return `**Invoice Status**\n\n• Saved Invoices: ${invoices?.savedInvoices || 0}\n• Invoice Counter: #${invoices?.invoiceCounter || 1}\n• Quantity Label: ${invoices?.invoiceSettings?.quantityLabel || "Qty (DAYS)"}\n• Current Items: ${invoices?.currentItems?.length || 0}\n• Current Total: ${currency} ${invoices?.currentTotal?.toLocaleString() || 0}\n\n💡 Tip: Go to the **Invoice** tab to create professional invoices with your company branding.`;
    }

    // Fuel price queries
    if (lowerMsg.includes("price") || lowerMsg.includes("fuel")) {
      return `**Current Fuel Prices & Tank Levels**\n\n**Prices:**\n• Petrol (PMS): ${currency} ${fuelPrices?.pms || "N/A"}/L\n• Diesel (AGO): ${currency} ${fuelPrices?.ago || "N/A"}/L\n\n**Tank Levels:**\n• PMS Tank: Opening ${tankLevels?.pms?.opening || 0}L → Closing ${tankLevels?.pms?.closing || 0}L\n• AGO Tank: Opening ${tankLevels?.ago?.opening || 0}L → Closing ${tankLevels?.ago?.closing || 0}L\n\n**Consumption:**\n• PMS: ${(tankLevels?.pms?.opening || 0) - (tankLevels?.pms?.closing || 0)} Litres dispensed\n• AGO: ${(tankLevels?.ago?.opening || 0) - (tankLevels?.ago?.closing || 0)} Litres dispensed`;
    }

    // Payroll queries
    if (
      lowerMsg.includes("payroll") ||
      lowerMsg.includes("staff") ||
      lowerMsg.includes("employee") ||
      lowerMsg.includes("salary")
    ) {
      if (!payroll || payroll.totalEmployees === 0) {
        return `**Payroll Information**\n\nNo employees recorded yet.\n\nTo set up payroll:\n1. Go to **Payroll System** tab\n2. Add employees with their details\n3. Set basic salary and allowances\n4. Process monthly payroll`;
      }
      return `**Payroll Summary**\n\n• Total Employees: ${payroll.totalEmployees}\n• Active: ${payroll.activeEmployees}\n• Total Monthly Payroll: ${currency} ${payroll.totalMonthlyPayroll?.toLocaleString()}\n• Positions: ${payroll.positions?.join(", ") || "N/A"}\n\n💡 Tip: Use the **Payroll System** tab to process salaries and generate payslips.`;
    }

    // Offloading queries
    if (
      lowerMsg.includes("offload") ||
      lowerMsg.includes("supply") ||
      lowerMsg.includes("delivery from")
    ) {
      if (!offloading || offloading.totalRecords === 0) {
        return `**Fuel Offloading Records**\n\nNo offloading records found.\n\nTo record fuel received:\n1. Go to **Fuel Offloading** tab\n2. Enter truck details and fuel quantity\n3. Save the record\n\nThis helps track fuel inventory and supplier payments.`;
      }
      return `**Offloading Summary**\n\n• Total Records: ${offloading.totalRecords}\n• Total Litres Received: ${offloading.totalLitres?.toLocaleString()} L\n• Total Cost: ${currency} ${offloading.totalCost?.toLocaleString()}\n• Suppliers: ${offloading.suppliers?.join(", ") || "N/A"}`;
    }

    // M-PESA queries
    if (
      lowerMsg.includes("mpesa") ||
      lowerMsg.includes("mobile") ||
      lowerMsg.includes("payment")
    ) {
      const mpesaTxns = context.mpesaTransactions;
      if (!mpesaTxns || mpesaTxns.totalTransactions === 0) {
        return `**M-PESA Summary**\n\nNo M-PESA transactions recorded.\n\nTo analyze M-PESA:\n1. Go to **M-PESA Analyzer** tab\n2. Paste your M-PESA statement\n3. The system will categorize and summarize all transactions`;
      }
      return `**M-PESA Summary**\n\n• Total Transactions: ${mpesaTxns.totalTransactions}\n• Total Amount: ${currency} ${mpesaTxns.totalAmount?.toLocaleString()}`;
    }

    // Business overview
    if (
      lowerMsg.includes("overview") ||
      lowerMsg.includes("summary") ||
      lowerMsg.includes("status") ||
      lowerMsg.includes("business")
    ) {
      return `**Business Overview - ${context.businessName}**\n\n**Sales:**\n• Today's Revenue: ${currency} ${todaySales?.totalRevenue?.toLocaleString() || 0}\n• PMS Sales: ${currency} ${todaySales?.petrol?.amount?.toLocaleString() || 0}\n• AGO Sales: ${currency} ${todaySales?.diesel?.amount?.toLocaleString() || 0}\n\n💰 **Financials:**\n• Outstanding Debt: ${currency} ${deliveryTracker?.totalDebt?.toLocaleString() || 0}\n• Total Expenses Today: ${currency} ${todaySales?.totalExpenses?.toLocaleString() || 0}\n• Saved Invoices: ${invoices?.savedInvoices || 0}\n\n**Fuel:**\n• PMS Price: ${currency} ${fuelPrices?.pms}/L\n• AGO Price: ${currency} ${fuelPrices?.ago}/L\n• PMS Pumps: ${todaySales?.petrol?.pumpCount || 0}\n• AGO Pumps: ${todaySales?.diesel?.pumpCount || 0}\n\n👥 **Staff:** ${payroll?.totalEmployees || 0} employees\n🚛 **Offloading:** ${offloading?.totalRecords || 0} records\n📅 **Sales History:** ${salesHistory?.totalDaysRecorded || 0} days recorded`;
    }

    // Help
    if (lowerMsg.includes("help") || lowerMsg.includes("what can you do")) {
      return `**I'm your FuelPro AI Assistant!**\n\nI can help you with:\n\n**Sales Analysis** - Today's sales, revenue trends, pump performance\n💰 **Debt Tracking** - Outstanding balances, customer debts\n📄 **Invoices** - Current invoice status and totals\n**Fuel Management** - Prices, tank levels, consumption\n👥 **Payroll** - Employee info, salary summaries\n🚛 **Offloading** - Fuel received from suppliers\n📱 **M-PESA** - Mobile payment analysis\n**Business Overview** - Complete business health check\n\n**Example questions:**\n• "What are today's sales?"\n• "Show outstanding debts"\n• "What are my fuel prices?"\n• "Business overview"\n• "Payroll summary"\n\nI'm running in **local mode** - all responses are generated from your actual business data stored in this device.`;
    }

    // Default response
    return `I analyzed your business data for "${message}".\n\n${todaySales?.totalRevenue ? `Today's revenue is ${currency} ${todaySales.totalRevenue.toLocaleString()}.\n` : ""}${deliveryTracker?.totalDebt ? `Outstanding debt: ${currency} ${deliveryTracker.totalDebt.toLocaleString()}.\n` : ""}\n💡 Try asking me about:\n• Today's sales\n• Outstanding debts\n• Fuel prices\n• Business overview\n• Payroll summary\n\nI'm running in **local mode** using your actual business data.`;
  };

  const sendMessage = async (message: string, isRetry = false) => {
    if (!message.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: message,
      timestamp: new Date(),
    };

    if (!isRetry) {
      setMessages(prev => [...prev, userMessage]);
    }
    setInputMessage("");
    setIsLoading(true);
    setConnectionStatus("checking");

    try {
      // Build comprehensive context from all business data
      const businessContext = buildBusinessContext();

      // Simulate processing delay for realistic feel
      await new Promise(r => setTimeout(r, 800 + Math.random() * 600));

      // Generate local AI response
      const response = generateLocalResponse(message, businessContext);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: response,
        timestamp: new Date(),
        suggestions: [
          "Today's Sales",
          "Outstanding Debts",
          "Business Overview",
          "Fuel Prices",
        ],
      };

      setMessages(prev => [...prev, assistantMessage]);
      setConnectionStatus("connected");
      setLastFailedMessage(null);
      setRetryCount(0);

      // Speak the response if speech is enabled
      if (speechEnabled && synthRef.current) {
        speak(response);
      }
    } catch (error) {
      console.error("Chat error:", error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content:
          "I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
        isError: true,
        canRetry: true,
        suggestions: [
          "What are today's sales?",
          "Show outstanding debts",
          "Business overview",
        ],
      };
      setMessages(prev => [...prev, errorMessage]);
      setConnectionStatus("error");
      setLastFailedMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const retryLastMessage = () => {
    if (lastFailedMessage && retryCount < 3) {
      setRetryCount(prev => prev + 1);
      // Remove the last error message before retrying
      setMessages(prev => prev.filter((_, idx) => idx !== prev.length - 1));
      sendMessage(lastFailedMessage, true);
    }
  };

  const speak = (text: string) => {
    if (!synthRef.current || !speechEnabled) return;

    // Cancel any ongoing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputMessage);
  };

  const clearChat = () => {
    setMessages([
      {
        id: "1",
        type: "assistant",
        content:
          "Chat cleared! I still have access to all your business data. What would you like to know?",
        timestamp: new Date(),
      },
    ]);
  };

  // Quick action buttons
  const quickActions = [
    {
      label: "Today's Sales",
      query:
        "Give me a summary of today's sales including total litres and amount for petrol and diesel",
    },
    {
      label: "Outstanding Debts",
      query:
        "Show me the top customers with outstanding debts and the total debt amount",
    },
    {
      label: "Business Overview",
      query:
        "Give me a complete overview of my fuel station business including sales, debts, and recent transactions",
    },
    {
      label: "M-PESA Summary",
      query: "Summarize my recent M-PESA transactions",
    },
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 md:bottom-6 right-4 md:right-6 w-12 h-12 md:w-14 md:h-14 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-30 md:z-50 group"
        title="Open AI Assistant"
      >
        <Sparkles size={24} />
        <div
          className={`absolute -top-2 -right-2 w-3 h-3 rounded-full animate-pulse ${
            connectionStatus === "error" ? "bg-red-500" : "bg-green-500"
          }`}
        ></div>
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          AI Assistant (Gemini)
        </div>
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-20 md:bottom-6 right-2 md:right-6 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-600 z-50 transition-all duration-300 ${
        isMinimized
          ? "w-80 h-16"
          : "w-[calc(100vw-16px)] md:w-[420px] h-[70vh] md:h-[650px] max-h-[650px]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Sparkles size={20} />
          <span className="font-semibold">FuelPro AI</span>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
            Gemini
          </span>
          <div
            className={`w-2 h-2 rounded-full ${
              connectionStatus === "connected"
                ? "bg-green-400 animate-pulse"
                : connectionStatus === "checking"
                  ? "bg-yellow-400 animate-pulse"
                  : "bg-red-400"
            }`}
            title={
              connectionStatus === "connected"
                ? "Connected"
                : connectionStatus === "checking"
                  ? "Processing..."
                  : "Connection issue"
            }
          ></div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSpeechEnabled(!speechEnabled)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title={speechEnabled ? "Disable voice" : "Enable voice"}
          >
            {speechEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Stop speaking"
            >
              <VolumeX size={16} />
            </button>
          )}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title={isMinimized ? "Maximize" : "Minimize"}
          >
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              // Reset messages to initial state when closing
              setMessages([
                {
                  id: "1",
                  type: "assistant",
                  content:
                    "Hello! I'm your FuelPro AI Assistant powered by Google Gemini. I have access to all your business data - sales, deliveries, invoices, M-PESA transactions, payroll, and more. Ask me anything about your fuel station operations!",
                  timestamp: new Date(),
                },
              ]);
            }}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title="Close chat"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Quick Actions */}
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(action.query)}
                  disabled={isLoading}
                  className="flex-shrink-0 px-2.5 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 transition-colors disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto h-[calc(650px-190px)] space-y-4">
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.type === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.type === "user"
                      ? "bg-blue-600 text-white"
                      : message.isError
                        ? "bg-amber-500 text-white"
                        : "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                  }`}
                >
                  {message.type === "user" ? (
                    <User size={16} />
                  ) : (
                    <Bot size={16} />
                  )}
                </div>
                <div
                  className={`max-w-[80%] ${message.type === "user" ? "text-right" : ""}`}
                >
                  <div
                    className={`inline-block p-3 rounded-2xl text-sm ${
                      message.type === "user"
                        ? "bg-blue-600 text-white rounded-br-sm"
                        : message.isError
                          ? "bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200 rounded-bl-sm"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-sm"
                    }`}
                  >
                    {message.content.split("\n").map((line, i) => (
                      <React.Fragment key={i}>
                        {line}
                        {i < message.content.split("\n").length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Retry button and suggestions for error messages */}
                  {message.isError && message.canRetry && (
                    <div className="mt-2 space-y-2">
                      <button
                        onClick={retryLastMessage}
                        disabled={isLoading || retryCount >= 3}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-full disabled:opacity-50 transition-colors"
                      >
                        <RefreshCw
                          size={12}
                          className={isLoading ? "animate-spin" : ""}
                        />
                        {retryCount >= 3 ? "Max retries reached" : "Try Again"}
                      </button>
                    </div>
                  )}

                  {/* Suggestions after error or successful response */}
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => sendMessage(suggestion)}
                          disabled={isLoading}
                          className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-600 rounded-full transition-colors disabled:opacity-50"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}

                  <div
                    className={`text-xs text-gray-500 mt-1 ${message.type === "user" ? "text-right" : ""}`}
                  >
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white flex items-center justify-center">
                  <RefreshCw size={16} className="animate-spin" />
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-2xl rounded-bl-sm">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <span>Analyzing your data</span>
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                      <div
                        className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={clearChat}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
              >
                <RefreshCw size={12} /> Clear Chat
              </button>
              <span className="text-xs text-gray-400">|</span>
              <span
                className={`text-xs flex items-center gap-1 ${
                  connectionStatus === "connected"
                    ? "text-green-600 dark:text-green-400"
                    : connectionStatus === "checking"
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-red-600 dark:text-red-400"
                }`}
              >
                {connectionStatus === "connected" && "● Connected to your data"}
                {connectionStatus === "checking" && "○ Processing..."}
                {connectionStatus === "error" && (
                  <>
                    <AlertCircle size={12} />
                    Connection issue
                  </>
                )}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  placeholder="Ask about sales, debts, M-PESA, payroll..."
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm"
                  disabled={isLoading}
                />
                {recognitionRef.current && (
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 rounded-full transition-colors ${
                      isListening
                        ? "bg-red-500 text-white animate-pulse"
                        : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500"
                    }`}
                    title={isListening ? "Stop listening" : "Start voice input"}
                  >
                    {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="p-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                title="Send message"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
