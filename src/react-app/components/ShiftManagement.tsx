import { useState, useMemo } from "react";
import { useLocation } from "@/react-app/context/LocationContext";
import {
  Calendar,
  Clock,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Download,
  Search,
  ChevronDown,
} from "lucide-react";

interface Shift {
  id: string;
  employeeName: string;
  role: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: "morning" | "afternoon" | "night" | "custom";
  pumpAssigned: string;
  status: "scheduled" | "active" | "completed" | "absent";
  notes: string;
  checkIn?: string;
  checkOut?: string;
}

interface Employee {
  id: string;
  name: string;
  phone: string;
  role: string;
  hourlyRate: number;
  status: "active" | "on_leave" | "suspended";
  joinDate: string;
}

const SHIFT_TEMPLATES = [
  {
    type: "morning" as const,
    label: "Morning",
    icon: Sunrise,
    start: "06:00",
    end: "14:00",
    color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
  },
  {
    type: "afternoon" as const,
    label: "Afternoon",
    icon: Sun,
    start: "14:00",
    end: "22:00",
    color: "text-orange-600 bg-orange-50 dark:bg-orange-900/20",
  },
  {
    type: "night" as const,
    label: "Night",
    icon: Moon,
    start: "22:00",
    end: "06:00",
    color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20",
  },
];

export default function ShiftManagement() {
  const location = useLocation();
  const currencySymbol = location.currencySymbol;
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("fuelpro_employees") || "[]");
    } catch {
      return defaultEmployees();
    }
  });
  const [shifts, setShifts] = useState<Shift[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("fuelpro_shifts") || "[]");
    } catch {
      return [];
    }
  });
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [showAddShift, setShowAddShift] = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newShift, setNewShift] = useState({
    employeeId: "",
    shiftType: "morning" as const,
    pumpAssigned: "",
    notes: "",
  });
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    phone: "",
    role: "Attendant",
    hourlyRate: 200,
  });
  const [searchEmp, setSearchEmp] = useState("");

  const saveShifts = (s: Shift[]) => {
    setShifts(s);
    localStorage.setItem("fuelpro_shifts", JSON.stringify(s));
  };
  const saveEmployees = (e: Employee[]) => {
    setEmployees(e);
    localStorage.setItem("fuelpro_employees", JSON.stringify(e));
  };

  const dayShifts = useMemo(
    () => shifts.filter(s => s.date === selectedDate),
    [shifts, selectedDate]
  );
  const activeNow = dayShifts.filter(s => s.status === "active").length;
  const scheduled = dayShifts.filter(s => s.status === "scheduled").length;

  const addShift = () => {
    if (!newShift.employeeId) return;
    const emp = employees.find(e => e.id === newShift.employeeId);
    if (!emp) return;
    const tmpl =
      SHIFT_TEMPLATES.find(t => t.type === newShift.shiftType) ||
      SHIFT_TEMPLATES[0];
    const shift: Shift = {
      id: `shift_${Date.now()}`,
      employeeName: emp.name,
      role: emp.role,
      date: selectedDate,
      startTime: tmpl.start,
      endTime: tmpl.end,
      shiftType: newShift.shiftType,
      pumpAssigned: newShift.pumpAssigned || "Any",
      status: "scheduled",
      notes: newShift.notes,
      employeeId: emp.id,
    } as any;
    saveShifts([shift, ...shifts]);
    setShowAddShift(false);
  };

  const addEmployee = () => {
    if (!newEmployee.name) return;
    const emp: Employee = {
      id: `emp_${Date.now()}`,
      ...newEmployee,
      status: "active",
      joinDate: new Date().toISOString().split("T")[0],
    };
    saveEmployees([emp, ...employees]);
    setNewEmployee({ name: "", phone: "", role: "Attendant", hourlyRate: 200 });
    setShowAddEmployee(false);
  };

  const toggleStatus = (id: string) => {
    saveShifts(
      shifts.map(s => {
        if (s.id !== id) return s;
        if (s.status === "scheduled")
          return {
            ...s,
            status: "active" as const,
            checkIn: new Date().toISOString(),
          };
        if (s.status === "active")
          return {
            ...s,
            status: "completed" as const,
            checkOut: new Date().toISOString(),
          };
        return s;
      })
    );
  };

  const filteredEmp = employees.filter(
    e =>
      e.name.toLowerCase().includes(searchEmp.toLowerCase()) ||
      e.role.toLowerCase().includes(searchEmp.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-cyan-100 dark:bg-cyan-900/30 rounded-xl">
          <Calendar size={24} className="text-cyan-600 dark:text-cyan-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Shift Management
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Schedule shifts, track attendance, manage staff
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Staff Total</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {employees.length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Active Now</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {activeNow}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Scheduled</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {scheduled}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Shifts Today</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {dayShifts.length}
          </p>
        </div>
      </div>

      {/* Date selector + add buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white"
        />
        <button
          onClick={() => setShowAddShift(true)}
          className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-medium flex items-center gap-2"
        >
          <Clock size={16} /> Schedule Shift
        </button>
        <button
          onClick={() => setShowAddEmployee(true)}
          className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl text-sm font-medium flex items-center gap-2 dark:text-white"
        >
          <UserPlus size={16} /> Add Employee
        </button>
      </div>

      {/* Add Shift Form */}
      {showAddShift && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-lg">
          <h3 className="text-sm font-semibold dark:text-white mb-3">
            Schedule Shift
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select
              value={newShift.employeeId}
              onChange={e =>
                setNewShift({ ...newShift, employeeId: e.target.value })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Select Employee</option>
              {employees
                .filter(e => e.status === "active")
                .map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.role})
                  </option>
                ))}
            </select>
            <select
              value={newShift.shiftType}
              onChange={e =>
                setNewShift({ ...newShift, shiftType: e.target.value as any })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {SHIFT_TEMPLATES.map(t => (
                <option key={t.type} value={t.type}>
                  {t.label} ({t.start}-{t.end})
                </option>
              ))}
            </select>
            <input
              placeholder="Pump Assignment (e.g., Pump 1)"
              value={newShift.pumpAssigned}
              onChange={e =>
                setNewShift({ ...newShift, pumpAssigned: e.target.value })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <div className="flex gap-2">
              <button
                onClick={addShift}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm"
              >
                Schedule
              </button>
              <button
                onClick={() => setShowAddShift(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm dark:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Form */}
      {showAddEmployee && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-lg">
          <h3 className="text-sm font-semibold dark:text-white mb-3">
            Add Employee
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              placeholder="Full Name *"
              value={newEmployee.name}
              onChange={e =>
                setNewEmployee({ ...newEmployee, name: e.target.value })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <input
              placeholder="Phone"
              value={newEmployee.phone}
              onChange={e =>
                setNewEmployee({ ...newEmployee, phone: e.target.value })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <select
              value={newEmployee.role}
              onChange={e =>
                setNewEmployee({ ...newEmployee, role: e.target.value })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option>Attendant</option>
              <option>Cashier</option>
              <option>Supervisor</option>
              <option>Manager</option>
              <option>Security</option>
              <option>Driver</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={addEmployee}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddEmployee(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm dark:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {dayShifts.map(shift => {
          const tmpl = SHIFT_TEMPLATES.find(t => t.type === shift.shiftType);
          const Icon = tmpl?.icon || Clock;
          return (
            <div
              key={shift.id}
              className={`rounded-xl p-4 border shadow-sm transition-all ${shift.status === "active" ? "bg-green-50 dark:bg-green-900/10 border-green-300 dark:border-green-700" : shift.status === "completed" ? "bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700 opacity-70" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon
                    size={16}
                    className={tmpl?.color.split(" ")[0] || "text-gray-600"}
                  />
                  <span className="text-sm font-semibold dark:text-white">
                    {shift.employeeName}
                  </span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${shift.status === "active" ? "bg-green-500 text-white" : shift.status === "completed" ? "bg-gray-400 text-white" : shift.status === "absent" ? "bg-red-500 text-white" : "bg-blue-500 text-white"}`}
                >
                  {shift.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-1">
                {shift.role}{" "}
                {shift.pumpAssigned !== "Any" ? `| ${shift.pumpAssigned}` : ""}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {shift.startTime} - {shift.endTime}
              </p>
              {shift.checkIn && (
                <p className="text-[10px] text-green-600">
                  Checked in: {new Date(shift.checkIn).toLocaleTimeString()}
                </p>
              )}
              {shift.checkOut && (
                <p className="text-[10px] text-gray-500">
                  Checked out: {new Date(shift.checkOut).toLocaleTimeString()}
                </p>
              )}
              <button
                onClick={() => toggleStatus(shift.id)}
                className={`mt-2 w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${shift.status === "scheduled" ? "bg-green-600 hover:bg-green-700 text-white" : shift.status === "active" ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-default"}`}
              >
                {shift.status === "scheduled"
                  ? "Check In"
                  : shift.status === "active"
                    ? "Check Out"
                    : "Done"}
              </button>
            </div>
          );
        })}
        {dayShifts.length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-400 text-sm">
            No shifts scheduled for{" "}
            {new Date(selectedDate).toLocaleDateString()}. Click &quot;Schedule
            Shift&quot; to add one.
          </div>
        )}
      </div>

      {/* Employee Roster */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold dark:text-white">
            Employee Roster
          </h3>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              placeholder="Search..."
              value={searchEmp}
              onChange={e => setSearchEmp(e.target.value)}
              className="pl-8 pr-3 py-1.5 border rounded-lg text-xs dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Role</th>
                <th className="text-left px-3 py-2">Phone</th>
                <th className="text-right px-3 py-2">Rate/hr</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmp.map(e => (
                <tr
                  key={e.id}
                  className="border-b border-gray-100 dark:border-gray-700/50"
                >
                  <td className="px-3 py-2 font-medium dark:text-white">
                    {e.name}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{e.role}</td>
                  <td className="px-3 py-2 text-gray-500">{e.phone || "-"}</td>
                  <td className="px-3 py-2 text-right dark:text-white">
                    {currencySymbol}
                    {e.hourlyRate}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${e.status === "active" ? "bg-green-100 text-green-700" : e.status === "on_leave" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}
                    >
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function defaultEmployees(): Employee[] {
  return [];
}
