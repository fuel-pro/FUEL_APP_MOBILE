import { useState } from "react";
import { useLocation } from "@/react-app/context/LocationContext";
import {
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  TrendingUp,
  Calendar,
  FileText,
  Download,
  Beaker,
  Thermometer,
} from "lucide-react";

interface QualityTest {
  id: string;
  date: string;
  fuelType: "PMS" | "AGO" | "Kerosene";
  batchNumber: string;
  supplier: string;
  density: number; // kg/m3
  temperature: number; // celsius
  waterContent: number; // ppm
  sulfurContent: number; // ppm
  color: string;
  flashPoint: number; // celsius
  appearance: "clear" | "hazy" | "cloudy";
  passed: boolean;
  testedBy: string;
  notes: string;
  certificateUrl?: string;
}

const QUALITY_STANDARDS = {
  PMS: { densityMin: 720, densityMax: 775, sulfurMax: 50, flashMin: 38 },
  AGO: { densityMin: 820, densityMax: 860, sulfurMax: 50, flashMin: 52 },
};

export default function FuelQualityTesting() {
  const location = useLocation();
  const [tests, setTests] = useState<QualityTest[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("fuelpro_quality_tests") || "[]");
    } catch {
      return defaultTests();
    }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [newTest, setNewTest] = useState<Partial<QualityTest>>({
    fuelType: "PMS",
    appearance: "clear",
  });

  const save = (t: QualityTest[]) => {
    setTests(t);
    localStorage.setItem("fuelpro_quality_tests", JSON.stringify(t));
  };

  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;

  const addTest = () => {
    if (!newTest.date || !newTest.batchNumber || !newTest.density) return;
    const std = QUALITY_STANDARDS[newTest.fuelType || "PMS"];
    const isPassed =
      newTest.density >= std.densityMin &&
      newTest.density <= std.densityMax &&
      (newTest.sulfurContent === undefined ||
        newTest.sulfurContent <= std.sulfurMax) &&
      (newTest.flashPoint === undefined ||
        newTest.flashPoint >= std.flashMin) &&
      newTest.appearance === "clear";

    const test: QualityTest = {
      id: `qt_${Date.now()}`,
      date: newTest.date,
      fuelType: newTest.fuelType || "PMS",
      batchNumber: newTest.batchNumber || "",
      supplier: newTest.supplier || "",
      density: newTest.density || 0,
      temperature: newTest.temperature || 0,
      waterContent: newTest.waterContent || 0,
      sulfurContent: newTest.sulfurContent || 0,
      color: newTest.color || "",
      flashPoint: newTest.flashPoint || 0,
      appearance: newTest.appearance || "clear",
      passed: isPassed,
      testedBy: newTest.testedBy || "Lab Technician",
      notes: newTest.notes || "",
    };
    save([test, ...tests]);
    setShowAdd(false);
    setNewTest({ fuelType: "PMS", appearance: "clear" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-teal-100 dark:bg-teal-900/30 rounded-xl">
          <FlaskConical
            size={24}
            className="text-teal-600 dark:text-teal-400"
          />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Fuel Quality Testing
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Test & certify fuel quality, track compliance
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Total Tests</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {tests.length}
          </p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-4 border border-green-200 dark:border-green-800">
          <p className="text-xs text-green-600">Passed</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {passed}
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 border border-red-200 dark:border-red-800">
          <p className="text-xs text-red-600">Failed</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {failed}
          </p>
        </div>
      </div>

      {/* Quality Standards Reference */}
      <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
          <FileText size={14} /> Quality Standards (
          {location.currentCountry.shortName})
        </h3>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-300">
              PMS (Petrol)
            </p>
            <p className="text-blue-700 dark:text-blue-400">
              Density: {QUALITY_STANDARDS.PMS.densityMin}-
              {QUALITY_STANDARDS.PMS.densityMax} kg/m
            </p>
            <p className="text-blue-700 dark:text-blue-400">
              Sulfur: max {QUALITY_STANDARDS.PMS.sulfurMax} ppm
            </p>
            <p className="text-blue-700 dark:text-blue-400">
              Flash point: min {QUALITY_STANDARDS.PMS.flashMin} C
            </p>
          </div>
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-300">
              AGO (Diesel)
            </p>
            <p className="text-blue-700 dark:text-blue-400">
              Density: {QUALITY_STANDARDS.AGO.densityMin}-
              {QUALITY_STANDARDS.AGO.densityMax} kg/m
            </p>
            <p className="text-blue-700 dark:text-blue-400">
              Sulfur: max {QUALITY_STANDARDS.AGO.sulfurMax} ppm
            </p>
            <p className="text-blue-700 dark:text-blue-400">
              Flash point: min {QUALITY_STANDARDS.AGO.flashMin} C
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowAdd(true)}
        className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-medium flex items-center gap-2"
      >
        <Plus size={16} /> Record Test
      </button>

      {showAdd && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-lg">
          <h3 className="text-sm font-semibold dark:text-white mb-3">
            New Quality Test
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="date"
              value={newTest.date || ""}
              onChange={e => setNewTest({ ...newTest, date: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <select
              value={newTest.fuelType}
              onChange={e =>
                setNewTest({ ...newTest, fuelType: e.target.value as any })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="PMS">PMS (Petrol)</option>
              <option value="AGO">AGO (Diesel)</option>
              <option value="Kerosene">Kerosene</option>
            </select>
            <input
              placeholder="Batch Number *"
              value={newTest.batchNumber || ""}
              onChange={e =>
                setNewTest({ ...newTest, batchNumber: e.target.value })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <input
              placeholder="Supplier"
              value={newTest.supplier || ""}
              onChange={e =>
                setNewTest({ ...newTest, supplier: e.target.value })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <input
              type="number"
              step="0.1"
              placeholder="Density (kg/m) *"
              value={newTest.density || ""}
              onChange={e =>
                setNewTest({ ...newTest, density: parseFloat(e.target.value) })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <input
              type="number"
              step="0.1"
              placeholder="Temperature (C)"
              value={newTest.temperature || ""}
              onChange={e =>
                setNewTest({
                  ...newTest,
                  temperature: parseFloat(e.target.value),
                })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <input
              type="number"
              placeholder="Water Content (ppm)"
              value={newTest.waterContent || ""}
              onChange={e =>
                setNewTest({
                  ...newTest,
                  waterContent: parseFloat(e.target.value),
                })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <input
              type="number"
              placeholder="Sulfur Content (ppm)"
              value={newTest.sulfurContent || ""}
              onChange={e =>
                setNewTest({
                  ...newTest,
                  sulfurContent: parseFloat(e.target.value),
                })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <input
              type="number"
              step="0.1"
              placeholder="Flash Point (C)"
              value={newTest.flashPoint || ""}
              onChange={e =>
                setNewTest({
                  ...newTest,
                  flashPoint: parseFloat(e.target.value),
                })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <select
              value={newTest.appearance}
              onChange={e =>
                setNewTest({ ...newTest, appearance: e.target.value as any })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="clear">Clear</option>
              <option value="hazy">Hazy</option>
              <option value="cloudy">Cloudy</option>
            </select>
            <input
              placeholder="Tested By"
              value={newTest.testedBy || ""}
              onChange={e =>
                setNewTest({ ...newTest, testedBy: e.target.value })
              }
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <input
              placeholder="Notes"
              value={newTest.notes || ""}
              onChange={e => setNewTest({ ...newTest, notes: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={addTest}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium"
            >
              Save Test
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm dark:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tests Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700 z-10">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Batch</th>
                <th className="px-3 py-2">Fuel</th>
                <th className="text-right px-3 py-2">Density</th>
                <th className="text-right px-3 py-2">Sulfur</th>
                <th className="text-right px-3 py-2">Flash</th>
                <th className="px-3 py-2">Appearance</th>
                <th className="px-3 py-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {tests.map(t => (
                <tr
                  key={t.id}
                  className="border-b border-gray-100 dark:border-gray-700/50"
                >
                  <td className="px-3 py-2 text-gray-500">{t.date}</td>
                  <td className="px-3 py-2 dark:text-white font-medium">
                    {t.batchNumber}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${t.fuelType === "PMS" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                    >
                      {t.fuelType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right dark:text-white">
                    {t.density}
                  </td>
                  <td className="px-3 py-2 text-right dark:text-white">
                    {t.sulfurContent}
                  </td>
                  <td className="px-3 py-2 text-right dark:text-white">
                    {t.flashPoint}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${t.appearance === "clear" ? "bg-green-100 text-green-700" : t.appearance === "hazy" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}
                    >
                      {t.appearance}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {t.passed ? (
                      <CheckCircle2
                        size={14}
                        className="text-green-500 inline"
                      />
                    ) : (
                      <XCircle size={14} className="text-red-500 inline" />
                    )}
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

function defaultTests(): QualityTest[] {
  return [];
}
