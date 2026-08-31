import { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus,
  Save,
  Trash2,
  Edit,
  Settings,
  Download,
  FileSpreadsheet,
  Users,
  Calculator,
  Image,
  Upload,
  FileText,
  BarChart3,
  Loader2,
  Receipt,
  Send,
  CalendarClock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useFuel } from "@/react-app/context/FuelContext";
import { useAuth } from "@/react-app/context/AuthContext";
import cloudStorageService from "@/react-app/lib/cloud-storage-service";
import { useStations } from "@/react-app/context/StationContext";
import {
  PAYSLIP_CONFIG_KEY,
  PAYSLIP_LOG_KEY,
  currentPeriodKey,
  currentPeriodLabel,
  createPayslipShortlink,
  defaultPayslipConfig,
  deliverPayslip,
  maskRecipient,
  normalizePhoneForSending,
  revokePayslipShortlinks,
  uploadPayslipPdf,
  type CommGatewayConfig,
  type PayslipChannel,
  type PayslipDeliveryConfig,
  type PayslipSendLogEntry,
  type PayslipWebFallback,
} from "@/react-app/lib/payslip-delivery";
import {
  navigateToTab,
  type ExpensePrefill,
} from "@/react-app/lib/mpesa-integration-service";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  getCurrencySymbol,
  isKenyaStation,
  getDetectedCountryCode,
} from "../lib/currency";
import { loadLogoAsDataURL } from "@/react-app/utils/exportUtils";
import { toastSuccess, toastError } from "@/react-app/lib/toast";

interface Employee {
  id?: number;
  no: string;
  firstName: string;
  lastName: string;
  fullName: string;
  employeeId: string;
  role: string;
  department: string;
  basicSalary: number;
  sha: number;
  nssf: number;
  advance: number;
  netPay: number;
  bank: string;
  bankCode: string;
  idNo: string;
  kraPin: string;
  shaNo: string;
  nssfNo: string;
  bankAccount: string;
  phone: string;
  email: string;
  employmentDate: string;
  notes: string;
}

interface PayrollSettings {
  organizationName: string;
  organizationAddress: string;
  organizationPhone: string;
  organizationEmail: string;
  organizationLogo: string | null;
  payrollMonth: number;
  payrollYear: number;
  paymentMethod: string;
  currency: string;
  enableSha: boolean;
  enableNssf: boolean;
  enableTax: boolean;
  enableUnion: boolean;
  theme: string;
  customRoles: string[];
  originatorAccount: string;
  branchDao: string;
  origCode: string;
  reference: string;
  shaPercentage: number;
  nssfAmount: number;
}

interface ColumnNames {
  sha: string;
  nssf: string;
  advance: string;
  bank: string;
  bankCode: string;
}

// Normalize a single raw cloud/local employee record into a fully-typed
// Employee. Accepts both snake_case (cloud) and camelCase (legacy) keys and
// fills every field with safe defaults so partial cloud data never crashes
// the UI (e.g. `emp.idNo.includes(...)` when idNo is missing).
function normalizeEmployee(
  e: Partial<Record<string, unknown>> | null | undefined,
  index = 0,
): Employee {
  const emp = (e ?? {}) as Record<string, any>;
  const firstName = emp.first_name ?? emp.firstName ?? "";
  const lastName = emp.last_name ?? emp.lastName ?? "";
  const basicSalaryRaw = emp.basic_salary ?? emp.basicSalary;
  const advanceRaw = emp.advance_amount ?? emp.advance;
  const shaRaw = emp.sha_amount ?? emp.sha;
  const nssfRaw = emp.nssf_amount ?? emp.nssf;
  const netPayRaw = emp.net_pay ?? emp.netPay;
  const basicSalary = typeof basicSalaryRaw === "number" ? basicSalaryRaw : 0;
  const advance = typeof advanceRaw === "number" ? advanceRaw : 0;
  const sha = typeof shaRaw === "number" ? shaRaw : 0;
  const nssf = typeof nssfRaw === "number" ? nssfRaw : 0;
  const netPay =
    typeof netPayRaw === "number" ? netPayRaw : basicSalary - advance;
  return {
    id: typeof emp.id === "number" ? emp.id : index + 1,
    no: emp.no ?? String(index + 1),
    firstName,
    lastName,
    fullName:
      emp.full_name ?? emp.fullName ?? `${firstName} ${lastName}`.trim(),
    employeeId: emp.employee_id ?? emp.employeeId ?? "",
    role: emp.role ?? "",
    department: emp.department ?? "",
    basicSalary,
    sha,
    nssf,
    advance,
    netPay,
    bank: emp.bank_name ?? emp.bank ?? "",
    bankCode: emp.bank_code ?? emp.bankCode ?? "",
    idNo: emp.id_number ?? emp.idNo ?? "",
    kraPin: emp.kra_pin ?? emp.kraPin ?? "",
    shaNo: emp.sha_number ?? emp.shaNo ?? "",
    nssfNo: emp.nssf_number ?? emp.nssfNo ?? "",
    bankAccount: emp.bank_account ?? emp.bankAccount ?? "",
    phone: emp.phone ?? "",
    email: emp.email ?? "",
    employmentDate: emp.employment_date ?? emp.employmentDate ?? "",
    notes: emp.notes ?? "",
  };
}

// Normalize an unknown payload into a safe Employee[] (returns [] for
// non-array data so downstream `.map`/`.reduce` never crash).
function normalizeEmployees(arr: unknown): Employee[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((e, i) => normalizeEmployee(e as Record<string, any>, i));
}

// Normalize a raw cloud/local payroll_settings object into a fully-typed
// PayrollSettings, falling back to `fallback` (typically the previous state)
// for any missing/invalid field. Returns `fallback` unchanged when `raw` is
// not a plain object (e.g. null/array from corrupt cloud data).
function normalizePayrollSettings(
  raw: unknown,
  fallback: PayrollSettings,
): PayrollSettings {
  const isObj = raw !== null && typeof raw === "object" && !Array.isArray(raw);
  if (!isObj) return fallback;
  const s = raw as Record<string, any>;
  const num = (v: any, d: number) => (typeof v === "number" ? v : d);
  let customRoles: string[];
  const cr = s.custom_roles ?? s.customRoles;
  if (Array.isArray(cr)) {
    customRoles = cr.filter((r: any) => typeof r === "string");
  } else if (typeof cr === "string") {
    customRoles = cr
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
  } else {
    customRoles = fallback.customRoles;
  }
  return {
    organizationName:
      s.organization_name ?? s.organizationName ?? fallback.organizationName,
    organizationAddress:
      s.organization_address ??
      s.organizationAddress ??
      fallback.organizationAddress,
    organizationPhone:
      s.organization_phone ?? s.organizationPhone ?? fallback.organizationPhone,
    organizationEmail:
      s.organization_email ?? s.organizationEmail ?? fallback.organizationEmail,
    organizationLogo:
      s.organization_logo ?? s.organizationLogo ?? fallback.organizationLogo,
    payrollMonth: num(s.payroll_month ?? s.payrollMonth, fallback.payrollMonth),
    payrollYear: num(s.payroll_year ?? s.payrollYear, fallback.payrollYear),
    paymentMethod:
      s.payment_method ?? s.paymentMethod ?? fallback.paymentMethod,
    currency: s.currency ?? fallback.currency,
    enableSha:
      typeof (s.enable_sha ?? s.enableSha) === "boolean"
        ? (s.enable_sha ?? s.enableSha)
        : fallback.enableSha,
    enableNssf:
      typeof (s.enable_nssf ?? s.enableNssf) === "boolean"
        ? (s.enable_nssf ?? s.enableNssf)
        : fallback.enableNssf,
    enableTax:
      typeof (s.enable_tax ?? s.enableTax) === "boolean"
        ? (s.enable_tax ?? s.enableTax)
        : fallback.enableTax,
    enableUnion:
      typeof (s.enable_union ?? s.enableUnion) === "boolean"
        ? (s.enable_union ?? s.enableUnion)
        : fallback.enableUnion,
    theme: s.theme ?? fallback.theme,
    customRoles,
    originatorAccount:
      s.originator_account ?? s.originatorAccount ?? fallback.originatorAccount,
    branchDao: s.branch_dao ?? s.branchDao ?? fallback.branchDao,
    origCode: s.orig_code ?? s.origCode ?? fallback.origCode,
    reference: s.reference_code ?? s.reference ?? fallback.reference,
    shaPercentage: num(
      s.sha_percentage ?? s.shaPercentage,
      fallback.shaPercentage,
    ),
    nssfAmount: num(s.nssf_amount ?? s.nssfAmount, fallback.nssfAmount),
  };
}

// Payroll statutory defaults are country-aware: Kenya uses SHA (2.75%) +
// NSSF (480); other countries get generic tax-deduction defaults so the
// payroll adapts to the station's location rather than forcing Kenya rules.
const countryCode = getDetectedCountryCode();
const isKenya = countryCode === "KE";

const defaultSettings: PayrollSettings = {
  organizationName: "",
  organizationAddress: "",
  organizationPhone: "",
  organizationEmail: "",
  organizationLogo: null,
  payrollMonth: new Date().getMonth() + 1,
  payrollYear: new Date().getFullYear(),
  paymentMethod: "bank",
  currency: "$", // overridden by station currency on mount"
  // SHA/NSSF are Kenya-specific statutory deductions; disable them by
  // default for non-Kenyan stations (still user-toggleable).
  enableSha: isKenya,
  enableNssf: isKenya,
  enableTax: true,
  // Employee union/levy is a universal payroll concept — keep enabled.
  enableUnion: true,
  theme: "blue",
  customRoles: [],
  originatorAccount: "",
  branchDao: isKenya ? "4021" : "",
  origCode: "",
  reference: "",
  shaPercentage: isKenya ? 2.75 : 0,
  nssfAmount: isKenya ? 480 : 0,
};

export default function PayrollSystem() {
  // Get auth context
  const { user } = useAuth();
  const { currentStation } = useStations();
  const stationId = currentStation?.id;
  // Resolve currency from React-context station (not synchronous localStorage)
  // so it's correct on fresh devices / multi-currency stations.
  const stationCurrencySymbol = useMemo(
    () =>
      getCurrencySymbol(
        (currentStation as any)?.companyCurrency ||
          (currentStation as any)?.currency,
      ),
    [currentStation],
  );
  const { state: fuelState } = useFuel();
  const isKenya = isKenyaStation();

  // State — initialize from the synchronous cache so the FIRST render shows
  // data instantly (no blank flash while the async cloud get resolves).
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const cached = cloudStorageService.getCached<unknown[]>(
      "payroll_employees",
      stationId,
    );
    return Array.isArray(cached) ? normalizeEmployees(cached) : [];
  });
  const [settings, setSettings] = useState<PayrollSettings>(() => {
    const cached = cloudStorageService.getCached<unknown>(
      "payroll_settings",
      stationId,
    );
    if (cached && typeof cached === "object" && !Array.isArray(cached)) {
      return { ...defaultSettings, ...(cached as Partial<PayrollSettings>) };
    }
    return defaultSettings;
  });

  const [columnNames, setColumnNames] = useState<ColumnNames>({
    sha: "SHA",
    nssf: "NSSF",
    advance: "Advance",
    bank: "Bank",
    bankCode: "Bank Code",
  });

  // Loading states
  const [_loading, _setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  // CRITICAL: guard against the auto-save (saveSettings fired from the
  // companyData sync effect) overwriting the cloud store BEFORE the initial
  // cloud load completes. Without this, on a fresh device the default/empty
  // settings are persisted to cloud before fetchSettings returns, wiping the
  // user's real settings (the same class of bug fixed in FuelContext).
  const cloudLoadCompleteRef = useRef(false);

  // UI State
  const [activeTab, setActiveTab] = useState("employees");
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShaModal, setShowShaModal] = useState(false);
  const [showNssfModal, setShowNssfModal] = useState(false);
  const [showColumnModal, setShowColumnModal] = useState(false);

  // Payslip delivery (email/WhatsApp) — config + log are cloud-synced
  // (station-scoped), so a schedule set on one device fires on every device.
  const [payslipConfig, setPayslipConfig] =
    useState<PayslipDeliveryConfig>(defaultPayslipConfig);
  const [payslipLog, setPayslipLog] = useState<PayslipSendLogEntry[]>([]);
  const payslipConfigRef = useRef(payslipConfig);
  payslipConfigRef.current = payslipConfig;
  const payslipLogRef = useRef(payslipLog);
  payslipLogRef.current = payslipLog;
  const [sendingPayslips, setSendingPayslips] = useState(false);
  const [editingPayslipSendDay, setEditingPayslipSendDay] = useState("1");
  const [editPayslipDayFocus, setEditPayslipDayFocus] = useState(false);
  // Short-link expiry input (days) — focus/edit state for the numeric input.
  const [editingExpiryDays, setEditingExpiryDays] = useState("7");
  const [editExpiryFocus, setEditExpiryFocus] = useState(false);
  const [revokingLinks, setRevokingLinks] = useState(false);
  // Web-redirect fallback queue: manual sends whose API gateway is not
  // configured land here so the owner can open WhatsApp Web / the mail
  // client per employee with one click (each click is a user gesture, so
  // popup blockers don't interfere).
  const [webSendQueue, setWebSendQueue] = useState<
    { entry: PayslipSendLogEntry; fallbacks: PayslipWebFallback[] }[]
  >([]);
  // Shared email/WhatsApp gateway config (the SAME one Communication →
  // Settings writes to `comm_integration_config`) — no double entry.
  const [commGateway, setCommGateway] = useState<CommGatewayConfig | null>(
    null,
  );

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<number | null>(null);
  const [employeeToDeleteId, setEmployeeToDeleteId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const [shaPercentage, setShaPercentage] = useState(2.75);
  const [nssfAmount, setNssfAmount] = useState(480);
  const [columnType, setColumnType] = useState("");
  const [columnName, setColumnName] = useState("");

  // Export options visibility
  const [showExportOptions, setShowExportOptions] = useState(false);

  // Refs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Form state for employee modal
  const [employeeForm, setEmployeeForm] = useState({
    firstName: "",
    lastName: "",
    employeeId: "",
    role: "",
    department: "",
    employmentDate: new Date().toISOString().split("T")[0],
    basicSalary: 0,
    idNo: "",
    kraPin: "",
    shaNo: "",
    nssfNo: "",
    bankAccount: "",
    bankName: "",
    bankCode: "",
    phone: "",
    email: "",
    advance: 0,
    sha: 0,
    nssf: 0,
    notes: "",
  });

  // Helper functions
  const formatNumber = (num: number) => {
    if (!Number.isFinite(num)) return "0.00";
    return num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, "$&,");
  };

  const formatCurrency = (amount: number) => {
    return `${stationCurrencySymbol || settings.currency} ${formatNumber(amount)}`;
  };

  // Single source of truth for net-pay calculation. Guards against NaN /
  // Infinity (bad parse, missing field). Was duplicated inline in 4 places
  // (saveEmployee, applyShaToAll, applyNssfToAll, updateCell) — each with a
  // slightly different formula and none guarded against NaN.
  const calcNetPay = (emp: {
    basicSalary: number;
    advance: number;
    sha: number;
    nssf: number;
  }): number => {
    const basic = Number.isFinite(emp.basicSalary) ? emp.basicSalary : 0;
    const advance = Number.isFinite(emp.advance) ? emp.advance : 0;
    const sha = Number.isFinite(emp.sha) ? emp.sha : 0;
    const nssf = Number.isFinite(emp.nssf) ? emp.nssf : 0;
    return Math.round((basic - advance - sha - nssf) * 100) / 100;
  };

  // API calls
  const fetchEmployees = async () => {
    try {
      const cloudData = await cloudStorageService.get<unknown>(
        "payroll_employees",
        stationId,
      );
      if (cloudData && Array.isArray(cloudData)) {
        setEmployees(normalizeEmployees(cloudData));
        return;
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
    // Fallback: load from localStorage
    try {
      const local = JSON.parse(
        localStorage.getItem("fuelpro_payroll_employees") || "[]",
      );
      if (Array.isArray(local) && local.length > 0) {
        setEmployees(normalizeEmployees(local));
      }
    } catch {
      /* */
    }
  };

  const fetchSettings = async () => {
    try {
      const cloudSettings = await cloudStorageService.get<unknown>(
        "payroll_settings",
        stationId,
      );
      const localSettings = (() => {
        try {
          return JSON.parse(
            localStorage.getItem("fuelpro_payroll_settings") || "null",
          );
        } catch {
          return null;
        }
      })();
      const raw = cloudSettings ?? localSettings;
      if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
        setSettings((prev) => normalizePayrollSettings(raw, prev));
        const s = raw as Record<string, any>;
        const shaPct = s.sha_percentage ?? s.shaPercentage;
        setShaPercentage(typeof shaPct === "number" ? shaPct : 2.75);
        const nssfAmt = s.nssf_amount ?? s.nssfAmount;
        setNssfAmount(typeof nssfAmt === "number" ? nssfAmt : 480);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const saveSettings = async (newSettings: Partial<PayrollSettings>) => {
    // CRITICAL: do NOT persist until the initial cloud load has completed.
    // On a fresh device, this fires from the companyData sync effect BEFORE
    // fetchSettings returns; persisting would overwrite the user's real
    // cloud settings with defaults.
    if (user && !cloudLoadCompleteRef.current) return;
    try {
      setSaving(true);
      const merged = { ...settings, ...newSettings };
      // Persist to cloud (Supabase app_kv) + localStorage cache
      const payload = {
        organization_name: merged.organizationName,
        organization_address: merged.organizationAddress,
        organization_phone: merged.organizationPhone,
        organization_email: merged.organizationEmail,
        organization_logo: merged.organizationLogo,
        payroll_month: merged.payrollMonth,
        payroll_year: merged.payrollYear,
        payment_method: merged.paymentMethod,
        currency: merged.currency,
        enable_sha: merged.enableSha,
        enable_nssf: merged.enableNssf,
        enable_tax: merged.enableTax,
        sha_percentage: merged.shaPercentage,
        nssf_amount: merged.nssfAmount,
        originator_account: merged.originatorAccount,
        branch_dao: merged.branchDao,
        orig_code: merged.origCode,
        reference_code: merged.reference,
        custom_roles: merged.customRoles?.join(", "),
      };
      await cloudStorageService.set("payroll_settings", payload, stationId);
      localStorage.setItem("fuelpro_payroll_settings", JSON.stringify(payload));
    } catch (error) {
      console.error("Error saving settings:", error);
      toastError(
        "Failed to save payroll settings: " + (error as Error).message,
      );
    } finally {
      setSaving(false);
    }
  };

  // Sync with main system organization data
  useEffect(() => {
    if (fuelState.companyData) {
      const updatedSettings = {
        ...settings,
        organizationName:
          fuelState.companyData.name || settings.organizationName,
        organizationAddress:
          fuelState.companyData.poBox || settings.organizationAddress,
        organizationPhone:
          fuelState.companyData.contacts || settings.organizationPhone,
        organizationEmail:
          fuelState.companyData.email || settings.organizationEmail,
        organizationLogo:
          fuelState.companyData.logo || settings.organizationLogo,
      };
      setSettings(updatedSettings);
      saveSettings(updatedSettings);
    }
  }, [fuelState.companyData]);

  // Initialize data
  useEffect(() => {
    if (user) {
      cloudLoadCompleteRef.current = false;
      Promise.all([fetchEmployees(), fetchSettings()]).finally(() => {
        cloudLoadCompleteRef.current = true;
      });
      // Payslip delivery config + log (station-scoped cloud keys).
      (async () => {
        try {
          const cfg = await cloudStorageService.get<PayslipDeliveryConfig>(
            PAYSLIP_CONFIG_KEY,
            stationId,
          );
          if (cfg && typeof cfg === "object") {
            setPayslipConfig({ ...defaultPayslipConfig, ...cfg });
          }
          const log = await cloudStorageService.get<PayslipSendLogEntry[]>(
            PAYSLIP_LOG_KEY,
            stationId,
          );
          if (Array.isArray(log)) setPayslipLog(log);
          // Shared gateway config (Communication → Settings, no double entry).
          const gw = await cloudStorageService.get<CommGatewayConfig>(
            "comm_integration_config",
            stationId,
          );
          if (gw && typeof gw === "object") setCommGateway(gw);
        } catch (e) {
          console.warn("[payslip-config] load failed:", e);
        }
      })();
    } else {
      cloudLoadCompleteRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, stationId]);

  // Employee CRUD operations
  const openAddEmployeeModal = () => {
    setEditingEmployee(null);
    setEmployeeForm({
      firstName: "",
      lastName: "",
      employeeId: "",
      role: "",
      department: "",
      employmentDate: new Date().toISOString().split("T")[0],
      basicSalary: 0,
      idNo: "",
      kraPin: "",
      shaNo: "",
      nssfNo: "",
      bankAccount: "",
      bankName: "",
      bankCode: "",
      phone: "",
      email: "",
      advance: 0,
      sha: 0,
      nssf: 0,
      notes: "",
    });
    setShowEmployeeModal(true);
  };

  const openEditEmployeeModal = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeeForm({
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeId: employee.employeeId,
      role: employee.role,
      department: employee.department,
      employmentDate: employee.employmentDate,
      basicSalary: employee.basicSalary,
      idNo: employee.idNo,
      kraPin: employee.kraPin,
      shaNo: employee.shaNo,
      nssfNo: employee.nssfNo,
      bankAccount: employee.bankAccount,
      bankName: employee.bank,
      bankCode: employee.bankCode,
      phone: employee.phone,
      email: employee.email,
      advance: employee.advance,
      sha: employee.sha,
      nssf: employee.nssf,
      notes: employee.notes,
    });
    setShowEmployeeModal(true);
  };

  const saveEmployee = async () => {
    try {
      setSaving(true);

      // Required-field validation (was missing — a user could save an
      // employee with no name, producing a blank row in the table + cloud).
      if (!employeeForm.firstName.trim() && !employeeForm.lastName.trim()) {
        toastError("Please enter at least a first name or last name.");
        return;
      }
      if (!employeeForm.role.trim()) {
        toastError("Please enter a role/position for the employee.");
        return;
      }

      const resolvedEmployeeId =
        employeeForm.employeeId.trim() ||
        `EMP-${Date.now().toString(36).toUpperCase()}`;

      const computedNet = calcNetPay({
        basicSalary: employeeForm.basicSalary,
        advance: employeeForm.advance,
        sha: employeeForm.sha,
        nssf: employeeForm.nssf,
      });

      const empData = {
        first_name: employeeForm.firstName,
        last_name: employeeForm.lastName,
        full_name: `${employeeForm.firstName} ${employeeForm.lastName}`.trim(),
        employee_id: resolvedEmployeeId,
        role: employeeForm.role,
        department: employeeForm.department,
        basic_salary: employeeForm.basicSalary,
        id_number: employeeForm.idNo,
        kra_pin: employeeForm.kraPin,
        sha_number: employeeForm.shaNo,
        nssf_number: employeeForm.nssfNo,
        bank_account: employeeForm.bankAccount,
        bank_name: employeeForm.bankName,
        bank_code: employeeForm.bankCode,
        phone: employeeForm.phone,
        email: employeeForm.email,
        employment_date: employeeForm.employmentDate,
        advance_amount: employeeForm.advance,
        sha_amount: employeeForm.sha || 0,
        nssf_amount: employeeForm.nssf || 0,
        net_pay: computedNet,
        notes: employeeForm.notes,
      };

      const cloudData =
        (await cloudStorageService.get<any[]>(
          "payroll_employees",
          stationId,
        )) || [];
      let updatedList: any[];
      if (editingEmployee) {
        // Match by employee_id (stable). Was matching by employeeId which is
        // empty for new employees → idx=-1 → appended a duplicate instead of
        // updating the intended row.
        const idx = cloudData.findIndex(
          (e: any) =>
            e.employee_id === editingEmployee.employeeId ||
            e.id === editingEmployee.id,
        );
        updatedList =
          idx >= 0
            ? [
                ...cloudData.slice(0, idx),
                { ...cloudData[idx], ...empData },
                ...cloudData.slice(idx + 1),
              ]
            : [...cloudData, { ...empData, id: Date.now() }];
      } else {
        updatedList = [...cloudData, { ...empData, id: Date.now() }];
      }
      await cloudStorageService.set(
        "payroll_employees",
        updatedList,
        stationId,
      );
      localStorage.setItem(
        "fuelpro_payroll_employees",
        JSON.stringify(updatedList),
      );

      await fetchEmployees();
      setShowEmployeeModal(false);
      setEditingEmployee(null);

      if (
        !settings.customRoles.includes(employeeForm.role) &&
        employeeForm.role
      ) {
        const updatedSettings = {
          ...settings,
          customRoles: [...settings.customRoles, employeeForm.role],
        };
        setSettings(updatedSettings);
        saveSettings(updatedSettings);
      }
    } catch (error) {
      console.error("Error saving employee:", error);
      toastError("Failed to save employee: " + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteEmployee = (employee: Employee) => {
    // Store the employeeId (stable string) AND the numeric id so delete can
    // match either. Was `employee.id || 0` — a real employee with id=0
    // (first in a fresh list) would set 0, then `if (employeeToDelete)` is
    // falsy → delete silently no-ops.
    setEmployeeToDelete(employee.id || 0);
    setEmployeeToDeleteId(employee.employeeId);
    setShowDeleteModal(true);
  };

  const deleteEmployee = async () => {
    // Match by BOTH the numeric id AND the stable employeeId string. The old
    // code only matched `e.id !== employeeToDelete` — but the cloud record's
    // `id` is assigned at insert (Date.now()) and may not match the
    // normalized Employee.id (which falls back to index+1). So deletes
    // frequently failed to match and the employee stayed in cloud.
    const targetId = employeeToDelete;
    const targetEmpId = employeeToDeleteId;
    if (!targetId && !targetEmpId) return;
    try {
      setSaving(true);
      const cloudData =
        (await cloudStorageService.get<any[]>(
          "payroll_employees",
          stationId,
        )) || [];
      const updatedList = cloudData.filter(
        (e: any) =>
          !(
            (targetId && e.id === targetId) ||
            (targetEmpId && e.employee_id === targetEmpId)
          ),
      );
      await cloudStorageService.set(
        "payroll_employees",
        updatedList,
        stationId,
      );
      localStorage.setItem(
        "fuelpro_payroll_employees",
        JSON.stringify(updatedList),
      );

      await fetchEmployees();
      setShowDeleteModal(false);
      setEmployeeToDelete(null);
      setEmployeeToDeleteId("");
    } catch (error) {
      console.error("Error deleting employee:", error);
      toastError("Failed to delete employee: " + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Bulk operations
  const applyShaToAll = async () => {
    try {
      setSaving(true);
      const cloudData =
        (await cloudStorageService.get<any[]>(
          "payroll_employees",
          stationId,
        )) || [];
      // CRITICAL FIX: the old code computed net_pay using emp.sha_amount
      // (the OLD value) instead of the NEW sha_amount it just set. So after
      // "Apply SHA to All", every employee's net_pay was wrong (used the
      // pre-update SHA). Now we compute the new SHA first, then derive
      // net_pay from it via calcNetPay (with NaN guard).
      const updatedList = cloudData.map((emp: any) => {
        const newSha = (emp.basic_salary || 0) * (shaPercentage / 100);
        return {
          ...emp,
          sha_amount: Math.round(newSha * 100) / 100,
          net_pay: calcNetPay({
            basicSalary: emp.basic_salary || 0,
            advance: emp.advance_amount || 0,
            sha: newSha,
            nssf: emp.nssf_amount || 0,
          }),
        };
      });
      await cloudStorageService.set(
        "payroll_employees",
        updatedList,
        stationId,
      );
      localStorage.setItem(
        "fuelpro_payroll_employees",
        JSON.stringify(updatedList),
      );

      await fetchEmployees();
      const updatedSettings = { ...settings, shaPercentage };
      setSettings(updatedSettings);
      saveSettings(updatedSettings);
      setShowShaModal(false);
    } catch (error) {
      // Was only console.error — the user saw the modal close with no SHA
      // applied and no explanation.
      console.error("Error updating SHA:", error);
      toastError("Failed to apply SHA: " + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const applyNssfToAll = async () => {
    try {
      setSaving(true);
      const cloudData =
        (await cloudStorageService.get<any[]>(
          "payroll_employees",
          stationId,
        )) || [];
      const updatedList = cloudData.map((emp: any) => {
        return {
          ...emp,
          nssf_amount: nssfAmount,
          net_pay: calcNetPay({
            basicSalary: emp.basic_salary || 0,
            advance: emp.advance_amount || 0,
            sha: emp.sha_amount || 0,
            nssf: nssfAmount,
          }),
        };
      });
      await cloudStorageService.set(
        "payroll_employees",
        updatedList,
        stationId,
      );
      localStorage.setItem(
        "fuelpro_payroll_employees",
        JSON.stringify(updatedList),
      );

      await fetchEmployees();
      const updatedSettings = { ...settings, nssfAmount };
      setSettings(updatedSettings);
      saveSettings(updatedSettings);
      setShowNssfModal(false);
    } catch (error) {
      console.error("Error updating NSSF:", error);
      toastError("Failed to update NSSF: " + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Column name editing (local only for now)
  const editColumnName = (type: string) => {
    setColumnType(type);
    setColumnName(columnNames[type as keyof ColumnNames]);
    setShowColumnModal(true);
  };

  const saveColumnName = () => {
    if (columnName.trim()) {
      setColumnNames({
        ...columnNames,
        [columnType]: columnName.trim(),
      });
      setShowColumnModal(false);
    }
  };

  // Update cell values — persist to cloud + localStorage
  const updateCell = async (employee: Employee, field: string, value: any) => {
    try {
      const updatedEmployee = { ...employee };

      if (field === "sha" || field === "nssf" || field === "advance") {
        const numValue = parseFloat(value) || 0;
        if (field === "sha") updatedEmployee.sha = numValue;
        if (field === "nssf") updatedEmployee.nssf = numValue;
        if (field === "advance") updatedEmployee.advance = numValue;

        updatedEmployee.netPay = calcNetPay({
          basicSalary: updatedEmployee.basicSalary,
          advance: updatedEmployee.advance,
          sha: updatedEmployee.sha,
          nssf: updatedEmployee.nssf,
        });
      } else {
        (updatedEmployee as any)[field] = value;
      }

      const cloudData =
        (await cloudStorageService.get<any[]>(
          "payroll_employees",
          stationId,
        )) || [];
      const idx = cloudData.findIndex(
        (e: any) => e.employee_id === employee.employeeId,
      );
      if (idx >= 0) {
        const updated = {
          ...cloudData[idx],
          first_name: updatedEmployee.firstName,
          last_name: updatedEmployee.lastName,
          full_name: updatedEmployee.fullName,
          employee_id: updatedEmployee.employeeId,
          role: updatedEmployee.role,
          department: updatedEmployee.department,
          basic_salary: updatedEmployee.basicSalary,
          id_number: updatedEmployee.idNo,
          kra_pin: updatedEmployee.kraPin,
          sha_number: updatedEmployee.shaNo,
          nssf_number: updatedEmployee.nssfNo,
          bank_account: updatedEmployee.bankAccount,
          bank_name: updatedEmployee.bank,
          bank_code: updatedEmployee.bankCode,
          phone: updatedEmployee.phone,
          email: updatedEmployee.email,
          employment_date: updatedEmployee.employmentDate,
          advance_amount: updatedEmployee.advance,
          sha_amount: updatedEmployee.sha,
          nssf_amount: updatedEmployee.nssf,
          net_pay: updatedEmployee.netPay,
          notes: updatedEmployee.notes,
        };
        cloudData[idx] = updated;
        await cloudStorageService.set(
          "payroll_employees",
          cloudData,
          stationId,
        );
        localStorage.setItem(
          "fuelpro_payroll_employees",
          JSON.stringify(cloudData),
        );
      }

      // Optimistically update local state
      setEmployees((prev) =>
        prev.map((e) =>
          e.employeeId === employee.employeeId ? updatedEmployee : e,
        ),
      );
    } catch (error) {
      console.error("Error updating cell:", error);
      toastError("Failed to update employee: " + (error as Error).message);
    }
  };

  // Logo upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toastError("Please upload a valid image file (JPG, PNG, GIF)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toastError("Image size should not exceed 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const updatedSettings = {
          ...settings,
          organizationLogo: event.target.result as string,
        };
        setSettings(updatedSettings);
        saveSettings(updatedSettings);
      }
    };
    reader.readAsDataURL(file);
  };

  // Reset to page 1 whenever the search term changes (was missing — after
  // filtering to e.g. 1 result on page 3, the table showed an empty page).
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Filter and pagination
  const filteredEmployees = employees.filter((emp) => {
    const q = searchTerm.toLowerCase();
    return (
      (emp.fullName || "").toLowerCase().includes(q) ||
      (emp.role || "").toLowerCase().includes(q) ||
      (emp.department || "").toLowerCase().includes(q) ||
      (emp.no || "").includes(searchTerm) ||
      (emp.idNo || "").includes(searchTerm) ||
      (emp.employeeId || "").includes(searchTerm) ||
      // Was missing — searching by phone/email/KRA PIN found nothing.
      (emp.phone || "").toLowerCase().includes(q) ||
      (emp.email || "").toLowerCase().includes(q) ||
      (emp.kraPin || "").toLowerCase().includes(q) ||
      (emp.bankAccount || "").includes(searchTerm)
    );
  });

  const totalPages = Math.max(
    Math.ceil(filteredEmployees.length / entriesPerPage),
    1,
  );
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const paginatedEmployees = filteredEmployees.slice(startIndex, endIndex);

  // Summary calculations (guard against NaN from corrupt cloud records).
  const safeNum = (n: number) => (Number.isFinite(n) ? n : 0);
  const totalGross = employees.reduce(
    (sum, emp) => sum + safeNum(emp.basicSalary),
    0,
  );
  const totalSha = employees.reduce((sum, emp) => sum + safeNum(emp.sha), 0);
  const totalNssf = employees.reduce((sum, emp) => sum + safeNum(emp.nssf), 0);
  const totalAdvances = employees.reduce(
    (sum, emp) => sum + safeNum(emp.advance),
    0,
  );
  const totalNet = employees.reduce((sum, emp) => sum + safeNum(emp.netPay), 0);

  // Export functions with backend integration
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const monthName = new Date(2023, settings.payrollMonth - 1)
      .toLocaleString("default", { month: "long" })
      .toUpperCase();

    const headers = [
      "No.",
      "Name",
      "Role",
      "Department",
      "Basic Salary",
      columnNames.sha,
      columnNames.nssf,
      columnNames.advance,
      "Net Pay",
      columnNames.bank,
      columnNames.bankCode,
    ];
    const data = [
      [
        `${settings.organizationName || "ORGANIZATION"} EMPLOYEES LIST ${monthName} ${settings.payrollYear}`,
      ],
      [],
      headers,
      ...employees.map((emp) => [
        emp.no,
        emp.fullName,
        emp.role,
        emp.department,
        emp.basicSalary,
        emp.sha,
        emp.nssf,
        emp.advance,
        emp.netPay,
        emp.bank,
        emp.bankCode,
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [
      { wch: 8 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(
      wb,
      `${settings.organizationName.replace(/\s/g, "_")}_Employees_${monthName}_${settings.payrollYear}.xlsx`,
    );
  };

  // Enhanced export functions using local/cloud data
  const exportCombinedPayrollExcel = async () => {
    try {
      setSaving(true);
      const cloudEmployees = await cloudStorageService.get<unknown>(
        "payroll_employees",
        stationId,
      );
      const cloudSettings = await cloudStorageService.get<unknown>(
        "payroll_settings",
        stationId,
      );
      generateCombinedExcel({
        employees: normalizeEmployees(cloudEmployees),
        settings: normalizePayrollSettings(cloudSettings, settings),
      });
    } catch (error) {
      console.error("Error exporting combined payroll:", error);
      toastError("Failed to export: " + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const exportCPCCentralizedExcel = async () => {
    try {
      setSaving(true);
      const cloudEmployees = await cloudStorageService.get<unknown>(
        "payroll_employees",
        stationId,
      );
      const cloudSettings = await cloudStorageService.get<unknown>(
        "payroll_settings",
        stationId,
      );
      generateCPCExcel({
        employees: normalizeEmployees(cloudEmployees),
        settings: normalizePayrollSettings(cloudSettings, settings),
      });
    } catch (error) {
      console.error("Error exporting CPC centralized:", error);
      toastError("Failed to export CPC: " + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const generateCombinedExcel = (data: {
    employees: Employee[];
    settings: PayrollSettings;
  }) => {
    const wb = XLSX.utils.book_new();
    const employees = data.employees || [];
    const settings = data.settings;

    const monthName = new Date(2023, (settings.payrollMonth || 1) - 1)
      .toLocaleString("default", { month: "long" })
      .toUpperCase();
    const year = settings.payrollYear || new Date().getFullYear();
    const orgName = (settings.organizationName || "ORGANIZATION").toUpperCase();

    // Sheet 1: Payroll Payment Summary
    const payrollData = [
      [`${orgName} SALARY ${monthName} ${year} PAYMENT`],
      [],
      [
        "S/NO.",
        "NAME",
        "BASIC AMOUNT",
        "SHA",
        "NSSF",
        "BANK CHARGES",
        "ADVANCE",
        "NET TOTAL",
      ],
      ...employees.map((emp, index) => [
        index + 1,
        (emp.fullName || "").toUpperCase(),
        emp.basicSalary,
        emp.sha,
        emp.nssf,
        0, // Bank charges
        emp.advance,
        emp.netPay,
      ]),
      [],
      [
        "TOTALS",
        "",
        employees.reduce((sum, emp) => sum + emp.basicSalary, 0),
        employees.reduce((sum, emp) => sum + emp.sha, 0),
        employees.reduce((sum, emp) => sum + emp.nssf, 0),
        0,
        employees.reduce((sum, emp) => sum + emp.advance, 0),
        employees.reduce((sum, emp) => sum + emp.netPay, 0),
      ],
    ];

    const payrollWS = XLSX.utils.aoa_to_sheet(payrollData);
    payrollWS["!cols"] = [
      { wch: 8 },
      { wch: 25 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, payrollWS, "Payroll Payment");

    // Sheet 2: SHA List
    const shaData = [
      [`${orgName} STAFF SHA LIST ${monthName} ${year}`],
      [],
      ["S/NO.", "NAME", "ID NO.", "SHA NO.", "BASIC SALARY", "SHA AMOUNT"],
      ...employees.map((emp, index) => [
        index + 1,
        (emp.fullName || "").toUpperCase(),
        emp.idNo,
        emp.shaNo,
        emp.basicSalary,
        emp.sha,
      ]),
      [],
      [
        "TOTALS",
        "",
        "",
        "",
        employees.reduce((sum, emp) => sum + emp.basicSalary, 0),
        employees.reduce((sum, emp) => sum + emp.sha, 0),
      ],
    ];

    const shaWS = XLSX.utils.aoa_to_sheet(shaData);
    shaWS["!cols"] = [
      { wch: 8 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, shaWS, "SHA List");

    // Sheet 3: NSSF List (with doubled amount as per requirement)
    const nssfData = [
      [`${orgName} STAFF NSSF LIST ${monthName} ${year}`],
      [],
      ["S/NO.", "NAME", "ID NO.", "NSSF NO.", "AMOUNT"],
      ...employees.map((emp, index) => [
        index + 1,
        (emp.fullName || "").toUpperCase(),
        emp.idNo,
        emp.nssfNo,
        emp.nssf * 2, // Double the amount for NSSF list as per requirement
      ]),
      [],
      [
        "TOTALS",
        "",
        "",
        "",
        employees.reduce((sum, emp) => sum + emp.nssf * 2, 0),
      ],
    ];

    const nssfWS = XLSX.utils.aoa_to_sheet(nssfData);
    nssfWS["!cols"] = [
      { wch: 8 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, nssfWS, "NSSF List");

    // Sheet 4: CPC Centralized Processing
    const cpcData = [
      [`CPC CENTRALIZED ${monthName} ${year} SALARY PROCESSING`],
      [],
      [
        "S/NO.",
        "NAME",
        "ACCOUNT",
        "BANK NAME",
        "BANK CODE",
        "AMOUNT",
        "REFERENCE",
        "ORIG CODE",
        "BRANCH DAO",
        "ORIGINATOR ACCOUNT",
      ],
      ...employees.map((emp, index) => [
        index + 1,
        (emp.fullName || "").toUpperCase(),
        emp.bankAccount,
        (emp.bank || "").toUpperCase(),
        emp.bankCode,
        emp.netPay,
        settings.reference || orgName,
        settings.origCode || emp.bankCode,
        settings.branchDao || "4021",
        settings.originatorAccount || "1285241630",
      ]),
      [],
      [
        "TOTAL",
        "",
        "",
        "",
        "",
        employees.reduce((sum, emp) => sum + emp.netPay, 0),
        "",
        "",
        "",
        "",
      ],
    ];

    const cpcWS = XLSX.utils.aoa_to_sheet(cpcData);
    cpcWS["!cols"] = [
      { wch: 8 },
      { wch: 25 },
      { wch: 18 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 12 },
      { wch: 15 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, cpcWS, "CPC Centralized");

    // Save the workbook
    XLSX.writeFile(
      wb,
      `PAYROLL_${(settings.organizationName || "Organization").replace(/\s/g, "_")}_${monthName}_${year}.xlsx`,
    );
  };

  const generateCPCExcel = (data: {
    employees: Employee[];
    settings: PayrollSettings;
  }) => {
    const wb = XLSX.utils.book_new();
    const employees = data.employees || [];
    const settings = data.settings;

    const monthName = new Date(2023, (settings.payrollMonth || 1) - 1)
      .toLocaleString("default", { month: "long" })
      .toUpperCase();
    const year = settings.payrollYear || new Date().getFullYear();
    const orgName = (settings.organizationName || "ORGANIZATION").toUpperCase();

    const cpcData = [
      [`CPC CENTRALIZED ${monthName} ${year} SALARY PROCESSING`],
      [],
      [
        "S/NO.",
        "NAME",
        "ACCOUNT",
        "BANK NAME",
        "BANK CODE",
        "AMOUNT",
        "REFERENCE",
        "ORIG CODE",
        "BRANCH DAO",
        "ORIGINATOR ACCOUNT",
      ],
      ...employees.map((emp, index) => [
        index + 1,
        (emp.fullName || "").toUpperCase(),
        emp.bankAccount,
        (emp.bank || "").toUpperCase(),
        emp.bankCode,
        emp.netPay,
        settings.reference || orgName,
        settings.origCode || emp.bankCode,
        settings.branchDao || "4021",
        settings.originatorAccount || "1285241630",
      ]),
      [],
      [
        "TOTAL",
        "",
        "",
        "",
        "",
        employees.reduce((sum, emp) => sum + emp.netPay, 0),
        "",
        "",
        "",
        "",
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(cpcData);
    ws["!cols"] = [
      { wch: 8 },
      { wch: 25 },
      { wch: 18 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 12 },
      { wch: 15 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "CPC Centralized");

    XLSX.writeFile(
      wb,
      `CPC_CENTRALIZED_SALARY_PROCESSING_${(settings.organizationName || "Organization").replace(/\s/g, "_")}_${monthName}_${year}.xlsx`,
    );
  };

  // Individual payslip PDF generation — returns the jsPDF doc so it can be
  // downloaded, emailed, or sent over WhatsApp.
  const buildEmployeePayslipPdf = async (
    employee: Employee,
  ): Promise<jsPDF> => {
    const doc = new jsPDF();
    const monthName = new Date(2023, settings.payrollMonth - 1).toLocaleString(
      "default",
      { month: "long" },
    );

    let y = 20;

    // Company logo (supports Supabase Storage URLs via loadLogoAsDataURL).
    if (settings.organizationLogo) {
      const logoDataUrl = await loadLogoAsDataURL(settings.organizationLogo);
      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, "PNG", 15, 10, 40, 25);
          y = 45;
        } catch (error) {
          console.warn("Could not load company logo for payslip:", error);
        }
      }
    }

    // Company header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor("#1a3a5f");
    doc.text(settings.organizationName || "ORGANIZATION", 105, y, {
      align: "center",
    });
    y += 8;

    if (settings.organizationAddress) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(settings.organizationAddress, 105, y, { align: "center" });
      y += 6;
    }

    if (settings.organizationPhone || settings.organizationEmail) {
      let contactInfo = "";
      if (settings.organizationPhone) contactInfo += settings.organizationPhone;
      if (settings.organizationPhone && settings.organizationEmail)
        contactInfo += " | ";
      if (settings.organizationEmail) contactInfo += settings.organizationEmail;
      doc.text(contactInfo, 105, y, { align: "center" });
      y += 6;
    }

    // Payslip title
    y += 10;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor("#000000");
    doc.text("PAY SLIP", 105, y, { align: "center" });
    y += 15;

    // Period info
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Pay Period: ${monthName} ${settings.payrollYear}`, 15, y);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 130, y);
    y += 15;

    // Employee details section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("EMPLOYEE DETAILS", 15, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const employeeDetails = [
      ["Employee Name:", employee.fullName],
      ["Employee ID:", employee.employeeId || "N/A"],
      ["ID Number:", employee.idNo || "N/A"],
      ["Role:", employee.role || "N/A"],
      ["Department:", employee.department || "N/A"],
      ["Employment Date:", employee.employmentDate || "N/A"],
    ];

    employeeDetails.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 15, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, 80, y);
      y += 6;
    });

    y += 10;

    // Salary breakdown table
    const tableData = [
      ["EARNINGS", "", "DEDUCTIONS", ""],
      [
        "Basic Salary",
        formatCurrency(employee.basicSalary),
        "SHA Contribution",
        formatCurrency(employee.sha),
      ],
      ["", "", "NSSF Contribution", formatCurrency(employee.nssf)],
      ["", "", "Advance Deduction", formatCurrency(employee.advance)],
      ["", "", "", ""],
      [
        "GROSS PAY",
        formatCurrency(employee.basicSalary),
        "TOTAL DEDUCTIONS",
        formatCurrency(employee.sha + employee.nssf + employee.advance),
      ],
      ["", "", "", ""],
      ["", "", "NET PAY", formatCurrency(employee.netPay)],
    ];

    autoTable(doc, {
      startY: y,
      body: tableData,
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 45 },
        1: { halign: "right", cellWidth: 35 },
        2: { fontStyle: "bold", cellWidth: 45 },
        3: { halign: "right", cellWidth: 35 },
      },
      didParseCell: (data) => {
        // Style specific rows
        if (data.row.index === 0) {
          // Header row
          data.cell.styles.fillColor = [26, 58, 95];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = "bold";
        }
        if (data.row.index === 5 || data.row.index === 7) {
          // Total rows
          data.cell.styles.fillColor = [240, 240, 240];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 20;

    // Bank details if available
    if (employee.bank && employee.bankAccount) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("BANK DETAILS", 15, y);
      y += 8;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Bank: ${employee.bank}`, 15, y);
      y += 6;
      doc.text(`Account Number: ${employee.bankAccount}`, 15, y);
      y += 6;
      doc.text(`Bank Code: ${employee.bankCode || "N/A"}`, 15, y);
      y += 15;
    }

    // Statutory deductions info
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("STATUTORY DEDUCTIONS:", 15, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`SHA No: ${employee.shaNo || "N/A"}`, 15, y);
    doc.text(`NSSF No: ${employee.nssfNo || "N/A"}`, 100, y);
    y += 6;
    if (isKenya) {
      doc.text(`KRA PIN: ${employee.kraPin || "N/A"}`, 15, y);
    }

    // Footer
    y = doc.internal.pageSize.height - 30;
    doc.setDrawColor(0, 0, 0);
    doc.line(15, y, 195, y);
    y += 8;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(
      "This is a computer-generated payslip and does not require a signature.",
      105,
      y,
      { align: "center" },
    );
    y += 5;
    doc.text(
      `Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
      105,
      y,
      { align: "center" },
    );

    return doc;
  };

  // Download the payslip PDF for a single employee (the pre-existing
  // behaviour that used to live inline here).
  const exportEmployeePayslip = async (employee: Employee) => {
    const monthName = new Date(2023, settings.payrollMonth - 1).toLocaleString(
      "default",
      { month: "long" },
    );
    const doc = await buildEmployeePayslipPdf(employee);
    doc.save(
      `Payslip_${(employee.fullName || "Employee").replace(/\s+/g, "_")}_${monthName}_${settings.payrollYear}.pdf`,
    );
  };

  // ─── Payslip delivery (email / WhatsApp) ────────────────────────────────

  const savePayslipConfig = async (patch: Partial<PayslipDeliveryConfig>) => {
    const merged = { ...payslipConfigRef.current, ...patch };
    setPayslipConfig(merged);
    try {
      await cloudStorageService.set(PAYSLIP_CONFIG_KEY, merged, stationId);
    } catch (e) {
      console.warn("[payslip-config] save failed:", e);
    }
  };

  const appendPayslipLog = async (entries: PayslipSendLogEntry[]) => {
    const updated = [...entries, ...payslipLogRef.current].slice(0, 200);
    setPayslipLog(updated);
    try {
      await cloudStorageService.set(PAYSLIP_LOG_KEY, updated, stationId);
    } catch (e) {
      console.warn("[payslip-log] save failed:", e);
    }
  };

  /** Immediately invalidate every payslip short-link for this owner. */
  const handleRevokeLinks = async () => {
    if (revokingLinks) return;
    setRevokingLinks(true);
    try {
      const n = await revokePayslipShortlinks();
      if (n > 0) {
        toastSuccess(`Revoked ${n} payslip link(s) — they no longer resolve.`);
      } else {
        toastError("No payslip links were registered yet.");
      }
    } catch (e) {
      toastError("Revoke failed: " + (e as Error).message);
    } finally {
      setRevokingLinks(false);
    }
  };

  /**
   * Send one employee's payslip PDF via the configured channel. The
   * recipient email/phone comes from the employee's OWN payroll record — no
   * manual re-entry. When the API gateway is not configured, the configured
   * web-redirect fallback (WhatsApp Web via wa.me, or the default mail
   * client via mailto:) is offered instead — manual sends only; auto-send
   * never opens web tabs.
   * Returns the log entry plus any pending web fallback links (queued for
   * the bulk modal or opened directly for single sends).
   */
  const sendPayslipToEmployee = async (
    employee: Employee,
    manual = true,
    openWebFallback = false,
  ): Promise<{
    entry: PayslipSendLogEntry;
    fallbacks: PayslipWebFallback[];
  }> => {
    const cfg = payslipConfigRef.current;
    const periodLabel = currentPeriodLabel();
    const monthName = new Date(2023, settings.payrollMonth - 1).toLocaleString(
      "default",
      { month: "long" },
    );
    const filename = `Payslip_${(employee.fullName || "Employee").replace(/\s+/g, "_")}_${monthName}_${settings.payrollYear}.pdf`;
    const recipient =
      cfg.channel === "email"
        ? employee.email
        : cfg.channel === "whatsapp"
          ? normalizePhoneForSending(employee.phone)
          : employee.email || normalizePhoneForSending(employee.phone);

    const entry: PayslipSendLogEntry = {
      id: `ps_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      employeeId: employee.employeeId || String(employee.id || ""),
      employeeName: employee.fullName || "Employee",
      period: periodLabel,
      channel: cfg.channel,
      recipient: maskRecipient(recipient),
      status: "pending",
      sentAt: new Date().toISOString(),
      manual,
      method: "api",
    };
    let pendingFallbacks: PayslipWebFallback[] = [];

    try {
      // 1. Build the PDF (no download).
      const doc = await buildEmployeePayslipPdf(employee);
      const pdfBlob = doc.output("blob");
      const pdfBase64 = doc.output("datauristring").split(",")[1] || "";

      // 2. Upload to public storage (WhatsApp document link + email fallback).
      const { url } = await uploadPayslipPdf(
        pdfBlob,
        user?.id || "unknown",
        filename,
      );

      // 2b. Register a short opaque link (/p/<code>) for user-visible text:
      // the raw storage URL (which leaks owner uid + filename + storage path)
      // never leaves the app. The short link is expiring + revocable.
      let shortUrl: string | undefined;
      try {
        const link = await createPayslipShortlink({
          rawUrl: url,
          employeeName: employee.fullName || "Employee",
          periodLabel,
          expiryDays: cfg.linkExpiryDays ?? 7,
        });
        shortUrl = link.shortUrl;
      } catch {
        // Short-link creation failed (offline / transient) — fall back to the
        // raw URL so delivery is never blocked by the privacy wrapper.
        shortUrl = undefined;
      }

      // 3. Deliver via the configured channel(s).
      const gateway: CommGatewayConfig = {
        emailEnabled: commGateway?.emailEnabled,
        emailProvider: commGateway?.emailProvider,
        emailApiKey: commGateway?.emailApiKey,
        emailDomain: commGateway?.emailDomain,
        senderEmail: commGateway?.senderEmail,
        smtpUser: commGateway?.smtpUser,
        stationName:
          commGateway?.stationName || settings.organizationName || "Payroll",
        whatsappEnabled: commGateway?.whatsappEnabled,
        whatsappPhone: commGateway?.whatsappPhone,
        whatsappToken: commGateway?.whatsappToken,
      };
      const result = await deliverPayslip({
        channel: cfg.channel,
        toEmail: employee.email,
        toPhone: employee.phone,
        filename,
        pdfBase64,
        publicUrl: url,
        shortUrl,
        periodLabel,
        employeeName: employee.fullName || "Employee",
        gateway,
      });

      if (result.success) {
        entry.status = "sent";
        entry.method = "api";
      } else if (cfg.webFallback && manual && result.webFallbacks?.length) {
        // API gateway missing → web-redirect fallback (WhatsApp Web / mailto).
        pendingFallbacks = result.webFallbacks;
        if (openWebFallback) {
          // Single send: open the web app(s) right now (user gesture, so
          // popup blockers allow it).
          for (const fb of pendingFallbacks) {
            window.open(fb.url, "_blank", "noopener");
          }
          entry.status = "sent";
          entry.method = "web";
          entry.error = undefined;
          pendingFallbacks = [];
        } else {
          entry.status = "pending";
          entry.error = "waiting for web send (open the link below)";
        }
      } else {
        entry.status = "failed";
        if (result.error) entry.error = result.error;
      }
    } catch (e) {
      entry.status = "failed";
      entry.error = (e as Error).message;
    }
    return { entry, fallbacks: pendingFallbacks };
  };

  /** Open a queued web fallback and mark its entry as sent-via-web. */
  const openWebFallbackLink = async (queued: {
    entry: PayslipSendLogEntry;
    fallbacks: PayslipWebFallback[];
  }) => {
    for (const fb of queued.fallbacks) {
      window.open(fb.url, "_blank", "noopener");
    }
    const sentEntry: PayslipSendLogEntry = {
      ...queued.entry,
      status: "sent",
      method: "web",
      error: undefined,
    };
    setWebSendQueue((q) =>
      q.filter((item) => item.entry.id !== queued.entry.id),
    );
    await appendPayslipLog([sentEntry]);
    toastSuccess(
      `Opened ${queued.entry.channel === "whatsapp" ? "WhatsApp" : "email"} for ${queued.entry.employeeName} — hit Send there to complete delivery.`,
    );
  };

  /** Send payslips to ALL employees who have contact info. */
  const sendAllPayslips = async (manual = true) => {
    if (sendingPayslips) return;
    setSendingPayslips(true);
    setWebSendQueue([]);
    const results: PayslipSendLogEntry[] = [];
    const queuedWeb: {
      entry: PayslipSendLogEntry;
      fallbacks: PayslipWebFallback[];
    }[] = [];
    try {
      for (const employee of employees) {
        // Skip employees with no contact info at all — log them as failed so
        // the owner knows their record is incomplete.
        if (!employee.email && !employee.phone) {
          results.push({
            id: `ps_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            employeeId: employee.employeeId || String(employee.id || ""),
            employeeName: employee.fullName || "Employee",
            period: currentPeriodLabel(),
            channel: payslipConfigRef.current.channel,
            recipient: "",
            status: "failed",
            error: "no email or phone on file",
            sentAt: new Date().toISOString(),
            manual,
          });
          continue;
        }
        const { entry, fallbacks } = await sendPayslipToEmployee(
          employee,
          manual,
          false,
        );
        // Web fallback: queue for the modal (one click per employee) rather
        // than logging as failed.
        if (entry.status === "pending" && fallbacks.length > 0) {
          queuedWeb.push({ entry, fallbacks });
        } else {
          results.push(entry);
        }
        // Small yield so the UI stays responsive during a large batch.
        await new Promise((r) => setTimeout(r, 150));
      }
      // Auto-open EVERY web-redirect link at once, in the same user gesture
      // (each goes to a different employee). window.open returns null when
      // the browser's popup blocker refuses — those stay in the queue with
      // per-employee buttons so nothing is lost (belt + suspenders).
      if (queuedWeb.length > 0) {
        const blocked: typeof queuedWeb = [];
        const openedEntries: PayslipSendLogEntry[] = [];
        for (const queued of queuedWeb) {
          let opened = true;
          for (const fb of queued.fallbacks) {
            const w = window.open(fb.url, "_blank", "noopener");
            if (!w) opened = false;
          }
          if (opened) {
            openedEntries.push({
              ...queued.entry,
              status: "sent",
              method: "web",
              error: undefined,
            });
          } else {
            blocked.push(queued);
          }
        }
        if (blocked.length > 0) setWebSendQueue(blocked);
        if (openedEntries.length > 0) {
          await appendPayslipLog(openedEntries);
        }
        const opened = openedEntries.length;
        const needsClick = blocked.length;
        if (needsClick > 0) {
          toastError(
            `${opened} web link(s) opened automatically; ${needsClick} were blocked by the popup blocker — click each button below to finish.`,
          );
        } else {
          toastSuccess(
            `Opened ${opened} web link(s) — hit Send in each one to deliver.`,
          );
        }
      }
      if (results.length > 0) await appendPayslipLog(results);
      const sent = results.filter((r) => r.status === "sent").length;
      const failed = results.length - sent;
      if (queuedWeb.length === 0 && failed === 0) {
        toastSuccess(`Payslips sent to ${sent} employee(s).`);
      } else if (sent > 0) {
        toastError(
          `Sent ${sent} payslip(s); ${failed} failed. Check the send log below.`,
        );
      } else {
        toastError(
          `All ${failed} payslip(s) failed to send. Check the gateway config (Communication → Settings) and the send log.`,
        );
      }
    } finally {
      setSendingPayslips(false);
    }
  };

  // Auto-send: fires the first time the app is open on/after the configured
  // day of the month (checked on mount + hourly). Cloud-synced config means
  // the schedule is consistent across devices; the lastAutoSentPeriod guard
  // prevents duplicate sends.
  useEffect(() => {
    const maybeAutoSend = () => {
      const cfg = payslipConfigRef.current;
      if (!cfg.enabled || !cfg.autoSend) return;
      if (!user || employees.length === 0) return;
      const today = new Date();
      if (today.getDate() < cfg.sendDay) return;
      const period = currentPeriodKey();
      if (cfg.lastAutoSentPeriod === period) return;
      void (async () => {
        await sendAllPayslips(false);
        await savePayslipConfig({ lastAutoSentPeriod: period });
      })();
    };
    maybeAutoSend();
    const timer = setInterval(maybeAutoSend, 60 * 60 * 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, employees.length]);

  // Excel import functionality
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setSaving(true);

      // Read the Excel file
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
      }) as any[][];

      // Skip empty rows and find header row
      const nonEmptyRows = jsonData.filter((row) =>
        row.some((cell) => cell !== undefined && cell !== ""),
      );
      if (nonEmptyRows.length < 2) {
        toastError(
          "Please ensure your Excel file has headers and employee data.",
        );
        return;
      }

      // Find the header row (look for common column names)
      let headerRowIndex = -1;
      let headers: string[] = [];

      for (let i = 0; i < nonEmptyRows.length; i++) {
        const row = nonEmptyRows[i];
        const rowString = row.join("").toLowerCase();

        // Look for key employee data indicators
        if (
          rowString.includes("name") ||
          rowString.includes("employee") ||
          rowString.includes("first") ||
          rowString.includes("salary")
        ) {
          headerRowIndex = i;
          headers = row.map((cell) => String(cell || "").trim());
          break;
        }
      }

      if (headerRowIndex === -1) {
        toastError(
          "Could not find header row. Please ensure your Excel file has column headers.",
        );
        return;
      }

      // Process employee data rows
      const employeeRows = nonEmptyRows.slice(headerRowIndex + 1);
      const importedEmployees: any[] = [];

      // Create mapping for common column variations
      const columnMapping: Record<string, string[]> = {
        firstName: ["first name", "fname", "first_name", "firstname"],
        lastName: ["last name", "lname", "last_name", "lastname", "surname"],
        fullName: [
          "full name",
          "name",
          "employee name",
          "full_name",
          "fullname",
        ],
        employeeId: [
          "employee id",
          "emp id",
          "id",
          "employee_id",
          "empid",
          "staff id",
        ],
        role: ["role", "position", "job title", "designation", "title"],
        department: ["department", "dept", "division", "section"],
        basicSalary: [
          "basic salary",
          "salary",
          "basic_salary",
          "basicsalary",
          "gross salary",
          "amount",
        ],
        idNo: ["id number", "id no", "national id", "id_number", "idno", "nin"],
        kraPin: ["kra pin", "pin", "kra_pin", "krapin", "tax pin"],
        shaNo: ["sha no", "sha number", "sha_no", "shanumber", "sha_number"],
        nssfNo: [
          "nssf no",
          "nssf number",
          "nssf_no",
          "nssfnumber",
          "nssf_number",
        ],
        bankAccount: [
          "bank account",
          "account",
          "account no",
          "bank_account",
          "accountno",
          "account_number",
        ],
        bankName: ["bank name", "bank", "bank_name", "bankname"],
        bankCode: ["bank code", "code", "bank_code", "bankcode"],
        phone: ["phone", "mobile", "contact", "telephone", "phone number"],
        email: ["email", "mail", "email address"],
        employmentDate: [
          "employment date",
          "date joined",
          "start date",
          "employment_date",
          "hire date",
        ],
        advance: ["advance", "loan", "advance amount", "deduction"],
        notes: ["notes", "remarks", "comments", "description"],
      };

      // Find column indices
      const getColumnIndex = (field: string): number => {
        const variations = columnMapping[field] || [field];
        for (const variation of variations) {
          const index = headers.findIndex((header) =>
            header.toLowerCase().includes(variation.toLowerCase()),
          );
          if (index !== -1) return index;
        }
        return -1;
      };

      // Process each employee row
      employeeRows.forEach((row) => {
        if (!row || row.length === 0) return;

        // Extract data using column mapping
        const firstName = String(row[getColumnIndex("firstName")] || "").trim();
        const lastName = String(row[getColumnIndex("lastName")] || "").trim();
        const fullName = String(
          row[getColumnIndex("fullName")] || `${firstName} ${lastName}`,
        ).trim();

        // Skip rows without essential data
        if (!firstName && !lastName && !fullName) return;

        const employeeData = {
          first_name: firstName || fullName.split(" ")[0] || "",
          last_name: lastName || fullName.split(" ").slice(1).join(" ") || "",
          employee_id: String(row[getColumnIndex("employeeId")] || "").trim(),
          role: String(row[getColumnIndex("role")] || "").trim(),
          department: String(row[getColumnIndex("department")] || "").trim(),
          basic_salary:
            parseFloat(
              String(row[getColumnIndex("basicSalary")] || "0").replace(
                /[^\d.-]/g,
                "",
              ),
            ) || 0,
          id_number: String(row[getColumnIndex("idNo")] || "").trim(),
          kra_pin: String(row[getColumnIndex("kraPin")] || "").trim(),
          sha_number: String(row[getColumnIndex("shaNo")] || "").trim(),
          nssf_number: String(row[getColumnIndex("nssfNo")] || "").trim(),
          bank_account: String(row[getColumnIndex("bankAccount")] || "").trim(),
          bank_name: String(row[getColumnIndex("bankName")] || "").trim(),
          bank_code: String(row[getColumnIndex("bankCode")] || "").trim(),
          phone: String(row[getColumnIndex("phone")] || "").trim(),
          email: String(row[getColumnIndex("email")] || "").trim(),
          employment_date: String(
            row[getColumnIndex("employmentDate")] ||
              new Date().toISOString().split("T")[0],
          ).trim(),
          advance_amount:
            parseFloat(
              String(row[getColumnIndex("advance")] || "0").replace(
                /[^\d.-]/g,
                "",
              ),
            ) || 0,
          notes: String(row[getColumnIndex("notes")] || "").trim(),
        };

        // Only add if we have basic required data
        if (employeeData.first_name || employeeData.last_name) {
          importedEmployees.push(employeeData);
        }
      });

      if (importedEmployees.length === 0) {
        toastError(
          "No valid employee data found in the Excel file. Please check the format and try again.",
        );
        return;
      }

      // Confirm before importing
      const confirmImport = confirm(
        `Found ${importedEmployees.length} employees to import. This will add them to your existing employee list. Continue?`,
      );

      if (!confirmImport) return;

      // Import employees directly to cloud storage + localStorage
      let successCount = 0;
      let errorCount = 0;
      const localImported: any[] = [];

      for (const employeeData of importedEmployees) {
        // Assign a stable employee_id if missing (was `Date.now() + Math.random()`
        // which produced a FLOAT id — breaks cloud lookups that compare with ===).
        const empId =
          employeeData.employee_id ||
          `EMP-${Date.now().toString(36).toUpperCase()}-${successCount}`;
        localImported.push({
          id: Date.now() + successCount, // integer, not float
          ...employeeData,
          employee_id: empId,
          sha_amount: 0,
          nssf_amount: 0,
          advance_amount: employeeData.advance_amount || 0,
          basic_salary: employeeData.basic_salary || 0,
          net_pay: calcNetPay({
            basicSalary: employeeData.basic_salary || 0,
            advance: employeeData.advance_amount || 0,
            sha: 0,
            nssf: 0,
          }),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        successCount++;
      }

      // Save imported employees to cloud + localStorage
      if (localImported.length > 0) {
        try {
          const cloudData =
            (await cloudStorageService.get<any[]>(
              "payroll_employees",
              stationId,
            )) || [];
          // De-duplicate: skip imported employees whose employee_id already
          // exists in cloud (was missing — re-importing the same file
          // created duplicates every time).
          const existingIds = new Set(
            cloudData.map((e: any) => e.employee_id).filter(Boolean),
          );
          const toAdd = localImported.filter(
            (emp) => !existingIds.has(emp.employee_id),
          );
          const skippedDupes = localImported.length - toAdd.length;
          if (toAdd.length === 0) {
            toastError(
              `All ${localImported.length} imported employees already exist (matched by Employee ID). No duplicates added.`,
            );
            return;
          }
          const updated = [...toAdd, ...cloudData];
          await cloudStorageService.set(
            "payroll_employees",
            updated,
            stationId,
          );
          localStorage.setItem(
            "fuelpro_payroll_employees",
            JSON.stringify(updated),
          );
          // Update local state
          setEmployees((prev) => [
            ...toAdd.map((emp, i) => ({
              id: emp.id,
              no: String(prev.length + i + 1),
              firstName: emp.first_name || "",
              lastName: emp.last_name || "",
              fullName: `${emp.first_name || ""} ${emp.last_name || ""}`.trim(),
              employeeId: emp.employee_id || "",
              role: emp.role || "",
              department: emp.department || "",
              basicSalary: emp.basic_salary || 0,
              sha: 0,
              nssf: 0,
              advance: emp.advance_amount || 0,
              netPay: emp.net_pay || 0,
              bank: emp.bank_name || "",
              bankCode: emp.bank_code || "",
              idNo: emp.id_number || "",
              kraPin: emp.kra_pin || "",
              shaNo: emp.sha_number || "",
              nssfNo: emp.nssf_number || "",
              bankAccount: emp.bank_account || "",
              phone: emp.phone || "",
              email: emp.email || "",
              employmentDate: emp.employment_date || "",
              notes: emp.notes || "",
            })),
            ...prev,
          ]);
          if (skippedDupes > 0) {
            toastSuccess(
              `Imported ${toAdd.length} employees. ${skippedDupes} duplicate(s) skipped (already exist by Employee ID).`,
            );
          }
        } catch (importErr) {
          // Was `catch { /* */ }` — silently swallowed, so the user saw
          // "Successfully imported" even when the cloud write failed.
          errorCount = localImported.length;
          console.error("Error saving imported employees to cloud:", importErr);
          toastError(
            "Failed to save imported employees to cloud: " +
              (importErr as Error).message,
          );
        }
      }

      // Show results
      if (successCount > 0 && errorCount === 0) {
        toastSuccess(`Successfully imported ${successCount} employees.`);
        await fetchEmployees(); // Refresh from cloud
      } else if (errorCount > 0) {
        toastError(
          `Import partially failed: ${errorCount} employee(s) could not be saved.`,
        );
      }
    } catch (error) {
      console.error("Error importing Excel file:", error);
      toastError(
        "Error reading Excel file. Please ensure it is a valid .xlsx file and try again.",
      );
    } finally {
      setImporting(false);
      setSaving(false);
      // Reset the file input
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  };

  // Other export functions (SHA, NSSF, Payroll lists)
  const exportShaList = () => {
    const wb = XLSX.utils.book_new();
    const monthName = new Date(2023, settings.payrollMonth - 1)
      .toLocaleString("default", { month: "long" })
      .toUpperCase();

    const shaData = [
      [
        `${(settings.organizationName || "ORGANIZATION").toUpperCase()} STAFF SHA LIST ${monthName} ${settings.payrollYear}`,
      ],
      [],
      ["S/NO.", "NAME", "ID NO.", "SHA NO.", "BASIC SALARY", "SHA AMOUNT"],
      ...employees.map((emp, index) => [
        index + 1,
        (emp.fullName || "").toUpperCase(),
        emp.idNo,
        emp.shaNo,
        emp.basicSalary,
        emp.sha,
      ]),
      [],
      [
        "TOTALS",
        "",
        "",
        "",
        employees.reduce((sum, emp) => sum + emp.basicSalary, 0),
        employees.reduce((sum, emp) => sum + emp.sha, 0),
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(shaData);
    ws["!cols"] = [
      { wch: 8 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "SHA List");
    XLSX.writeFile(wb, `SHA_List_${monthName}_${settings.payrollYear}.xlsx`);
  };

  const exportNssfList = () => {
    const wb = XLSX.utils.book_new();
    const monthName = new Date(2023, settings.payrollMonth - 1)
      .toLocaleString("default", { month: "long" })
      .toUpperCase();

    const nssfData = [
      [
        `${(settings.organizationName || "ORGANIZATION").toUpperCase()} STAFF NSSF LIST ${monthName} ${settings.payrollYear}`,
      ],
      [],
      ["S/NO.", "NAME", "ID NO.", "NSSF NO.", "AMOUNT"],
      ...employees.map((emp, index) => [
        index + 1,
        (emp.fullName || "").toUpperCase(),
        emp.idNo,
        emp.nssfNo,
        emp.nssf * 2, // Double the amount for NSSF list as per requirement
      ]),
      [],
      [
        "TOTALS",
        "",
        "",
        "",
        employees.reduce((sum, emp) => sum + emp.nssf * 2, 0),
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(nssfData);
    ws["!cols"] = [
      { wch: 8 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "NSSF List");
    XLSX.writeFile(wb, `NSSF_List_${monthName}_${settings.payrollYear}.xlsx`);
  };

  const exportPayrollList = () => {
    const wb = XLSX.utils.book_new();
    const monthName = new Date(2023, settings.payrollMonth - 1)
      .toLocaleString("default", { month: "long" })
      .toUpperCase();

    const payrollData = [
      [
        `${(settings.organizationName || "ORGANIZATION").toUpperCase()} COMPLETE PAYROLL LIST ${monthName} ${settings.payrollYear}`,
      ],
      [`Generated on: ${new Date().toLocaleDateString()}`],
      [],
      [
        "S/NO.",
        "NAME",
        "EMPLOYEE ID",
        "ROLE",
        "DEPARTMENT",
        "BASIC SALARY",
        "SHA",
        "NSSF",
        "ADVANCE",
        "NET PAY",
        "BANK",
        "ACCOUNT NUMBER",
      ],
      ...employees.map((emp, index) => [
        index + 1,
        (emp.fullName || "").toUpperCase(),
        emp.employeeId,
        (emp.role || "").toUpperCase(),
        (emp.department || "").toUpperCase(),
        emp.basicSalary,
        emp.sha,
        emp.nssf,
        emp.advance,
        emp.netPay,
        (emp.bank || "").toUpperCase(),
        emp.bankAccount,
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(payrollData);
    ws["!cols"] = [
      { wch: 8 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Payroll List");
    XLSX.writeFile(
      wb,
      `Payroll_List_${monthName}_${settings.payrollYear}.xlsx`,
    );
  };

  // Tab content
  const renderEmployeesTab = () => (
    <div className="p-2 md:p-6 space-y-2 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2 md:mb-6 gap-2 md:gap-4">
        <div className="w-full md:w-auto">
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-auto px-2 md:px-4 py-1 md:py-2 text-xs md:text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="flex flex-wrap gap-1 md:gap-2 w-full md:w-auto">
          <select
            value={entriesPerPage}
            onChange={(e) => setEntriesPerPage(Number(e.target.value))}
            className="px-1 md:px-3 py-1 md:py-2 text-xs md:text-base border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>

          <div className="relative inline-block">
            <button
              onClick={() => setShowExportOptions(!showExportOptions)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-200 text-xs md:text-sm font-medium rounded-xl transition-all active:scale-[0.98]"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Export</span>
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${showExportOptions ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {showExportOptions && (
              <div className="absolute right-0 top-full mt-2 w-48 md:w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl shadow-black/20 border border-gray-200 dark:border-gray-700 z-50 overflow-hidden origin-top-right animate-in fade-in slide-in-from-top-1 duration-150">
                <button
                  onClick={exportToExcel}
                  className="w-full text-left px-2 md:px-4 py-2 md:py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 md:gap-3 first:rounded-t-lg text-xs md:text-base"
                >
                  <FileSpreadsheet size={12} className="md:w-4 md:h-4" />
                  <span className="hidden md:inline">Export Employee List</span>
                  <span className="md:hidden">Employees</span>
                </button>
                <button
                  onClick={exportShaList}
                  className="w-full text-left px-2 md:px-4 py-2 md:py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 md:gap-3 text-xs md:text-base"
                >
                  <FileText size={12} className="md:w-4 md:h-4" />
                  <span className="hidden md:inline">Export SHA List</span>
                  <span className="md:hidden">SHA</span>
                </button>
                <button
                  onClick={exportNssfList}
                  className="w-full text-left px-2 md:px-4 py-2 md:py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 md:gap-3 text-xs md:text-base"
                >
                  <FileText size={12} className="md:w-4 md:h-4" />
                  <span className="hidden md:inline">Export NSSF List</span>
                  <span className="md:hidden">NSSF</span>
                </button>
                <button
                  onClick={exportPayrollList}
                  className="w-full text-left px-2 md:px-4 py-2 md:py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 md:gap-3 text-xs md:text-base"
                >
                  <BarChart3 size={12} className="md:w-4 md:h-4" />
                  <span className="hidden md:inline">Export Payroll List</span>
                  <span className="md:hidden">Payroll</span>
                </button>
                <button
                  onClick={exportCombinedPayrollExcel}
                  disabled={saving}
                  className="w-full text-left px-2 md:px-4 py-2 md:py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 md:gap-3 last:rounded-b-lg text-xs md:text-base"
                >
                  {saving ? (
                    <Loader2 className="animate-spin" size={12} />
                  ) : (
                    <FileSpreadsheet size={12} className="md:w-4 md:h-4" />
                  )}
                  <span className="hidden md:inline">
                    PAYROLL AND CPC CENTRALIZED SALARY PROCESSING
                  </span>
                  <span className="md:hidden">PAYROLL & CPC</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="btn btn-secondary px-2 md:px-4 py-1 md:py-2 text-xs md:text-base"
          >
            {importing ? (
              <Loader2 className="animate-spin" size={12} />
            ) : (
              <Upload size={12} className="md:w-4 md:h-4" />
            )}
            <span className="hidden sm:inline ml-1">
              {importing ? "Importing..." : "Import Excel"}
            </span>
            <span className="sm:hidden">
              {importing ? "Loading..." : "Import"}
            </span>
          </button>

          <button
            onClick={openAddEmployeeModal}
            className="btn btn-primary px-2 md:px-4 py-1 md:py-2 text-xs md:text-base"
          >
            <Plus size={12} className="md:w-4 md:h-4" />
            <span className="hidden sm:inline ml-1">Add Employee</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[50vh] md:max-h-[60vh] overflow-y-auto">
        <table className="w-full border-collapse bg-white dark:bg-gray-800 rounded-lg shadow text-xs md:text-base">
          <thead>
            <tr className="bg-blue-900 text-gray-900 dark:text-white">
              <th className="p-1 md:p-3 text-left text-xs md:text-base">No.</th>
              <th className="p-1 md:p-3 text-left text-xs md:text-base">
                Name
              </th>
              <th className="p-1 md:p-3 text-left text-xs md:text-base hidden sm:table-cell">
                Role
              </th>
              <th className="p-1 md:p-3 text-left text-xs md:text-base hidden md:table-cell">
                Dept
              </th>
              <th className="p-1 md:p-3 text-left text-xs md:text-base">
                Salary
              </th>
              <th className="p-1 md:p-3 text-left text-xs md:text-base">
                <div className="flex items-center justify-between">
                  <span className="truncate">{columnNames.sha}</span>
                  <button
                    onClick={() => editColumnName("sha")}
                    className="p-0.5 md:p-1 hover:bg-white/20 rounded"
                  >
                    <Edit size={10} className="md:w-3 md:h-3" />
                  </button>
                </div>
              </th>
              <th className="p-1 md:p-3 text-left text-xs md:text-base">
                <div className="flex items-center justify-between">
                  <span className="truncate">{columnNames.nssf}</span>
                  <button
                    onClick={() => editColumnName("nssf")}
                    className="p-0.5 md:p-1 hover:bg-white/20 rounded"
                  >
                    <Edit size={10} className="md:w-3 md:h-3" />
                  </button>
                </div>
              </th>
              <th className="p-1 md:p-3 text-left text-xs md:text-base hidden sm:table-cell">
                <div className="flex items-center justify-between">
                  <span className="truncate">{columnNames.advance}</span>
                  <button
                    onClick={() => editColumnName("advance")}
                    className="p-0.5 md:p-1 hover:bg-white/20 rounded"
                  >
                    <Edit size={10} className="md:w-3 md:h-3" />
                  </button>
                </div>
              </th>
              <th className="p-1 md:p-3 text-left text-xs md:text-base">Net</th>
              <th className="p-1 md:p-3 text-left text-xs md:text-base hidden md:table-cell">
                <div className="flex items-center justify-between">
                  <span className="truncate">{columnNames.bank}</span>
                  <button
                    onClick={() => editColumnName("bank")}
                    className="p-0.5 md:p-1 hover:bg-white/20 rounded"
                  >
                    <Edit size={10} className="md:w-3 md:h-3" />
                  </button>
                </div>
              </th>
              <th className="p-1 md:p-3 text-left text-xs md:text-base hidden lg:table-cell">
                <div className="flex items-center justify-between">
                  <span className="truncate">{columnNames.bankCode}</span>
                  <button
                    onClick={() => editColumnName("bankCode")}
                    className="p-0.5 md:p-1 hover:bg-white/20 rounded"
                  >
                    <Edit size={10} className="md:w-3 md:h-3" />
                  </button>
                </div>
              </th>
              <th className="p-1 md:p-3 text-left text-xs md:text-base">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedEmployees.map((employee) => (
              <tr
                key={employee.id}
                className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <td className="p-1 md:p-3 text-xs md:text-base">
                  {employee.no}
                </td>
                <td className="p-1 md:p-3 text-xs md:text-base truncate max-w-20 md:max-w-none">
                  {employee.fullName}
                </td>
                <td className="p-1 md:p-3 text-xs md:text-base hidden sm:table-cell truncate">
                  {employee.role}
                </td>
                <td className="p-1 md:p-3 text-xs md:text-base hidden md:table-cell truncate">
                  {employee.department}
                </td>
                <td className="p-1 md:p-3 text-xs md:text-base">
                  {formatCurrency(employee.basicSalary)}
                </td>
                <td className="p-1 md:p-3">
                  <input
                    type="number"
                    value={employee.sha}
                    onChange={(e) =>
                      updateCell(employee, "sha", e.target.value)
                    }
                    className="w-12 md:w-20 px-1 md:px-2 py-0.5 md:py-1 text-xs md:text-base border border-gray-300 dark:border-gray-600 rounded bg-transparent"
                  />
                </td>
                <td className="p-1 md:p-3">
                  <input
                    type="number"
                    value={employee.nssf}
                    onChange={(e) =>
                      updateCell(employee, "nssf", e.target.value)
                    }
                    className="w-12 md:w-20 px-1 md:px-2 py-0.5 md:py-1 text-xs md:text-base border border-gray-300 dark:border-gray-600 rounded bg-transparent"
                  />
                </td>
                <td className="p-1 md:p-3 hidden sm:table-cell">
                  <input
                    type="number"
                    value={employee.advance}
                    onChange={(e) =>
                      updateCell(employee, "advance", e.target.value)
                    }
                    className="w-12 md:w-20 px-1 md:px-2 py-0.5 md:py-1 text-xs md:text-base border border-gray-300 dark:border-gray-600 rounded bg-transparent"
                  />
                </td>
                <td className="p-1 md:p-3 text-xs md:text-base">
                  {formatCurrency(employee.netPay)}
                </td>
                <td className="p-1 md:p-3 hidden md:table-cell">
                  <input
                    type="text"
                    value={employee.bank}
                    onChange={(e) =>
                      updateCell(employee, "bank", e.target.value)
                    }
                    className="w-16 md:w-28 px-1 md:px-2 py-0.5 md:py-1 text-xs md:text-base border border-gray-300 dark:border-gray-600 rounded bg-transparent"
                  />
                </td>
                <td className="p-1 md:p-3 hidden lg:table-cell">
                  <input
                    type="text"
                    value={employee.bankCode}
                    onChange={(e) =>
                      updateCell(employee, "bankCode", e.target.value)
                    }
                    className="w-12 md:w-20 px-1 md:px-2 py-0.5 md:py-1 text-xs md:text-base border border-gray-300 dark:border-gray-600 rounded bg-transparent"
                  />
                </td>
                <td className="p-1 md:p-3">
                  <div className="flex gap-1 md:gap-2">
                    <button
                      onClick={() => openEditEmployeeModal(employee)}
                      className="p-0.5 md:p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded"
                    >
                      <Edit size={10} className="md:w-3.5 md:h-3.5" />
                    </button>
                    <button
                      onClick={() => confirmDeleteEmployee(employee)}
                      className="p-0.5 md:p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                    >
                      <Trash2 size={10} className="md:w-3.5 md:h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-0">
        <div className="text-xs md:text-sm text-gray-600 dark:text-gray-500 dark:text-gray-400">
          <span className="hidden md:inline">
            Showing {startIndex + 1} to{" "}
            {Math.min(endIndex, filteredEmployees.length)} of{" "}
            {filteredEmployees.length} entries
          </span>
          <span className="md:hidden">
            {startIndex + 1}-{Math.min(endIndex, filteredEmployees.length)} of{" "}
            {filteredEmployees.length}
          </span>
        </div>
        <div className="flex gap-1 md:gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
            disabled={safePage === 1}
            className="px-2 md:px-3 py-1 md:py-2 text-xs md:text-base border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
          >
            <span className="hidden md:inline">Previous</span>
            <span className="md:hidden">Prev</span>
          </button>
          <span className="px-2 md:px-3 py-1 md:py-2 text-xs md:text-base bg-blue-900 text-gray-900 dark:text-white rounded">
            {safePage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
            disabled={safePage === totalPages}
            className="px-2 md:px-3 py-1 md:py-2 text-xs md:text-base border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4 mt-2 md:mt-6 p-2 md:p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-xs md:text-base">
        <div className="col-span-2 md:col-span-1">
          <strong>Gross:</strong>{" "}
          <span className="block md:inline">{formatCurrency(totalGross)}</span>
        </div>
        <div>
          <strong>SHA:</strong>{" "}
          <span className="block md:inline">{formatCurrency(totalSha)}</span>
        </div>
        <div>
          <strong>NSSF:</strong>{" "}
          <span className="block md:inline">{formatCurrency(totalNssf)}</span>
        </div>
        <div>
          <strong>Advances:</strong>{" "}
          <span className="block md:inline">
            {formatCurrency(totalAdvances)}
          </span>
        </div>
        <div className="col-span-2 md:col-span-1 font-bold text-green-600">
          <strong>Net:</strong>{" "}
          <span className="block md:inline">{formatCurrency(totalNet)}</span>
        </div>
      </div>

      {/* Headcount by Department */}
      {employees.length > 0 && (
        <div className="mt-2 md:mt-4 p-2 md:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
            Headcount by Department ({employees.length} total)
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(
              employees.reduce<Record<string, number>>((acc, emp) => {
                const dept = emp.department || "Unassigned";
                acc[dept] = (acc[dept] || 0) + 1;
                return acc;
              }, {}),
            )
              .sort((a, b) => b[1] - a[1])
              .map(([dept, count]) => (
                <span
                  key={dept}
                  className="px-3 py-1 bg-white dark:bg-gray-700 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                >
                  {dept}: {count}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      <div className="grid grid-cols-2 md:flex gap-2 md:gap-4 flex-wrap">
        <button
          onClick={() => setShowShaModal(true)}
          className="btn btn-secondary px-2 md:px-4 py-1 md:py-2 text-xs md:text-base"
        >
          <Calculator size={12} className="md:w-4 md:h-4" />
          <span className="hidden sm:inline ml-1">Edit SHA for All</span>
          <span className="sm:hidden ml-1">SHA</span>
        </button>
        <button
          onClick={() => setShowNssfModal(true)}
          className="btn btn-secondary px-2 md:px-4 py-1 md:py-2 text-xs md:text-base"
        >
          <Calculator size={12} className="md:w-4 md:h-4" />
          <span className="hidden sm:inline ml-1">Edit NSSF for All</span>
          <span className="sm:hidden ml-1">NSSF</span>
        </button>
        <button
          onClick={exportShaList}
          className="btn btn-outline px-2 md:px-4 py-1 md:py-2 text-xs md:text-base"
        >
          <FileText size={12} className="md:w-4 md:h-4" />
          <span className="hidden sm:inline ml-1">Export SHA List</span>
          <span className="sm:hidden ml-1">SHA List</span>
        </button>
        <button
          onClick={exportNssfList}
          className="btn btn-outline px-2 md:px-4 py-1 md:py-2 text-xs md:text-base"
        >
          <FileText size={12} className="md:w-4 md:h-4" />
          <span className="hidden sm:inline ml-1">Export NSSF List</span>
          <span className="sm:hidden ml-1">NSSF List</span>
        </button>
        <button
          onClick={exportPayrollList}
          className="btn btn-outline px-2 md:px-4 py-1 md:py-2 text-xs md:text-base"
        >
          <BarChart3 size={12} className="md:w-4 md:h-4" />
          <span className="hidden sm:inline ml-1">Export Payroll List</span>
          <span className="sm:hidden ml-1">Payroll</span>
        </button>
        <button
          onClick={exportCombinedPayrollExcel}
          disabled={saving}
          className="btn btn-primary px-2 md:px-4 py-1 md:py-2 text-xs md:text-base col-span-2 md:col-span-1 flex items-center gap-2"
        >
          {saving ? (
            <Loader2 className="animate-spin" size={12} />
          ) : (
            <FileSpreadsheet size={12} className="md:w-4 md:h-4" />
          )}
          <span className="hidden sm:inline">PAYROLL</span>
          <span className="sm:hidden">PAYROLL</span>
        </button>

        <button
          onClick={exportCPCCentralizedExcel}
          disabled={saving}
          className="btn btn-success px-2 md:px-4 py-1 md:py-2 text-xs md:text-base col-span-2 md:col-span-1 flex items-center gap-2"
        >
          {saving ? (
            <Loader2 className="animate-spin" size={12} />
          ) : (
            <FileSpreadsheet size={12} className="md:w-4 md:h-4" />
          )}
          <span className="hidden sm:inline">CPC CENTRALIZED</span>
          <span className="sm:hidden">CPC CENTRALIZED</span>
        </button>

        <button
          onClick={() =>
            navigateToTab("expenses", {
              category: "salaries",
              amount: totalNet,
              description: `Payroll — ${employees.length} employee(s) (net pay)`,
              reference: `PAYROLL-${new Date().toISOString().slice(0, 10)}`,
              paymentMethod: "Bank Transfer",
            } satisfies ExpensePrefill)
          }
          disabled={totalNet <= 0}
          className="btn btn-primary px-2 md:px-4 py-1 md:py-2 text-xs md:text-base col-span-2 md:col-span-1 flex items-center gap-2 disabled:opacity-50"
          title="Record this payroll total as an expense in the Expense Tracker"
        >
          <Receipt size={12} className="md:w-4 md:h-4" />
          <span className="hidden sm:inline">RECORD EXPENSE</span>
          <span className="sm:hidden">EXPENSE</span>
        </button>
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="p-2 md:p-6 space-y-2 md:space-y-6 max-h-[60vh] md:max-h-[70vh] overflow-y-auto">
      <h3 className="text-lg md:text-xl font-bold mb-2 md:mb-4">
        Organization Settings
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-6">
        <div className="form-group">
          <label className="text-xs md:text-sm">Organization Name</label>
          <input
            type="text"
            value={settings.organizationName}
            onChange={(e) => {
              const updatedSettings = {
                ...settings,
                organizationName: e.target.value,
              };
              setSettings(updatedSettings);
              saveSettings(updatedSettings);
            }}
            className="text-xs md:text-base px-2 md:px-3 py-1 md:py-2"
          />
        </div>

        <div className="form-group">
          <label className="text-xs md:text-sm">Address</label>
          <input
            type="text"
            value={settings.organizationAddress}
            onChange={(e) => {
              const updatedSettings = {
                ...settings,
                organizationAddress: e.target.value,
              };
              setSettings(updatedSettings);
              saveSettings(updatedSettings);
            }}
            className="text-xs md:text-base px-2 md:px-3 py-1 md:py-2"
          />
        </div>

        <div className="form-group">
          <label className="text-xs md:text-sm">Phone</label>
          <input
            type="text"
            value={settings.organizationPhone}
            onChange={(e) => {
              const updatedSettings = {
                ...settings,
                organizationPhone: e.target.value,
              };
              setSettings(updatedSettings);
              saveSettings(updatedSettings);
            }}
            className="text-xs md:text-base px-2 md:px-3 py-1 md:py-2"
          />
        </div>

        <div className="form-group">
          <label className="text-xs md:text-sm">Email</label>
          <input
            type="email"
            value={settings.organizationEmail}
            onChange={(e) => {
              const updatedSettings = {
                ...settings,
                organizationEmail: e.target.value,
              };
              setSettings(updatedSettings);
              saveSettings(updatedSettings);
            }}
            className="text-xs md:text-base px-2 md:px-3 py-1 md:py-2"
          />
        </div>
      </div>

      {/* Logo Upload */}
      <div className="form-group">
        <label className="text-xs md:text-sm">Organization Logo</label>
        <div
          onClick={() => logoInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-2 md:p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
        >
          {settings.organizationLogo ? (
            <img
              src={settings.organizationLogo}
              alt="Organization Logo"
              className="max-h-16 md:max-h-32 mx-auto mb-1 md:mb-2"
            />
          ) : (
            <div className="flex flex-col items-center">
              <Image
                size={24}
                className="md:w-12 md:h-12 text-gray-500 dark:text-gray-400 mb-1 md:mb-2"
              />
              <p className="text-gray-500 text-xs md:text-base">
                Click to upload logo
              </p>
            </div>
          )}
        </div>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          onChange={handleLogoUpload}
          className="hidden"
        />
      </div>

      {/* Payroll Settings */}
      <h3 className="text-lg md:text-xl font-bold mb-2 md:mb-4 mt-4 md:mt-8">
        Payroll Settings
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-6">
        <div className="form-group">
          <label className="text-xs md:text-sm">Payroll Month</label>
          <select
            value={settings.payrollMonth}
            onChange={(e) => {
              const updatedSettings = {
                ...settings,
                payrollMonth: Number(e.target.value),
              };
              setSettings(updatedSettings);
              saveSettings(updatedSettings);
            }}
            className="text-xs md:text-base px-2 md:px-3 py-1 md:py-2"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2023, i).toLocaleString("default", { month: "long" })}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="text-xs md:text-sm">Year</label>
          <input
            type="number"
            value={settings.payrollYear}
            onChange={(e) => {
              const updatedSettings = {
                ...settings,
                payrollYear: Number(e.target.value),
              };
              setSettings(updatedSettings);
              saveSettings(updatedSettings);
            }}
            className="text-xs md:text-base px-2 md:px-3 py-1 md:py-2"
          />
        </div>

        <div className="form-group">
          <label className="text-xs md:text-sm">SHA Percentage (%)</label>
          <input
            type="number"
            step="0.01"
            value={settings.shaPercentage}
            onChange={(e) => {
              const updatedSettings = {
                ...settings,
                shaPercentage: Number(e.target.value),
              };
              setSettings(updatedSettings);
              saveSettings(updatedSettings);
              setShaPercentage(Number(e.target.value));
            }}
            className="text-xs md:text-base px-2 md:px-3 py-1 md:py-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            Minimum contribution: {stationCurrencySymbol} 300 (enforced
            automatically)
          </p>
        </div>

        <div className="form-group">
          <label className="text-xs md:text-sm">
            NSSF Amount ({stationCurrencySymbol})
          </label>
          <input
            type="number"
            step="0.01"
            value={settings.nssfAmount}
            onChange={(e) => {
              const updatedSettings = {
                ...settings,
                nssfAmount: Number(e.target.value),
              };
              setSettings(updatedSettings);
              saveSettings(updatedSettings);
              setNssfAmount(Number(e.target.value));
            }}
            className="text-xs md:text-base px-2 md:px-3 py-1 md:py-2"
          />
        </div>
      </div>

      {/* Originator Account Settings */}
      <h3 className="text-lg md:text-xl font-bold mb-2 md:mb-4 mt-4 md:mt-8">
        Bank Transfer Settings
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-6">
        <div className="form-group">
          <label className="text-xs md:text-sm">Originator Account</label>
          <input
            type="text"
            value={settings.originatorAccount}
            onChange={(e) => {
              const updatedSettings = {
                ...settings,
                originatorAccount: e.target.value,
              };
              setSettings(updatedSettings);
              saveSettings(updatedSettings);
            }}
            className="text-xs md:text-base px-2 md:px-3 py-1 md:py-2"
          />
        </div>

        <div className="form-group">
          <label className="text-xs md:text-sm">Branch DAO</label>
          <input
            type="text"
            value={settings.branchDao}
            onChange={(e) => {
              const updatedSettings = {
                ...settings,
                branchDao: e.target.value,
              };
              setSettings(updatedSettings);
              saveSettings(updatedSettings);
            }}
            className="text-xs md:text-base px-2 md:px-3 py-1 md:py-2"
          />
        </div>

        <div className="form-group">
          <label className="text-xs md:text-sm">Orig Code</label>
          <input
            type="text"
            value={settings.origCode}
            onChange={(e) => {
              const updatedSettings = { ...settings, origCode: e.target.value };
              setSettings(updatedSettings);
              saveSettings(updatedSettings);
            }}
            className="text-xs md:text-base px-2 md:px-3 py-1 md:py-2"
          />
        </div>

        <div className="form-group">
          <label className="text-xs md:text-sm">Reference</label>
          <input
            type="text"
            value={settings.reference}
            onChange={(e) => {
              const updatedSettings = {
                ...settings,
                reference: e.target.value,
              };
              setSettings(updatedSettings);
              saveSettings(updatedSettings);
            }}
            className="text-xs md:text-base px-2 md:px-3 py-1 md:py-2"
          />
        </div>
      </div>

      {/* Custom Roles */}
      <div className="form-group">
        <label className="text-xs md:text-sm">
          Custom Roles (comma-separated)
        </label>
        <textarea
          value={settings.customRoles.join(", ")}
          onChange={(e) => {
            const updatedSettings = {
              ...settings,
              customRoles: e.target.value
                .split(",")
                .map((role) => role.trim())
                .filter((role) => role),
            };
            setSettings(updatedSettings);
            saveSettings(updatedSettings);
          }}
          rows={2}
          placeholder="Teacher, Manager, Accountant, etc."
          className="text-xs md:text-base px-2 md:px-3 py-1 md:py-2"
        />
      </div>

      <div className="flex gap-2 md:gap-4 mt-4 md:mt-8">
        <button
          onClick={async () => {
            const defaultSettings = {
              organizationName: "",
              organizationAddress: "",
              organizationPhone: "",
              organizationEmail: "",
              organizationLogo: null,
              payrollMonth: new Date().getMonth() + 1,
              payrollYear: new Date().getFullYear(),
              paymentMethod: "bank",
              currency: "$", // overridden by station currency on mount"
              enableSha: true,
              enableNssf: true,
              enableTax: true,
              enableUnion: true,
              theme: "blue",
              customRoles: [],
              originatorAccount: "",
              branchDao: "4021",
              origCode: "",
              reference: "",
              shaPercentage: 2.75,
              nssfAmount: 480,
            };
            setSettings(defaultSettings);
            await saveSettings(defaultSettings);
          }}
          className="btn btn-outline px-2 md:px-4 py-1 md:py-2 text-xs md:text-base"
        >
          Reset to Default
        </button>
        <button
          onClick={() => toastSuccess("Settings are automatically saved!")}
          className="btn btn-primary px-2 md:px-4 py-1 md:py-2 text-xs md:text-base"
        >
          <Save size={12} className="md:w-4 md:h-4" />
          <span className="ml-1">Settings Auto-saved</span>
        </button>
      </div>
    </div>
  );

  const renderPayslipTab = () => (
    <div className="p-2 md:p-6 space-y-2 md:space-y-6">
      <h3 className="text-lg md:text-xl font-bold mb-2 md:mb-4">
        Employee Payslips
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-500 dark:text-gray-400 mb-4">
        Generate, download and send individual payslips for employees for{" "}
        {new Date(2023, settings.payrollMonth - 1).toLocaleString("default", {
          month: "long",
        })}{" "}
        {settings.payrollYear}
      </p>

      {/* ── Payslip Delivery (auto / manual via email or WhatsApp) ── */}
      <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Send size={16} className="text-blue-500" />
          <h4 className="font-semibold text-sm md:text-base">
            Payslip Delivery
          </h4>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
          Send each employee&apos;s payslip as a PDF via email or WhatsApp.
          Recipients are taken from each employee&apos;s payroll record — no
          re-entering numbers.
        </p>

        {/* Delivery controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Channel
            </label>
            <select
              value={payslipConfig.channel}
              onChange={(e) =>
                savePayslipConfig({
                  channel: e.target.value as PayslipChannel,
                })
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="email">Email (PDF attachment)</option>
              <option value="whatsapp">WhatsApp (PDF document)</option>
              <option value="both">Both (Email + WhatsApp)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              <CalendarClock size={12} className="inline mr-1" />
              Send day of month
            </label>
            <input
              type="number"
              min={1}
              max={28}
              value={
                editPayslipDayFocus
                  ? editingPayslipSendDay
                  : String(payslipConfig.sendDay)
              }
              onFocus={() => {
                setEditPayslipDayFocus(true);
                setEditingPayslipSendDay(String(payslipConfig.sendDay));
              }}
              onChange={(e) => setEditingPayslipSendDay(e.target.value)}
              onBlur={() => {
                setEditPayslipDayFocus(false);
                const day = Math.max(
                  1,
                  Math.min(28, parseInt(editingPayslipSendDay, 10) || 1),
                );
                savePayslipConfig({ sendDay: day });
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={payslipConfig.enabled}
                onChange={(e) =>
                  savePayslipConfig({ enabled: e.target.checked })
                }
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium">Enable delivery</span>
            </label>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={payslipConfig.autoSend}
                onChange={(e) =>
                  savePayslipConfig({ autoSend: e.target.checked })
                }
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium">
                Auto-send on day {payslipConfig.sendDay}
              </span>
            </label>
          </div>
          <div className="flex items-end col-span-1 sm:col-span-2 lg:col-span-1">
            <label
              className="flex items-center gap-2 cursor-pointer"
              title="When the API gateway is not configured, manual sends open WhatsApp Web (wa.me) or the mail client (mailto:) instead of failing."
            >
              <input
                type="checkbox"
                checked={payslipConfig.webFallback}
                onChange={(e) =>
                  savePayslipConfig({ webFallback: e.target.checked })
                }
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium">
                Web fallback (wa.me / mailto)
              </span>
            </label>
          </div>
          {/* Short-link expiry (days) */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Link expiry (days)
            </label>
            <input
              type="number"
              min={1}
              max={90}
              value={
                editExpiryFocus
                  ? editingExpiryDays
                  : String(payslipConfig.linkExpiryDays ?? 7)
              }
              onFocus={() => {
                setEditExpiryFocus(true);
                setEditingExpiryDays(String(payslipConfig.linkExpiryDays ?? 7));
              }}
              onChange={(e) => setEditingExpiryDays(e.target.value)}
              onBlur={() => {
                setEditExpiryFocus(false);
                const days = Math.max(
                  1,
                  Math.min(90, parseInt(editingExpiryDays, 10) || 7),
                );
                savePayslipConfig({ linkExpiryDays: days });
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          {/* Revoke all live links */}
          <div className="flex items-end">
            <button
              onClick={handleRevokeLinks}
              disabled={revokingLinks}
              title="Immediately invalidate every payslip short-link — recipients with old links see an expired/not-found page"
              className="px-3 py-2 text-xs font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              {revokingLinks ? "Revoking…" : "Revoke links"}
            </button>
          </div>
        </div>

        {/* Gateway status + cross-link */}
        {(() => {
          const needEmail =
            payslipConfig.channel === "email" ||
            payslipConfig.channel === "both";
          const needWhatsApp =
            payslipConfig.channel === "whatsapp" ||
            payslipConfig.channel === "both";
          const emailReady = !!(
            commGateway?.emailEnabled && commGateway?.emailApiKey
          );
          const whatsappReady = !!(
            commGateway?.whatsappEnabled &&
            commGateway?.whatsappPhone &&
            commGateway?.whatsappToken
          );
          const missing: string[] = [];
          if (needEmail && !emailReady) missing.push("Email gateway");
          if (needWhatsApp && !whatsappReady) missing.push("WhatsApp Business");
          return missing.length > 0 ? (
            <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/20 text-xs text-amber-800 dark:text-amber-300 flex flex-wrap items-center gap-2">
              <span>
                API gateway not configured:{" "}
                <strong>{missing.join(", ")}</strong>
                {payslipConfig.webFallback
                  ? " — manual sends will redirect to WhatsApp Web (wa.me) or the mail client (mailto:) instead."
                  : " — sending is disabled until you enable the Web fallback toggle or set up the gateway."}
              </span>
              <button
                onClick={() => navigateToTab("communication")}
                className="btn btn-secondary px-2 py-1 text-xs"
              >
                Open Communication → Settings
              </button>
            </div>
          ) : (
            <div className="mb-4 p-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-900/20 text-xs text-green-800 dark:text-green-300 flex items-center gap-2">
              <CheckCircle2 size={14} />
              Gateway ready (
              {[emailReady && "Email", whatsappReady && "WhatsApp"]
                .filter(Boolean)
                .join(" + ")}
              ).
            </div>
          );
        })()}

        {/* Web send queue (manual redirects for gateway-less channels) */}
        {webSendQueue.length > 0 && (
          <div className="mb-4 p-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-900/20">
            <h5 className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2">
              {webSendQueue.length} payslip(s) could not be opened automatically
              — click each button to finish:
            </h5>
            <div className="space-y-2">
              {webSendQueue.map((queued) => (
                <div
                  key={queued.entry.id}
                  className="flex flex-wrap items-center gap-2 text-xs"
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {queued.entry.employeeName}
                  </span>
                  <span className="text-gray-500">
                    → {queued.entry.recipient || "—"}
                  </span>
                  {queued.fallbacks.map((fb) => (
                    <button
                      key={fb.kind}
                      onClick={() => openWebFallbackLink(queued)}
                      className="btn btn-primary px-2 py-1 text-xs"
                    >
                      {fb.kind === "whatsapp" ? "WhatsApp Web" : "Email app"}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
              The link opens WhatsApp Web / your mail client with the message
              and payslip link pre-filled — press Send there to finish.
            </p>
          </div>
        )}

        {/* Manual send + last auto-send info */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => sendAllPayslips(true)}
            disabled={sendingPayslips || !payslipConfig.enabled}
            className="btn btn-primary px-4 py-2 text-sm flex items-center gap-2"
          >
            {sendingPayslips ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Send size={16} />
            )}
            Send All Payslips Now
          </button>
          {payslipConfig.lastAutoSentPeriod && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Auto-sent: {payslipConfig.lastAutoSentPeriod}
            </span>
          )}
        </div>

        {/* Recent send log */}
        {payslipLog.length > 0 && (
          <div className="mt-4">
            <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
              Recent sends
            </h5>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {payslipLog.slice(0, 8).map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-gray-50 dark:bg-gray-700/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {e.status === "sent" ? (
                      <CheckCircle2
                        size={13}
                        className="text-green-500 shrink-0"
                      />
                    ) : (
                      <XCircle size={13} className="text-red-500 shrink-0" />
                    )}
                    <span className="font-medium truncate">
                      {e.employeeName}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 hidden sm:inline">
                      → {e.recipient || "—"} ({e.channel}
                      {e.method === "web" ? " via web" : ""})
                    </span>
                  </div>
                  <span className="text-gray-400 shrink-0 ml-2">
                    {new Date(e.sentAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
            {payslipLog.some((e) => e.status === "failed") && (
              <p className="text-xs text-red-500 mt-1">
                Some sends failed — hover the entries above for details.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search employees for payslips..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-auto px-2 md:px-4 py-1 md:py-2 text-xs md:text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
      </div>

      {/* Employee List for Payslips */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEmployees.map((employee) => (
          <div
            key={employee.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm md:text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {employee.fullName}
                </h4>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-500 dark:text-gray-400">
                  {employee.role} • {employee.department}
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-500 dark:text-gray-400">
                  ID: {employee.employeeId || "N/A"}
                </p>
                {/* Contact info used for delivery (from payroll record) */}
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 truncate">
                  {employee.email && `📧 ${employee.email}`}
                  {employee.email && employee.phone && " · "}
                  {employee.phone && `📱 ${employee.phone}`}
                  {!employee.email && !employee.phone && (
                    <span className="text-amber-500">
                      No contact info on file
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Salary Summary */}
            <div className="space-y-1 mb-4 text-xs md:text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-500 dark:text-gray-400">
                  Basic Salary:
                </span>
                <span className="font-medium">
                  {formatCurrency(employee.basicSalary)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-500 dark:text-gray-400">
                  Total Deductions:
                </span>
                <span className="text-red-600 dark:text-red-400">
                  -
                  {formatCurrency(
                    employee.sha + employee.nssf + employee.advance,
                  )}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-green-600 dark:text-green-400 border-t pt-1">
                <span>Net Pay:</span>
                <span>{formatCurrency(employee.netPay)}</span>
              </div>
            </div>

            {/* Export + Send Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => exportEmployeePayslip(employee)}
                className="flex-1 btn btn-primary px-3 py-2 text-xs md:text-sm flex items-center justify-center gap-2"
              >
                <FileText size={14} />
                Export (PDF)
              </button>
              <button
                onClick={async () => {
                  if (!payslipConfig.enabled) {
                    toastError(
                      'Enable "Payslip Delivery" above before sending (optionally configure an API gateway in Communication → Settings).',
                    );
                    return;
                  }
                  setSaving(true);
                  try {
                    const { entry } = await sendPayslipToEmployee(
                      employee,
                      true,
                      true, // open the web fallback immediately (user gesture)
                    );
                    await appendPayslipLog([entry]);
                    if (entry.status === "sent") {
                      toastSuccess(
                        entry.method === "web"
                          ? `Opened ${entry.channel === "whatsapp" ? "WhatsApp" : "email app"} for ${employee.fullName} — hit Send there to deliver.`
                          : `Payslip sent to ${employee.fullName} via ${entry.channel}.`,
                      );
                    } else {
                      toastError(
                        `Failed to send to ${employee.fullName}: ${entry.error || "unknown error"}`,
                      );
                    }
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="flex-1 btn btn-secondary px-3 py-2 text-xs md:text-sm flex items-center justify-center gap-2"
                title={
                  employee.email || employee.phone
                    ? `Send PDF to ${employee.email || employee.phone}`
                    : "No contact info on file for this employee"
                }
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Send size={14} />
                )}
                Send
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* No employees message */}
      {filteredEmployees.length === 0 && (
        <div className="text-center py-12">
          <Users
            size={48}
            className="mx-auto text-gray-500 dark:text-gray-400 mb-4"
          />
          <p className="text-gray-500 dark:text-gray-500 dark:text-gray-400">
            {searchTerm
              ? "No employees found matching your search."
              : "No employees added yet."}
          </p>
        </div>
      )}

      {/* Batch Export */}
      {employees.length > 0 && (
        <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h4 className="font-semibold mb-3">Batch Export Options</h4>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={async () => {
                setSaving(true);
                try {
                  for (const employee of employees) {
                    await new Promise((resolve) => setTimeout(resolve, 50)); // Small yield to prevent browser blocking
                    exportEmployeePayslip(employee);
                  }
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className="btn btn-secondary px-4 py-2 text-sm flex items-center gap-2"
            >
              {saving ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <FileText size={16} />
              )}
              Export All Payslips (PDF)
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Note: Batch export will download all payslips as individual PDF
            files. Please allow popups for this site.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-2 md:p-6 space-y-2 md:space-y-6">
      {/* Tabs */}
      <div className="card">
        <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 mb-2 md:mb-6">
          <button
            onClick={() => setActiveTab("employees")}
            className={`px-2 md:px-6 py-1 md:py-3 font-medium text-xs md:text-base flex-shrink-0 ${
              activeTab === "employees"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 dark:text-gray-500 dark:text-gray-400"
            }`}
          >
            <Users size={12} className="inline mr-1 md:mr-2 md:w-4 md:h-4" />
            <span className="hidden sm:inline">Employees</span>
            <span className="sm:hidden">Emp</span>
          </button>
          <button
            onClick={() => setActiveTab("payslip")}
            className={`px-2 md:px-6 py-1 md:py-3 font-medium text-xs md:text-base flex-shrink-0 ${
              activeTab === "payslip"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 dark:text-gray-500 dark:text-gray-400"
            }`}
          >
            <FileText size={12} className="inline mr-1 md:mr-2 md:w-4 md:h-4" />
            <span className="hidden sm:inline">Payslips</span>
            <span className="sm:hidden">Pay</span>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-2 md:px-6 py-1 md:py-3 font-medium text-xs md:text-base flex-shrink-0 ${
              activeTab === "settings"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 dark:text-gray-500 dark:text-gray-400"
            }`}
          >
            <Settings size={12} className="inline mr-1 md:mr-2 md:w-4 md:h-4" />
            <span className="hidden sm:inline">Settings</span>
            <span className="sm:hidden">Set</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "employees" && renderEmployeesTab()}
        {activeTab === "payslip" && renderPayslipTab()}
        {activeTab === "settings" && renderSettingsTab()}
      </div>

      {/* Employee Modal */}
      {showEmployeeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">
                {editingEmployee ? "Edit Employee" : "Add Employee"}
              </h3>
              <button
                onClick={() => setShowEmployeeModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  value={employeeForm.firstName}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      firstName: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  value={employeeForm.lastName}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      lastName: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Employee ID</label>
                <input
                  type="text"
                  value={employeeForm.employeeId}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      employeeId: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <input
                  type="text"
                  list="roles"
                  value={employeeForm.role}
                  onChange={(e) =>
                    setEmployeeForm({ ...employeeForm, role: e.target.value })
                  }
                />
                <datalist id="roles">
                  {settings.customRoles.map((role) => (
                    <option key={role} value={role} />
                  ))}
                </datalist>
              </div>

              <div className="form-group">
                <label>Department</label>
                <input
                  type="text"
                  list="departments"
                  value={employeeForm.department}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      department: e.target.value,
                    })
                  }
                />
                <datalist id="departments">
                  {settings.customRoles.map((dept) => (
                    <option key={dept} value={dept} />
                  ))}
                </datalist>
              </div>

              <div className="form-group">
                <label>Employment Date</label>
                <input
                  type="date"
                  value={employeeForm.employmentDate}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      employmentDate: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>Basic Salary</label>
                <input
                  type="number"
                  value={employeeForm.basicSalary}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      basicSalary: Number(e.target.value),
                    })
                  }
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="form-group">
                <label>ID Number</label>
                <input
                  type="text"
                  value={employeeForm.idNo}
                  onChange={(e) =>
                    setEmployeeForm({ ...employeeForm, idNo: e.target.value })
                  }
                />
              </div>

              {isKenya && (
                <div className="form-group">
                  <label>KRA PIN</label>
                  <input
                    type="text"
                    value={employeeForm.kraPin}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        kraPin: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              <div className="form-group">
                <label>SHA Number</label>
                <input
                  type="text"
                  value={employeeForm.shaNo}
                  onChange={(e) =>
                    setEmployeeForm({ ...employeeForm, shaNo: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>NSSF Number</label>
                <input
                  type="text"
                  value={employeeForm.nssfNo}
                  onChange={(e) =>
                    setEmployeeForm({ ...employeeForm, nssfNo: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Bank Account</label>
                <input
                  type="text"
                  value={employeeForm.bankAccount}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      bankAccount: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>Bank Name</label>
                <input
                  type="text"
                  value={employeeForm.bankName}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      bankName: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>Bank Code</label>
                <input
                  type="text"
                  value={employeeForm.bankCode}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      bankCode: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>Phone</label>
                <input
                  type="text"
                  value={employeeForm.phone}
                  onChange={(e) =>
                    setEmployeeForm({ ...employeeForm, phone: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={employeeForm.email}
                  onChange={(e) =>
                    setEmployeeForm({ ...employeeForm, email: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Advance ({stationCurrencySymbol})</label>
                <input
                  type="number"
                  value={employeeForm.advance}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      advance: Number(e.target.value),
                    })
                  }
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="form-group mt-4">
              <label>Notes</label>
              <textarea
                value={employeeForm.notes}
                onChange={(e) =>
                  setEmployeeForm({ ...employeeForm, notes: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setShowEmployeeModal(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={saveEmployee}
                disabled={saving}
                className="btn btn-primary flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Save size={16} />
                )}
                Save Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Confirm Deletion</h3>
            <p className="mb-6">
              Are you sure you want to delete this employee? This action cannot
              be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={deleteEmployee}
                disabled={saving}
                className="btn btn-danger flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Trash2 size={16} />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHA Modal */}
      {showShaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">
              Edit SHA for All Employees
            </h3>
            <p className="mb-4">
              Enter the SHA percentage to apply to all employees based on their
              basic salary:
            </p>
            <div className="form-group">
              <label>SHA Percentage (%)</label>
              <input
                type="number"
                value={shaPercentage}
                onChange={(e) => setShaPercentage(Number(e.target.value))}
                min="0"
                max="100"
                step="0.01"
              />
              <p className="text-sm text-gray-500 mt-2">
                Note: Minimum SHA contribution is {stationCurrencySymbol} 300
                (automatically enforced)
              </p>
            </div>
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setShowShaModal(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={applyShaToAll}
                disabled={saving}
                className="btn btn-primary flex items-center gap-2"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : null}
                Apply to All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NSSF Modal */}
      {showNssfModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">
              Edit NSSF for All Employees
            </h3>
            <p className="mb-4">
              Enter the fixed NSSF amount to apply to all employees:
            </p>
            <div className="form-group">
              <label>NSSF Amount ({stationCurrencySymbol})</label>
              <input
                type="number"
                value={nssfAmount}
                onChange={(e) => setNssfAmount(Number(e.target.value))}
                min="0"
                step="0.01"
              />
            </div>
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setShowNssfModal(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={applyNssfToAll}
                disabled={saving}
                className="btn btn-primary flex items-center gap-2"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : null}
                Apply to All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Column Name Modal */}
      {showColumnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Edit Column Name</h3>
            <div className="form-group">
              <label>Column Name</label>
              <input
                type="text"
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
              />
            </div>
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setShowColumnModal(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button onClick={saveColumnName} className="btn btn-primary">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Data Input */}
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleImportExcel}
        className="hidden"
      />
    </div>
  );
}
