import{j as a}from"./trpc-Do2GXDyq.js";import{r as s}from"./vendor-DwGTNw7s.js";import{h as F,z as O,x as I,K,N as H,O as P,l as _,Q as W}from"./index-B-T48S1p.js";import{E as G}from"./FileSaver.min-FRgE4AJ8.js";import{g as z,h as L,i as U}from"./exportUtils-DjRJ9yiG.js";import"./file-spreadsheet-BoNx3N-8.js";import"./jspdf.es.min-CZheozpm.js";import"./jspdf.plugin.autotable-DEZvi-_-.js";import"./xlsx-BBWTpfDg.js";function te(){const{state:n,dispatch:v}=F(),[l,c]=s.useState(""),[m,i]=s.useState(""),[d,p]=s.useState(""),[u,h]=s.useState(""),[x,N]=s.useState(""),[b,g]=s.useState(""),[A,y]=s.useState(""),[$,j]=s.useState(""),[f,C]=s.useState("WhatsApp"),D=e=>{const t=P(e);i(t)},k=()=>{c(""),i(""),p(""),h(""),N(""),g(""),y(""),j("")},r=()=>({name:l||"[Customer Name]",amount:_(W(m)||0),till:d||"[Till]",bank:u||"[Bank]",acName:x||"[A/C Name]",acNo:b||"[A/C No.]",contact:A||"[Contact]",method:f,manager:$||"[Manager]"}),T=()=>{const e=l.trim();if(!e){alert("Please enter a customer name");return}const t={name:l,amount:m,till:d,bank:u,acName:x,acNo:b,contact:A,method:f,manager:$},R=`${new Date().toISOString().split("T")[0]}_${e.replace(/\s+/g,"_")}`;v({type:"SET_DEBT_HISTORY",payload:{...n.debtHistory,[R]:t}}),alert(`Debt reminder for ${e} saved!`)},B=e=>{const t=n.debtHistory[e];t&&(c(t.name),i(t.amount),p(t.till),h(t.bank),N(t.acName),g(t.acNo),y(t.contact),j(t.manager),C(t.method))},S=e=>{if(confirm("Delete this reminder?")){const t={...n.debtHistory};delete t[e],v({type:"SET_DEBT_HISTORY",payload:t})}},E=()=>{const e=r(),t=`Dear ${e.name},%0A%0AThis is a gentle reminder that KES ${e.amount} for fuel supplied remains unpaid.%0A%0AKindly settle the amount via Till:%0ABuy Goods: ${e.till}%0A%0AFor bank transfer:%0ABank: ${e.bank}%0AA/C Name: ${e.acName}%0AA/C No.: ${e.acNo}%0A%0AAfter payment, share the confirmation with us via ${e.method}: ${e.contact}%0A%0AThank you.%0A%0ABest regards,%0A${e.manager}%0AManager%0A${n.companyData.name}%0A%0AP.O. Box: ${n.companyData.poBox||"N/A"}%0ACONTACTS: ${n.companyData.contacts||"N/A"}%0AEMAIL: ${n.companyData.email||"N/A"}`,o=`https://wa.me/${e.contact.replace(/\D/g,"")}?text=${t}`;window.open(o,"_blank")},w=()=>{const e=r(),t=`Fuel Debt Reminder - ${e.amount}`,o=`Dear ${e.name},

This is a gentle reminder that KES ${e.amount} for fuel supplied remains unpaid.

Kindly settle the amount via Till:
Buy Goods: ${e.till}

For bank transfer:
Bank: ${e.bank}
A/C Name: ${e.acName}
A/C No.: ${e.acNo}

After payment, share the confirmation with us via ${e.method}: ${e.contact}

Thank you.

Best regards,
${e.manager}
Manager
${n.companyData.name}

P.O. Box: ${n.companyData.poBox||"N/A"}
CONTACTS: ${n.companyData.contacts||"N/A"}
EMAIL: ${n.companyData.email||"N/A"}`;window.location.href=`mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(o)}`},M={pdf:()=>U({...n,debtData:r()}),excel:()=>L({...n,debtData:r()}),txt:()=>z({...n,debtData:r()}),whatsapp:()=>{const e=r(),t=`*${n.companyData.name}*

*Fuel Debt Payment Reminder*

Dear ${e.name},

This is a gentle reminder that KES ${e.amount} for fuel supplied remains unpaid.

Kindly settle the amount via Till:
Buy Goods: ${e.till}

For bank transfer:
Bank: ${e.bank}
A/C Name: ${e.acName}
A/C No.: ${e.acNo}

After payment, share the confirmation with us via ${e.method}: ${e.contact}

Thank you.

Best regards,
${e.manager}
Manager
${n.companyData.name}

*P.O. Box:* ${n.companyData.poBox||"N/A"}
*CONTACTS:* ${n.companyData.contacts||"N/A"}
*EMAIL:* ${n.companyData.email||"N/A"}`,o=`https://wa.me/?text=${encodeURIComponent(t)}`;window.open(o,"_blank")},email:()=>{const e=r(),t=`Fuel Debt Payment Reminder - ${e.amount}`,o=`${n.companyData.name}

Fuel Debt Payment Reminder

Dear ${e.name},

This is a gentle reminder that KES ${e.amount} for fuel supplied remains unpaid.

Kindly settle the amount via Till:
Buy Goods: ${e.till}

For bank transfer:
Bank: ${e.bank}
A/C Name: ${e.acName}
A/C No.: ${e.acNo}

After payment, share the confirmation with us via ${e.method}: ${e.contact}

Thank you.

Best regards,
${e.manager}
Manager
${n.companyData.name}

P.O. Box: ${n.companyData.poBox||"N/A"}
CONTACTS: ${n.companyData.contacts||"N/A"}
EMAIL: ${n.companyData.email||"N/A"}`;window.location.href=`mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(o)}`}};return a.jsxs("div",{className:"p-6 space-y-6",children:[a.jsxs("div",{className:"card",children:[a.jsxs("div",{className:"flex justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700",children:[a.jsx("h2",{className:"text-2xl font-bold text-blue-900 dark:text-blue-200",children:"Fuel Debt Payment Reminder"}),a.jsxs("div",{className:"flex gap-2",children:[a.jsxs("button",{onClick:T,className:"btn btn-primary",children:[a.jsx(O,{size:16}),"Save"]}),a.jsxs("button",{onClick:k,className:"btn btn-outline",children:[a.jsx(I,{size:16}),"Clear"]})]})]}),a.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",children:[a.jsxs("div",{className:"form-group",children:[a.jsx("label",{children:"Customer Name"}),a.jsx("input",{type:"text",value:l,onChange:e=>c(e.target.value),placeholder:"Customer name"})]}),a.jsxs("div",{className:"form-group",children:[a.jsx("label",{children:"Amount (KES)"}),a.jsx("input",{type:"text",value:m,onChange:e=>D(e.target.value),placeholder:"0"})]}),a.jsxs("div",{className:"form-group",children:[a.jsx("label",{children:"Buy Goods Number"}),a.jsx("input",{type:"text",value:d,onChange:e=>p(e.target.value),placeholder:"e.g. 123456"})]}),a.jsxs("div",{className:"form-group",children:[a.jsx("label",{children:"Bank Name"}),a.jsx("input",{type:"text",value:u,onChange:e=>h(e.target.value),placeholder:"e.g. Equity Bank"})]}),a.jsxs("div",{className:"form-group",children:[a.jsx("label",{children:"A/C Name"}),a.jsx("input",{type:"text",value:x,onChange:e=>N(e.target.value),placeholder:"Account holder name"})]}),a.jsxs("div",{className:"form-group",children:[a.jsx("label",{children:"A/C No."}),a.jsx("input",{type:"text",value:b,onChange:e=>g(e.target.value),placeholder:"Account number"})]}),a.jsxs("div",{className:"form-group",children:[a.jsx("label",{children:"WhatsApp Number"}),a.jsx("input",{type:"text",value:A,onChange:e=>y(e.target.value),placeholder:"+254..."})]}),a.jsxs("div",{className:"form-group",children:[a.jsx("label",{children:"Manager Name"}),a.jsx("input",{type:"text",value:$,onChange:e=>j(e.target.value),placeholder:"Manager name"})]}),a.jsxs("div",{className:"form-group",children:[a.jsx("label",{children:"Contact Method"}),a.jsxs("select",{value:f,onChange:e=>C(e.target.value),children:[a.jsx("option",{value:"WhatsApp",children:"WhatsApp"}),a.jsx("option",{value:"Email",children:"Email"})]})]})]})]}),a.jsxs("div",{className:"card",children:[a.jsx("div",{className:"flex justify-between items-center mb-4",children:a.jsx("h3",{className:"text-xl font-bold",children:"Client History"})}),a.jsx("div",{className:"history-panel",children:Object.keys(n.debtHistory).sort((e,t)=>new Date(t.split("_")[0]).getTime()-new Date(e.split("_")[0]).getTime()).map(e=>{const t=n.debtHistory[e];return a.jsxs("div",{className:"history-item",children:[a.jsxs("span",{children:[t.name," - Ksh ",t.amount]}),a.jsxs("div",{className:"flex gap-2",children:[a.jsx("button",{onClick:()=>B(e),className:"text-xs",children:"Load"}),a.jsx("button",{onClick:()=>S(e),className:"text-xs",children:"Delete"})]})]},e)})})]}),a.jsx("div",{className:"card",children:a.jsxs("div",{className:"flex gap-4 flex-wrap",children:[a.jsx(G,{onExport:M,title:"Export Reminder"}),a.jsxs("button",{onClick:E,className:"btn btn-secondary",children:[a.jsx(K,{size:16}),"WhatsApp"]}),a.jsxs("button",{onClick:w,className:"btn btn-outline",children:[a.jsx(H,{size:16}),"Email"]})]})})]})}export{te as default};
