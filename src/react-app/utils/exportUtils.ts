import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { formatNumber } from "./formatUtils";

export function exportDeliveryPDF(state: any) {
  const doc = new jsPDF();

  let y = 20;
  if (state.companyData.logo) {
    const img = new Image();
    img.src = state.companyData.logo;
    doc.addImage(img, "PNG", 80, 10, 50, 20);
    y = 40;
  }

  // Company name in gold with bold styling
  doc.setFontSize(16);
  doc.setTextColor("#d4af37");
  doc.setFont("helvetica", "bold");
  doc.text(state.companyData.name || "Company Name", 105, y, {
    align: "center",
  });

  // Reset to normal text color and size
  doc.setTextColor("#1a3a5f");
  y += 10;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Fuel Delivery Report", 105, y, { align: "center" });
  y += 20;

  // Add business info
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`FUEL DELIVERED TO: ${state.deliveredTo || "Client"}`, 14, y);
  y += 8;
  doc.text(`TOTAL ORDER: ${state.totalOrder || "N/A"} Litres`, 14, y);
  y += 8;
  doc.text(`YEAR: ${state.deliveryYear || "2025"}`, 14, y);
  y += 8;
  doc.text(`Petrol Price: Ksh ${state.petrolPrice || "180"} /L`, 14, y);
  y += 8;
  doc.text(`Diesel Price: Ksh ${state.dieselPrice || "170"} /L`, 14, y);
  y += 8;

  // Create table data
  const headers = state.deliveryData.columns.map((col: any) => col.label);
  const data = state.deliveryData.rows.map((r: any) =>
    state.deliveryData.columns.map((col: any) => {
      if (col.key === "amount") return "Ksh " + formatNumber(r.amount);
      if (col.key === "debt") return "Ksh " + formatNumber(r.debt);
      return r[col.key] || "";
    })
  );

  autoTable(doc, {
    startY: y,
    head: [headers],
    body: data,
    theme: "striped",
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Totals below the table
  doc.setFont("helvetica", "bold");
  doc.text(
    `Total Supplied: ${formatNumber(state.deliveryData.totals.totalSupplied)} L`,
    14,
    finalY
  );
  doc.text(
    `Total Payments: ${state.companyData.currency} ${formatNumber(state.deliveryData.totals.totalPayments)}`,
    70,
    finalY
  );
  doc.text(
    `Balance Due: ${state.companyData.currency} ${formatNumber(state.deliveryData.totals.balanceDue, 2)}`,
    130,
    finalY
  );
  y = finalY + 10;

  // Contact info
  doc.setFont("helvetica", "normal");
  doc.text(`P.O. Box: ${state.companyData.poBox || "N/A"}`, 14, y);
  y += 8;
  doc.text(`CONTACTS: ${state.companyData.contacts || "N/A"}`, 14, y);
  y += 8;
  doc.text(`EMAIL: ${state.companyData.email || "N/A"}`, 14, y);
  y += 10;

  doc.save(`Delivery_Report_${state.deliveredTo || "Client"}.pdf`);
}

export function exportDeliveryExcel(state: any) {
  const wb = XLSX.utils.book_new();

  const ws_data = [
    [state.companyData.name || "Company Name"],
    ["Fuel Delivery Report"],
    [],
    [`FUEL DELIVERED TO: ${state.deliveredTo || "Client"}`],
    [`TOTAL ORDER: ${state.totalOrder || "N/A"} Litres`],
    [`YEAR: ${state.deliveryYear || "2025"}`],
    [`Petrol Price: Ksh ${state.petrolPrice || "180"} /L`],
    [`Diesel Price: Ksh ${state.dieselPrice || "170"} /L`],
    [],
    state.deliveryData.columns.map((col: any) => col.label),
    ...state.deliveryData.rows.map((r: any) =>
      state.deliveryData.columns.map((col: any) => {
        if (col.key === "amount")
          return state.companyData.currency + " " + formatNumber(r.amount);
        if (col.key === "debt")
          return state.companyData.currency + " " + formatNumber(r.debt);
        return r[col.key] || "";
      })
    ),
    [],
    [
      `Total Supplied: ${formatNumber(state.deliveryData.totals.totalSupplied)} L`,
    ],
    [
      `Total Payments: Ksh ${formatNumber(state.deliveryData.totals.totalPayments)}`,
    ],
    [
      `Balance Due: Ksh ${formatNumber(state.deliveryData.totals.balanceDue, 2)}`,
    ],
    [],
    [`P.O. Box: ${state.companyData.poBox || "N/A"}`],
    [`CONTACTS: ${state.companyData.contacts || "N/A"}`],
    [`EMAIL: ${state.companyData.email || "N/A"}`],
  ];

  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, "Delivery Report");
  XLSX.writeFile(wb, `Delivery_Report_${state.deliveredTo || "Client"}.xlsx`);
}

export function exportDeliveryTXT(state: any) {
  let txt = `=== ${state.companyData.name || "Company Name"} ===\nFuel Delivery Report\n\n`;
  txt += `FUEL DELIVERED TO: ${state.deliveredTo || "Client"}\n`;
  txt += `TOTAL ORDER: ${state.totalOrder || "N/A"} Litres\n`;
  txt += `YEAR: ${state.deliveryYear || "2025"}\n`;
  txt += `Petrol Price: ${state.companyData.currency} ${state.petrolPrice || "180"} /L\n`;
  txt += `Diesel Price: ${state.companyData.currency} ${state.dieselPrice || "170"} /L\n\n`;

  txt += state.deliveryData.rows
    .map((r: any) =>
      state.deliveryData.columns
        .map((col: any) => {
          if (col.key === "amount")
            return `${col.label}: ${state.companyData.currency}${formatNumber(r.amount)}`;
          if (col.key === "debt")
            return `${col.label}: ${state.companyData.currency}${formatNumber(r.debt)}`;
          return `${col.label}: ${r[col.key] || ""}`;
        })
        .join(" | ")
    )
    .join("\n");

  txt += `\n\n`;
  txt += `Total Supplied: ${formatNumber(state.deliveryData.totals.totalSupplied)} L\n`;
  txt += `Total Payments: ${state.companyData.currency} ${formatNumber(state.deliveryData.totals.totalPayments)}\n`;
  txt += `Balance Due: ${state.companyData.currency} ${formatNumber(state.deliveryData.totals.balanceDue, 2)}\n\n`;
  txt += `P.O. Box: ${state.companyData.poBox || "N/A"}\n`;
  txt += `CONTACTS: ${state.companyData.contacts || "N/A"}\n`;
  txt += `EMAIL: ${state.companyData.email || "N/A"}`;

  const blob = new Blob([txt], { type: "text/plain" });
  saveAs(blob, `Delivery_Report_${state.deliveredTo || "Client"}.txt`);
}

export function exportDebtPDF(state: any) {
  const data = state.debtData;
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
  doc.text(state.companyData.name || "Company Name", 105, y, {
    align: "center",
  });
  doc.setTextColor("#1a3a5f");

  y += 10;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Fuel Debt Payment Reminder", 105, y, { align: "center" });
  y += 15;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  const lines = [
    `Dear ${data.name},`,
    ``,
    `This is a gentle reminder that KES ${data.amount} for fuel supplied remains unpaid.`,
    ``,
    `Kindly settle the amount via Till:`,
    `Buy Goods: ${data.till}`,
    ``,
    `For bank transfer:`,
    `Bank: ${data.bank}`,
    `A/C Name: ${data.acName}`,
    `A/C No.: ${data.acNo}`,
    ``,
    `After payment, share the confirmation with us via ${data.method}: ${data.contact}`,
    ``,
    `Thank you.`,
    ``,
    `Best regards,`,
    `${data.manager}`,
    `Manager`,
    `${state.companyData.name || "Company Name"}`,
    ``,
    `P.O. Box: ${state.companyData.poBox || "N/A"}`,
    `CONTACTS: ${state.companyData.contacts || "N/A"}`,
    `EMAIL: ${state.companyData.email || "N/A"}`,
  ];
  doc.text(lines, 15, y, { maxWidth: 180 });

  doc.save(`Debt_Reminder_${data.name}.pdf`);
}

export function exportDebtExcel(state: any) {
  const data = state.debtData;
  const wb = XLSX.utils.book_new();
  const ws_data = [
    ["Fuel Debt Payment Reminder"],
    [],
    [`Dear ${data.name},`],
    [],
    [
      `This is a gentle reminder that KES ${data.amount} for fuel supplied remains unpaid.`,
    ],
    [],
    ["Kindly settle the amount via Till:"],
    [`Buy Goods: ${data.till}`],
    [],
    ["For bank transfer:"],
    [`Bank: ${data.bank}`],
    [`A/C Name: ${data.acName}`],
    [`A/C No.: ${data.acNo}`],
    [],
    [
      `After payment, share the confirmation with us via ${data.method}: ${data.contact}`,
    ],
    [],
    ["Thank you."],
    [],
    ["Best regards,"],
    [`${data.manager}`],
    ["Manager"],
    [`${state.companyData.name || "Company Name"}`],
    [],
    [`P.O. Box: ${state.companyData.poBox || "N/A"}`],
    [`CONTACTS: ${state.companyData.contacts || "N/A"}`],
    [`EMAIL: ${state.companyData.email || "N/A"}`],
  ];
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, "Debt Reminder");
  XLSX.writeFile(wb, `Debt_Reminder_${data.name}.xlsx`);
}

export function exportDebtTXT(state: any) {
  const data = state.debtData;
  const companyName = state.companyData.name || "Company Name";
  const txt = `=== ${companyName} ===\nFuel Debt Payment Reminder\n\nDear ${data.name},\n\nThis is a gentle reminder that KES ${data.amount} for fuel supplied remains unpaid.\n\nKindly settle the amount via Till:\nBuy Goods: ${data.till}\n\nFor bank transfer:\nBank: ${data.bank}\nA/C Name: ${data.acName}\nA/C No.: ${data.acNo}\n\nAfter payment, share the confirmation with us via ${data.method}: ${data.contact}\n\nThank you.\n\nBest regards,\n${data.manager}\nManager\n${companyName}\n\nP.O. Box: ${state.companyData.poBox || "N/A"}\nCONTACTS: ${state.companyData.contacts || "N/A"}\nEMAIL: ${state.companyData.email || "N/A"}`;
  const blob = new Blob([txt], { type: "text/plain" });
  saveAs(blob, `Fuel_Debt_Reminder_${data.name}.txt`);
}

export function exportSalesPDF(state: any) {
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
  doc.text(state.companyData.name || "Company Name", 105, y, {
    align: "center",
  });
  doc.setTextColor("#1a3a5f");

  y += 10;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Fuel Sales Report", 105, y, { align: "center" });
  y += 20;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${state.salesDate}`, 15, y);
  doc.text(`Shift: ${state.shift}`, 100, y);
  y += 15;

  // Create PMS pumps table
  if (state.pmsPumps && state.pmsPumps.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Petrol (PMS) Pumps:", 15, y);
    y += 10;

    const pmsHeaders = [
      "Pump ID",
      "Opening (Ksh)",
      "Closing (Ksh)",
      "Opening (L)",
      "Closing (L)",
      "Sales (L)",
      "Sales (Ksh)",
    ];
    const pmsData = state.pmsPumps.map((p: any) => [
      p.id,
      formatNumber(p.openingKsh),
      formatNumber(p.closingKsh),
      formatNumber(p.openingL),
      formatNumber(p.closingL),
      formatNumber(p.salesL),
      formatNumber(p.salesKsh),
    ]);

    autoTable(doc, {
      startY: y,
      head: [pmsHeaders],
      body: pmsData,
      theme: "striped",
      headStyles: { fillColor: [26, 58, 95] },
    });

    y = (doc as any).lastAutoTable.finalY + 15;
  }

  // Create AGO pumps table
  if (state.agoPumps && state.agoPumps.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Diesel (AGO) Pumps:", 15, y);
    y += 10;

    const agoHeaders = [
      "Pump ID",
      "Opening (Ksh)",
      "Closing (Ksh)",
      "Opening (L)",
      "Closing (L)",
      "Sales (L)",
      "Sales (Ksh)",
    ];
    const agoData = state.agoPumps.map((p: any) => [
      p.id,
      formatNumber(p.openingKsh),
      formatNumber(p.closingKsh),
      formatNumber(p.openingL),
      formatNumber(p.closingL),
      formatNumber(p.salesL),
      formatNumber(p.salesKsh),
    ]);

    autoTable(doc, {
      startY: y,
      head: [agoHeaders],
      body: agoData,
      theme: "striped",
      headStyles: { fillColor: [26, 58, 95] },
    });

    y = (doc as any).lastAutoTable.finalY + 15;
  }

  // Add summary
  if (state.summary) {
    doc.setFont("helvetica", "bold");
    doc.text("Daily Summary:", 15, y);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.text(
      `Total Petrol Sales: Ksh ${formatNumber(state.summary.totalPmsSalesKsh, 2)}`,
      15,
      y
    );
    y += 8;
    doc.text(
      `Total Diesel Sales: Ksh ${formatNumber(state.summary.totalAgoSalesKsh, 2)}`,
      15,
      y
    );
    y += 8;
    doc.text(
      `Total Revenue: Ksh ${formatNumber(state.summary.totalRevenue, 2)}`,
      15,
      y
    );
    y += 8;
    doc.text(
      `Cash In Hand: Ksh ${formatNumber(state.summary.cashInHand, 2)}`,
      15,
      y
    );
    y += 8;
    doc.text(
      `Net Income: Ksh ${formatNumber(state.summary.netIncome, 2)}`,
      15,
      y
    );
  }

  doc.save("Fuel_Sales_Report.pdf");
}

export function exportSalesExcel(state: any) {
  const wb = XLSX.utils.book_new();

  // PMS Pumps sheet
  if (state.pmsPumps && state.pmsPumps.length > 0) {
    const pmsData = [
      [
        "Pump ID",
        "Opening (Ksh)",
        "Closing (Ksh)",
        "Opening (L)",
        "Closing (L)",
        "Sales (L)",
        "Sales (Ksh)",
      ],
      ...state.pmsPumps.map((p: any) => [
        p.id,
        p.openingKsh,
        p.closingKsh,
        p.openingL,
        p.closingL,
        p.salesL,
        p.salesKsh,
      ]),
    ];
    const pmsWS = XLSX.utils.aoa_to_sheet(pmsData);
    XLSX.utils.book_append_sheet(wb, pmsWS, "Petrol Pumps");
  }

  // AGO Pumps sheet
  if (state.agoPumps && state.agoPumps.length > 0) {
    const agoData = [
      [
        "Pump ID",
        "Opening (Ksh)",
        "Closing (Ksh)",
        "Opening (L)",
        "Closing (L)",
        "Sales (L)",
        "Sales (Ksh)",
      ],
      ...state.agoPumps.map((p: any) => [
        p.id,
        p.openingKsh,
        p.closingKsh,
        p.openingL,
        p.closingL,
        p.salesL,
        p.salesKsh,
      ]),
    ];
    const agoWS = XLSX.utils.aoa_to_sheet(agoData);
    XLSX.utils.book_append_sheet(wb, agoWS, "Diesel Pumps");
  }

  // Add footer info sheet
  const footerData = [
    ["Report Information"],
    [],
    [`Company: ${state.companyData.name || "Company Name"}`],
    [`Generated: ${new Date().toLocaleDateString()}`],
  ];
  const footerWS = XLSX.utils.aoa_to_sheet(footerData);
  XLSX.utils.book_append_sheet(wb, footerWS, "Report Info");

  XLSX.writeFile(wb, "Fuel_Sales_Report.xlsx");
}

export function exportSalesTXT(state: any) {
  let txt = `=== ${state.companyData.name || "Company Name"} ===\nFuel Sales Report\n\n`;
  txt += `Date: ${state.salesDate}\nShift: ${state.shift}\n\n`;

  // Add tank inventory
  txt += `Fuel Tank Inventory:\n`;
  txt += `Petrol (PMS) Tank: Opening: ${formatNumber(state.pmsTankOpening)} L, Closing: ${formatNumber(state.pmsTankClosing)} L\n`;
  txt += `Diesel (AGO) Tank: Opening: ${formatNumber(state.agoTankOpening)} L, Closing: ${formatNumber(state.agoTankClosing)} L\n\n`;

  txt += `Fuel Pricing:\n`;
  txt += `Petrol (PMS): Ksh ${state.pmsPrice}/L\n`;
  txt += `Diesel (AGO): Ksh ${state.agoPrice}/L\n\n`;

  if (state.pmsPumps && state.pmsPumps.length > 0) {
    txt += `Petrol (PMS) Pumps:\n`;
    txt += state.pmsPumps
      .map(
        (p: any) =>
          `${p.id}: Sales: ${formatNumber(p.salesL)} L, ${formatNumber(p.salesKsh)} Ksh`
      )
      .join("\n");
    txt += "\n\n";
  }

  if (state.agoPumps && state.agoPumps.length > 0) {
    txt += `Diesel (AGO) Pumps:\n`;
    txt += state.agoPumps
      .map(
        (p: any) =>
          `${p.id}: Sales: ${formatNumber(p.salesL)} L, ${formatNumber(p.salesKsh)} Ksh`
      )
      .join("\n");
    txt += "\n\n";
  }

  if (state.expenses && state.expenses.length > 0) {
    txt += `Daily Expenses:\n`;
    txt += state.expenses
      .map((e: any) => `${e.desc}: ${formatNumber(e.amount)} Ksh`)
      .join("\n");
    txt += "\n\n";
  }

  txt += `Till/Mobile Payment: ${formatNumber(state.tillPayment)} Ksh\n\n`;

  if (state.summary) {
    txt += `Daily Summary:\n`;
    txt += `Total Petrol Sales: Ksh ${formatNumber(state.summary.totalPmsSalesKsh, 2)}\n`;
    txt += `Total Diesel Sales: Ksh ${formatNumber(state.summary.totalAgoSalesKsh, 2)}\n`;
    txt += `Total Revenue: Ksh ${formatNumber(state.summary.totalRevenue, 2)}\n`;
    txt += `Till/Mobile Payment: Ksh ${formatNumber(state.tillPayment, 2)}\n`;
    txt += `Cash In Hand: Ksh ${formatNumber(state.summary.cashInHand, 2)}\n`;
    txt += `Total Expenses: Ksh ${formatNumber(state.summary.totalExpenses, 2)}\n`;
    txt += `Net Income: Ksh ${formatNumber(state.summary.netIncome, 2)}`;
  }

  const blob = new Blob([txt], { type: "text/plain" });
  saveAs(blob, "Fuel_Sales_Report.txt");
}

// Enhanced Invoice Export Functions - Matching CAR HIRE INVOICE Format Exactly
export function exportInvoicePDF(invoiceData: any) {
  const doc = new jsPDF();

  let y = 20;

  // Company logo at the very top (max 150px wide) - Enhanced loading
  if (invoiceData.companyData?.logo) {
    try {
      // Create a new image and wait for it to load before adding to PDF
      const img = new Image();
      img.crossOrigin = "anonymous";

      // Convert logo to base64 if it's a URL, or use directly if already base64
      let logoSrc = invoiceData.companyData.logo;

      // Add image synchronously if it's already a data URL
      if (logoSrc.startsWith("data:")) {
        doc.addImage(logoSrc, "PNG", 15, 10, 50, 30);
        y = 50;
      } else {
        // For external URLs, we'll skip for now to avoid CORS issues
        console.warn(
          "External logo URLs not supported in PDF export. Please upload logo as file."
        );
      }
    } catch (error) {
      console.warn("Could not load company logo for PDF:", error);
    }
  }

  // INVOICE title (after logo, before company info)
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor("#000000");
  doc.text("INVOICE", 15, y);
  y += 15;

  // Company name (only if provided by user - NO DEFAULTS)
  if (invoiceData.companyData?.name) {
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(invoiceData.companyData.name, 15, y);
    y += 10;
  }

  // P.O. Box and Contacts on the same line (only if provided)
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  let contactLine = "";
  if (invoiceData.companyData?.poBox) {
    contactLine += `P.O. Box: ${invoiceData.companyData.poBox}`;
  }
  if (invoiceData.companyData?.contacts) {
    if (contactLine) contactLine += " ";
    contactLine += invoiceData.companyData.contacts;
  }
  if (contactLine) {
    doc.text(contactLine, 15, y);
    y += 8;
  }

  // Email (only if provided)
  if (invoiceData.companyData?.email) {
    doc.text(invoiceData.companyData.email, 15, y);
    y += 8;
  }

  y += 10;

  // Bill To section
  doc.setFont("helvetica", "bold");
  doc.text("Bill To:", 15, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  if (invoiceData.customerName) {
    doc.text(invoiceData.customerName, 15, y);
    y += 6;
  }

  // Invoice details on the right
  const rightX = 120;
  let rightY = y - 20;
  doc.setFont("helvetica", "bold");
  doc.text("Invoice #:", rightX, rightY);
  doc.setFont("helvetica", "normal");
  doc.text(invoiceData.invoiceNumber || "", rightX + 25, rightY);
  rightY += 8;

  doc.setFont("helvetica", "bold");
  doc.text("Date:", rightX, rightY);
  doc.setFont("helvetica", "normal");
  doc.text(invoiceData.invoiceDate || "", rightX + 15, rightY);

  y += 15;

  // Items table with customizable quantity header
  if (invoiceData.invoiceItems && invoiceData.invoiceItems.length > 0) {
    const quantityHeader = invoiceData.quantityLabel || "Qty (DAYS)";
    const headers = ["Description", quantityHeader, "Unit Price", "Total"];
    const data = invoiceData.invoiceItems.map((item: any) => [
      item.desc || "",
      item.qty || 0,
      `Ksh${formatNumber(item.price, 0)}`,
      `Ksh${formatNumber(item.total, 0)}`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [headers],
      body: data,
      theme: "plain",
      headStyles: {
        fillColor: false,
        textColor: [0, 0, 0],
        fontSize: 11,
        fontStyle: "bold",
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
      },
      bodyStyles: {
        fontSize: 10,
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 30, halign: "center" },
        2: { cellWidth: 40, halign: "right" },
        3: { cellWidth: 40, halign: "right" },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 15;
  }

  // Total Due with leading space (as in sample)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(
    ` Total Due: Ksh${formatNumber(invoiceData.totalDue || 0, 0)}`,
    120,
    y
  );
  y += 20;

  // Payment information section
  doc.setFont("helvetica", "bold");
  doc.text("Payment Should Be Made Through", 15, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  // Bank details each on a new line (only if provided)
  if (invoiceData.companyData?.bankName) {
    doc.text(`BANK: ${invoiceData.companyData.bankName}`, 15, y);
    y += 8;
  }
  if (invoiceData.companyData?.branchName) {
    doc.text(`BRANCH: ${invoiceData.companyData.branchName}`, 15, y);
    y += 8;
  }
  if (invoiceData.companyData?.accountHolder) {
    doc.text(invoiceData.companyData.accountHolder, 15, y);
    y += 8;
  }
  if (invoiceData.companyData?.accountNumber) {
    doc.text(`ACCOUNT NO: ${invoiceData.companyData.accountNumber}`, 15, y);
    y += 8;
  }

  y += 15;

  // Signature line
  doc.text("Signature:………………………….", 15, y);

  // Save with descriptive filename
  const filename = `Invoice_${invoiceData.invoiceNumber}_${invoiceData.customerName?.replace(/\s+/g, "_") || "Customer"}.pdf`;
  doc.save(filename);
}

export function exportInvoiceExcel(invoiceData: any) {
  const wb = XLSX.utils.book_new();

  // Invoice header data matching exact format
  const headerData = [["INVOICE"], []];

  // Company info (only if provided)
  if (invoiceData.companyData?.name) {
    headerData.push([invoiceData.companyData.name]);
  }

  // P.O. Box and contacts on same line
  let contactLine = "";
  if (invoiceData.companyData?.poBox) {
    contactLine += `P.O. Box: ${invoiceData.companyData.poBox}`;
  }
  if (invoiceData.companyData?.contacts) {
    if (contactLine) contactLine += " ";
    contactLine += invoiceData.companyData.contacts;
  }
  if (contactLine) {
    headerData.push([contactLine]);
  }

  if (invoiceData.companyData?.email) {
    headerData.push([invoiceData.companyData.email]);
  }

  headerData.push([]);
  headerData.push(["Bill To:", invoiceData.customerName || ""]);
  headerData.push([`Invoice #: ${invoiceData.invoiceNumber}`]);
  headerData.push([`Date: ${invoiceData.invoiceDate}`]);
  headerData.push([]);

  // Invoice items data
  const quantityHeader = invoiceData.quantityLabel || "Qty (DAYS)";
  const itemsData =
    invoiceData.invoiceItems?.length > 0
      ? [
          ["Description", quantityHeader, "Unit Price", "Total"],
          ...invoiceData.invoiceItems.map((item: any) => [
            item.desc || "",
            item.qty || 0,
            `Ksh${formatNumber(item.price, 0)}`,
            `Ksh${formatNumber(item.total, 0)}`,
          ]),
        ]
      : [["No items added"]];

  // Totals data
  const totalsData = [
    [],
    [` Total Due: Ksh${formatNumber(invoiceData.totalDue || 0, 0)}`],
    [],
    ["Payment Should Be Made Through"],
  ];

  // Bank details (only if provided)
  if (invoiceData.companyData?.bankName) {
    totalsData.push([`BANK: ${invoiceData.companyData.bankName}`]);
  }
  if (invoiceData.companyData?.branchName) {
    totalsData.push([`BRANCH: ${invoiceData.companyData.branchName}`]);
  }
  if (invoiceData.companyData?.accountHolder) {
    totalsData.push([invoiceData.companyData.accountHolder]);
  }
  if (invoiceData.companyData?.accountNumber) {
    totalsData.push([`ACCOUNT NO: ${invoiceData.companyData.accountNumber}`]);
  }

  totalsData.push([]);
  totalsData.push(["Signature:…………………………."]);

  // Combine all data
  const allData = [...headerData, ...itemsData, ...totalsData];

  const ws = XLSX.utils.aoa_to_sheet(allData);

  // Set column widths
  ws["!cols"] = [
    { width: 25 }, // Description
    { width: 12 }, // Quantity
    { width: 18 }, // Unit Price
    { width: 18 }, // Total
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Invoice");

  // Save with descriptive filename
  const filename = `Invoice_${invoiceData.invoiceNumber}_${invoiceData.customerName?.replace(/\s+/g, "_") || "Customer"}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function exportInvoiceTXT(invoiceData: any) {
  let txt = "";

  // INVOICE header
  txt += "INVOICE\n";

  // Company info (only if provided)
  if (invoiceData.companyData?.name) {
    txt += `${invoiceData.companyData.name}\n`;
  }

  // P.O. Box and contacts on same line
  let contactLine = "";
  if (invoiceData.companyData?.poBox) {
    contactLine += `P.O. Box: ${invoiceData.companyData.poBox}`;
  }
  if (invoiceData.companyData?.contacts) {
    if (contactLine) contactLine += " ";
    contactLine += invoiceData.companyData.contacts;
  }
  if (contactLine) {
    txt += `${contactLine}\n`;
  }

  if (invoiceData.companyData?.email) {
    txt += `${invoiceData.companyData.email}\n`;
  }

  txt += "\n";

  // Customer and invoice details
  txt += `Bill To: ${invoiceData.customerName || ""}\n`;
  txt += `Invoice #: ${invoiceData.invoiceNumber}\n`;
  txt += `Date: ${invoiceData.invoiceDate}\n\n`;

  // Items table
  const quantityHeader = invoiceData.quantityLabel || "Qty (DAYS)";
  txt += `${"Description".padEnd(40)} ${quantityHeader.padEnd(12)} ${"Unit Price".padEnd(15)} ${"Total".padEnd(15)}\n`;
  txt += `${"-".repeat(85)}\n`;

  if (invoiceData.invoiceItems?.length > 0) {
    invoiceData.invoiceItems.forEach((item: any) => {
      const desc = (item.desc || "").padEnd(40);
      const qty = (item.qty || 0).toString().padEnd(12);
      const price = `Ksh${formatNumber(item.price, 0)}`.padEnd(15);
      const total = `Ksh${formatNumber(item.total, 0)}`.padEnd(15);
      txt += `${desc} ${qty} ${price} ${total}\n`;
    });
  } else {
    txt += `No items added\n`;
  }

  txt += `\n`;

  // Total with leading space
  txt += ` Total Due: Ksh${formatNumber(invoiceData.totalDue || 0, 0)}\n\n`;

  // Payment information
  txt += `Payment Should Be Made Through\n`;

  // Bank details (only if provided)
  if (invoiceData.companyData?.bankName) {
    txt += `BANK: ${invoiceData.companyData.bankName}\n`;
  }
  if (invoiceData.companyData?.branchName) {
    txt += `BRANCH: ${invoiceData.companyData.branchName}\n`;
  }
  if (invoiceData.companyData?.accountHolder) {
    txt += `${invoiceData.companyData.accountHolder}\n`;
  }
  if (invoiceData.companyData?.accountNumber) {
    txt += `ACCOUNT NO: ${invoiceData.companyData.accountNumber}\n`;
  }

  txt += `\nSignature:………………………….`;

  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  const filename = `Invoice_${invoiceData.invoiceNumber}_${invoiceData.customerName?.replace(/\s+/g, "_") || "Customer"}.txt`;
  saveAs(blob, filename);
}
