import { useState } from "react";
import { Save, Trash2, MessageCircle, Mail } from "lucide-react";
import { useFuel } from "@/react-app/context/FuelContext";
import ExportDropdown from "@/react-app/components/ExportDropdown";
import {
  exportDebtPDF,
  exportDebtExcel,
  exportDebtTXT,
} from "@/react-app/utils/exportUtils";
import {
  formatAmountWithCommas,
  parseNumberFromFormatted,
  formatNumber,
} from "@/react-app/utils/formatUtils";

export default function DebtReminder() {
  const { state, dispatch } = useFuel();
  const [debtCustomerName, setDebtCustomerName] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [buyGoodsNo, setBuyGoodsNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [whatsappNo, setWhatsappNo] = useState("");
  const [managerName, setManagerName] = useState("");
  const [contactMethod, setContactMethod] = useState("WhatsApp");

  const handleAmountChange = (value: string) => {
    const formatted = formatAmountWithCommas(value);
    setDebtAmount(formatted);
  };

  const clearDebtForm = () => {
    setDebtCustomerName("");
    setDebtAmount("");
    setBuyGoodsNo("");
    setBankName("");
    setAccountName("");
    setAccountNo("");
    setWhatsappNo("");
    setManagerName("");
  };

  const getDebtData = () => {
    return {
      name: debtCustomerName || "[Customer Name]",
      amount: formatNumber(parseNumberFromFormatted(debtAmount) || 0),
      till: buyGoodsNo || "[Till]",
      bank: bankName || "[Bank]",
      acName: accountName || "[A/C Name]",
      acNo: accountNo || "[A/C No.]",
      contact: whatsappNo || "[Contact]",
      method: contactMethod,
      manager: managerName || "[Manager]",
    };
  };

  const saveDebtReminder = () => {
    const name = debtCustomerName.trim();
    if (!name) {
      alert("Please enter a customer name");
      return;
    }

    const data = {
      name: debtCustomerName,
      amount: debtAmount,
      till: buyGoodsNo,
      bank: bankName,
      acName: accountName,
      acNo: accountNo,
      contact: whatsappNo,
      method: contactMethod,
      manager: managerName,
    };

    const date = new Date().toISOString().split("T")[0];
    const key = `${date}_${name.replace(/\s+/g, "_")}`;

    dispatch({
      type: "SET_DEBT_HISTORY",
      payload: { ...state.debtHistory, [key]: data },
    });

    alert(`Debt reminder for ${name} saved!`);
  };

  const loadDebt = (key: string) => {
    const item = state.debtHistory[key];
    if (!item) return;

    setDebtCustomerName(item.name);
    setDebtAmount(item.amount);
    setBuyGoodsNo(item.till);
    setBankName(item.bank);
    setAccountName(item.acName);
    setAccountNo(item.acNo);
    setWhatsappNo(item.contact);
    setManagerName(item.manager);
    setContactMethod(item.method);
  };

  const deleteDebt = (key: string) => {
    if (confirm("Delete this reminder?")) {
      const updatedHistory = { ...state.debtHistory };
      delete updatedHistory[key];
      dispatch({ type: "SET_DEBT_HISTORY", payload: updatedHistory });
    }
  };

  const sendWhatsApp = () => {
    const data = getDebtData();
    const msg = `Dear ${data.name},%0A%0AThis is a gentle reminder that KES ${data.amount} for fuel supplied remains unpaid.%0A%0AKindly settle the amount via Till:%0ABuy Goods: ${data.till}%0A%0AFor bank transfer:%0ABank: ${data.bank}%0AA/C Name: ${data.acName}%0AA/C No.: ${data.acNo}%0A%0AAfter payment, share the confirmation with us via ${data.method}: ${data.contact}%0A%0AThank you.%0A%0ABest regards,%0A${data.manager}%0AManager%0A${state.companyData.name}%0A%0AP.O. Box: ${state.companyData.poBox || "N/A"}%0ACONTACTS: ${state.companyData.contacts || "N/A"}%0AEMAIL: ${state.companyData.email || "N/A"}`;
    const url = `https://wa.me/${data.contact.replace(/\D/g, "")}?text=${msg}`;
    window.open(url, "_blank");
  };

  const sendEmail = () => {
    const data = getDebtData();
    const subject = `Fuel Debt Reminder - ${data.amount}`;
    const body = `Dear ${data.name},\n\nThis is a gentle reminder that KES ${data.amount} for fuel supplied remains unpaid.\n\nKindly settle the amount via Till:\nBuy Goods: ${data.till}\n\nFor bank transfer:\nBank: ${data.bank}\nA/C Name: ${data.acName}\nA/C No.: ${data.acNo}\n\nAfter payment, share the confirmation with us via ${data.method}: ${data.contact}\n\nThank you.\n\nBest regards,\n${data.manager}\nManager\n${state.companyData.name}\n\nP.O. Box: ${state.companyData.poBox || "N/A"}\nCONTACTS: ${state.companyData.contacts || "N/A"}\nEMAIL: ${state.companyData.email || "N/A"}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const exportHandlers = {
    pdf: () =>
      exportDebtPDF({
        ...state,
        debtData: getDebtData(),
      }),
    excel: () =>
      exportDebtExcel({
        ...state,
        debtData: getDebtData(),
      }),
    txt: () =>
      exportDebtTXT({
        ...state,
        debtData: getDebtData(),
      }),
    whatsapp: () => {
      const data = getDebtData();
      const msg = `*${state.companyData.name}*\n\n*Fuel Debt Payment Reminder*\n\nDear ${data.name},\n\nThis is a gentle reminder that KES ${data.amount} for fuel supplied remains unpaid.\n\nKindly settle the amount via Till:\nBuy Goods: ${data.till}\n\nFor bank transfer:\nBank: ${data.bank}\nA/C Name: ${data.acName}\nA/C No.: ${data.acNo}\n\nAfter payment, share the confirmation with us via ${data.method}: ${data.contact}\n\nThank you.\n\nBest regards,\n${data.manager}\nManager\n${state.companyData.name}\n\n*P.O. Box:* ${state.companyData.poBox || "N/A"}\n*CONTACTS:* ${state.companyData.contacts || "N/A"}\n*EMAIL:* ${state.companyData.email || "N/A"}`;
      const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    },
    email: () => {
      const data = getDebtData();
      const subject = `Fuel Debt Payment Reminder - ${data.amount}`;
      const body = `${state.companyData.name}\n\nFuel Debt Payment Reminder\n\nDear ${data.name},\n\nThis is a gentle reminder that KES ${data.amount} for fuel supplied remains unpaid.\n\nKindly settle the amount via Till:\nBuy Goods: ${data.till}\n\nFor bank transfer:\nBank: ${data.bank}\nA/C Name: ${data.acName}\nA/C No.: ${data.acNo}\n\nAfter payment, share the confirmation with us via ${data.method}: ${data.contact}\n\nThank you.\n\nBest regards,\n${data.manager}\nManager\n${state.companyData.name}\n\nP.O. Box: ${state.companyData.poBox || "N/A"}\nCONTACTS: ${state.companyData.contacts || "N/A"}\nEMAIL: ${state.companyData.email || "N/A"}`;
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    },
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-200">
            Fuel Debt Payment Reminder
          </h2>
          <div className="flex gap-2">
            <button onClick={saveDebtReminder} className="btn btn-primary">
              <Save size={16} />
              Save
            </button>
            <button onClick={clearDebtForm} className="btn btn-outline">
              <Trash2 size={16} />
              Clear
            </button>
          </div>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="form-group">
            <label>Customer Name</label>
            <input
              type="text"
              value={debtCustomerName}
              onChange={e => setDebtCustomerName(e.target.value)}
              placeholder="Customer name"
            />
          </div>
          <div className="form-group">
            <label>Amount (KES)</label>
            <input
              type="text"
              value={debtAmount}
              onChange={e => handleAmountChange(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="form-group">
            <label>Buy Goods Number</label>
            <input
              type="text"
              value={buyGoodsNo}
              onChange={e => setBuyGoodsNo(e.target.value)}
              placeholder="e.g. 123456"
            />
          </div>
          <div className="form-group">
            <label>Bank Name</label>
            <input
              type="text"
              value={bankName}
              onChange={e => setBankName(e.target.value)}
              placeholder="e.g. Equity Bank"
            />
          </div>
          <div className="form-group">
            <label>A/C Name</label>
            <input
              type="text"
              value={accountName}
              onChange={e => setAccountName(e.target.value)}
              placeholder="Account holder name"
            />
          </div>
          <div className="form-group">
            <label>A/C No.</label>
            <input
              type="text"
              value={accountNo}
              onChange={e => setAccountNo(e.target.value)}
              placeholder="Account number"
            />
          </div>
          <div className="form-group">
            <label>WhatsApp Number</label>
            <input
              type="text"
              value={whatsappNo}
              onChange={e => setWhatsappNo(e.target.value)}
              placeholder="+254..."
            />
          </div>
          <div className="form-group">
            <label>Manager Name</label>
            <input
              type="text"
              value={managerName}
              onChange={e => setManagerName(e.target.value)}
              placeholder="Manager name"
            />
          </div>
          <div className="form-group">
            <label>Contact Method</label>
            <select
              value={contactMethod}
              onChange={e => setContactMethod(e.target.value)}
            >
              <option value="WhatsApp">WhatsApp</option>
              <option value="Email">Email</option>
            </select>
          </div>
        </div>
      </div>

      {/* Client History */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Client History</h3>
        </div>
        <div className="history-panel">
          {Object.keys(state.debtHistory)
            .sort(
              (a, b) =>
                new Date(b.split("_")[0]).getTime() -
                new Date(a.split("_")[0]).getTime()
            )
            .map(key => {
              const item = state.debtHistory[key];
              return (
                <div key={key} className="history-item">
                  <span>
                    {item.name} - Ksh {item.amount}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => loadDebt(key)} className="text-xs">
                      Load
                    </button>
                    <button onClick={() => deleteDebt(key)} className="text-xs">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Actions */}
      <div className="card">
        <div className="flex gap-4 flex-wrap">
          <ExportDropdown onExport={exportHandlers} title="Export Reminder" />
          <button onClick={sendWhatsApp} className="btn btn-secondary">
            <MessageCircle size={16} />
            WhatsApp
          </button>
          <button onClick={sendEmail} className="btn btn-outline">
            <Mail size={16} />
            Email
          </button>
        </div>
      </div>
    </div>
  );
}
