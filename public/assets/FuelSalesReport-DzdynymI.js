import{h as z,F as T,a1 as H,T as S,a4 as B}from"./index-De6F8O5Y.js";import{j as e}from"./trpc-DMa4lQDh.js";import{r as u}from"./vendor-r8aAkVtU.js";import{E as $}from"./jspdf.es.min-D2wRW_Sg.js";import O from"./html2canvas.esm-QH1iLAAe.js";import{P as A}from"./printer-DasNWEcy.js";function q(){const{state:a}=z(),[i,P]=u.useState(new Date().getMonth()+1),[c,C]=u.useState(new Date().getFullYear()),[N,R]=u.useState([]),[D,F]=u.useState(!1),[x,Y]=u.useState({petrol:0,diesel:0,total:0}),y=["January","February","March","April","May","June","July","August","September","October","November","December"],E=(()=>{const t=new Date().getFullYear(),o=t-100,d=t+100,s=[];for(let r=o;r<=d;r++)s.push(r);return s})();u.useEffect(()=>{k()},[i,c,a.salesHistory]);const k=()=>{const t=[];a.salesHistory&&typeof a.salesHistory=="object"&&Object.entries(a.salesHistory).forEach(([s,r])=>{const[m]=s.split("_"),l=new Date(m);if(!isNaN(l.getTime())&&l.getMonth()+1===i&&l.getFullYear()===c&&r&&(r.pmsPumps||r.agoPumps)){const p=(r.pmsPumps||[]).reduce((v,w)=>v+(w.salesKsh||0),0),h=(r.agoPumps||[]).reduce((v,w)=>v+(w.salesKsh||0),0),g=l.getDate().toString().padStart(2,"0"),b=i.toString().padStart(2,"0"),f=c.toString(),j=r.shift==="Night"||r.shift==="NIGHT"?"NIGHT":"DAY",I=`${g}/${b}/${f}(${j})`;(p>0||h>0)&&t.push({date:I,shift:j,petrolSales:p,dieselSales:h,totalSales:p+h})}}),t.sort((s,r)=>{const m=new Date(s.date.split("(")[0].split("/").reverse().join("-")),l=new Date(r.date.split("(")[0].split("/").reverse().join("-"));return m.getTime()-l.getTime()}),R(t);const o=t.reduce((s,r)=>s+r.petrolSales,0),d=t.reduce((s,r)=>s+r.dieselSales,0);Y({petrol:o,diesel:d,total:o+d})},M=()=>{const t=document.getElementById("report-content");if(!t)return;const o=window.open("","_blank");o&&(o.document.write(`
      <html>
        <head>
          <title>Fuel Sales Report - ${y[i-1]} ${c}</title>
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
          ${t.innerHTML}
        </body>
      </html>
    `),o.document.close(),o.focus(),o.print())},_=async()=>{try{F(!0);const t=document.getElementById("report-content");if(!t)return;const o=t.cloneNode(!0),d=document.createElement("style");d.textContent=`
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
      `,document.head.appendChild(d);const s=document.createElement("div");s.style.position="absolute",s.style.left="-9999px",s.style.top="0",s.style.background="white",s.style.color="black",s.style.width="210mm",s.style.padding="20px",s.appendChild(o),document.body.appendChild(s);const r=await O(s,{backgroundColor:"#ffffff",scale:2,useCORS:!0,allowTaint:!0,width:794,height:1123}),m=new $({orientation:"portrait",unit:"mm",format:"a4"}),l=r.toDataURL("image/png"),p=210,h=295,g=r.height*p/r.width;let b=g,f=0;for(m.addImage(l,"PNG",0,f,p,g),b-=h;b>=0;)f=b-g,m.addPage(),m.addImage(l,"PNG",0,f,p,g),b-=h;const j=`Fuel_Sales_Report_${y[i-1]}_${c}.pdf`;m.save(j),document.body.removeChild(s),document.head.removeChild(d)}catch(t){console.error("Error generating PDF:",t),B(async()=>{const{toastError:o}=await import("./toast-CHkWstsd.js");return{toastError:o}},[]).then(({toastError:o})=>o("Error generating PDF. Please try again."))}finally{F(!1)}},n=a.companyData.currency||"Ksh";return e.jsxs("div",{className:"p-4 md:p-6 space-y-6 text-white min-h-screen",children:[e.jsxs("div",{className:"flex flex-col md:flex-row items-start md:items-center justify-between gap-4",children:[e.jsxs("h2",{className:"text-xl md:text-2xl font-bold text-white flex items-center gap-2",children:[e.jsx(T,{className:"text-blue-400"}),"Fuel Sales Report"]}),e.jsxs("div",{className:"flex flex-col md:flex-row items-start md:items-center gap-3",children:[e.jsxs("div",{className:"flex gap-2",children:[e.jsx("select",{value:i,onChange:t=>P(parseInt(t.target.value)),className:"bg-gray-700 border border-gray-600 rounded p-2 text-white text-sm",children:y.map((t,o)=>e.jsx("option",{value:o+1,children:t},t))}),e.jsx("select",{value:c,onChange:t=>C(parseInt(t.target.value)),className:"bg-gray-700 border border-gray-600 rounded p-2 text-white text-sm",children:E.map(t=>e.jsx("option",{value:t,children:t},t))})]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsxs("button",{onClick:_,disabled:D,className:"bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-4 py-2 rounded flex items-center gap-2 text-sm",children:[e.jsx(H,{size:16}),D?"Saving...":"Save Report"]}),e.jsxs("button",{onClick:M,className:"bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2 text-sm",children:[e.jsx(A,{size:16}),"Print Report"]})]})]})]}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-4",children:[e.jsxs("div",{className:"bg-green-900/30 border border-green-600 p-4 rounded-lg",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-2",children:[e.jsx(S,{className:"text-green-400",size:20}),e.jsx("span",{className:"text-sm text-green-300",children:"Petrol Sales"})]}),e.jsxs("div",{className:"text-xl font-bold text-white",children:[n," ",x.petrol.toFixed(2)]})]}),e.jsxs("div",{className:"bg-blue-900/30 border border-blue-600 p-4 rounded-lg",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-2",children:[e.jsx(S,{className:"text-blue-400",size:20}),e.jsx("span",{className:"text-sm text-blue-300",children:"Diesel Sales"})]}),e.jsxs("div",{className:"text-xl font-bold text-white",children:[n," ",x.diesel.toFixed(2)]})]}),e.jsxs("div",{className:"bg-purple-900/30 border border-purple-600 p-4 rounded-lg",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-2",children:[e.jsx(S,{className:"text-purple-400",size:20}),e.jsx("span",{className:"text-sm text-purple-300",children:"Total Revenue"})]}),e.jsxs("div",{className:"text-xl font-bold text-white",children:[n," ",x.total.toFixed(2)]})]})]}),e.jsx("div",{className:"bg-gray-800 rounded-lg overflow-hidden",children:e.jsxs("div",{id:"report-content",className:"p-6",children:[e.jsxs("div",{className:"text-center mb-6",children:[a.companyData.logo&&e.jsx("div",{className:"logo mb-4",children:e.jsx("img",{src:a.companyData.logo,alt:"Company Logo",className:"report-logo h-16 mx-auto max-w-[150px] max-h-[60px] object-contain"})}),a.companyData.name&&a.companyData.name.trim()!==""?e.jsx("div",{className:"company-name text-lg font-bold text-white mb-2",children:a.companyData.name}):e.jsx("div",{className:"company-name text-lg font-bold text-white mb-2",children:"Company Name"}),e.jsx("div",{className:"report-title text-md font-semibold text-gray-200 mb-2",children:"Fuel Sales Report"}),e.jsxs("div",{className:"month-year text-gray-300",children:[e.jsxs("div",{children:["Month: ",y[i-1]]}),e.jsxs("div",{children:["Year: ",c]})]})]}),e.jsx("div",{className:"overflow-x-auto",children:N.length===0?e.jsxs("div",{className:"text-center py-8",children:[e.jsx(T,{size:48,className:"mx-auto text-gray-500 mb-4"}),e.jsx("div",{className:"text-lg font-semibold text-gray-300 mb-2",children:"No sales recorded for this period"}),e.jsxs("div",{className:"text-gray-400",children:["Sales data for ",y[i-1]," ",c," will appear here once you save sales tracking records."]})]}):e.jsxs("table",{className:"w-full border-collapse bg-white text-black",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"bg-gray-100",children:[e.jsx("th",{className:"border border-gray-400 p-3 text-left",children:"DD/MM/YYYY(SHIFT)"}),e.jsxs("th",{className:"border border-gray-400 p-3 text-right",children:["Total Petrol Sales (",n,")"]}),e.jsxs("th",{className:"border border-gray-400 p-3 text-right",children:["Total Diesel Sales (",n,")"]}),e.jsxs("th",{className:"border border-gray-400 p-3 text-right",children:["Total Sales/Revenue (",n,")"]})]})}),e.jsx("tbody",{children:N.map((t,o)=>e.jsxs("tr",{className:o%2===0?"bg-white":"bg-gray-50",children:[e.jsx("td",{className:"border border-gray-400 p-3",children:t.date}),e.jsx("td",{className:"border border-gray-400 p-3 text-right",children:t.petrolSales.toFixed(2)}),e.jsx("td",{className:"border border-gray-400 p-3 text-right",children:t.dieselSales.toFixed(2)}),e.jsx("td",{className:"border border-gray-400 p-3 text-right",children:t.totalSales.toFixed(2)})]},o))})]})}),N.length>0&&e.jsxs("div",{className:"totals mt-6 space-y-2",children:[e.jsxs("div",{className:"text-white",children:[e.jsx("span",{className:"font-semibold",children:"Monthly Total Petrol Sales:"})," ",n," ",x.petrol.toFixed(2)]}),e.jsxs("div",{className:"text-white",children:[e.jsx("span",{className:"font-semibold",children:"Monthly Total Diesel Sales:"})," ",n," ",x.diesel.toFixed(2)]}),e.jsxs("div",{className:"text-white text-lg",children:[e.jsx("span",{className:"font-bold",children:"Total Monthly Sales/Revenue:"})," ",n," ",x.total.toFixed(2)]})]}),(a.companyData.poBox&&a.companyData.poBox.trim()!==""||a.companyData.contacts&&a.companyData.contacts.trim()!==""||a.companyData.email&&a.companyData.email.trim()!=="")&&e.jsxs("div",{className:"contact-info mt-8 text-gray-300 space-y-1",children:[a.companyData.poBox&&a.companyData.poBox.trim()!==""&&e.jsxs("div",{children:["P.O. Box: ",a.companyData.poBox]}),a.companyData.contacts&&a.companyData.contacts.trim()!==""&&e.jsxs("div",{children:["Contacts: ",a.companyData.contacts]}),a.companyData.email&&a.companyData.email.trim()!==""&&e.jsxs("div",{children:["Email: ",a.companyData.email]})]})]})})]})}export{q as default};
