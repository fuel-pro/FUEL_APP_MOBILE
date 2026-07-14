import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { useFuel } from "@/react-app/context/FuelContext";
import { useAuth } from "@/react-app/context/AuthContext";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

export default function PayrollSystem() {
  // Get auth context
  const { user } = useAuth();
  const { state: fuelState } = useFuel();

  // State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<PayrollSettings>({
    organizationName: "",
    organizationAddress: "",
    organizationPhone: "",
    organizationEmail: "",
    organizationLogo: null,
    payrollMonth: new Date().getMonth() + 1,
    payrollYear: new Date().getFullYear(),
    paymentMethod: "bank",
    currency: "KES",
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

  // UI State
  const [activeTab, setActiveTab] = useState("employees");
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShaModal, setShowShaModal] = useState(false);
  const [showNssfModal, setShowNssfModal] = useState(false);
  const [showColumnModal, setShowColumnModal] = useState(false);

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<number | null>(null);
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
    bankName: "KCB LODWAR",
    bankCode: "01144",
    phone: "",
    email: "",
    advance: 0,
    notes: "",
  });

  // Helper functions
  const formatNumber = (num: number) => {
    return num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, "$&,");
  };

  const formatCurrency = (amount: number) => {
    return `${settings.currency} ${formatNumber(amount)}`;
  };

  // API calls
  const fetchEmployees = async () => {
    try {
      const response = await fetch("/api/payroll/employees", {
        headers: { Authorization: `Bearer ${user?.id || "local"}` },
      });

      if (response.ok) {
        const data = await response.json();
        const formattedEmployees = data.employees.map((emp: any) => ({
          id: emp.id,
          no: emp.employee_number,
          firstName: emp.first_name,
          lastName: emp.last_name,
          fullName: emp.full_name,
          employeeId: emp.employee_id,
          role: emp.role,
          department: emp.department,
          basicSalary: emp.basic_salary,
          sha: emp.sha_amount,
          nssf: emp.nssf_amount,
          advance: emp.advance_amount,
          netPay: emp.net_pay,
          bank: emp.bank_name,
          bankCode: emp.bank_code,
          idNo: emp.id_number,
          kraPin: emp.kra_pin,
          shaNo: emp.sha_number,
          nssfNo: emp.nssf_number,
          bankAccount: emp.bank_account,
          phone: emp.phone,
          email: emp.email,
          employmentDate: emp.employment_date,
          notes: emp.notes,
        }));
        setEmployees(formattedEmployees);
        return;
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
    // Fallback: load from localStorage
    try {
      const local = JSON.parse(
        localStorage.getItem("fuelpro_payroll_employees") || "[]"
      );
      if (local.length > 0) {
        setEmployees(
          local.map((emp: any, i: number) => ({
            id: emp.id || i,
            no: String(i + 1),
            firstName: emp.first_name || "",
            lastName: emp.last_name || "",
            fullName: `${emp.first_name || ""} ${emp.last_name || ""}`.trim(),
            employeeId: emp.employee_id || "",
            role: emp.role || "",
            department: emp.department || "",
            basicSalary: emp.basic_salary || 0,
            sha: emp.sha || 0,
            nssf: emp.nssf || 0,
            advance: emp.advance || 0,
            netPay:
              emp.netPay ||
              emp.net_pay ||
              (emp.basic_salary || 0) - (emp.advance || 0),
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
          }))
        );
      }
    } catch {
      /* */
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/payroll/settings", {
        headers: { Authorization: `Bearer ${user?.id}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          const backendSettings = data.settings;
          setSettings(prev => ({
            ...prev,
            organizationName:
              backendSettings.organization_name || prev.organizationName,
            organizationAddress:
              backendSettings.organization_address || prev.organizationAddress,
            organizationPhone:
              backendSettings.organization_phone || prev.organizationPhone,
            organizationEmail:
              backendSettings.organization_email || prev.organizationEmail,
            organizationLogo:
              backendSettings.organization_logo || prev.organizationLogo,
            payrollMonth: backendSettings.payroll_month || prev.payrollMonth,
            payrollYear: backendSettings.payroll_year || prev.payrollYear,
            paymentMethod: backendSettings.payment_method || prev.paymentMethod,
            currency: backendSettings.currency || prev.currency,
            enableSha: backendSettings.enable_sha !== 0,
            enableNssf: backendSettings.enable_nssf !== 0,
            enableTax: backendSettings.enable_tax !== 0,
            shaPercentage: backendSettings.sha_percentage || prev.shaPercentage,
            nssfAmount: backendSettings.nssf_amount || prev.nssfAmount,
            originatorAccount:
              backendSettings.originator_account || prev.originatorAccount,
            branchDao: backendSettings.branch_dao || prev.branchDao,
            origCode: backendSettings.orig_code || prev.origCode,
            reference: backendSettings.reference_code || prev.reference,
            customRoles: backendSettings.custom_roles
              ? backendSettings.custom_roles
                  .split(",")
                  .map((r: string) => r.trim())
                  .filter((r: string) => r)
              : prev.customRoles,
          }));
          setShaPercentage(backendSettings.sha_percentage || 2.75);
          setNssfAmount(backendSettings.nssf_amount || 480);
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const saveSettings = async (newSettings: Partial<PayrollSettings>) => {
    try {
      setImporting(true);
      const response = await fetch("/api/payroll/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.id}`,
        },
        body: JSON.stringify({
          organization_name: newSettings.organizationName,
          organization_address: newSettings.organizationAddress,
          organization_phone: newSettings.organizationPhone,
          organization_email: newSettings.organizationEmail,
          organization_logo: newSettings.organizationLogo,
          payroll_month: newSettings.payrollMonth,
          payroll_year: newSettings.payrollYear,
          payment_method: newSettings.paymentMethod,
          currency: newSettings.currency,
          enable_sha: newSettings.enableSha,
          enable_nssf: newSettings.enableNssf,
          enable_tax: newSettings.enableTax,
          sha_percentage: newSettings.shaPercentage,
          nssf_amount: newSettings.nssfAmount,
          originator_account: newSettings.originatorAccount,
          branch_dao: newSettings.branchDao,
          orig_code: newSettings.origCode,
          reference_code: newSettings.reference,
          custom_roles: newSettings.customRoles?.join(", "),
        }),
      });

      if (response.ok) {
        console.log("Settings saved successfully");
      } else {
        console.error("Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setImporting(false);
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
      Promise.all([fetchEmployees(), fetchSettings()]);
    }
  }, [user]);

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
      bankName: "KCB LODWAR",
      bankCode: "01144",
      phone: "",
      email: "",
      advance: 0,
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
      notes: employee.notes,
    });
    setShowEmployeeModal(true);
  };

  const saveEmployee = async () => {
    try {
      setSaving(true);
      const method = editingEmployee ? "PUT" : "POST";
      const url = editingEmployee
        ? `/api/payroll/employees/${editingEmployee.id}`
        : "/api/payroll/employees";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.id}`,
        },
        body: JSON.stringify({
          first_name: employeeForm.firstName,
          last_name: employeeForm.lastName,
          employee_id: employeeForm.employeeId,
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
          notes: employeeForm.notes,
        }),
      });

      if (response.ok) {
        await fetchEmployees(); // Refresh the list
        setShowEmployeeModal(false);
        setEditingEmployee(null);

        // Add role to custom roles if not already there
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
      } else {
        console.error("Failed to save employee");
      }
    } catch (error) {
      console.error("Error saving employee:", error);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteEmployee = (employee: Employee) => {
    setEmployeeToDelete(employee.id || 0);
    setShowDeleteModal(true);
  };

  const deleteEmployee = async () => {
    if (employeeToDelete) {
      try {
        setSaving(true);
        const response = await fetch(
          `/api/payroll/employees/${employeeToDelete}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${user?.id}` },
          }
        );

        if (response.ok) {
          await fetchEmployees(); // Refresh the list
          setShowDeleteModal(false);
          setEmployeeToDelete(null);
        } else {
          console.error("Failed to delete employee");
        }
      } catch (error) {
        console.error("Error deleting employee:", error);
      } finally {
        setSaving(false);
      }
    }
  };

  // Bulk operations
  const applyShaToAll = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/payroll/bulk-update-sha", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.id}`,
        },
        body: JSON.stringify({ sha_percentage: shaPercentage }),
      });

      if (response.ok) {
        await fetchEmployees(); // Refresh the list
        const updatedSettings = { ...settings, shaPercentage };
        setSettings(updatedSettings);
        setShowShaModal(false);
      } else {
        console.error("Failed to update SHA for all employees");
      }
    } catch (error) {
      console.error("Error updating SHA:", error);
    } finally {
      setSaving(false);
    }
  };

  const applyNssfToAll = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/payroll/bulk-update-nssf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.id}`,
        },
        body: JSON.stringify({ nssf_amount: nssfAmount }),
      });

      if (response.ok) {
        await fetchEmployees(); // Refresh the list
        const updatedSettings = { ...settings, nssfAmount };
        setSettings(updatedSettings);
        setShowNssfModal(false);
      } else {
        console.error("Failed to update NSSF for all employees");
      }
    } catch (error) {
      console.error("Error updating NSSF:", error);
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

  // Update cell values directly in backend
  const updateCell = async (employee: Employee, field: string, value: any) => {
    try {
      const updatedEmployee = { ...employee };

      if (field === "sha" || field === "nssf" || field === "advance") {
        const numValue = parseFloat(value) || 0;
        if (field === "sha") updatedEmployee.sha = numValue;
        if (field === "nssf") updatedEmployee.nssf = numValue;
        if (field === "advance") updatedEmployee.advance = numValue;

        // Recalculate net pay
        updatedEmployee.netPay =
          updatedEmployee.basicSalary -
          (updatedEmployee.sha +
            updatedEmployee.nssf +
            updatedEmployee.advance);
      } else {
        (updatedEmployee as any)[field] = value;
      }

      // Update in backend
      const response = await fetch(`/api/payroll/employees/${employee.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.id}`,
        },
        body: JSON.stringify({
          first_name: updatedEmployee.firstName,
          last_name: updatedEmployee.lastName,
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
          notes: updatedEmployee.notes,
        }),
      });

      if (response.ok) {
        await fetchEmployees(); // Refresh to get updated values
      }
    } catch (error) {
      console.error("Error updating cell:", error);
    }
  };

  // Logo upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      alert("Please upload a valid image file (JPG, PNG, GIF)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should not exceed 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
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

  // Filter and pagination
  const filteredEmployees = employees.filter(
    emp =>
      emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.no.includes(searchTerm) ||
      emp.idNo.includes(searchTerm) ||
      emp.employeeId.includes(searchTerm)
  );

  const totalPages = Math.ceil(filteredEmployees.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const paginatedEmployees = filteredEmployees.slice(startIndex, endIndex);

  // Summary calculations
  const totalGross = employees.reduce((sum, emp) => sum + emp.basicSalary, 0);
  const totalSha = employees.reduce((sum, emp) => sum + emp.sha, 0);
  const totalNssf = employees.reduce((sum, emp) => sum + emp.nssf, 0);
  const totalAdvances = employees.reduce((sum, emp) => sum + emp.advance, 0);
  const totalNet = employees.reduce((sum, emp) => sum + emp.netPay, 0);

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
      ...employees.map(emp => [
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
      `${settings.organizationName.replace(/\s/g, "_")}_Employees_${monthName}_${settings.payrollYear}.xlsx`
    );
  };

  // Enhanced export functions with backend data
  const exportCombinedPayrollExcel = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/payroll/export-combined", {
        method: "POST",
        headers: { Authorization: `Bearer ${user?.id}` },
      });

      if (response.ok) {
        const data = await response.json();
        generateCombinedExcel(data);
      } else {
        console.error("Failed to export combined payroll");
      }
    } catch (error) {
      console.error("Error exporting combined payroll:", error);
    } finally {
      setSaving(false);
    }
  };

  const exportCPCCentralizedExcel = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/payroll/export-cpc", {
        method: "POST",
        headers: { Authorization: `Bearer ${user?.id}` },
      });

      if (response.ok) {
        const data = await response.json();
        generateCPCExcel(data);
      } else {
        console.error("Failed to export CPC centralized");
      }
    } catch (error) {
      console.error("Error exporting CPC centralized:", error);
    } finally {
      setSaving(false);
    }
  };

  const generateCombinedExcel = (data: any) => {
    const wb = XLSX.utils.book_new();
    const employees = data.employees;
    const settings = data.settings;

    const monthName = new Date(2023, (settings.payroll_month || 1) - 1)
      .toLocaleString("default", { month: "long" })
      .toUpperCase();
    const year = settings.payroll_year || 2025;

    // Sheet 1: Payroll Payment Summary
    const payrollData = [
      [
        `${(settings.organization_name || "ORGANIZATION").toUpperCase()} SALARY ${monthName} ${year} PAYMENT`,
      ],
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
      ...employees.map((emp: any, index: number) => [
        index + 1,
        emp.full_name.toUpperCase(),
        emp.basic_salary,
        emp.sha_amount,
        emp.nssf_amount,
        0, // Bank charges
        emp.advance_amount,
        emp.net_pay,
      ]),
      [],
      [
        "TOTALS",
        "",
        employees.reduce((sum: number, emp: any) => sum + emp.basic_salary, 0),
        employees.reduce((sum: number, emp: any) => sum + emp.sha_amount, 0),
        employees.reduce((sum: number, emp: any) => sum + emp.nssf_amount, 0),
        0,
        employees.reduce(
          (sum: number, emp: any) => sum + emp.advance_amount,
          0
        ),
        employees.reduce((sum: number, emp: any) => sum + emp.net_pay, 0),
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
      [
        `${(settings.organization_name || "ORGANIZATION").toUpperCase()} STAFF SHA LIST ${monthName} ${year}`,
      ],
      [],
      ["S/NO.", "NAME", "ID NO.", "SHA NO.", "BASIC SALARY", "SHA AMOUNT"],
      ...employees.map((emp: any, index: number) => [
        index + 1,
        emp.full_name.toUpperCase(),
        emp.id_number,
        emp.sha_number,
        emp.basic_salary,
        emp.sha_amount,
      ]),
      [],
      [
        "TOTALS",
        "",
        "",
        "",
        employees.reduce((sum: number, emp: any) => sum + emp.basic_salary, 0),
        employees.reduce((sum: number, emp: any) => sum + emp.sha_amount, 0),
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
      [
        `${(settings.organization_name || "ORGANIZATION").toUpperCase()} STAFF NSSF LIST ${monthName} ${year}`,
      ],
      [],
      ["S/NO.", "NAME", "ID NO.", "NSSF NO.", "AMOUNT"],
      ...employees.map((emp: any, index: number) => [
        index + 1,
        emp.full_name.toUpperCase(),
        emp.id_number,
        emp.nssf_number,
        emp.nssf_amount * 2, // Double the amount for NSSF list as per requirement
      ]),
      [],
      [
        "TOTALS",
        "",
        "",
        "",
        employees.reduce(
          (sum: number, emp: any) => sum + emp.nssf_amount * 2,
          0
        ),
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
      ...employees.map((emp: any, index: number) => [
        index + 1,
        emp.full_name.toUpperCase(),
        emp.bank_account,
        emp.bank_name.toUpperCase(),
        emp.bank_code,
        emp.net_pay,
        settings.reference_code ||
          (settings.organization_name || "ORGANIZATION").toUpperCase(),
        settings.orig_code || emp.bank_code,
        settings.branch_dao || "4021",
        settings.originator_account || "1285241630",
      ]),
      [],
      [
        "TOTAL",
        "",
        "",
        "",
        "",
        employees.reduce((sum: number, emp: any) => sum + emp.net_pay, 0),
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
      `PAYROLL_${(settings.organization_name || "Organization").replace(/\s/g, "_")}_${monthName}_${year}.xlsx`
    );
  };

  const generateCPCExcel = (data: any) => {
    const wb = XLSX.utils.book_new();
    const employees = data.employees;
    const settings = data.settings;

    const monthName = new Date(2023, (settings.payroll_month || 1) - 1)
      .toLocaleString("default", { month: "long" })
      .toUpperCase();
    const year = settings.payroll_year || 2025;

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
      ...employees.map((emp: any, index: number) => [
        index + 1,
        emp.full_name.toUpperCase(),
        emp.bank_account,
        emp.bank_name.toUpperCase(),
        emp.bank_code,
        emp.net_pay,
        settings.reference_code ||
          (settings.organization_name || "ORGANIZATION").toUpperCase(),
        settings.orig_code || emp.bank_code,
        settings.branch_dao || "4021",
        settings.originator_account || "1285241630",
      ]),
      [],
      [
        "TOTAL",
        "",
        "",
        "",
        "",
        employees.reduce((sum: number, emp: any) => sum + emp.net_pay, 0),
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
      `CPC_CENTRALIZED_SALARY_PROCESSING_${(settings.organization_name || "Organization").replace(/\s/g, "_")}_${monthName}_${year}.xlsx`
    );
  };

  // Individual payslip PDF generation
  const exportEmployeePayslip = (employee: Employee) => {
    const doc = new jsPDF();
    const monthName = new Date(2023, settings.payrollMonth - 1).toLocaleString(
      "default",
      { month: "long" }
    );

    let y = 20;

    // Company logo
    if (settings.organizationLogo) {
      try {
        if (settings.organizationLogo.startsWith("data:")) {
          doc.addImage(settings.organizationLogo, "PNG", 15, 10, 40, 25);
          y = 45;
        }
      } catch (error) {
        console.warn("Could not load company logo for payslip:", error);
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
      didParseCell: data => {
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
    doc.text(`KRA PIN: ${employee.kraPin || "N/A"}`, 15, y);

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
      { align: "center" }
    );
    y += 5;
    doc.text(
      `Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
      105,
      y,
      { align: "center" }
    );

    // Save the PDF
    doc.save(
      `Payslip_${employee.fullName.replace(/\s+/g, "_")}_${monthName}_${settings.payrollYear}.pdf`
    );
  };

  // Excel import functionality
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setSaving(true);

      // Read the Excel file
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
      }) as any[][];

      // Skip empty rows and find header row
      const nonEmptyRows = jsonData.filter(row =>
        row.some(cell => cell !== undefined && cell !== "")
      );
      if (nonEmptyRows.length < 2) {
        alert("Please ensure your Excel file has headers and employee data.");
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
          headers = row.map(cell => String(cell || "").trim());
          break;
        }
      }

      if (headerRowIndex === -1) {
        alert(
          "Could not find header row. Please ensure your Excel file has column headers."
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
          const index = headers.findIndex(header =>
            header.toLowerCase().includes(variation.toLowerCase())
          );
          if (index !== -1) return index;
        }
        return -1;
      };

      // Process each employee row
      employeeRows.forEach(row => {
        if (!row || row.length === 0) return;

        // Extract data using column mapping
        const firstName = String(row[getColumnIndex("firstName")] || "").trim();
        const lastName = String(row[getColumnIndex("lastName")] || "").trim();
        const fullName = String(
          row[getColumnIndex("fullName")] || `${firstName} ${lastName}`
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
                ""
              )
            ) || 0,
          id_number: String(row[getColumnIndex("idNo")] || "").trim(),
          kra_pin: String(row[getColumnIndex("kraPin")] || "").trim(),
          sha_number: String(row[getColumnIndex("shaNo")] || "").trim(),
          nssf_number: String(row[getColumnIndex("nssfNo")] || "").trim(),
          bank_account: String(row[getColumnIndex("bankAccount")] || "").trim(),
          bank_name: String(
            row[getColumnIndex("bankName")] || "KCB LODWAR"
          ).trim(),
          bank_code: String(row[getColumnIndex("bankCode")] || "01144").trim(),
          phone: String(row[getColumnIndex("phone")] || "").trim(),
          email: String(row[getColumnIndex("email")] || "").trim(),
          employment_date: String(
            row[getColumnIndex("employmentDate")] ||
              new Date().toISOString().split("T")[0]
          ).trim(),
          advance_amount:
            parseFloat(
              String(row[getColumnIndex("advance")] || "0").replace(
                /[^\d.-]/g,
                ""
              )
            ) || 0,
          notes: String(row[getColumnIndex("notes")] || "").trim(),
        };

        // Only add if we have basic required data
        if (employeeData.first_name || employeeData.last_name) {
          importedEmployees.push(employeeData);
        }
      });

      if (importedEmployees.length === 0) {
        alert(
          "No valid employee data found in the Excel file. Please check the format and try again."
        );
        return;
      }

      // Confirm before importing
      const confirmImport = confirm(
        `Found ${importedEmployees.length} employees to import. This will add them to your existing employee list. Continue?`
      );

      if (!confirmImport) return;

      // Import employees - try API first, fallback to localStorage
      let successCount = 0;
      let errorCount = 0;
      const localImported: any[] = [];

      for (const employeeData of importedEmployees) {
        try {
          const response = await fetch("/api/payroll/employees", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${user?.id || "local"}`,
            },
            body: JSON.stringify(employeeData),
          });

          if (response.ok) {
            successCount++;
          } else {
            throw new Error("API failed");
          }
        } catch {
          // Fallback: store in localStorage
          localImported.push({
            id: Date.now() + Math.random(),
            ...employeeData,
            sha: 0,
            nssf: 0,
            advance: employeeData.advance_amount || 0,
            basicSalary: employeeData.basic_salary || 0,
            netPay:
              (employeeData.basic_salary || 0) -
              (employeeData.advance_amount || 0),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          successCount++;
        }
      }

      // Save locally imported employees to localStorage
      if (localImported.length > 0) {
        try {
          const existing = JSON.parse(
            localStorage.getItem("fuelpro_payroll_employees") || "[]"
          );
          const updated = [...existing, ...localImported];
          localStorage.setItem(
            "fuelpro_payroll_employees",
            JSON.stringify(updated)
          );
          // Update local state
          setEmployees(prev => [
            ...prev,
            ...localImported.map(emp => ({
              id: emp.id,
              no: String(prev.length + localImported.indexOf(emp) + 1),
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
              netPay: (emp.basic_salary || 0) - (emp.advance_amount || 0),
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
          ]);
        } catch {
          /* */
        }
      }

      // Show results
      if (successCount > 0) {
        alert(
          `Successfully imported ${successCount} employees${errorCount > 0 ? ` (${errorCount} failed)` : ""}.`
        );
        if (errorCount === 0) await fetchEmployees(); // Refresh if all API
      } else {
        alert(
          "Failed to import any employees. Please check the file format and try again."
        );
      }
    } catch (error) {
      console.error("Error importing Excel file:", error);
      alert(
        "Error reading Excel file. Please ensure it is a valid .xlsx file and try again."
      );
    } finally {
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
        emp.fullName.toUpperCase(),
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
        emp.fullName.toUpperCase(),
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
        emp.fullName.toUpperCase(),
        emp.employeeId,
        emp.role.toUpperCase(),
        emp.department.toUpperCase(),
        emp.basicSalary,
        emp.sha,
        emp.nssf,
        emp.advance,
        emp.netPay,
        emp.bank.toUpperCase(),
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
      `Payroll_List_${monthName}_${settings.payrollYear}.xlsx`
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
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full md:w-auto px-2 md:px-4 py-1 md:py-2 text-xs md:text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="flex flex-wrap gap-1 md:gap-2 w-full md:w-auto">
          <select
            value={entriesPerPage}
            onChange={e => setEntriesPerPage(Number(e.target.value))}
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
            <tr className="bg-blue-900 text-white">
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
            {paginatedEmployees.map(employee => (
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
                    onChange={e => updateCell(employee, "sha", e.target.value)}
                    className="w-12 md:w-20 px-1 md:px-2 py-0.5 md:py-1 text-xs md:text-base border border-gray-300 dark:border-gray-600 rounded bg-transparent"
                  />
                </td>
                <td className="p-1 md:p-3">
                  <input
                    type="number"
                    value={employee.nssf}
                    onChange={e => updateCell(employee, "nssf", e.target.value)}
                    className="w-12 md:w-20 px-1 md:px-2 py-0.5 md:py-1 text-xs md:text-base border border-gray-300 dark:border-gray-600 rounded bg-transparent"
                  />
                </td>
                <td className="p-1 md:p-3 hidden sm:table-cell">
                  <input
                    type="number"
                    value={employee.advance}
                    onChange={e =>
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
                    onChange={e => updateCell(employee, "bank", e.target.value)}
                    className="w-16 md:w-28 px-1 md:px-2 py-0.5 md:py-1 text-xs md:text-base border border-gray-300 dark:border-gray-600 rounded bg-transparent"
                  />
                </td>
                <td className="p-1 md:p-3 hidden lg:table-cell">
                  <input
                    type="text"
                    value={employee.bankCode}
                    onChange={e =>
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
        <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
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
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-2 md:px-3 py-1 md:py-2 text-xs md:text-base border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
          >
            <span className="hidden md:inline">Previous</span>
            <span className="md:hidden">Prev</span>
          </button>
          <span className="px-2 md:px-3 py-1 md:py-2 text-xs md:text-base bg-blue-900 text-white rounded">
            {currentPage} of {totalPages}
          </span>
          <button
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages}
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
            onChange={e => {
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
            onChange={e => {
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
            onChange={e => {
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
            onChange={e => {
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
                className="md:w-12 md:h-12 text-gray-400 mb-1 md:mb-2"
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
            onChange={e => {
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
            onChange={e => {
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
            onChange={e => {
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
            Minimum contribution: KSh 300 (enforced automatically)
          </p>
        </div>

        <div className="form-group">
          <label className="text-xs md:text-sm">NSSF Amount (KSh)</label>
          <input
            type="number"
            step="0.01"
            value={settings.nssfAmount}
            onChange={e => {
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
            onChange={e => {
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
            onChange={e => {
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
            onChange={e => {
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
            onChange={e => {
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
          onChange={e => {
            const updatedSettings = {
              ...settings,
              customRoles: e.target.value
                .split(",")
                .map(role => role.trim())
                .filter(role => role),
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
              currency: "KES",
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
          onClick={() => alert("Settings are automatically saved!")}
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
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Generate and download individual payslips for employees for{" "}
        {new Date(2023, settings.payrollMonth - 1).toLocaleString("default", {
          month: "long",
        })}{" "}
        {settings.payrollYear}
      </p>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search employees for payslips..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full md:w-auto px-2 md:px-4 py-1 md:py-2 text-xs md:text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
      </div>

      {/* Employee List for Payslips */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEmployees.map(employee => (
          <div
            key={employee.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm md:text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {employee.fullName}
                </h4>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  {employee.role} • {employee.department}
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  ID: {employee.employeeId || "N/A"}
                </p>
              </div>
            </div>

            {/* Salary Summary */}
            <div className="space-y-1 mb-4 text-xs md:text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Basic Salary:
                </span>
                <span className="font-medium">
                  {formatCurrency(employee.basicSalary)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Total Deductions:
                </span>
                <span className="text-red-600 dark:text-red-400">
                  -
                  {formatCurrency(
                    employee.sha + employee.nssf + employee.advance
                  )}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-green-600 dark:text-green-400 border-t pt-1">
                <span>Net Pay:</span>
                <span>{formatCurrency(employee.netPay)}</span>
              </div>
            </div>

            {/* Export Button */}
            <button
              onClick={() => exportEmployeePayslip(employee)}
              className="w-full btn btn-primary px-3 py-2 text-xs md:text-sm flex items-center justify-center gap-2"
            >
              <FileText size={14} />
              Export Payslip (PDF)
            </button>
          </div>
        ))}
      </div>

      {/* No employees message */}
      {filteredEmployees.length === 0 && (
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
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
                    await new Promise(resolve => setTimeout(resolve, 500)); // Delay to prevent browser blocking
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
                : "text-gray-600 dark:text-gray-400"
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
                : "text-gray-600 dark:text-gray-400"
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
                : "text-gray-600 dark:text-gray-400"
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
                  onChange={e =>
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
                  onChange={e =>
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
                  onChange={e =>
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
                  onChange={e =>
                    setEmployeeForm({ ...employeeForm, role: e.target.value })
                  }
                />
                <datalist id="roles">
                  {settings.customRoles.map(role => (
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
                  onChange={e =>
                    setEmployeeForm({
                      ...employeeForm,
                      department: e.target.value,
                    })
                  }
                />
                <datalist id="departments">
                  {settings.customRoles.map(dept => (
                    <option key={dept} value={dept} />
                  ))}
                </datalist>
              </div>

              <div className="form-group">
                <label>Employment Date</label>
                <input
                  type="date"
                  value={employeeForm.employmentDate}
                  onChange={e =>
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
                  onChange={e =>
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
                  onChange={e =>
                    setEmployeeForm({ ...employeeForm, idNo: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>KRA PIN</label>
                <input
                  type="text"
                  value={employeeForm.kraPin}
                  onChange={e =>
                    setEmployeeForm({ ...employeeForm, kraPin: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>SHA Number</label>
                <input
                  type="text"
                  value={employeeForm.shaNo}
                  onChange={e =>
                    setEmployeeForm({ ...employeeForm, shaNo: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>NSSF Number</label>
                <input
                  type="text"
                  value={employeeForm.nssfNo}
                  onChange={e =>
                    setEmployeeForm({ ...employeeForm, nssfNo: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Bank Account</label>
                <input
                  type="text"
                  value={employeeForm.bankAccount}
                  onChange={e =>
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
                  onChange={e =>
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
                  onChange={e =>
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
                  onChange={e =>
                    setEmployeeForm({ ...employeeForm, phone: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={employeeForm.email}
                  onChange={e =>
                    setEmployeeForm({ ...employeeForm, email: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Advance (KES)</label>
                <input
                  type="number"
                  value={employeeForm.advance}
                  onChange={e =>
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
                onChange={e =>
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
                onChange={e => setShaPercentage(Number(e.target.value))}
                min="0"
                max="100"
                step="0.01"
              />
              <p className="text-sm text-gray-500 mt-2">
                Note: Minimum SHA contribution is KSh 300 (automatically
                enforced)
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
              <label>NSSF Amount (KES)</label>
              <input
                type="number"
                value={nssfAmount}
                onChange={e => setNssfAmount(Number(e.target.value))}
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
                onChange={e => setColumnName(e.target.value)}
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
