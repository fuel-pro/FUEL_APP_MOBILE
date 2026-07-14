import { useState } from "react";
import {
  Plus,
  Save,
  Trash2,
  Truck,
  Fuel,
  FileText,
  Calendar,
  X,
} from "lucide-react";
import ExportDropdown from "@/react-app/components/ExportDropdown";
import { useFuel } from "@/react-app/context/FuelContext";
import type { OffloadingRecord } from "@/react-app/context/FuelContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export default function FuelOffloading() {
  const { state, dispatch } = useFuel();
  const [selectedRecord, setSelectedRecord] = useState<OffloadingRecord | null>(
    null
  );
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState<Partial<OffloadingRecord>>({
    date: new Date().toISOString().split("T")[0],
    time: new Date().toTimeString().slice(0, 5),
    truckReg: "",
    driverName: "",
    fuelType: "PMS",
    quantity: 0,
    rate: 0,
    totalAmount: 0,
    supplier: "",
    invoiceNo: "",
    remarks: "",
  });

  const generateId = () => {
    return "OFF" + Date.now().toString().slice(-8);
  };

  const calculateTotal = (quantity: number, rate: number) => {
    return quantity * rate;
  };

  const handleInputChange = (field: keyof OffloadingRecord, value: any) => {
    const updatedData = { ...formData, [field]: value };

    // Auto-calculate total amount
    if (field === "quantity" || field === "rate") {
      const quantity =
        field === "quantity" ? parseFloat(value) || 0 : formData.quantity || 0;
      const rate =
        field === "rate" ? parseFloat(value) || 0 : formData.rate || 0;
      updatedData.totalAmount = calculateTotal(quantity, rate);
    }

    setFormData(updatedData);
  };

  const saveRecord = () => {
    if (
      !formData.truckReg ||
      !formData.driverName ||
      !formData.supplier ||
      !formData.quantity ||
      !formData.rate
    ) {
      alert("Please fill in all required fields");
      return;
    }

    const record: OffloadingRecord = {
      id: selectedRecord?.id || generateId(),
      date: formData.date!,
      time: formData.time!,
      truckReg: formData.truckReg!,
      driverName: formData.driverName!,
      fuelType: formData.fuelType!,
      quantity: formData.quantity!,
      rate: formData.rate!,
      totalAmount: formData.totalAmount!,
      supplier: formData.supplier!,
      invoiceNo: formData.invoiceNo!,
      remarks: formData.remarks!,
    };

    let updatedRecords;
    if (selectedRecord) {
      // Update existing record
      updatedRecords = state.offloadingRecords.map(r =>
        r.id === selectedRecord.id ? record : r
      );
    } else {
      // Add new record
      updatedRecords = [...state.offloadingRecords, record];
    }

    dispatch({ type: "SET_OFFLOADING_RECORDS", payload: updatedRecords });
    resetForm();
    alert(
      selectedRecord
        ? "Record updated successfully!"
        : "Record added successfully!"
    );
  };

  const editRecord = (record: OffloadingRecord) => {
    setSelectedRecord(record);
    setFormData(record);
    setShowForm(true);
  };

  const deleteRecord = (id: string) => {
    if (confirm("Are you sure you want to delete this record?")) {
      const updatedRecords = state.offloadingRecords.filter(r => r.id !== id);
      dispatch({ type: "SET_OFFLOADING_RECORDS", payload: updatedRecords });
    }
  };

  const resetForm = () => {
    setSelectedRecord(null);
    setShowForm(false);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      time: new Date().toTimeString().slice(0, 5),
      truckReg: "",
      driverName: "",
      fuelType: "PMS",
      quantity: 0,
      rate: 0,
      totalAmount: 0,
      supplier: "",
      invoiceNo: "",
      remarks: "",
    });
  };

  // Calculate totals
  const totals = {
    totalQuantity: state.offloadingRecords.reduce(
      (sum, record) => sum + record.quantity,
      0
    ),
    totalAmount: state.offloadingRecords.reduce(
      (sum, record) => sum + record.totalAmount,
      0
    ),
    pmsQuantity: state.offloadingRecords
      .filter(r => r.fuelType === "PMS")
      .reduce((sum, record) => sum + record.quantity, 0),
    agoQuantity: state.offloadingRecords
      .filter(r => r.fuelType === "AGO")
      .reduce((sum, record) => sum + record.quantity, 0),
    pmsAmount: state.offloadingRecords
      .filter(r => r.fuelType === "PMS")
      .reduce((sum, record) => sum + record.totalAmount, 0),
    agoAmount: state.offloadingRecords
      .filter(r => r.fuelType === "AGO")
      .reduce((sum, record) => sum + record.totalAmount, 0),
  };

  // Export functions
  const exportToPDF = () => {
    const doc = new jsPDF();

    let y = 20;
    if (state.companyData.logo) {
      const img = new Image();
      img.src = state.companyData.logo;
      doc.addImage(img, "PNG", 80, 10, 50, 20);
      y = 40;
    }

    doc.setFontSize(16);
    doc.setTextColor("#d4af37");
    doc.setFont("helvetica", "bold");
    doc.text(state.companyData.name, 105, y, { align: "center" });
    doc.setTextColor("#1a3a5f");

    y += 10;
    doc.setFontSize(14);
    doc.text("Fuel Offloading Report", 105, y, { align: "center" });
    y += 20;

    const headers = [
      "Date",
      "Time",
      "Truck Reg",
      "Driver",
      "Fuel Type",
      "Quantity (L)",
      "Rate",
      "Total Amount",
      "Supplier",
    ];
    const data = state.offloadingRecords.map(record => [
      record.date,
      record.time,
      record.truckReg,
      record.driverName,
      record.fuelType,
      formatNumber(record.quantity),
      `${state.companyData.currency} ${formatNumber(record.rate)}`,
      `${state.companyData.currency} ${formatNumber(record.totalAmount)}`,
      record.supplier,
    ]);

    autoTable(doc, {
      startY: y,
      head: [headers],
      body: data,
      theme: "striped",
      headStyles: { fillColor: [26, 58, 95] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;

    // Add totals
    doc.setFont("helvetica", "bold");
    doc.text(
      `Total Quantity: ${formatNumber(totals.totalQuantity)} L`,
      14,
      finalY
    );
    doc.text(
      `Total Amount: ${state.companyData.currency} ${formatNumber(totals.totalAmount)}`,
      14,
      finalY + 8
    );
    doc.text(
      `PMS: ${formatNumber(totals.pmsQuantity)} L (${state.companyData.currency} ${formatNumber(totals.pmsAmount)})`,
      14,
      finalY + 16
    );
    doc.text(
      `AGO: ${formatNumber(totals.agoQuantity)} L (${state.companyData.currency} ${formatNumber(totals.agoAmount)})`,
      14,
      finalY + 24
    );

    doc.save("Fuel_Offloading_Report.pdf");
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const ws_data = [
      ["Fuel Offloading Report"],
      [state.companyData.name],
      [],
      [
        "Date",
        "Time",
        "Truck Reg",
        "Driver Name",
        "Fuel Type",
        "Quantity (L)",
        "Rate",
        "Total Amount",
        "Supplier",
        "Invoice No",
        "Remarks",
      ],
      ...state.offloadingRecords.map(record => [
        record.date,
        record.time,
        record.truckReg,
        record.driverName,
        record.fuelType,
        record.quantity,
        record.rate,
        record.totalAmount,
        record.supplier,
        record.invoiceNo,
        record.remarks,
      ]),
      [],
      ["TOTALS"],
      [`Total Quantity: ${formatNumber(totals.totalQuantity)} L`],
      [
        `Total Amount: ${state.companyData.currency} ${formatNumber(totals.totalAmount)}`,
      ],
      [
        `PMS: ${formatNumber(totals.pmsQuantity)} L (${state.companyData.currency} ${formatNumber(totals.pmsAmount)})`,
      ],
      [
        `AGO: ${formatNumber(totals.agoQuantity)} L (${state.companyData.currency} ${formatNumber(totals.agoAmount)})`,
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, "Offloading Report");
    XLSX.writeFile(wb, "Fuel_Offloading_Report.xlsx");
  };

  const exportToTXT = () => {
    let txt = `=== ${state.companyData.name} ===\nFuel Offloading Report\n\n`;

    state.offloadingRecords.forEach(record => {
      txt += `Date: ${record.date} ${record.time}\n`;
      txt += `Truck: ${record.truckReg} | Driver: ${record.driverName}\n`;
      txt += `Fuel: ${record.fuelType} | Quantity: ${formatNumber(record.quantity)} L\n`;
      txt += `Rate: ${state.companyData.currency} ${formatNumber(record.rate)} | Total: ${state.companyData.currency} ${formatNumber(record.totalAmount)}\n`;
      txt += `Supplier: ${record.supplier} | Invoice: ${record.invoiceNo}\n`;
      if (record.remarks) txt += `Remarks: ${record.remarks}\n`;
      txt += "\n";
    });

    txt += `\nTOTALS:\n`;
    txt += `Total Quantity: ${formatNumber(totals.totalQuantity)} L\n`;
    txt += `Total Amount: ${state.companyData.currency} ${formatNumber(totals.totalAmount)}\n`;
    txt += `PMS: ${formatNumber(totals.pmsQuantity)} L (${state.companyData.currency} ${formatNumber(totals.pmsAmount)})\n`;
    txt += `AGO: ${formatNumber(totals.agoQuantity)} L (${state.companyData.currency} ${formatNumber(totals.agoAmount)})`;

    const blob = new Blob([txt], { type: "text/plain" });
    saveAs(blob, "Fuel_Offloading_Report.txt");
  };

  const exportHandlers = {
    pdf: exportToPDF,
    excel: exportToExcel,
    txt: exportToTXT,
    whatsapp: () => {
      const msg = `*${state.companyData.name}*\n\n*Fuel Offloading Summary*\n\nTotal Quantity: ${formatNumber(totals.totalQuantity)} L\nTotal Amount: ${state.companyData.currency} ${formatNumber(totals.totalAmount)}\n\nPMS: ${formatNumber(totals.pmsQuantity)} L\nAGO: ${formatNumber(totals.agoQuantity)} L\n\nRecords: ${state.offloadingRecords.length}`;
      const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    },
    email: () => {
      const subject = "Fuel Offloading Report";
      const body = `${state.companyData.name}\n\nFuel Offloading Summary\n\nTotal Quantity: ${formatNumber(totals.totalQuantity)} L\nTotal Amount: ${state.companyData.currency} ${formatNumber(totals.totalAmount)}\n\nPMS: ${formatNumber(totals.pmsQuantity)} L\nAGO: ${formatNumber(totals.agoQuantity)} L\n\nRecords: ${state.offloadingRecords.length}`;
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    },
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
            <Truck size={24} />
            Fuel Offloading Tracker
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(true)}
              className="btn btn-primary"
            >
              <Plus size={16} />
              New Offloading
            </button>
            <ExportDropdown onExport={exportHandlers} title="Export" />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="flex items-center gap-2 mb-2">
              <Fuel size={20} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Total Quantity
              </span>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {formatNumber(totals.totalQuantity)} L
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={20} className="text-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Total Value
              </span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {state.companyData.currency} {formatNumber(totals.totalAmount)}
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700">
            <div className="flex items-center gap-2 mb-2">
              <Fuel size={20} className="text-indigo-500" />
              <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                PMS
              </span>
            </div>
            <div className="text-lg font-bold text-yellow-600">
              {formatNumber(totals.pmsQuantity)} L
            </div>
            <div className="text-sm text-yellow-600">
              {state.companyData.currency} {formatNumber(totals.pmsAmount)}
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
            <div className="flex items-center gap-2 mb-2">
              <Fuel size={20} className="text-indigo-500" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                AGO
              </span>
            </div>
            <div className="text-lg font-bold text-purple-600">
              {formatNumber(totals.agoQuantity)} L
            </div>
            <div className="text-sm text-purple-600">
              {state.companyData.currency} {formatNumber(totals.agoAmount)}
            </div>
          </div>
        </div>

        {/* Records Table */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>Truck Reg</th>
                <th>Driver</th>
                <th>Fuel Type</th>
                <th>Quantity (L)</th>
                <th>Rate</th>
                <th>Total Amount</th>
                <th>Supplier</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.offloadingRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-8 text-gray-500 dark:text-gray-400"
                  >
                    <Truck size={48} className="mx-auto mb-2 opacity-30" />
                    <p>No offloading records found</p>
                    <p className="text-sm">
                      Add your first offloading record to get started
                    </p>
                  </td>
                </tr>
              ) : (
                state.offloadingRecords
                  .sort(
                    (a, b) =>
                      new Date(b.date + " " + b.time).getTime() -
                      new Date(a.date + " " + a.time).getTime()
                  )
                  .map(record => (
                    <tr key={record.id}>
                      <td>
                        <div className="flex items-center gap-1">
                          <Calendar size={14} className="text-gray-400" />
                          <div>
                            <div className="font-medium">{record.date}</div>
                            <div className="text-sm text-gray-500">
                              {record.time}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="font-mono font-medium">
                        {record.truckReg}
                      </td>
                      <td>{record.driverName}</td>
                      <td>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            record.fuelType === "PMS"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                              : "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                          }`}
                        >
                          {record.fuelType}
                        </span>
                      </td>
                      <td className="font-mono">
                        {formatNumber(record.quantity)}
                      </td>
                      <td className="font-mono">
                        {state.companyData.currency} {formatNumber(record.rate)}
                      </td>
                      <td className="font-mono font-medium">
                        {state.companyData.currency}{" "}
                        {formatNumber(record.totalAmount)}
                      </td>
                      <td>{record.supplier}</td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            onClick={() => editRecord(record)}
                            className="btn btn-outline p-1"
                            title="Edit"
                          ></button>
                          <button
                            onClick={() => deleteRecord(record.id)}
                            className="btn btn-outline p-1 text-red-600"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {selectedRecord
                  ? "Edit Offloading Record"
                  : "New Offloading Record"}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => handleInputChange("date", e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Time *</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={e => handleInputChange("time", e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Truck Registration *</label>
                <input
                  type="text"
                  value={formData.truckReg}
                  onChange={e =>
                    handleInputChange("truckReg", e.target.value.toUpperCase())
                  }
                  placeholder="e.g. KCA 123A"
                  required
                />
              </div>

              <div className="form-group">
                <label>Driver Name *</label>
                <input
                  type="text"
                  value={formData.driverName}
                  onChange={e =>
                    handleInputChange("driverName", e.target.value)
                  }
                  placeholder="Driver full name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Fuel Type *</label>
                <select
                  value={formData.fuelType}
                  onChange={e => handleInputChange("fuelType", e.target.value)}
                  required
                >
                  <option value="PMS">PMS (Petrol)</option>
                  <option value="AGO">AGO (Diesel)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Quantity (Litres) *</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={e =>
                    handleInputChange(
                      "quantity",
                      parseFloat(e.target.value) || 0
                    )
                  }
                  step="0.1"
                  min="0"
                  required
                />
              </div>

              <div className="form-group">
                <label>Rate per Litre ({state.companyData.currency}) *</label>
                <input
                  type="number"
                  value={formData.rate}
                  onChange={e =>
                    handleInputChange("rate", parseFloat(e.target.value) || 0)
                  }
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              <div className="form-group">
                <label>Total Amount ({state.companyData.currency})</label>
                <input
                  type="number"
                  value={formData.totalAmount}
                  readOnly
                  className="bg-gray-100 dark:bg-gray-700"
                />
              </div>

              <div className="form-group">
                <label>Supplier *</label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={e => handleInputChange("supplier", e.target.value)}
                  placeholder="Supplier company name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Invoice Number</label>
                <input
                  type="text"
                  value={formData.invoiceNo}
                  onChange={e => handleInputChange("invoiceNo", e.target.value)}
                  placeholder="Invoice/Receipt number"
                />
              </div>

              <div className="form-group md:col-span-2">
                <label>Remarks</label>
                <textarea
                  value={formData.remarks}
                  onChange={e => handleInputChange("remarks", e.target.value)}
                  placeholder="Additional notes or remarks"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={saveRecord} className="btn btn-primary flex-1">
                <Save size={16} />
                {selectedRecord ? "Update Record" : "Save Record"}
              </button>
              <button onClick={resetForm} className="btn btn-outline">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
