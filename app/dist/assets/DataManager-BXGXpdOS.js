var je=Object.defineProperty;var Se=(t,a,s)=>a in t?je(t,a,{enumerable:!0,configurable:!0,writable:!0,value:s}):t[a]=s;var G=(t,a,s)=>Se(t,typeof a!="symbol"?a+"":a,s);import{$ as pe,a1 as T,_ as W,a4 as F,d as ke,g as M,a7 as we,C as ee,a6 as me,a8 as Ne,R as H,a9 as be,aa as De,k as Ce,ab as xe,Z as _e,w as ye,h as Pe,ac as Ee,ad as Oe,a as ne,y as Q,l as Re,n as Ie,D as $e,ae as ze,P as Le,af as Te}from"./index-Ck_i7EPU.js";import{j as e}from"./trpc-vl3HIbK0.js";import{r as p}from"./vendor-CQPL1QX0.js";import{L as he}from"./loader-circle-CeQPK3PM.js";import{C as fe}from"./circle-check-big-DM_k43VG.js";function Ae({children:t,className:a="",variant:s="default",title:l,icon:r,padding:d="md",hover:n=!1,shadow:g="sm"}){const c="rounded-lg",b={sm:"p-4",md:"p-6",lg:"p-8"},m={none:"",sm:"shadow-sm",md:"shadow-md",lg:"shadow-lg"},u={default:"bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",glass:"bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700",gradient:"bg-gradient-to-br"},C=n?"transition-transform hover:scale-105":"";return e.jsxs("div",{className:`${c} ${b[d]} ${u[s]} ${m[g]} ${C} ${a}`,children:[(l||r)&&e.jsxs("div",{className:"flex items-center gap-2 mb-4",children:[r&&e.jsx("div",{className:"text-blue-600 dark:text-blue-400",children:r}),l&&e.jsx("h3",{className:"text-lg font-semibold text-gray-900 dark:text-white",children:l})]}),t]})}function le({children:t,icon:a,variant:s="primary",size:l="md",loading:r=!1,fullWidth:d=!1,className:n="",disabled:g,...c}){const b="inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all",m={sm:"px-3 py-1.5 text-sm",md:"px-4 py-2",lg:"px-6 py-3 text-lg"},u={primary:"bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:bg-blue-400",secondary:"bg-gray-600 hover:bg-gray-700 text-white shadow-sm disabled:bg-gray-400",outline:"border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50",success:"bg-green-600 hover:bg-green-700 text-white shadow-sm disabled:bg-green-400",warning:"bg-yellow-600 hover:bg-yellow-700 text-white shadow-sm disabled:bg-yellow-400",danger:"bg-red-600 hover:bg-red-700 text-white shadow-sm disabled:bg-red-400"},C=d?"w-full":"";return e.jsxs("button",{className:`${b} ${m[l]} ${u[s]} ${C} ${n}`,disabled:g||r,...c,children:[r?e.jsx(he,{size:16,className:"animate-spin"}):a,t]})}function Fe({onRestore:t}){const[a,s]=p.useState("idle"),[l,r]=p.useState(""),d=()=>{try{const g={timestamp:new Date().toISOString(),fuelData:localStorage.getItem("fuelData"),clients:localStorage.getItem("clients"),invoices:localStorage.getItem("invoices"),salesHistory:localStorage.getItem("salesHistory")},c=new Blob([JSON.stringify(g,null,2)],{type:"application/json"}),b=URL.createObjectURL(c),m=document.createElement("a");m.href=b,m.download=`fuelpro-backup-${new Date().toISOString().split("T")[0]}.json`,m.click(),URL.revokeObjectURL(b),s("success"),r("Backup exported successfully"),setTimeout(()=>s("idle"),3e3)}catch{s("error"),r("Failed to export backup"),setTimeout(()=>s("idle"),3e3)}},n=g=>{var m;const c=(m=g.target.files)==null?void 0:m[0];if(!c)return;const b=new FileReader;b.onload=u=>{var C;try{const v=JSON.parse((C=u.target)==null?void 0:C.result);v.fuelData&&localStorage.setItem("fuelData",v.fuelData),v.clients&&localStorage.setItem("clients",v.clients),v.invoices&&localStorage.setItem("invoices",v.invoices),v.salesHistory&&localStorage.setItem("salesHistory",v.salesHistory),t&&t(v),s("success"),r("Backup restored successfully. Reloading..."),F(async()=>{const{triggerSoftReload:I}=await import("./app-reloader-DVuBCsi3.js");return{triggerSoftReload:I}},[]).then(({triggerSoftReload:I})=>I(1500))}catch{s("error"),r("Invalid backup file format"),setTimeout(()=>s("idle"),3e3)}},b.readAsText(c)};return e.jsx(Ae,{title:"Data Backup & Recovery",icon:e.jsx(T,{size:20}),children:e.jsxs("div",{className:"space-y-4",children:[e.jsx("p",{className:"text-gray-600 dark:text-gray-400",children:"Export your data for backup or import a previous backup to restore your data."}),a!=="idle"&&e.jsxs("div",{className:`flex items-center gap-2 p-3 rounded-lg ${a==="success"?"bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400":"bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"}`,children:[a==="success"?e.jsx(fe,{size:20}):e.jsx(pe,{size:20}),e.jsx("span",{children:l})]}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4",children:[e.jsx(le,{onClick:d,icon:e.jsx(T,{size:20}),variant:"primary",fullWidth:!0,children:"Export Backup"}),e.jsxs("label",{className:"w-full",children:[e.jsx("input",{type:"file",accept:".json",onChange:n,className:"hidden"}),e.jsx(le,{icon:e.jsx(W,{size:20}),variant:"secondary",fullWidth:!0,children:"Import Backup"})]})]})]})})}const Z={databaseURL:"https://fuelpro-cloud-default-rtdb.firebaseio.com",apiKey:"YOUR_FIREBASE_API_KEY",projectId:"fuelpro-cloud"};function ie(){let t=localStorage.getItem("fuelpro_device_id");return t||(t=`dev_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,localStorage.setItem("fuelpro_device_id",t)),t}function Be(t,a){let s="";for(let l=0;l<t.length;l++)s+=String.fromCharCode(t.charCodeAt(l)^a.charCodeAt(l%a.length));return btoa(s)}function Ue(t,a){try{const s=atob(t);let l="";for(let r=0;r<s.length;r++)l+=String.fromCharCode(s.charCodeAt(r)^a.charCodeAt(r%a.length));return l}catch{return"{}"}}function ce(t){return`${localStorage.getItem("fuelpro_cloud_key")||"fuelpro_default_key_2026"}_${t}`}const U={isEnabled(){return localStorage.getItem("fuelpro_cloud_enabled")==="true"},setEnabled(t){localStorage.setItem("fuelpro_cloud_enabled",String(t))},setEncryptionKey(t){localStorage.setItem("fuelpro_cloud_key",t)},async syncToCloud(t){if(!this.isEnabled())return!1;try{const a={},s=[`fuelpro_data_${t}`,"fuelpro_inventory","fuelpro_customers","fuelpro_shifts","fuelpro_employees","fuelpro_credit_accounts","fuelpro_quality_tests",`fuelpro_sync_result_${t}`,"fuelpro_fuel_prices_KE"];for(const n of s){const g=localStorage.getItem(n);if(g)try{a[n]=JSON.parse(g)}catch{a[n]=g}}const l={stationId:t,data:a,version:Date.now(),lastModified:new Date().toISOString(),deviceId:ie()},r=Be(JSON.stringify(l),ce(t));return(await fetch(`${Z.databaseURL}/stations/${t}.json`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({encrypted:r,timestamp:Date.now()})})).ok?(localStorage.setItem("fuelpro_last_cloud_sync",new Date().toISOString()),window.dispatchEvent(new CustomEvent("fuelpro-cloud-sync",{detail:{success:!0,stationId:t}})),!0):!1}catch(a){return console.error("[Firebase] Sync failed:",a),!1}},async restoreFromCloud(t){if(!this.isEnabled())return!1;try{const a=await fetch(`${Z.databaseURL}/stations/${t}.json`);if(!a.ok)return!1;const s=await a.json();if(!(s!=null&&s.encrypted))return!1;const l=Ue(s.encrypted,ce(t)),r=JSON.parse(l);if(r.data){for(const[d,n]of Object.entries(r.data))n!=null&&localStorage.setItem(d,typeof n=="string"?n:JSON.stringify(n));return localStorage.setItem("fuelpro_last_cloud_sync",new Date().toISOString()),window.dispatchEvent(new CustomEvent("fuelpro-cloud-sync",{detail:{success:!0,restored:!0,stationId:t}})),!0}return!1}catch(a){return console.error("[Firebase] Restore failed:",a),!1}},startAutoSync(t,a=6e4){return setInterval(()=>{this.isEnabled()&&this.syncToCloud(t)},a)},getLastSyncInfo(){return{lastSync:localStorage.getItem("fuelpro_last_cloud_sync"),deviceId:ie(),enabled:this.isEnabled()}},async clearCloudData(t){try{return(await fetch(`${Z.databaseURL}/stations/${t}.json`,{method:"DELETE"})).ok}catch{return!1}}};function Me(){const{currentStation:t}=ke(),[a,s]=p.useState(U.isEnabled()),[l,r]=p.useState(!1),[d,n]=p.useState(localStorage.getItem("fuelpro_last_cloud_sync")),[g,c]=p.useState(""),[b,m]=p.useState(!1),[u,C]=p.useState(""),v=(t==null?void 0:t.id)||"default";p.useEffect(()=>{const D=()=>{n(localStorage.getItem("fuelpro_last_cloud_sync")),c("Cloud sync completed!"),setTimeout(()=>c(""),3e3)};return window.addEventListener("fuelpro-cloud-sync",D),()=>window.removeEventListener("fuelpro-cloud-sync",D)},[]);const I=()=>{U.setEnabled(!a),s(!a),a||(c("Cloud sync enabled. Data will auto-sync every 60 seconds."),setTimeout(()=>c(""),4e3))},_=async()=>{if(!a){c("Enable cloud sync first.");return}r(!0),c("");const D=await U.syncToCloud(v);r(!1),c(D?"Data synced to cloud!":"Sync failed. Check connection."),D&&n(new Date().toISOString()),setTimeout(()=>c(""),4e3)},P=async()=>{if(!a){c("Enable cloud sync first.");return}r(!0),c("");const D=await U.restoreFromCloud(v);r(!1),c(D?"Data restored from cloud! Refreshing...":"No cloud data found."),D&&(n(new Date().toISOString()),F(async()=>{const{triggerSoftReload:z}=await import("./app-reloader-DVuBCsi3.js");return{triggerSoftReload:z}},[]).then(({triggerSoftReload:z})=>z(1500))),setTimeout(()=>c(""),4e3)},A=()=>{u.trim()&&(U.setEncryptionKey(u.trim()),c("Encryption key saved!"),setTimeout(()=>c(""),3e3))};return e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:`flex items-center justify-between p-4 rounded-xl border ${a?"bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800":"bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"}`,children:[e.jsxs("div",{className:"flex items-center gap-3",children:[a?e.jsx(M,{size:20,className:"text-blue-500"}):e.jsx(we,{size:20,className:"text-gray-400"}),e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-semibold dark:text-white",children:a?"Cloud Sync Active":"Cloud Sync Disabled"}),e.jsx("p",{className:"text-[11px] text-gray-500",children:d?`Last sync: ${new Date(d).toLocaleString()}`:"Never synced"})]})]}),e.jsx("button",{onClick:I,className:`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${a?"bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400":"bg-blue-600 text-white hover:bg-blue-700"}`,children:a?"Disable":"Enable"})]}),g&&e.jsxs("div",{className:`flex items-center gap-2 p-3 rounded-lg text-xs ${g.includes("failed")||g.includes("first")?"bg-red-50 text-red-700 dark:bg-red-900/10":"bg-green-50 text-green-700 dark:bg-green-900/10"}`,children:[g.includes("failed")?e.jsx(pe,{size:14}):e.jsx(ee,{size:14}),g]}),a&&e.jsxs("div",{className:"flex gap-3",children:[e.jsxs("button",{onClick:_,disabled:l,className:"flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors",children:[e.jsx(W,{size:14,className:l?"animate-bounce":""})," ","Sync to Cloud"]}),e.jsxs("button",{onClick:P,disabled:l,className:"flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors",children:[e.jsx(T,{size:14,className:l?"animate-bounce":""})," ","Restore from Cloud"]}),e.jsx("button",{onClick:()=>m(!b),className:"px-3 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl text-gray-600 dark:text-gray-300 transition-colors",children:e.jsx(me,{size:14})})]}),b&&e.jsxs("div",{className:"bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-3",children:[e.jsxs("h4",{className:"text-sm font-semibold dark:text-white flex items-center gap-2",children:[e.jsx(Ne,{size:14})," Encryption Key"]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx("input",{type:"password",value:u,onChange:D=>C(D.target.value),placeholder:"Enter custom encryption key...",className:"flex-1 px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"}),e.jsx("button",{onClick:A,className:"px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium",children:"Save"})]}),e.jsx("p",{className:"text-[10px] text-gray-500",children:"This key encrypts your data before sending to the cloud. Use the same key on all your devices."})]})]})}const Je="fuelpro-sync",$="sync_queue",de="sync_meta",We="fuelpro_broadcast";function te(){let t=localStorage.getItem("fuelpro_device_id");return t||(t=`dev_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,localStorage.setItem("fuelpro_device_id",t)),t}async function V(){return new Promise((t,a)=>{const s=indexedDB.open(Je,1);s.onerror=()=>a(s.error),s.onsuccess=()=>t(s.result),s.onupgradeneeded=l=>{const r=l.target.result;r.objectStoreNames.contains($)||r.createObjectStore($,{keyPath:"id"}),r.objectStoreNames.contains(de)||r.createObjectStore(de,{keyPath:"key"})}})}async function ae(){const t=await V();return new Promise((a,s)=>{const d=t.transaction($,"readonly").objectStore($).openCursor(),n=[];d.onsuccess=g=>{const c=g.target.result;c?(c.value.synced||n.push(c.value),c.continue()):(n.sort((b,m)=>b.timestamp-m.timestamp),a(n))},d.onerror=()=>s(d.error)})}async function Ke(t){const a=await V();return new Promise((s,l)=>{const d=a.transaction($,"readwrite").objectStore($),n=d.get(t);n.onsuccess=()=>{const g=n.result;g&&(g.synced=!0,d.put(g)),s()},n.onerror=()=>l(n.error)})}async function He(t=10080*60*1e3){const a=await V(),s=Date.now()-t;return new Promise((l,r)=>{const n=a.transaction($,"readwrite").objectStore($),g=n.openCursor();let c=0;g.onsuccess=b=>{const m=b.target.result;m?(m.value.synced&&m.value.timestamp<s&&(n.delete(m.value.id),c++),m.continue()):l(c)},g.onerror=()=>r(g.error)})}let J=null;try{J=new BroadcastChannel(We)}catch{}function Ve(t){const a=l=>{var r,d;if(((r=l.data)==null?void 0:r.type)==="mutation"&&((d=l.data)!=null&&d.item)){const n=l.data.item;n.deviceId!==te()&&t(n)}},s=l=>{l.key==="fuelpro_sync_ping"&&ae().then(r=>{r.forEach(d=>{d.deviceId!==te()&&t(d)})}).catch(()=>{})};return J&&J.addEventListener("message",a),window.addEventListener("storage",s),()=>{J&&J.removeEventListener("message",a),window.removeEventListener("storage",s)}}async function Ye(){const t={};for(let a=0;a<localStorage.length;a++){const s=localStorage.key(a);if(s&&s.startsWith("fuelpro_"))try{t[s]=JSON.parse(localStorage.getItem(s))}catch{t[s]=localStorage.getItem(s)}}try{const r=(await V()).transaction($,"readonly").objectStore($).getAll(),d=await new Promise((n,g)=>{r.onsuccess=()=>n(r.result),r.onerror=()=>g(r.error)});t._sync_queue=d}catch{}return JSON.stringify(t,null,2)}async function ge(t){let a=0,s=0;try{const l=JSON.parse(t);for(const[r,d]of Object.entries(l))if(r!=="_sync_queue"&&r.startsWith("fuelpro_"))try{typeof d=="string"?localStorage.setItem(r,d):localStorage.setItem(r,JSON.stringify(d)),a++}catch{s++}}catch{s++}return{imported:a,errors:s}}async function ue(){const t=await ae();return{lastSync:Number(localStorage.getItem("fuelpro_last_sync")||"0"),deviceId:te(),pendingCount:t.length,isOnline:navigator.onLine}}class qe{constructor(){G(this,"listeners",new Set);G(this,"interval",null)}start(a=5e3){this.stop(),this.interval=setInterval(async()=>{const s=await ue();this.listeners.forEach(l=>l(s))},a)}stop(){this.interval&&(clearInterval(this.interval),this.interval=null)}subscribe(a){return this.listeners.add(a),ue().then(s=>a(s)).catch(()=>{}),()=>this.listeners.delete(a)}}const X=new qe;function Ge(){const[t,a]=p.useState({lastSync:0,deviceId:"",pendingCount:0,isOnline:navigator.onLine}),[s,l]=p.useState([]),[r,d]=p.useState(!1),[n,g]=p.useState(""),[c,b]=p.useState(""),[m,u]=p.useState(""),[C,v]=p.useState({totalDocs:0,totalStorage:0,lastActivity:"Never"}),I=p.useRef(null);p.useEffect(()=>{const i=X.subscribe(a);X.start(5e3),_(),P();const E=Ve(R=>{u(`Synced: ${R.collection} ${R.operation}`),setTimeout(()=>u(""),3e3),_(),P()}),w=()=>a(R=>({...R,isOnline:!0})),j=()=>a(R=>({...R,isOnline:!1}));return window.addEventListener("online",w),window.addEventListener("offline",j),()=>{i(),E(),X.stop(),window.removeEventListener("online",w),window.removeEventListener("offline",j)}},[]);const _=p.useCallback(async()=>{const i=await ae();l(i)},[]),P=p.useCallback(async()=>{try{let i=0,E=0;for(let w=0;w<localStorage.length;w++){const j=localStorage.key(w);j!=null&&j.startsWith("fuelpro_")&&(i++,E+=(localStorage.getItem(j)||"").length*2)}v({totalDocs:i,totalStorage:E,lastActivity:new Date().toLocaleTimeString()})}catch{}},[]),A=p.useCallback(async()=>{d(!0);try{for(const i of s)await Ke(i.id);localStorage.setItem("fuelpro_last_sync",String(Date.now())),await _(),await P(),u(`Synced ${s.length} items`)}catch{u("Sync failed")}d(!1),setTimeout(()=>u(""),3e3)},[s,_,P]),D=p.useCallback(async()=>{const i=await Ye();g(i);const E=new Blob([i],{type:"application/json"}),w=URL.createObjectURL(E),j=document.createElement("a");j.href=w,j.download=`fuelpro_backup_${new Date().toISOString().slice(0,10)}.json`,j.click(),URL.revokeObjectURL(w),u("Data exported"),setTimeout(()=>u(""),3e3)},[]),z=p.useCallback(async()=>{if(c.trim()){try{const i=await ge(c.trim());u(`Imported: ${i.imported} items, ${i.errors} errors`),await P()}catch{u("Import failed - invalid data")}b(""),setTimeout(()=>u(""),3e3)}},[c,P]),Y=p.useCallback(i=>{var j;const E=(j=i.target.files)==null?void 0:j[0];if(!E)return;const w=new FileReader;w.onload=async()=>{try{const R=await ge(String(w.result));u(`Imported: ${R.imported} items, ${R.errors} errors`),await P()}catch{u("Import failed")}setTimeout(()=>u(""),3e3)},w.readAsText(E),i.target.value=""},[P]),B=p.useCallback(async()=>{const i=await He();u(`Cleaned up ${i} old items`),await _(),setTimeout(()=>u(""),3e3)},[_]),q=i=>i<1024?i+" B":i<1048576?(i/1024).toFixed(1)+" KB":(i/1048576).toFixed(1)+" MB";return e.jsxs("div",{style:{padding:16,fontFamily:"system-ui, sans-serif",color:"#e2e8f0"},children:[e.jsxs("div",{style:{marginBottom:20},children:[e.jsxs("h2",{style:{margin:"0 0 6px",fontSize:20,fontWeight:700,color:"#fff",display:"flex",alignItems:"center",gap:10},children:[e.jsx(H,{size:22,style:{color:"#f59e0b"}})," Cross-Device Sync"]}),e.jsx("p",{style:{margin:0,fontSize:12,color:"#64748b"},children:"Sync data across all your devices and browsers instantly"})]}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:10,marginBottom:16},children:[e.jsx(K,{icon:t.isOnline?e.jsx(be,{size:16}):e.jsx(De,{size:16}),label:"Connection",value:t.isOnline?"Online":"Offline",color:t.isOnline?"#10b981":"#ef4444"}),e.jsx(K,{icon:e.jsx(Ce,{size:16}),label:"Pending Sync",value:String(t.pendingCount),color:"#f59e0b"}),e.jsx(K,{icon:e.jsx(xe,{size:16}),label:"Storage Used",value:q(C.totalStorage),color:"#3b82f6"}),e.jsx(K,{icon:e.jsx(ee,{size:16}),label:"Data Items",value:String(C.totalDocs),color:"#8b5cf6"})]}),e.jsxs("div",{style:{background:"rgba(30,30,35,0.6)",borderRadius:10,padding:12,border:"1px solid #334155",marginBottom:16},children:[e.jsx("div",{style:{fontSize:11,color:"#64748b",marginBottom:4},children:"Device ID (unique to this browser)"}),e.jsx("div",{style:{fontSize:12,color:"#94a3b8",fontFamily:"monospace",wordBreak:"break-all"},children:t.deviceId})]}),e.jsxs("div",{style:{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16},children:[e.jsxs("button",{onClick:A,disabled:r||s.length===0,style:{padding:"10px 18px",background:r||s.length===0?"#374151":"#f59e0b",color:"#000",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:r||s.length===0?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:6},children:[r?e.jsx(he,{size:14,className:"spin"}):e.jsx(_e,{size:14})," ","Sync Now"]}),e.jsxs("button",{onClick:D,style:{padding:"10px 18px",background:"#1a1a1f",color:"#e2e8f0",border:"1px solid #334155",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6},children:[e.jsx(T,{size:14})," Export Data"]}),e.jsxs("button",{onClick:()=>{var i;return(i=I.current)==null?void 0:i.click()},style:{padding:"10px 18px",background:"#1a1a1f",color:"#e2e8f0",border:"1px solid #334155",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6},children:[e.jsx(W,{size:14})," Import File"]}),e.jsx("input",{ref:I,type:"file",accept:".json",onChange:Y,style:{display:"none"}}),e.jsxs("button",{onClick:B,style:{padding:"10px 18px",background:"transparent",color:"#ef4444",border:"1px solid #ef4444",borderRadius:8,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6},children:[e.jsx(ye,{size:14})," Cleanup Old"]})]}),e.jsxs("div",{style:{marginBottom:16},children:[e.jsx("textarea",{value:c,onChange:i=>b(i.target.value),placeholder:"Paste exported JSON data here to import...",style:{width:"100%",minHeight:80,padding:10,background:"#1a1a1f",border:"1px solid #334155",borderRadius:8,color:"#e2e8f0",fontSize:12,fontFamily:"monospace",resize:"vertical",boxSizing:"border-box"}}),c&&e.jsx("button",{onClick:z,style:{marginTop:8,padding:"8px 16px",background:"#10b981",color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer"},children:"Import Data"})]}),e.jsxs("div",{style:{marginBottom:16},children:[e.jsx("h3",{style:{fontSize:14,fontWeight:600,color:"#fff",margin:"0 0 10px"},children:"Pending Sync Queue"}),s.length===0?e.jsxs("div",{style:{textAlign:"center",padding:24,color:"#475569",fontSize:13},children:[e.jsx(ee,{size:32,style:{marginBottom:8,opacity:.3}}),e.jsx("p",{children:"All data synced"})]}):e.jsx("div",{style:{maxHeight:240,overflowY:"auto",display:"flex",flexDirection:"column",gap:4},children:s.map(i=>e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"rgba(30,30,35,0.6)",borderRadius:8,border:"1px solid #334155",fontSize:12},children:[e.jsx("span",{style:{color:"#f59e0b"},children:e.jsx(H,{size:12})}),e.jsx("span",{style:{flex:1,color:"#e2e8f0"},children:i.collection}),e.jsx("span",{style:{padding:"2px 8px",borderRadius:10,fontSize:10,background:i.operation==="create"?"rgba(16,185,129,0.1)":i.operation==="delete"?"rgba(239,68,68,0.1)":"rgba(59,130,246,0.1)",color:i.operation==="create"?"#34d399":i.operation==="delete"?"#f87171":"#60a5fa"},children:i.operation}),e.jsx("span",{style:{color:"#475569",fontSize:10},children:new Date(i.timestamp).toLocaleTimeString()})]},i.id))})]}),e.jsxs("div",{style:{background:"rgba(30,30,35,0.6)",borderRadius:10,padding:12,border:"1px solid #334155",fontSize:11,color:"#64748b",lineHeight:1.6},children:[e.jsx("strong",{style:{color:"#94a3b8"},children:"How Cross-Device Sync Works:"}),e.jsxs("ul",{style:{margin:"6px 0 0",paddingLeft:16},children:[e.jsxs("li",{children:[e.jsx("strong",{style:{color:"#f59e0b"},children:"Same Browser:"})," Data syncs instantly across all tabs via BroadcastChannel"]}),e.jsxs("li",{children:[e.jsx("strong",{style:{color:"#f59e0b"},children:"Different Devices:"})," ","Export data as JSON from one device, import on another"]}),e.jsxs("li",{children:[e.jsx("strong",{style:{color:"#f59e0b"},children:"Offline:"})," All changes queue in IndexedDB and sync when you reconnect"]}),e.jsxs("li",{children:[e.jsx("strong",{style:{color:"#f59e0b"},children:"Storage:"})," Data persists in IndexedDB even after browser close"]})]})]}),m&&e.jsx("div",{style:{position:"fixed",bottom:20,right:20,padding:"10px 16px",background:"#1a1a1f",border:"1px solid #334155",borderRadius:8,fontSize:13,color:"#e2e8f0",zIndex:9999,animation:"slideUp 0.2s ease"},children:m}),e.jsx("style",{children:`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `})]})}function K({icon:t,label:a,value:s,color:l}){return e.jsxs("div",{style:{background:"rgba(30,30,35,0.6)",borderRadius:10,padding:12,border:"1px solid #334155",display:"flex",alignItems:"center",gap:10},children:[e.jsx("div",{style:{width:32,height:32,borderRadius:8,background:`${l}20`,display:"flex",alignItems:"center",justifyContent:"center",color:l,flexShrink:0},children:t}),e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:16,fontWeight:700,color:"#fff"},children:s}),e.jsx("div",{style:{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:.5},children:a})]})]})}function st(){var re,oe;const{state:t,dispatch:a,saveToCloud:s,loadFromCloud:l,isCloudSaving:r,lastCloudSave:d}=Pe(),{hasPermission:n,isOwner:g}=Ee(),c=p.useRef(null),[b,m]=p.useState(""),[u,C]=p.useState("overview"),[v,I]=p.useState(t.pmsPrice||180),[_,P]=p.useState(t.agoPrice||170),[A,D]=p.useState(((re=t.pmsPumps)==null?void 0:re.length)||1),[z,Y]=p.useState(((oe=t.agoPumps)==null?void 0:oe.length)||1),B=()=>(JSON.stringify(t).length/1024).toFixed(1),q=()=>({deliveries:t.deliveryData.rows.length,clients:Object.keys(t.clients).length,invoices:Object.keys(t.invoices).length,salesRecords:Object.keys(t.salesHistory).length,debtRecords:Object.keys(t.debtHistory).length,pmsPumps:t.pmsPumps.length,agoPumps:t.agoPumps.length,expenses:t.expenses.length,employees:t.employees.length,offloadingRecords:t.offloadingRecords.length}),i=o=>{try{const f=new Date().toISOString().replace(/[:.]/g,"-");if(o==="json"){const x={version:"2.0",exported:new Date().toISOString(),appData:t},h=JSON.stringify(x,null,2),y=new Blob([h],{type:"application/json"}),k=URL.createObjectURL(y),N=document.createElement("a");N.href=k,N.download=`FuelPro_Backup_${f}.json`,N.click(),URL.revokeObjectURL(k),F(async()=>{const{toastSuccess:O}=await import("./toast-CHkWstsd.js");return{toastSuccess:O}},[]).then(({toastSuccess:O})=>O("Data exported successfully!"))}if(o==="csv"){const x=t.deliveryData.columns.map(L=>L.label).join(","),h=t.deliveryData.rows.map(L=>t.deliveryData.columns.map(ve=>L[ve.key]).join(",")).join(`
`),y=`${x}
${h}`,k=new Blob([y],{type:"text/csv"}),N=URL.createObjectURL(k),O=document.createElement("a");O.href=N,O.download=`FuelPro_Deliveries_${f}.csv`,O.click(),URL.revokeObjectURL(N),F(async()=>{const{toastSuccess:L}=await import("./toast-CHkWstsd.js");return{toastSuccess:L}},[]).then(({toastSuccess:L})=>L("Delivery data exported as CSV!"))}}catch(f){console.error("Export error:",f),F(async()=>{const{toastError:x}=await import("./toast-CHkWstsd.js");return{toastError:x}},[]).then(({toastError:x})=>x("Export failed. Please try again."))}},E=o=>{var h;const f=(h=o.target.files)==null?void 0:h[0];if(!f)return;if(!f.name.endsWith(".json")){m("Please select a valid JSON backup file.");return}m("Reading backup file...");const x=new FileReader;x.onload=y=>{var k;try{const N=(k=y.target)==null?void 0:k.result,O=JSON.parse(N);if(!O.appData&&!O.data)throw new Error("Invalid backup file format");m("Restoring data...");const L=O.appData||O.data;a({type:"LOAD_FROM_STORAGE",payload:L}),m("Data imported successfully!"),setTimeout(()=>{m("")},3e3)}catch(N){console.error("Import error:",N),m("Failed to import data. Invalid backup file."),setTimeout(()=>{m("")},3e3)}},x.readAsText(f),c.current&&(c.current.value="")},w="fuelpro_",j=()=>{if(confirm("Are you sure you want to clear all FuelPro data? This action cannot be undone!")){const f=[];for(let x=0;x<localStorage.length;x++){const h=localStorage.key(x);h&&(h.startsWith(w)||h==="fuelData"||h==="clients"||h==="invoices"||h==="salesHistory")&&f.push(h)}f.forEach(x=>localStorage.removeItem(x)),F(async()=>{const{broadcastReload:x}=await import("./app-reloader-DVuBCsi3.js");return{broadcastReload:x}},[]).then(({broadcastReload:x})=>x())}},R=()=>{try{const o=new Date().toISOString().replace(/[:.]/g,"-"),f=`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FuelPro - Standalone Version</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            background: linear-gradient(135deg, #1a1a1a 0%, #2c2c2c 100%);
            color: #eee;
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header {
            background: linear-gradient(135deg, #1a3a5f 0%, #2980b9 100%);
            padding: 30px;
            border-radius: 16px;
            margin-bottom: 30px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.3);
        }
        .header h1 { color: #f0d78a; font-size: 2.5rem; margin-bottom: 10px; }
        .header p { color: #fff; opacity: 0.9; }
        .notice {
            background: #2c5282;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            border-left: 4px solid #f0d78a;
        }
        .notice h3 { color: #f0d78a; margin-bottom: 10px; }
        .notice ul { padding-left: 20px; line-height: 1.8; }
        .card {
            background: rgba(44, 44, 44, 0.8);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 25px;
            margin-bottom: 20px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.2);
            border: 1px solid rgba(240, 215, 138, 0.2);
        }
        .card h2 { color: #f0d78a; margin-bottom: 15px; font-size: 1.5rem; }
        .btn {
            background: linear-gradient(135deg, #f0d78a 0%, #d4af37 100%);
            color: #1a1a1a;
            border: none;
            padding: 12px 24px;
            border-radius: 12px;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 600;
            transition: all 0.3s ease;
            display: inline-block;
            margin: 5px;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(240, 215, 138, 0.4);
        }
        .data-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        .data-item {
            background: rgba(240, 215, 138, 0.1);
            padding: 15px;
            border-radius: 12px;
            border: 1px solid rgba(240, 215, 138, 0.3);
        }
        .data-item strong { color: #f0d78a; display: block; margin-bottom: 5px; }
        .data-item span { color: #eee; font-size: 1.2rem; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        th {
            background: rgba(240, 215, 138, 0.2);
            color: #f0d78a;
            font-weight: 600;
        }
        tr:hover { background: rgba(240, 215, 138, 0.05); }
        .export-section {
            background: rgba(41, 128, 185, 0.2);
            padding: 20px;
            border-radius: 12px;
            margin-top: 20px;
            border: 1px solid rgba(41, 128, 185, 0.4);
        }
        .status { 
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
        }
        .status.success { background: #10b981; color: white; }
        .status.warning { background: #f59e0b; color: white; }
        .status.error { background: #ef4444; color: white; }
        @media print {
            .btn, .export-section { display: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${t.companyData.name||"FuelPro"}</h1>
            <p>Standalone Business Management System - Exported ${new Date().toLocaleDateString()}</p>
        </div>

        <div class="notice">
            <h3>Standalone Version Information</h3>
            <ul>
                <li><strong>Status:</strong> This is a fully functional offline version</li>
                <li><strong>Data Storage:</strong> All data is stored locally in your browser</li>
                <li><strong>Limitations:</strong> M-PESA payments, AI Assistant, and cloud sync are disabled</li>
                <li><strong>Compatibility:</strong> Works on any modern web browser</li>
                <li><strong>Export Date:</strong> ${new Date().toLocaleString()}</li>
            </ul>
        </div>

        <div class="card">
            <h2>Business Summary</h2>
            <div class="data-grid">
                <div class="data-item">
                    <strong>Deliveries</strong>
                    <span>${S.deliveries}</span>
                </div>
                <div class="data-item">
                    <strong>Clients</strong>
                    <span>${S.clients}</span>
                </div>
                <div class="data-item">
                    <strong>Invoices</strong>
                    <span>${S.invoices}</span>
                </div>
                <div class="data-item">
                    <strong>Sales Records</strong>
                    <span>${S.salesRecords}</span>
                </div>
                <div class="data-item">
                    <strong>PMS Pumps</strong>
                    <span>${S.pmsPumps}</span>
                </div>
                <div class="data-item">
                    <strong>AGO Pumps</strong>
                    <span>${S.agoPumps}</span>
                </div>
                <div class="data-item">
                    <strong>Employees</strong>
                    <span>${S.employees}</span>
                </div>
                <div class="data-item">
                    <strong>Expenses</strong>
                    <span>${S.expenses}</span>
                </div>
            </div>
        </div>

        <div class="card">
            <h2>Delivery Data</h2>
            ${t.deliveryData.rows.length>0?`
            <div style="overflow-x: auto;">
                <table>
                    <thead>
                        <tr>
                            ${t.deliveryData.columns.map(k=>`<th>${k.label}</th>`).join("")}
                        </tr>
                    </thead>
                    <tbody>
                        ${t.deliveryData.rows.slice(0,50).map(k=>`
                            <tr>
                                ${t.deliveryData.columns.map(N=>`<td>${k[N.key]||"-"}</td>`).join("")}
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
                ${t.deliveryData.rows.length>50?`<p style="margin-top: 10px; color: #f0d78a;">Showing 50 of ${t.deliveryData.rows.length} deliveries</p>`:""}
            </div>
            `:'<p style="color: #999;">No delivery data available</p>'}
        </div>

        <div class="card">
            <h2>Client Database</h2>
            ${Object.keys(t.clients).length>0?`
            <div class="data-grid">
                ${Object.entries(t.clients).slice(0,20).map(([k,N])=>`
                    <div class="data-item">
                        <strong>${N.name}</strong>
                        <span style="font-size: 0.9rem; color: #999;">${N.contact||"No contact"}</span>
                    </div>
                `).join("")}
            </div>
            ${Object.keys(t.clients).length>20?`<p style="margin-top: 10px; color: #f0d78a;">Showing 20 of ${Object.keys(t.clients).length} clients</p>`:""}
            `:'<p style="color: #999;">No clients registered</p>'}
        </div>

        <div class="export-section">
            <h3 style="color: #60a5fa; margin-bottom: 15px;">Export Your Data</h3>
            <button class="btn" onclick="exportAsJSON()">Download JSON</button>
            <button class="btn" onclick="exportAsCSV()">Download CSV</button>
            <button class="btn" onclick="window.print()">Print Report</button>
        </div>

        <div class="card" style="margin-top: 30px; background: rgba(240, 215, 138, 0.1);">
            <h2>Technical Details</h2>
            <div class="data-grid">
                <div class="data-item">
                    <strong>Version</strong>
                    <span>2.0 Standalone</span>
                </div>
                <div class="data-item">
                    <strong>Data Size</strong>
                    <span>${B()} KB</span>
                </div>
                <div class="data-item">
                    <strong>Export Date</strong>
                    <span>${new Date().toLocaleDateString()}</span>
                </div>
                <div class="data-item">
                    <strong>Theme</strong>
                    <span>${t.theme||"Dark"}</span>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Embedded app data
        const appData = ${JSON.stringify(t,null,2)};
        
        // Store data in localStorage for persistence
        localStorage.setItem('fuelpro_standalone_data', JSON.stringify(appData));
        
        function exportAsJSON() {
            const dataStr = JSON.stringify(appData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'FuelPro_Data_${o}.json';
            a.click();
            URL.revokeObjectURL(url);
        }
        
        function exportAsCSV() {
            if (!appData.deliveryData || !appData.deliveryData.rows.length) {
                import('@/react-app/lib/toast').then(({toastWarning}) => toastWarning('No delivery data to export'));
                return;
            }
            
            const headers = appData.deliveryData.columns.map(col => col.label).join(',');
            const rows = appData.deliveryData.rows.map(row => 
                appData.deliveryData.columns.map(col => {
                    const value = row[col.key] || '';
                    return typeof value === 'string' && value.includes(',') ? '"' + value + '"' : value;
                }).join(',')
            ).join('\\n');
            
            const csvContent = headers + '\\n' + rows;
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'FuelPro_Deliveries_${o}.csv';
            a.click();
            URL.revokeObjectURL(url);
        }
        
        console.log('FuelPro Standalone Version Loaded');
        console.log('Data Records:', {
            deliveries: appData.deliveryData?.rows?.length || 0,
            clients: Object.keys(appData.clients || {}).length,
            invoices: Object.keys(appData.invoices || {}).length
        });
    <\/script>
</body>
</html>`,x=new Blob([f],{type:"text/html;charset=utf-8"}),h=URL.createObjectURL(x),y=document.createElement("a");y.href=h,y.download=`FuelPro_Standalone_${o}.html`,y.style.display="none",document.body.appendChild(y),y.click(),setTimeout(()=>{document.body.removeChild(y),URL.revokeObjectURL(h)},100),alert(`Standalone version downloaded successfully!

Open the HTML file in any browser to use your app offline.`)}catch(o){console.error("Download error:",o),alert("Failed to create standalone version. Please try again.")}},se=async()=>{if(!r)try{await s(),alert("Data synced to cloud successfully!")}catch{alert("Cloud sync failed. Please try again.")}},S=q();return e.jsx("div",{className:"min-h-screen bg-gray-50 dark:bg-gray-900 p-4",children:e.jsxs("div",{className:"max-w-7xl mx-auto space-y-6",children:[e.jsxs("div",{className:"bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-600",children:[e.jsxs("div",{className:"flex items-center justify-between mb-4",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"bg-blue-100 dark:bg-blue-900 p-3 rounded-lg",children:e.jsx(Oe,{className:"text-blue-600 dark:text-blue-400",size:28})}),e.jsxs("div",{children:[e.jsx("h1",{className:"text-2xl font-bold text-gray-800 dark:text-white",children:"Data Management Center"}),e.jsx("p",{className:"text-gray-600 dark:text-gray-300",children:"Backup, restore, and manage your business data"})]})]}),e.jsx("button",{onClick:()=>window.location.hash="#/founder",className:"text-[10px] text-gray-300 hover:text-amber-400 transition-colors flex items-center gap-1 opacity-30 hover:opacity-100",title:"Founder Only",children:"Founder Console"})]}),e.jsx("div",{className:"flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 overflow-x-auto",children:[{id:"overview",label:"Overview",icon:xe},n("canEditFuelPrices")?{id:"pumps",label:"Pump Settings",icon:ne}:null,n("canManageCloud")?{id:"recovery",label:"Recovery",icon:H}:null,n("canManageCloud")?{id:"backup",label:"Backup",icon:Q}:null,n("canManageCloud")?{id:"cloud",label:"Cloud Sync",icon:M}:null,{id:"sync",label:"Cross-Device",icon:be}].filter(Boolean).map(o=>{const f=o.icon;return e.jsxs("button",{onClick:()=>C(o.id),className:`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${u===o.id?"bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm":"text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"}`,children:[e.jsx(f,{size:16}),o.label]},o.id)})})]}),u==="overview"&&e.jsxs("div",{className:"grid grid-cols-1 xl:grid-cols-2 gap-6",children:[e.jsxs("div",{className:"bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-600",children:[e.jsx("h2",{className:"text-xl font-bold text-gray-800 dark:text-white mb-4",children:"Data Summary"}),e.jsx("div",{className:"grid grid-cols-2 gap-4",children:[{label:"Deliveries",value:S.deliveries,color:"blue"},{label:"Clients",value:S.clients,color:"green"},{label:"Invoices",value:S.invoices,color:"yellow"},{label:"Sales Records",value:S.salesRecords,color:"purple"},{label:"PMS Pumps",value:S.pmsPumps,color:"red"},{label:"AGO Pumps",value:S.agoPumps,color:"indigo"},{label:"Employees",value:S.employees,color:"pink"},{label:"Offloading Records",value:S.offloadingRecords,color:"gray"}].map(o=>e.jsxs("div",{className:`bg-${o.color}-50 dark:bg-${o.color}-900/20 p-4 rounded-lg border border-${o.color}-200 dark:border-${o.color}-700`,children:[e.jsx("div",{className:`text-2xl font-bold text-${o.color}-600 dark:text-${o.color}-400`,children:Re(o.value,0)}),e.jsx("div",{className:"text-sm text-gray-600 dark:text-gray-400",children:o.label})]},o.label))}),e.jsxs("div",{className:"mt-6 pt-4 border-t border-gray-200 dark:border-gray-600",children:[e.jsxs("div",{className:"flex justify-between items-center",children:[e.jsx("span",{className:"text-gray-600 dark:text-gray-400",children:"Total Data Size:"}),e.jsxs("span",{className:"font-semibold text-gray-800 dark:text-white",children:[B()," KB"]})]}),e.jsxs("div",{className:"flex justify-between items-center mt-2",children:[e.jsx("span",{className:"text-gray-600 dark:text-gray-400",children:"Company:"}),e.jsx("span",{className:"font-semibold text-gray-800 dark:text-white",children:t.companyData.name||"Not Set"})]}),e.jsxs("div",{className:"flex justify-between items-center mt-2",children:[e.jsx("span",{className:"text-gray-600 dark:text-gray-400",children:"Theme:"}),e.jsx("span",{className:"font-semibold text-gray-800 dark:text-white capitalize",children:t.theme})]})]})]}),e.jsxs("div",{className:"bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-600",children:[e.jsx("h2",{className:"text-xl font-bold text-gray-800 dark:text-white mb-4",children:"Quick Actions"}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("button",{onClick:R,className:"w-full btn bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 flex items-center gap-3",children:[e.jsx(T,{size:16}),"Download Standalone Website"]}),e.jsxs("button",{onClick:()=>i("json"),className:"w-full btn btn-primary flex items-center gap-3",children:[e.jsx(T,{size:16}),"Export Complete Backup"]}),e.jsxs("button",{onClick:()=>i("csv"),className:"w-full btn btn-secondary flex items-center gap-3",children:[e.jsx(T,{size:16}),"Export Delivery Data (CSV)"]}),e.jsxs("label",{className:"w-full btn btn-outline flex items-center gap-3 cursor-pointer",children:[e.jsx(W,{size:16}),"Import Data",e.jsx("input",{ref:c,type:"file",accept:".json",onChange:E,className:"hidden"})]}),b&&e.jsx("div",{className:`p-3 rounded-lg text-sm ${b.includes("✅")?"bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200":b.includes("❌")?"bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200":"bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200"}`,children:b}),e.jsxs("button",{onClick:se,disabled:r,className:"w-full btn btn-secondary flex items-center gap-3",children:[e.jsx(M,{className:r?"animate-pulse":"",size:16}),r?"Syncing...":"Sync to Cloud"]})]}),e.jsxs("div",{className:"mt-6 pt-4 border-t border-gray-200 dark:border-gray-600",children:[e.jsx("h3",{className:"font-semibold text-gray-800 dark:text-white mb-2",children:"Danger Zone"}),e.jsxs("button",{onClick:j,className:"w-full btn btn-outline text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3",children:[e.jsx(ye,{size:16}),"Clear All Data"]})]})]})]}),u==="pumps"&&e.jsxs("div",{className:"space-y-6",children:[!g&&e.jsxs("div",{className:"bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-center gap-2",children:[e.jsx(Ie,{size:14,className:"text-amber-500"}),e.jsxs("p",{className:"text-xs text-amber-700 dark:text-amber-300",children:["You have ",e.jsx("strong",{children:"Member"})," access. Changes are tracked. Some settings require Founder approval."]})]}),e.jsxs("div",{className:"bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-600",children:[e.jsxs("h3",{className:"text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2",children:[e.jsx($e,{size:18,className:"text-green-500"}),"Pump Prices (per Litre)"]}),e.jsx("div",{className:"grid grid-cols-1 sm:grid-cols-3 gap-4",children:[{label:"PMS (Petrol)",value:v,setter:I,color:"red",key:"pms"},{label:"AGO (Diesel)",value:_,setter:P,color:"blue",key:"ago"}].map(o=>e.jsxs("div",{className:`p-4 bg-${o.color}-50 dark:bg-${o.color}-900/20 rounded-lg border border-${o.color}-200 dark:border-${o.color}-700`,children:[e.jsx("label",{className:"text-xs text-gray-500 dark:text-gray-400 block mb-2",children:o.label}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"text-sm text-gray-500",children:"Ksh"}),e.jsx("input",{type:"number",step:"0.01",value:o.value,onChange:f=>o.setter(parseFloat(f.target.value)||0),className:"flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-green-500 outline-none"})]})]},o.key))}),e.jsxs("button",{onClick:()=>{a({type:"SET_PRICES",payload:{pmsPrice:v,agoPrice:_}}),alert(`Pump prices updated:
PMS: Ksh ${v.toFixed(2)}
AGO: Ksh ${_.toFixed(2)}`)},className:"mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",children:[e.jsx(Q,{size:14})," Save Prices"]})]}),n("canChangePumpCount")&&e.jsxs("div",{className:"bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-600",children:[e.jsxs("h3",{className:"text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2",children:[e.jsx(ne,{size:18,className:"text-blue-500"}),"Number of Pumps"]}),e.jsx("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-4",children:[{label:"PMS Pumps",value:A,setter:D,color:"red"},{label:"AGO Pumps",value:z,setter:Y,color:"blue"}].map(o=>e.jsxs("div",{className:`p-4 bg-${o.color}-50 dark:bg-${o.color}-900/20 rounded-lg border border-${o.color}-200 dark:border-${o.color}-700`,children:[e.jsx("label",{className:"text-xs text-gray-500 dark:text-gray-400 block mb-2",children:o.label}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("button",{onClick:()=>o.setter(Math.max(0,o.value-1)),className:"p-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors",children:e.jsx(ze,{size:14})}),e.jsx("span",{className:"text-2xl font-bold text-gray-900 dark:text-white w-12 text-center",children:o.value}),e.jsx("button",{onClick:()=>o.setter(o.value+1),className:"p-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors",children:e.jsx(Le,{size:14})})]})]},o.label))}),e.jsxs("button",{onClick:()=>{const o=(h,y)=>({id:h,name:y,openingKsh:0,closingKsh:0,openingL:0,closingL:0,salesL:0,salesKsh:0}),f=Array.from({length:A},(h,y)=>t.pmsPumps[y]||o(`pms-${y+1}`,`PMS Pump ${y+1}`)),x=Array.from({length:z},(h,y)=>t.agoPumps[y]||o(`ago-${y+1}`,`AGO Pump ${y+1}`));a({type:"SET_PMS_PUMPS",payload:f}),a({type:"SET_AGO_PUMPS",payload:x}),alert(`Pump count updated:
PMS: ${A} pumps
AGO: ${z} pumps`)},className:"mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",children:[e.jsx(Q,{size:14})," Save Pump Count"]})]}),e.jsxs("div",{className:"bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-600",children:[e.jsxs("h3",{className:"text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2",children:[e.jsx(Te,{size:18,className:"text-gray-500"}),"Your Access Level"]}),e.jsx("div",{className:"space-y-2",children:[{label:"Edit Pump Prices",allowed:n("canEditFuelPrices")},{label:"Change Pump Count",allowed:n("canChangePumpCount")},{label:"Edit Fuel Prices",allowed:n("canEditFuelPrices")},{label:"Manage Inventory",allowed:n("canManageInventory")},{label:"Edit Employees",allowed:n("canManageEmployees")},{label:"Run Payroll",allowed:n("canRunPayroll")},{label:"Export Data",allowed:n("canExportReports")},{label:"Backup & Restore",allowed:n("canManageCloud")},{label:"Cloud Sync",allowed:n("canManageCloud")},{label:"Founder Access",allowed:g}].map(o=>e.jsxs("div",{className:"flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded-lg",children:[e.jsx("span",{className:"text-xs text-gray-700 dark:text-gray-300",children:o.label}),e.jsx("span",{className:`text-[10px] px-2 py-0.5 rounded-full font-medium ${o.allowed?"bg-green-100 text-green-700":"bg-red-100 text-red-700"}`,children:o.allowed?"Allowed":"Restricted"})]},o.label))})]})]}),u==="recovery"&&e.jsx(Fe,{}),u==="backup"&&e.jsxs("div",{className:"bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-600",children:[e.jsx("h2",{className:"text-xl font-bold text-gray-800 dark:text-white mb-4",children:"Backup Management"}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-6",children:[e.jsxs("div",{className:"space-y-4",children:[e.jsx("h3",{className:"font-semibold text-gray-800 dark:text-white",children:"Local Backups"}),e.jsx("p",{className:"text-gray-600 dark:text-gray-400 text-sm",children:"Create and manage local backup files that you can store on your device or cloud storage."}),e.jsxs("div",{className:"space-y-3",children:[e.jsxs("button",{onClick:()=>i("json"),className:"w-full btn btn-primary flex items-center gap-3",children:[e.jsx(T,{size:16}),"Create Full Backup"]}),e.jsxs("button",{onClick:()=>{const o=new Date().toISOString().replace(/[:.]/g,"-"),f={version:"2.0",type:"settings_only",exported:new Date().toISOString(),data:{theme:t.theme,themeSettings:t.themeSettings,userPreferences:t.userPreferences,companyData:t.companyData,tabConfigurations:t.tabConfigurations}},x=JSON.stringify(f,null,2),h=new Blob([x],{type:"application/json"}),y=URL.createObjectURL(h),k=document.createElement("a");k.href=y,k.download=`FuelPro_Settings_${o}.json`,k.click(),URL.revokeObjectURL(y),alert("Settings backup created!")},className:"w-full btn btn-secondary flex items-center gap-3",children:[e.jsx(me,{size:16}),"Backup Settings Only"]})]})]}),e.jsxs("div",{className:"space-y-4",children:[e.jsx("h3",{className:"font-semibold text-gray-800 dark:text-white",children:"Restore Options"}),e.jsx("p",{className:"text-gray-600 dark:text-gray-400 text-sm",children:"Import data from backup files to restore your application state."}),e.jsxs("label",{className:"w-full btn btn-outline flex items-center gap-3 cursor-pointer",children:[e.jsx(W,{size:16}),"Restore from File",e.jsx("input",{type:"file",accept:".json",onChange:E,className:"hidden"})]}),b&&e.jsx("div",{className:`p-3 rounded-lg text-sm ${b.includes("✅")?"bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200":b.includes("❌")?"bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200":"bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200"}`,children:b})]})]})]}),u==="cloud"&&e.jsxs("div",{className:"space-y-6",children:[e.jsx(Me,{}),e.jsxs("div",{className:"bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-600",children:[e.jsx("h2",{className:"text-xl font-bold text-gray-800 dark:text-white mb-4",children:"Local Cloud Sync"}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-6",children:[e.jsxs("div",{className:"space-y-4",children:[e.jsx("h3",{className:"font-semibold text-gray-800 dark:text-white",children:"Sync Status"}),e.jsxs("div",{className:"bg-gray-50 dark:bg-gray-700 rounded-lg p-4",children:[e.jsxs("div",{className:"flex items-center gap-3 mb-3",children:[e.jsx(M,{className:r?"animate-pulse text-blue-500":"text-green-500",size:20}),e.jsx("span",{className:"font-medium text-gray-800 dark:text-white",children:r?"Syncing...":"Connected"})]}),e.jsxs("div",{className:"space-y-2 text-sm text-gray-600 dark:text-gray-400",children:[e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{children:"Last Sync:"}),e.jsx("span",{children:d?d.toLocaleString():"Never"})]}),e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{children:"Auto Sync:"}),e.jsx("span",{className:"text-green-600 dark:text-green-400",children:"Enabled"})]}),e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{children:"Data Size:"}),e.jsxs("span",{children:[B()," KB"]})]})]})]})]}),e.jsxs("div",{className:"space-y-4",children:[e.jsx("h3",{className:"font-semibold text-gray-800 dark:text-white",children:"Manual Actions"}),e.jsxs("div",{className:"space-y-3",children:[e.jsxs("button",{onClick:se,disabled:r,className:"w-full btn btn-primary flex items-center gap-3",children:[e.jsx(M,{className:r?"animate-pulse":"",size:16}),r?"Syncing...":"Force Sync Now"]}),e.jsxs("button",{onClick:async()=>{try{await l(),alert("Data loaded from cloud successfully!")}catch{alert("Failed to load from cloud. Using local data.")}},className:"w-full btn btn-secondary flex items-center gap-3",children:[e.jsx(H,{size:16}),"Load from Cloud"]})]})]})]}),e.jsxs("div",{className:"mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4",children:[e.jsxs("h4",{className:"font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2",children:[e.jsx(fe,{size:16}),"Cloud Sync Features"]}),e.jsxs("ul",{className:"text-sm text-blue-700 dark:text-blue-300 space-y-1",children:[e.jsx("li",{children:"• Automatic backup every 30 seconds when data changes"}),e.jsx("li",{children:"• Real-time sync across all your devices"}),e.jsx("li",{children:"• Secure encrypted storage in the cloud"}),e.jsx("li",{children:"• Automatic conflict resolution"}),e.jsx("li",{children:"• Data recovery from cloud backups"})]})]})]})]}),u==="sync"&&e.jsx(Ge,{})]})})}export{st as default};
