import { useState, useEffect } from "react";
import {
  Plus,
  DollarSign,
  ArrowRight,
  Columns,
  Save,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useFuel } from "@/react-app/context/FuelContext";
import SignatureCanvas from "@/react-app/components/SignatureCanvas";
import ExportDropdown from "@/react-app/components/ExportDropdown";
import {
  exportDeliveryPDF,
  exportDeliveryExcel,
  exportDeliveryTXT,
} from "@/react-app/utils/exportUtils";
import { formatNumber } from "@/react-app/utils/formatUtils";

export default function DeliveryTracker() {
  const { state, dispatch } = useFuel();
  const [managerSignature, setManagerSignature] = useState("");
  const [directorSignature, setDirectorSignature] = useState("");

  // Signature state management
  useEffect(() => {
    // Signatures are ready for use in export functions
    if (managerSignature || directorSignature) {
      console.log("Signatures updated");
    }
  }, [managerSignature, directorSignature]);

  const addDeliveryRow = () => {
    const newRow: any = {};
    state.deliveryData.columns.forEach(col => {
      switch (col.key) {
        case "date":
          newRow.date = new Date().toISOString().split("T")[0];
          break;
        case "reg":
          newRow.reg = "";
          break;
        case "fuel":
          newRow.fuel = "Petrol";
          break;
        case "litres":
          newRow.litres = 0;
          break;
        case "amount":
          newRow.amount = 0;
          break;
        case "name":
          newRow.name = "";
          break;
        case "debt":
          newRow.debt = 0;
          break;
        default:
          newRow[col.key] = "";
          break;
      }
    });

    const updatedData = {
      ...state.deliveryData,
      rows: [...state.deliveryData.rows, newRow],
    };

    dispatch({ type: "SET_DELIVERY_DATA", payload: updatedData });
    updateDeliveryTotals(updatedData);
  };

  const addPaymentRow = () => {
    const amount = parseFloat(
      prompt("Enter payment amount (Ksh):", "0") || "0"
    );
    const name = prompt("Payment from:", "") || "";

    const newRow: any = {};
    state.deliveryData.columns.forEach(col => {
      switch (col.key) {
        case "date":
          newRow.date = new Date().toISOString().split("T")[0];
          break;
        case "reg":
          newRow.reg = "PAYMENT";
          break;
        case "fuel":
          newRow.fuel = "-";
          break;
        case "litres":
          newRow.litres = 0;
          break;
        case "amount":
          newRow.amount = -amount;
          break;
        case "name":
          newRow.name = name;
          break;
        case "debt":
          newRow.debt = -amount;
          break;
        default:
          newRow[col.key] = "";
          break;
      }
    });

    const updatedData = {
      ...state.deliveryData,
      rows: [...state.deliveryData.rows, newRow],
    };

    dispatch({ type: "SET_DELIVERY_DATA", payload: updatedData });
    updateDeliveryTotals(updatedData);
  };

  const addCarriedOverDebt = () => {
    const amount = parseFloat(
      prompt("Carried Over Debt Amount (Ksh):", "0") || "0"
    );

    const newRow: any = {};
    state.deliveryData.columns.forEach(col => {
      switch (col.key) {
        case "date":
          newRow.date = "C/O";
          break;
        case "reg":
          newRow.reg = "Carried Over Debt";
          break;
        case "fuel":
          newRow.fuel = "Carried Over Debt";
          break;
        case "litres":
          newRow.litres = 0;
          break;
        case "amount":
          newRow.amount = amount;
          break;
        case "name":
          newRow.name = "Carried Over Debt";
          break;
        case "debt":
          newRow.debt = amount;
          break;
        default:
          newRow[col.key] = "";
          break;
      }
    });

    const updatedData = {
      ...state.deliveryData,
      rows: [...state.deliveryData.rows, newRow],
    };

    dispatch({ type: "SET_DELIVERY_DATA", payload: updatedData });
    updateDeliveryTotals(updatedData);
  };

  const addColumn = () => {
    const colName = prompt("Enter column name:");
    if (!colName) return;

    const key = colName.toLowerCase().replace(/\s+/g, "");
    const newColumn = { key, label: colName, editable: true };

    const updatedData = {
      ...state.deliveryData,
      columns: [...state.deliveryData.columns, newColumn],
    };

    dispatch({ type: "SET_DELIVERY_DATA", payload: updatedData });
  };

  const moveColumnLeft = (columnIndex: number) => {
    if (columnIndex === 0) return; // Can't move first column left

    const updatedColumns = [...state.deliveryData.columns];
    const temp = updatedColumns[columnIndex];
    updatedColumns[columnIndex] = updatedColumns[columnIndex - 1];
    updatedColumns[columnIndex - 1] = temp;

    const updatedData = {
      ...state.deliveryData,
      columns: updatedColumns,
    };

    dispatch({ type: "SET_DELIVERY_DATA", payload: updatedData });
  };

  const moveColumnRight = (columnIndex: number) => {
    if (columnIndex === state.deliveryData.columns.length - 1) return; // Can't move last column right

    const updatedColumns = [...state.deliveryData.columns];
    const temp = updatedColumns[columnIndex];
    updatedColumns[columnIndex] = updatedColumns[columnIndex + 1];
    updatedColumns[columnIndex + 1] = temp;

    const updatedData = {
      ...state.deliveryData,
      columns: updatedColumns,
    };

    dispatch({ type: "SET_DELIVERY_DATA", payload: updatedData });
  };

  const deleteColumn = (columnIndex: number) => {
    const column = state.deliveryData.columns[columnIndex];

    // Prevent deletion of essential columns
    const essentialColumns = [
      "date",
      "reg",
      "fuel",
      "litres",
      "amount",
      "name",
      "debt",
    ];
    if (essentialColumns.includes(column.key)) {
      alert(
        `Cannot delete the "${column.label}" column as it is essential for calculations.`
      );
      return;
    }

    if (
      confirm(
        `Delete the "${column.label}" column? This will remove all data in this column.`
      )
    ) {
      const updatedColumns = [...state.deliveryData.columns];
      updatedColumns.splice(columnIndex, 1);

      // Remove the column data from all rows
      const updatedRows = state.deliveryData.rows.map(row => {
        const newRow = { ...row };
        delete newRow[column.key];
        return newRow;
      });

      const updatedData = {
        ...state.deliveryData,
        columns: updatedColumns,
        rows: updatedRows,
      };

      dispatch({ type: "SET_DELIVERY_DATA", payload: updatedData });
    }
  };

  const updateCell = (rowIndex: number, field: string, value: any) => {
    const updatedRows = [...state.deliveryData.rows];
    const row = updatedRows[rowIndex] as any;

    if (field === "litres" || field === "fuel") {
      const litres = parseFloat(value) || 0;
      const fuel = field === "fuel" ? value : row.fuel;
      const price = fuel === "Petrol" ? state.petrolPrice : state.dieselPrice;
      const amount = litres * price;

      row[field] = field === "litres" ? litres : value;
      row.amount = amount;
    } else if (field === "reg") {
      row.reg = value;
      if (value === "PAYMENT" || value === "Carried Over Debt") {
        row.fuel = "-";
      }
    } else {
      row[field] = value;
    }

    // Recalculate cumulative debt
    let cumulativeSum = 0;
    for (let i = 0; i < updatedRows.length; i++) {
      cumulativeSum += updatedRows[i].amount || 0;
      updatedRows[i].debt = cumulativeSum;
    }

    const updatedData = {
      ...state.deliveryData,
      rows: updatedRows,
    };

    dispatch({ type: "SET_DELIVERY_DATA", payload: updatedData });
    updateDeliveryTotals(updatedData);
  };

  const deleteRow = (index: number) => {
    if (confirm("Delete this row?")) {
      const updatedRows = [...state.deliveryData.rows];
      updatedRows.splice(index, 1);

      // Recalculate cumulative debt
      let cumulativeSum = 0;
      for (let i = 0; i < updatedRows.length; i++) {
        cumulativeSum += updatedRows[i].amount || 0;
        updatedRows[i].debt = cumulativeSum;
      }

      const updatedData = {
        ...state.deliveryData,
        rows: updatedRows,
      };

      dispatch({ type: "SET_DELIVERY_DATA", payload: updatedData });
      updateDeliveryTotals(updatedData);
    }
  };

  const updateDeliveryTotals = (deliveryData: any) => {
    const totalSupplied = deliveryData.rows
      .filter((r: any) => r.reg !== "PAYMENT" && r.reg !== "Carried Over Debt")
      .reduce((sum: number, r: any) => sum + (r.litres || 0), 0);

    const totalPayments = deliveryData.rows
      .filter((r: any) => r.reg === "PAYMENT")
      .reduce((sum: number, r: any) => sum + Math.abs(r.amount || 0), 0);

    const balanceDue =
      deliveryData.rows.length > 0
        ? deliveryData.rows[deliveryData.rows.length - 1].debt || 0
        : 0;

    const updatedData = {
      ...deliveryData,
      totals: { totalSupplied, totalPayments, balanceDue },
    };

    dispatch({ type: "SET_DELIVERY_DATA", payload: updatedData });
  };

  const saveClient = () => {
    const name = state.deliveredTo.trim() || `Client_${Date.now()}`;
    const clientData = {
      ...state.deliveryData,
      deliveredTo: name,
      year: state.deliveryYear,
    };

    dispatch({
      type: "SET_CLIENTS",
      payload: { ...state.clients, [name]: clientData },
    });

    alert(`Client "${name}" saved!`);
  };

  const loadClient = (name: string) => {
    const data = state.clients[name];
    if (!data) return;

    dispatch({ type: "SET_DELIVERY_DATA", payload: data });
    dispatch({
      type: "SET_DELIVERY_INFO",
      payload: {
        deliveredTo: data.deliveredTo,
        deliveryYear: data.year || 2025,
      },
    });
  };

  const deleteClient = (name: string) => {
    if (confirm(`Delete client "${name}"?`)) {
      const updatedClients = { ...state.clients };
      delete updatedClients[name];
      dispatch({ type: "SET_CLIENTS", payload: updatedClients });
    }
  };

  const clearAllDelivery = () => {
    if (confirm("Clear all delivery data?")) {
      const clearedData = {
        ...state.deliveryData,
        rows: [],
      };

      dispatch({ type: "SET_DELIVERY_DATA", payload: clearedData });
      dispatch({
        type: "SET_DELIVERY_INFO",
        payload: { deliveredTo: "", totalOrder: "" },
      });
    }
  };

  const exportHandlers = {
    pdf: () => exportDeliveryPDF(state),
    excel: () => exportDeliveryExcel(state),
    txt: () => exportDeliveryTXT(state),
    whatsapp: () => {
      const data = getDeliveryData();
      const msg = `*${state.companyData.name}*\n\n*Fuel Delivery Report*\n\n${data}\n\n*CONTACTS:* ${state.companyData.contacts}\n*EMAIL:* ${state.companyData.email}`;
      const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    },
    email: () => {
      const data = getDeliveryData();
      const subject = `Fuel Delivery Report - ${state.deliveredTo || "Client"}`;
      const body = `${state.companyData.name}\n\nFuel Delivery Report\n\n${data}\n\nCONTACTS: ${state.companyData.contacts}\nEMAIL: ${state.companyData.email}`;
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    },
  };

  const getDeliveryData = () => {
    const headers = state.deliveryData.columns.map(col => col.label);
    const rows = state.deliveryData.rows
      .map(r =>
        state.deliveryData.columns
          .map(col => {
            if (col.key === "amount") return `Ksh${formatNumber(r.amount)}`;
            if (col.key === "debt") return `Ksh${formatNumber(r.debt)}`;
            return r[col.key] || "";
          })
          .join(" | ")
      )
      .join("\n");

    return `FUEL DELIVERED TO: ${state.deliveredTo || "Client"}\nTOTAL ORDER: ${state.totalOrder || "N/A"} Litres\nYEAR: ${state.deliveryYear}\nPetrol Price: Ksh ${state.petrolPrice} /L\nDiesel Price: Ksh ${state.dieselPrice} /L\n\n${headers.join(" | ")}\n${rows}\n\nTotal Supplied: ${formatNumber(state.deliveryData.totals.totalSupplied)} L\nTotal Payments: Ksh ${formatNumber(state.deliveryData.totals.totalPayments)}\nBalance Due: Ksh ${formatNumber(state.deliveryData.totals.balanceDue, 2)}`;
  };

  useEffect(() => {
    if (state.deliveryData.rows.length > 0) {
      updateDeliveryTotals(state.deliveryData);
    }
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-200">
            Delivery Tracker
          </h2>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="form-group">
            <label>Fuel Delivered To</label>
            <input
              type="text"
              value={state.deliveredTo}
              onChange={e =>
                dispatch({
                  type: "SET_DELIVERY_INFO",
                  payload: { deliveredTo: e.target.value },
                })
              }
              placeholder="Client Name"
            />
          </div>
          <div className="form-group">
            <label>Total Order</label>
            <input
              type="text"
              value={state.totalOrder}
              onChange={e =>
                dispatch({
                  type: "SET_DELIVERY_INFO",
                  payload: { totalOrder: e.target.value },
                })
              }
              placeholder="e.g. 50,000 Litres"
            />
          </div>
          <div className="form-group">
            <label>Year</label>
            <input
              type="number"
              value={state.deliveryYear}
              onChange={e =>
                dispatch({
                  type: "SET_DELIVERY_INFO",
                  payload: { deliveryYear: parseInt(e.target.value) },
                })
              }
            />
          </div>
          <div className="form-group">
            <label>Petrol Price (Ksh/L)</label>
            <input
              type="number"
              value={state.petrolPrice}
              onChange={e =>
                dispatch({
                  type: "SET_PRICES",
                  payload: { petrolPrice: parseFloat(e.target.value) },
                })
              }
              step="0.1"
            />
          </div>
          <div className="form-group">
            <label>Diesel Price (Ksh/L)</label>
            <input
              type="number"
              value={state.dieselPrice}
              onChange={e =>
                dispatch({
                  type: "SET_PRICES",
                  payload: { dieselPrice: parseFloat(e.target.value) },
                })
              }
              step="0.1"
            />
          </div>
        </div>

        {/* Table */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {state.deliveryData.columns.map((col, index) => (
                  <th key={col.key} className="relative">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{col.label}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveColumnLeft(index)}
                            disabled={index === 0}
                            className="p-1 hover:bg-white/20 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move Left"
                          >
                            <ChevronLeft size={12} />
                          </button>
                          <button
                            onClick={() => moveColumnRight(index)}
                            disabled={
                              index === state.deliveryData.columns.length - 1
                            }
                            className="p-1 hover:bg-white/20 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move Right"
                          >
                            <ChevronRight size={12} />
                          </button>
                          <button
                            onClick={() => deleteColumn(index)}
                            className="p-1 hover:bg-red-500/20 rounded text-red-300 hover:text-red-100"
                            title="Delete Column"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {col.key === "date" && (
                          <input
                            type="date"
                            className="text-xs bg-transparent border border-white/30 rounded px-1 flex-1"
                          />
                        )}
                        {col.key === "fuel" && (
                          <select className="text-xs bg-transparent border border-white/30 rounded px-1 flex-1">
                            <option value="">All</option>
                            <option value="Petrol">Petrol</option>
                            <option value="Diesel">Diesel</option>
                          </select>
                        )}
                      </div>
                    </div>
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.deliveryData.rows.map((row, index) => (
                <tr key={index}>
                  {state.deliveryData.columns.map(col => (
                    <td key={col.key}>
                      {col.key === "date" ? (
                        <input
                          type="date"
                          value={row.date || ""}
                          onChange={e =>
                            updateCell(index, col.key, e.target.value)
                          }
                          className="w-full bg-transparent border-none outline-none"
                        />
                      ) : col.key === "reg" ? (
                        <input
                          type="text"
                          value={row.reg || ""}
                          onChange={e =>
                            updateCell(index, col.key, e.target.value)
                          }
                          className="w-full bg-transparent border-none outline-none"
                        />
                      ) : col.key === "fuel" ? (
                        row.reg === "PAYMENT" ||
                        row.reg === "Carried Over Debt" ? (
                          <span>-</span>
                        ) : (
                          <select
                            value={row.fuel || "Petrol"}
                            onChange={e =>
                              updateCell(index, col.key, e.target.value)
                            }
                            className="w-full bg-transparent border-none outline-none"
                          >
                            <option value="Petrol">Petrol</option>
                            <option value="Diesel">Diesel</option>
                          </select>
                        )
                      ) : col.key === "litres" ? (
                        <input
                          type="number"
                          value={row.litres || 0}
                          onChange={e =>
                            updateCell(index, col.key, e.target.value)
                          }
                          step="0.1"
                          className="w-full bg-transparent border-none outline-none"
                        />
                      ) : col.key === "amount" ? (
                        <input
                          type="number"
                          value={row.amount || 0}
                          onChange={e =>
                            updateCell(index, col.key, e.target.value)
                          }
                          step="0.01"
                          className="w-full bg-transparent border-none outline-none"
                        />
                      ) : col.key === "name" ? (
                        <input
                          type="text"
                          value={row.name || ""}
                          onChange={e =>
                            updateCell(index, col.key, e.target.value)
                          }
                          className="w-full bg-transparent border-none outline-none"
                        />
                      ) : col.key === "debt" ? (
                        <span>{formatNumber(row.debt || 0)}</span>
                      ) : (
                        <input
                          type="text"
                          value={row[col.key] || ""}
                          onChange={e =>
                            updateCell(index, col.key, e.target.value)
                          }
                          className="w-full bg-transparent border-none outline-none"
                        />
                      )}
                    </td>
                  ))}
                  <td>
                    <button
                      onClick={() => deleteRow(index)}
                      className="btn btn-outline p-1"
                      title="Delete Row"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action Buttons Row */}
        <div className="flex gap-3 mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg justify-center">
          <button onClick={addCarriedOverDebt} className="btn btn-outline">
            <ArrowRight size={16} />
            C/O Debt
          </button>
          <button onClick={addDeliveryRow} className="btn btn-primary">
            <Plus size={16} />
            Add
          </button>
          <button onClick={addPaymentRow} className="btn btn-secondary">
            <DollarSign size={16} />
            Payment
          </button>
          <button onClick={addColumn} className="btn btn-outline">
            <Columns size={16} />
            Column
          </button>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div>
            <strong>Total Supplied:</strong>{" "}
            {formatNumber(state.deliveryData.totals.totalSupplied)} L
          </div>
          <div>
            <strong>Total Payments:</strong> Ksh{" "}
            {formatNumber(state.deliveryData.totals.totalPayments)}
          </div>
          <div>
            <strong>Balance Due:</strong> Ksh{" "}
            {formatNumber(state.deliveryData.totals.balanceDue, 2)}
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="card">
        <h3 className="text-xl font-bold mb-4">Signatures</h3>
        <div className="space-y-4">
          <SignatureCanvas onSave={setManagerSignature} />
          <SignatureCanvas onSave={setDirectorSignature} />
        </div>
      </div>

      {/* Saved Clients */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Saved Clients</h3>
          <div className="flex gap-2">
            <button onClick={saveClient} className="btn btn-primary">
              <Save size={16} />
              Save Client
            </button>
            <button onClick={clearAllDelivery} className="btn btn-outline">
              <Trash2 size={16} />
              Clear All
            </button>
          </div>
        </div>
        <div className="history-panel">
          {Object.keys(state.clients).map(key => (
            <div key={key} className="history-item">
              <span>{key}</span>
              <div className="flex gap-2">
                <button onClick={() => loadClient(key)} className="text-xs">
                  Load
                </button>
                <button onClick={() => deleteClient(key)} className="text-xs">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export */}
      <div className="card">
        <ExportDropdown
          onExport={exportHandlers}
          title="Export Delivery Report"
        />
      </div>
    </div>
  );
}
