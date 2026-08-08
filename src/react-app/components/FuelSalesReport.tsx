import { useState, useEffect } from "react";
import { FileText, Printer, TrendingUp, Download, Loader2 } from "lucide-react";
import { useFuel } from "@/react-app/context/FuelContext";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { silentPrintService } from "@/react-app/lib/silent-print-service";

interface SalesEntry {
  date: string;
  shift: "DAY" | "NIGHT";
  petrolSales: number;
  dieselSales: number;
  totalSales: number;
}

export default function FuelSalesReport() {
  const { state } = useFuel();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState<SalesEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [totals, setTotals] = useState({
    petrol: 0,
    diesel: 0,
    total: 0,
  });

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Generate year options for unlimited range (100+ years in each direction)
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 100;
    const endYear = currentYear + 100;
    const years = [];

    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }

    return years;
  };

  const yearOptions = generateYearOptions();

  useEffect(() => {
    generateReport();
  }, [selectedMonth, selectedYear, state.salesHistory]);

  const generateReport = () => {
    // Get real sales data EXCLUSIVELY from saved Sales Tracking records
    const entries: SalesEntry[] = [];

    if (state.salesHistory && typeof state.salesHistory === "object") {
      Object.entries(state.salesHistory).forEach(
        ([dateKey, salesData]: [string, any]) => {
          // Parse the dateKey which is in format YYYY-MM-DD_Shift or similar
          const [datePart] = dateKey.split("_");
          const salesDate = new Date(datePart);

          // Ensure valid date and check if it matches selected month/year
          if (
            !isNaN(salesDate.getTime()) &&
            salesDate.getMonth() + 1 === selectedMonth &&
            salesDate.getFullYear() === selectedYear
          ) {
            // Only process if we have actual sales data
            if (salesData && (salesData.pmsPumps || salesData.agoPumps)) {
              // Calculate petrol sales from all PMS pumps (with rounding for safety)
              const petrolSales = Math.round(
                (salesData.pmsPumps || []).reduce(
                  (sum: number, pump: any) => sum + (pump.salesKsh || 0),
                  0
                ) * 100
              ) / 100;

              // Calculate diesel sales from all AGO pumps (with rounding for safety)
              const dieselSales = Math.round(
                (salesData.agoPumps || []).reduce(
                  (sum: number, pump: any) => sum + (pump.salesKsh || 0),
                  0
                ) * 100
              ) / 100;

              // Format date as DD/MM/YYYY(SHIFT)
              const day = salesDate.getDate().toString().padStart(2, "0");
              const month = selectedMonth.toString().padStart(2, "0");
              const year = selectedYear.toString();
              const shift =
                salesData.shift === "Night" || salesData.shift === "NIGHT"
                  ? "NIGHT"
                  : "DAY";
              const formattedDate = `${day}/${month}/${year}(${shift})`;

              // Only add entry if there are actual sales (petrol or diesel)
              if (petrolSales > 0 || dieselSales > 0) {
                entries.push({
                  date: formattedDate,
                  shift: shift as "DAY" | "NIGHT",
                  petrolSales,
                  dieselSales,
                  totalSales: Math.round((petrolSales + dieselSales) * 100) / 100,
                });
              }
            }
          }
        }
      );
    }

    // Sort entries by date for better presentation
    entries.sort((a, b) => {
      const dateA = new Date(
        a.date.split("(")[0].split("/").reverse().join("-")
      );
      const dateB = new Date(
        b.date.split("(")[0].split("/").reverse().join("-")
      );
      return dateA.getTime() - dateB.getTime();
    });

    setReportData(entries);

    // Calculate totals from real data only
    const petrolTotal = entries.reduce(
      (sum, entry) => sum + entry.petrolSales,
      0
    );
    const dieselTotal = entries.reduce(
      (sum, entry) => sum + entry.dieselSales,
      0
    );

    setTotals({
      petrol: petrolTotal,
      diesel: dieselTotal,
      total: petrolTotal + dieselTotal,
    });
  };

  const handlePrint = () => {
    const printContent = document.getElementById("report-content");
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Fuel Sales Report - ${months[selectedMonth - 1]} ${selectedYear}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              background: white; 
              color: black;
            }
            .logo { 
              text-align: center; 
              margin-bottom: 20px; 
            }
            .report-logo {
              max-width: 150px;
              max-height: 60px;
              margin: 0 auto 16px auto;
              display: block;
              object-fit: contain;
            }
            .company-name { 
              font-size: 18px; 
              font-weight: bold; 
              text-align: center; 
              margin: 10px 0; 
            }
            .report-title { 
              font-size: 16px; 
              font-weight: bold; 
              text-align: center; 
              margin: 10px 0; 
            }
            .month-year { 
              text-align: center; 
              margin: 15px 0; 
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 20px 0; 
            }
            th, td { 
              border: 1px solid #333; 
              padding: 8px; 
              text-align: center; 
            }
            th { 
              background-color: #f0f0f0; 
              font-weight: bold; 
            }
            .totals { 
              margin: 20px 0; 
              font-weight: bold; 
            }
            .contact-info { 
              margin-top: 30px; 
            }
            @media print {
              body { margin: 0; }
              .report-logo {
                max-width: 120px;
                max-height: 50px;
              }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // Silent print using print service
  const handleSilentPrint = async () => {
    if (reportData.length === 0) return;

    setIsPrinting(true);
    try {
      const reportHTML = document.getElementById("report-content");
      const reportDataForPrint = {
        stationName: state.companyData.name || 'FuelPro Station',
        monthYear: `${months[selectedMonth - 1]} ${selectedYear}`,
        period: `${months[selectedMonth - 1]} ${selectedYear}`,
        currency: state.companyData.currency || 'KSh',
        entries: reportData.map(entry => ({
          date: entry.date,
          petrolSales: entry.petrolSales,
          dieselSales: entry.dieselSales,
          totalSales: entry.totalSales,
        })),
        totals: {
          petrol: totals.petrol,
          diesel: totals.diesel,
          total: totals.total,
        },
      };

      await silentPrintService.queueSalesReport(reportDataForPrint);
      
      setTimeout(() => setIsPrinting(false), 1500);
    } catch (error) {
      console.error("Silent print error:", error);
      setIsPrinting(false);
    }
  };

  const handleSaveReport = async () => {
    try {
      setIsSaving(true);

      const reportContent = document.getElementById("report-content");
      if (!reportContent) return;

      // Create a clean version for PDF generation
      const clonedContent = reportContent.cloneNode(true) as HTMLElement;

      // Apply PDF-specific styles to the cloned content
      const style = document.createElement("style");
      style.textContent = `
        .report-logo {
          max-width: 150px !important;
          max-height: 60px !important;
          margin: 0 auto 16px auto !important;
          display: block !important;
          object-fit: contain !important;
        }
        .logo {
          text-align: center !important;
          margin-bottom: 20px !important;
        }
        .company-name {
          font-size: 18px !important;
          font-weight: bold !important;
          text-align: center !important;
          margin: 10px 0 !important;
          color: #000 !important;
        }
        .report-title {
          font-size: 16px !important;
          font-weight: bold !important;
          text-align: center !important;
          margin: 10px 0 !important;
          color: #000 !important;
        }
        .month-year {
          text-align: center !important;
          margin: 15px 0 !important;
          color: #000 !important;
        }
        .totals {
          color: #000 !important;
        }
        .contact-info {
          color: #000 !important;
        }
      `;

      document.head.appendChild(style);

      // Temporarily add the cloned content to the body for rendering
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.top = "0";
      tempContainer.style.background = "white";
      tempContainer.style.color = "black";
      tempContainer.style.width = "210mm"; // A4 width
      tempContainer.style.padding = "20px";
      tempContainer.appendChild(clonedContent);
      document.body.appendChild(tempContainer);

      // Generate canvas from the content
      const canvas = await html2canvas(tempContainer, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        width: 794, // A4 width in pixels at 96 DPI
        height: 1123, // A4 height in pixels at 96 DPI
      });

      // Create PDF
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      // Add image to PDF
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add new pages if content is longer than one page
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Generate filename
      const filename = `Fuel_Sales_Report_${months[selectedMonth - 1]}_${selectedYear}.pdf`;

      // Save the PDF
      pdf.save(filename);

      // Cleanup
      document.body.removeChild(tempContainer);
      document.head.removeChild(style);
    } catch (error) {
      console.error("Error generating PDF:", error);
      import("@/react-app/lib/toast").then(({ toastError }) =>
        toastError("Error generating PDF. Please try again.")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const currency = state.companyData.currency || "KSh";

  return (
    <div className="p-4 md:p-6 space-y-6 text-white min-h-screen">
      {/* Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="text-blue-400" />
          Fuel Sales Report
        </h2>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          <div className="flex gap-2">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(parseInt(e.target.value))}
              className="bg-gray-700 border border-gray-600 rounded p-2 text-white text-sm"
            >
              {months.map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(parseInt(e.target.value))}
              className="bg-gray-700 border border-gray-600 rounded p-2 text-white text-sm"
            >
              {yearOptions.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSaveReport}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-4 py-2 rounded flex items-center gap-2 text-sm"
            >
              <Download size={16} />
              {isSaving ? "Saving..." : "Save Report"}
            </button>

            <button
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2 text-sm"
            >
              <Printer size={16} />
              Print Report
            </button>

            <button
              onClick={handleSilentPrint}
              disabled={isPrinting || reportData.length === 0}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-4 py-2 rounded flex items-center gap-2 text-sm"
            >
              {isPrinting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Printing...
                </>
              ) : (
                <>
                  <Printer size={16} />
                  Silent Print
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-900/30 border border-green-600 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-green-400" size={20} />
            <span className="text-sm text-green-300">Petrol Sales</span>
          </div>
          <div className="text-xl font-bold text-white">
            {currency} {totals.petrol.toFixed(2)}
          </div>
        </div>
        <div className="bg-blue-900/30 border border-blue-600 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-blue-400" size={20} />
            <span className="text-sm text-blue-300">Diesel Sales</span>
          </div>
          <div className="text-xl font-bold text-white">
            {currency} {totals.diesel.toFixed(2)}
          </div>
        </div>
        <div className="bg-purple-900/30 border border-purple-600 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-purple-400" size={20} />
            <span className="text-sm text-purple-300">Total Revenue</span>
          </div>
          <div className="text-xl font-bold text-white">
            {currency} {totals.total.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div id="report-content" className="p-6">
          {/* Header - Only show if company data exists */}
          <div className="text-center mb-6">
            {state.companyData.logo && (
              <div className="logo mb-4">
                <img
                  src={state.companyData.logo}
                  alt="Company Logo"
                  className="report-logo h-16 mx-auto max-w-[150px] max-h-[60px] object-contain"
                />
              </div>
            )}
            {state.companyData.name && state.companyData.name.trim() !== "" ? (
              <div className="company-name text-lg font-bold text-white mb-2">
                {state.companyData.name}
              </div>
            ) : (
              <div className="company-name text-lg font-bold text-white mb-2">
                Company Name
              </div>
            )}
            <div className="report-title text-md font-semibold text-gray-200 mb-2">
              Fuel Sales Report
            </div>
            <div className="month-year text-gray-300">
              <div>Month: {months[selectedMonth - 1]}</div>
              <div>Year: {selectedYear}</div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {reportData.length === 0 ? (
              <div className="text-center py-8">
                <FileText size={48} className="mx-auto text-gray-500 mb-4" />
                <div className="text-lg font-semibold text-gray-300 mb-2">
                  No sales recorded for this period
                </div>
                <div className="text-gray-400">
                  Sales data for {months[selectedMonth - 1]} {selectedYear} will
                  appear here once you save sales tracking records.
                </div>
              </div>
            ) : (
              <table className="w-full border-collapse bg-white text-black">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-400 p-3 text-left">
                      DD/MM/YYYY(SHIFT)
                    </th>
                    <th className="border border-gray-400 p-3 text-right">
                      Total Petrol Sales ({currency})
                    </th>
                    <th className="border border-gray-400 p-3 text-right">
                      Total Diesel Sales ({currency})
                    </th>
                    <th className="border border-gray-400 p-3 text-right">
                      Total Sales/Revenue ({currency})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((entry, index) => (
                    <tr
                      key={index}
                      className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="border border-gray-400 p-3">
                        {entry.date}
                      </td>
                      <td className="border border-gray-400 p-3 text-right">
                        {entry.petrolSales.toFixed(2)}
                      </td>
                      <td className="border border-gray-400 p-3 text-right">
                        {entry.dieselSales.toFixed(2)}
                      </td>
                      <td className="border border-gray-400 p-3 text-right">
                        {entry.totalSales.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Totals - Only show if there's data */}
          {reportData.length > 0 && (
            <div className="totals mt-6 space-y-2">
              <div className="text-white">
                <span className="font-semibold">
                  Monthly Total Petrol Sales:
                </span>{" "}
                {currency} {totals.petrol.toFixed(2)}
              </div>
              <div className="text-white">
                <span className="font-semibold">
                  Monthly Total Diesel Sales:
                </span>{" "}
                {currency} {totals.diesel.toFixed(2)}
              </div>
              <div className="text-white text-lg">
                <span className="font-bold">Total Monthly Sales/Revenue:</span>{" "}
                {currency} {totals.total.toFixed(2)}
              </div>
            </div>
          )}

          {/* Contact Info - Only show if actual data exists */}
          {((state.companyData.poBox &&
            state.companyData.poBox.trim() !== "") ||
            (state.companyData.contacts &&
              state.companyData.contacts.trim() !== "") ||
            (state.companyData.email &&
              state.companyData.email.trim() !== "")) && (
            <div className="contact-info mt-8 text-gray-300 space-y-1">
              {state.companyData.poBox &&
                state.companyData.poBox.trim() !== "" && (
                  <div>P.O. Box: {state.companyData.poBox}</div>
                )}
              {state.companyData.contacts &&
                state.companyData.contacts.trim() !== "" && (
                  <div>Contacts: {state.companyData.contacts}</div>
                )}
              {state.companyData.email &&
                state.companyData.email.trim() !== "" && (
                  <div>Email: {state.companyData.email}</div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
