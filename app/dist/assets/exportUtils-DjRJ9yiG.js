import{E as T}from"./jspdf.es.min-CZheozpm.js";import{a as P}from"./jspdf.plugin.autotable-DEZvi-_-.js";import{u as r,w as S}from"./xlsx-BBWTpfDg.js";import{F as C}from"./FileSaver.min-FRgE4AJ8.js";import{l as t}from"./index-B-T48S1p.js";function I(e){const a=new T;let o=20;if(e.companyData.logo){const m=new Image;m.src=e.companyData.logo,a.addImage(m,"PNG",80,10,50,20),o=40}a.setFontSize(16),a.setTextColor("#d4af37"),a.setFont("helvetica","bold"),a.text(e.companyData.name||"Company Name",105,o,{align:"center"}),a.setTextColor("#1a3a5f"),o+=10,a.setFontSize(12),a.setFont("helvetica","bold"),a.text("Fuel Delivery Report",105,o,{align:"center"}),o+=20,a.setFontSize(10),a.setFont("helvetica","normal"),a.text(`FUEL DELIVERED TO: ${e.deliveredTo||"Client"}`,14,o),o+=8,a.text(`TOTAL ORDER: ${e.totalOrder||"N/A"} Litres`,14,o),o+=8,a.text(`YEAR: ${e.deliveryYear||"2025"}`,14,o),o+=8,a.text(`Petrol Price: Ksh ${e.petrolPrice||"180"} /L`,14,o),o+=8,a.text(`Diesel Price: Ksh ${e.dieselPrice||"170"} /L`,14,o),o+=8;const n=e.deliveryData.columns.map(m=>m.label),s=e.deliveryData.rows.map(m=>e.deliveryData.columns.map(c=>c.key==="amount"?"Ksh "+t(m.amount):c.key==="debt"?"Ksh "+t(m.debt):m[c.key]||""));P(a,{startY:o,head:[n],body:s,theme:"striped"});const l=a.lastAutoTable.finalY+10;a.setFont("helvetica","bold"),a.text(`Total Supplied: ${t(e.deliveryData.totals.totalSupplied)} L`,14,l),a.text(`Total Payments: ${e.companyData.currency} ${t(e.deliveryData.totals.totalPayments)}`,70,l),a.text(`Balance Due: ${e.companyData.currency} ${t(e.deliveryData.totals.balanceDue,2)}`,130,l),o=l+10,a.setFont("helvetica","normal"),a.text(`P.O. Box: ${e.companyData.poBox||"N/A"}`,14,o),o+=8,a.text(`CONTACTS: ${e.companyData.contacts||"N/A"}`,14,o),o+=8,a.text(`EMAIL: ${e.companyData.email||"N/A"}`,14,o),o+=10,a.save(`Delivery_Report_${e.deliveredTo||"Client"}.pdf`)}function O(e){const a=r.book_new(),o=[[e.companyData.name||"Company Name"],["Fuel Delivery Report"],[],[`FUEL DELIVERED TO: ${e.deliveredTo||"Client"}`],[`TOTAL ORDER: ${e.totalOrder||"N/A"} Litres`],[`YEAR: ${e.deliveryYear||"2025"}`],[`Petrol Price: Ksh ${e.petrolPrice||"180"} /L`],[`Diesel Price: Ksh ${e.dieselPrice||"170"} /L`],[],e.deliveryData.columns.map(s=>s.label),...e.deliveryData.rows.map(s=>e.deliveryData.columns.map(l=>l.key==="amount"?e.companyData.currency+" "+t(s.amount):l.key==="debt"?e.companyData.currency+" "+t(s.debt):s[l.key]||"")),[],[`Total Supplied: ${t(e.deliveryData.totals.totalSupplied)} L`],[`Total Payments: Ksh ${t(e.deliveryData.totals.totalPayments)}`],[`Balance Due: Ksh ${t(e.deliveryData.totals.balanceDue,2)}`],[],[`P.O. Box: ${e.companyData.poBox||"N/A"}`],[`CONTACTS: ${e.companyData.contacts||"N/A"}`],[`EMAIL: ${e.companyData.email||"N/A"}`]],n=r.aoa_to_sheet(o);r.book_append_sheet(a,n,"Delivery Report"),S(a,`Delivery_Report_${e.deliveredTo||"Client"}.xlsx`)}function B(e){let a=`=== ${e.companyData.name||"Company Name"} ===
Fuel Delivery Report

`;a+=`FUEL DELIVERED TO: ${e.deliveredTo||"Client"}
`,a+=`TOTAL ORDER: ${e.totalOrder||"N/A"} Litres
`,a+=`YEAR: ${e.deliveryYear||"2025"}
`,a+=`Petrol Price: ${e.companyData.currency} ${e.petrolPrice||"180"} /L
`,a+=`Diesel Price: ${e.companyData.currency} ${e.dieselPrice||"170"} /L

`,a+=e.deliveryData.rows.map(n=>e.deliveryData.columns.map(s=>s.key==="amount"?`${s.label}: ${e.companyData.currency}${t(n.amount)}`:s.key==="debt"?`${s.label}: ${e.companyData.currency}${t(n.debt)}`:`${s.label}: ${n[s.key]||""}`).join(" | ")).join(`
`),a+=`

`,a+=`Total Supplied: ${t(e.deliveryData.totals.totalSupplied)} L
`,a+=`Total Payments: ${e.companyData.currency} ${t(e.deliveryData.totals.totalPayments)}
`,a+=`Balance Due: ${e.companyData.currency} ${t(e.deliveryData.totals.balanceDue,2)}

`,a+=`P.O. Box: ${e.companyData.poBox||"N/A"}
`,a+=`CONTACTS: ${e.companyData.contacts||"N/A"}
`,a+=`EMAIL: ${e.companyData.email||"N/A"}`;const o=new Blob([a],{type:"text/plain"});C.saveAs(o,`Delivery_Report_${e.deliveredTo||"Client"}.txt`)}function E(e){const a=e.debtData,o=new T;let n=20;if(e.companyData.logo){const l=new Image;l.src=e.companyData.logo,o.addImage(l,"PNG",80,10,50,20),n=40}o.setFontSize(16),o.setTextColor("#d4af37"),o.setFont("helvetica","bold"),o.text(e.companyData.name||"Company Name",105,n,{align:"center"}),o.setTextColor("#1a3a5f"),n+=10,o.setFontSize(14),o.setFont("helvetica","bold"),o.text("Fuel Debt Payment Reminder",105,n,{align:"center"}),n+=15,o.setFont("helvetica","normal"),o.setFontSize(12);const s=[`Dear ${a.name},`,"",`This is a gentle reminder that KES ${a.amount} for fuel supplied remains unpaid.`,"","Kindly settle the amount via Till:",`Buy Goods: ${a.till}`,"","For bank transfer:",`Bank: ${a.bank}`,`A/C Name: ${a.acName}`,`A/C No.: ${a.acNo}`,"",`After payment, share the confirmation with us via ${a.method}: ${a.contact}`,"","Thank you.","","Best regards,",`${a.manager}`,"Manager",`${e.companyData.name||"Company Name"}`,"",`P.O. Box: ${e.companyData.poBox||"N/A"}`,`CONTACTS: ${e.companyData.contacts||"N/A"}`,`EMAIL: ${e.companyData.email||"N/A"}`];o.text(s,15,n,{maxWidth:180}),o.save(`Debt_Reminder_${a.name}.pdf`)}function k(e){const a=e.debtData,o=r.book_new(),n=[["Fuel Debt Payment Reminder"],[],[`Dear ${a.name},`],[],[`This is a gentle reminder that KES ${a.amount} for fuel supplied remains unpaid.`],[],["Kindly settle the amount via Till:"],[`Buy Goods: ${a.till}`],[],["For bank transfer:"],[`Bank: ${a.bank}`],[`A/C Name: ${a.acName}`],[`A/C No.: ${a.acNo}`],[],[`After payment, share the confirmation with us via ${a.method}: ${a.contact}`],[],["Thank you."],[],["Best regards,"],[`${a.manager}`],["Manager"],[`${e.companyData.name||"Company Name"}`],[],[`P.O. Box: ${e.companyData.poBox||"N/A"}`],[`CONTACTS: ${e.companyData.contacts||"N/A"}`],[`EMAIL: ${e.companyData.email||"N/A"}`]],s=r.aoa_to_sheet(n);r.book_append_sheet(o,s,"Debt Reminder"),S(o,`Debt_Reminder_${a.name}.xlsx`)}function R(e){const a=e.debtData,o=e.companyData.name||"Company Name",n=`=== ${o} ===
Fuel Debt Payment Reminder

Dear ${a.name},

This is a gentle reminder that KES ${a.amount} for fuel supplied remains unpaid.

Kindly settle the amount via Till:
Buy Goods: ${a.till}

For bank transfer:
Bank: ${a.bank}
A/C Name: ${a.acName}
A/C No.: ${a.acNo}

After payment, share the confirmation with us via ${a.method}: ${a.contact}

Thank you.

Best regards,
${a.manager}
Manager
${o}

P.O. Box: ${e.companyData.poBox||"N/A"}
CONTACTS: ${e.companyData.contacts||"N/A"}
EMAIL: ${e.companyData.email||"N/A"}`,s=new Blob([n],{type:"text/plain"});C.saveAs(s,`Fuel_Debt_Reminder_${a.name}.txt`)}function w(e){const a=new T;let o=20;if(e.companyData.logo){const n=new Image;n.src=e.companyData.logo,a.addImage(n,"PNG",80,10,50,20),o=40}if(a.setFontSize(16),a.setTextColor("#d4af37"),a.setFont("helvetica","bold"),a.text(e.companyData.name||"Company Name",105,o,{align:"center"}),a.setTextColor("#1a3a5f"),o+=10,a.setFontSize(14),a.setFont("helvetica","bold"),a.text("Fuel Sales Report",105,o,{align:"center"}),o+=20,a.setFontSize(12),a.setFont("helvetica","normal"),a.text(`Date: ${e.salesDate}`,15,o),a.text(`Shift: ${e.shift}`,100,o),o+=15,e.pmsPumps&&e.pmsPumps.length>0){a.setFont("helvetica","bold"),a.text("Petrol (PMS) Pumps:",15,o),o+=10;const n=["Pump ID","Opening (Ksh)","Closing (Ksh)","Opening (L)","Closing (L)","Sales (L)","Sales (Ksh)"],s=e.pmsPumps.map(l=>[l.id,t(l.openingKsh),t(l.closingKsh),t(l.openingL),t(l.closingL),t(l.salesL),t(l.salesKsh)]);P(a,{startY:o,head:[n],body:s,theme:"striped",headStyles:{fillColor:[26,58,95]}}),o=a.lastAutoTable.finalY+15}if(e.agoPumps&&e.agoPumps.length>0){a.setFont("helvetica","bold"),a.text("Diesel (AGO) Pumps:",15,o),o+=10;const n=["Pump ID","Opening (Ksh)","Closing (Ksh)","Opening (L)","Closing (L)","Sales (L)","Sales (Ksh)"],s=e.agoPumps.map(l=>[l.id,t(l.openingKsh),t(l.closingKsh),t(l.openingL),t(l.closingL),t(l.salesL),t(l.salesKsh)]);P(a,{startY:o,head:[n],body:s,theme:"striped",headStyles:{fillColor:[26,58,95]}}),o=a.lastAutoTable.finalY+15}e.summary&&(a.setFont("helvetica","bold"),a.text("Daily Summary:",15,o),o+=10,a.setFont("helvetica","normal"),a.text(`Total Petrol Sales: Ksh ${t(e.summary.totalPmsSalesKsh,2)}`,15,o),o+=8,a.text(`Total Diesel Sales: Ksh ${t(e.summary.totalAgoSalesKsh,2)}`,15,o),o+=8,a.text(`Total Revenue: Ksh ${t(e.summary.totalRevenue,2)}`,15,o),o+=8,a.text(`Cash In Hand: Ksh ${t(e.summary.cashInHand,2)}`,15,o),o+=8,a.text(`Net Income: Ksh ${t(e.summary.netIncome,2)}`,15,o)),a.save("Fuel_Sales_Report.pdf")}function v(e){const a=r.book_new();if(e.pmsPumps&&e.pmsPumps.length>0){const s=[["Pump ID","Opening (Ksh)","Closing (Ksh)","Opening (L)","Closing (L)","Sales (L)","Sales (Ksh)"],...e.pmsPumps.map(m=>[m.id,m.openingKsh,m.closingKsh,m.openingL,m.closingL,m.salesL,m.salesKsh])],l=r.aoa_to_sheet(s);r.book_append_sheet(a,l,"Petrol Pumps")}if(e.agoPumps&&e.agoPumps.length>0){const s=[["Pump ID","Opening (Ksh)","Closing (Ksh)","Opening (L)","Closing (L)","Sales (L)","Sales (Ksh)"],...e.agoPumps.map(m=>[m.id,m.openingKsh,m.closingKsh,m.openingL,m.closingL,m.salesL,m.salesKsh])],l=r.aoa_to_sheet(s);r.book_append_sheet(a,l,"Diesel Pumps")}const o=[["Report Information"],[],[`Company: ${e.companyData.name||"Company Name"}`],[`Generated: ${new Date().toLocaleDateString()}`]],n=r.aoa_to_sheet(o);r.book_append_sheet(a,n,"Report Info"),S(a,"Fuel_Sales_Report.xlsx")}function H(e){let a=`=== ${e.companyData.name||"Company Name"} ===
Fuel Sales Report

`;a+=`Date: ${e.salesDate}
Shift: ${e.shift}

`,a+=`Fuel Tank Inventory:
`,a+=`Petrol (PMS) Tank: Opening: ${t(e.pmsTankOpening)} L, Closing: ${t(e.pmsTankClosing)} L
`,a+=`Diesel (AGO) Tank: Opening: ${t(e.agoTankOpening)} L, Closing: ${t(e.agoTankClosing)} L

`,a+=`Fuel Pricing:
`,a+=`Petrol (PMS): Ksh ${e.pmsPrice}/L
`,a+=`Diesel (AGO): Ksh ${e.agoPrice}/L

`,e.pmsPumps&&e.pmsPumps.length>0&&(a+=`Petrol (PMS) Pumps:
`,a+=e.pmsPumps.map(n=>`${n.id}: Sales: ${t(n.salesL)} L, ${t(n.salesKsh)} Ksh`).join(`
`),a+=`

`),e.agoPumps&&e.agoPumps.length>0&&(a+=`Diesel (AGO) Pumps:
`,a+=e.agoPumps.map(n=>`${n.id}: Sales: ${t(n.salesL)} L, ${t(n.salesKsh)} Ksh`).join(`
`),a+=`

`),e.expenses&&e.expenses.length>0&&(a+=`Daily Expenses:
`,a+=e.expenses.map(n=>`${n.desc}: ${t(n.amount)} Ksh`).join(`
`),a+=`

`),a+=`Till/Mobile Payment: ${t(e.tillPayment)} Ksh

`,e.summary&&(a+=`Daily Summary:
`,a+=`Total Petrol Sales: Ksh ${t(e.summary.totalPmsSalesKsh,2)}
`,a+=`Total Diesel Sales: Ksh ${t(e.summary.totalAgoSalesKsh,2)}
`,a+=`Total Revenue: Ksh ${t(e.summary.totalRevenue,2)}
`,a+=`Till/Mobile Payment: Ksh ${t(e.tillPayment,2)}
`,a+=`Cash In Hand: Ksh ${t(e.summary.cashInHand,2)}
`,a+=`Total Expenses: Ksh ${t(e.summary.totalExpenses,2)}
`,a+=`Net Income: Ksh ${t(e.summary.netIncome,2)}`);const o=new Blob([a],{type:"text/plain"});C.saveAs(o,"Fuel_Sales_Report.txt")}function Y(e){var c,d,b,h,$,D,g,f,x,i;const a=new T;let o=20;if((c=e.companyData)!=null&&c.logo)try{const y=new Image;y.crossOrigin="anonymous";let u=e.companyData.logo;u.startsWith("data:")?(a.addImage(u,"PNG",15,10,50,30),o=50):console.warn("External logo URLs not supported in PDF export. Please upload logo as file.")}catch(y){console.warn("Could not load company logo for PDF:",y)}a.setFontSize(24),a.setFont("helvetica","bold"),a.setTextColor("#000000"),a.text("INVOICE",15,o),o+=15,(d=e.companyData)!=null&&d.name&&(a.setFontSize(16),a.setFont("helvetica","bold"),a.text(e.companyData.name,15,o),o+=10),a.setFontSize(11),a.setFont("helvetica","normal");let n="";(b=e.companyData)!=null&&b.poBox&&(n+=`P.O. Box: ${e.companyData.poBox}`),(h=e.companyData)!=null&&h.contacts&&(n&&(n+=" "),n+=e.companyData.contacts),n&&(a.text(n,15,o),o+=8),($=e.companyData)!=null&&$.email&&(a.text(e.companyData.email,15,o),o+=8),o+=10,a.setFont("helvetica","bold"),a.text("Bill To:",15,o),o+=8,a.setFont("helvetica","normal"),e.customerName&&(a.text(e.customerName,15,o),o+=6);const s=120;let l=o-20;if(a.setFont("helvetica","bold"),a.text("Invoice #:",s,l),a.setFont("helvetica","normal"),a.text(e.invoiceNumber||"",s+25,l),l+=8,a.setFont("helvetica","bold"),a.text("Date:",s,l),a.setFont("helvetica","normal"),a.text(e.invoiceDate||"",s+15,l),o+=15,e.invoiceItems&&e.invoiceItems.length>0){const u=["Description",e.quantityLabel||"Qty (DAYS)","Unit Price","Total"],N=e.invoiceItems.map(p=>[p.desc||"",p.qty||0,`Ksh${t(p.price,0)}`,`Ksh${t(p.total,0)}`]);P(a,{startY:o,head:[u],body:N,theme:"plain",headStyles:{fillColor:!1,textColor:[0,0,0],fontSize:11,fontStyle:"bold",lineWidth:.1,lineColor:[0,0,0]},bodyStyles:{fontSize:10,lineWidth:.1,lineColor:[0,0,0]},columnStyles:{0:{cellWidth:80},1:{cellWidth:30,halign:"center"},2:{cellWidth:40,halign:"right"},3:{cellWidth:40,halign:"right"}}}),o=a.lastAutoTable.finalY+15}a.setFont("helvetica","bold"),a.setFontSize(12),a.text(` Total Due: Ksh${t(e.totalDue||0,0)}`,120,o),o+=20,a.setFont("helvetica","bold"),a.text("Payment Should Be Made Through",15,o),o+=10,a.setFont("helvetica","normal"),(D=e.companyData)!=null&&D.bankName&&(a.text(`BANK: ${e.companyData.bankName}`,15,o),o+=8),(g=e.companyData)!=null&&g.branchName&&(a.text(`BRANCH: ${e.companyData.branchName}`,15,o),o+=8),(f=e.companyData)!=null&&f.accountHolder&&(a.text(e.companyData.accountHolder,15,o),o+=8),(x=e.companyData)!=null&&x.accountNumber&&(a.text(`ACCOUNT NO: ${e.companyData.accountNumber}`,15,o),o+=8),o+=15,a.text("Signature:………………………….",15,o);const m=`Invoice_${e.invoiceNumber}_${((i=e.customerName)==null?void 0:i.replace(/\s+/g,"_"))||"Customer"}.pdf`;a.save(m)}function M(e){var h,$,D,g,f,x,i,y,u,N;const a=r.book_new(),o=[["INVOICE"],[]];(h=e.companyData)!=null&&h.name&&o.push([e.companyData.name]);let n="";($=e.companyData)!=null&&$.poBox&&(n+=`P.O. Box: ${e.companyData.poBox}`),(D=e.companyData)!=null&&D.contacts&&(n&&(n+=" "),n+=e.companyData.contacts),n&&o.push([n]),(g=e.companyData)!=null&&g.email&&o.push([e.companyData.email]),o.push([]),o.push(["Bill To:",e.customerName||""]),o.push([`Invoice #: ${e.invoiceNumber}`]),o.push([`Date: ${e.invoiceDate}`]),o.push([]);const s=e.quantityLabel||"Qty (DAYS)",l=((f=e.invoiceItems)==null?void 0:f.length)>0?[["Description",s,"Unit Price","Total"],...e.invoiceItems.map(p=>[p.desc||"",p.qty||0,`Ksh${t(p.price,0)}`,`Ksh${t(p.total,0)}`])]:[["No items added"]],m=[[],[` Total Due: Ksh${t(e.totalDue||0,0)}`],[],["Payment Should Be Made Through"]];(x=e.companyData)!=null&&x.bankName&&m.push([`BANK: ${e.companyData.bankName}`]),(i=e.companyData)!=null&&i.branchName&&m.push([`BRANCH: ${e.companyData.branchName}`]),(y=e.companyData)!=null&&y.accountHolder&&m.push([e.companyData.accountHolder]),(u=e.companyData)!=null&&u.accountNumber&&m.push([`ACCOUNT NO: ${e.companyData.accountNumber}`]),m.push([]),m.push(["Signature:…………………………."]);const c=[...o,...l,...m],d=r.aoa_to_sheet(c);d["!cols"]=[{width:25},{width:12},{width:18},{width:18}],r.book_append_sheet(a,d,"Invoice");const b=`Invoice_${e.invoiceNumber}_${((N=e.customerName)==null?void 0:N.replace(/\s+/g,"_"))||"Customer"}.xlsx`;S(a,b)}function z(e){var m,c,d,b,h,$,D,g,f,x;let a="";a+=`INVOICE
`,(m=e.companyData)!=null&&m.name&&(a+=`${e.companyData.name}
`);let o="";(c=e.companyData)!=null&&c.poBox&&(o+=`P.O. Box: ${e.companyData.poBox}`),(d=e.companyData)!=null&&d.contacts&&(o&&(o+=" "),o+=e.companyData.contacts),o&&(a+=`${o}
`),(b=e.companyData)!=null&&b.email&&(a+=`${e.companyData.email}
`),a+=`
`,a+=`Bill To: ${e.customerName||""}
`,a+=`Invoice #: ${e.invoiceNumber}
`,a+=`Date: ${e.invoiceDate}

`;const n=e.quantityLabel||"Qty (DAYS)";a+=`${"Description".padEnd(40)} ${n.padEnd(12)} ${"Unit Price".padEnd(15)} ${"Total".padEnd(15)}
`,a+=`${"-".repeat(85)}
`,((h=e.invoiceItems)==null?void 0:h.length)>0?e.invoiceItems.forEach(i=>{const y=(i.desc||"").padEnd(40),u=(i.qty||0).toString().padEnd(12),N=`Ksh${t(i.price,0)}`.padEnd(15),p=`Ksh${t(i.total,0)}`.padEnd(15);a+=`${y} ${u} ${N} ${p}
`}):a+=`No items added
`,a+=`
`,a+=` Total Due: Ksh${t(e.totalDue||0,0)}

`,a+=`Payment Should Be Made Through
`,($=e.companyData)!=null&&$.bankName&&(a+=`BANK: ${e.companyData.bankName}
`),(D=e.companyData)!=null&&D.branchName&&(a+=`BRANCH: ${e.companyData.branchName}
`),(g=e.companyData)!=null&&g.accountHolder&&(a+=`${e.companyData.accountHolder}
`),(f=e.companyData)!=null&&f.accountNumber&&(a+=`ACCOUNT NO: ${e.companyData.accountNumber}
`),a+=`
Signature:………………………….`;const s=new Blob([a],{type:"text/plain;charset=utf-8"}),l=`Invoice_${e.invoiceNumber}_${((x=e.customerName)==null?void 0:x.replace(/\s+/g,"_"))||"Customer"}.txt`;C.saveAs(s,l)}export{O as a,I as b,z as c,M as d,B as e,Y as f,R as g,k as h,E as i,H as j,v as k,w as l};
