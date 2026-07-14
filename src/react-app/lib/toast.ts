/**
 * Toast Notification System — replaces all blocking alert() calls
 * with non-blocking toast notifications.
 */

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  createdAt: number;
}

let toastContainer: HTMLDivElement | null = null;
let toasts: ToastMessage[] = [];
let listeners: ((toasts: ToastMessage[]) => void)[] = [];

function notifyListeners() {
  listeners.forEach(l => l([...toasts]));
}

function getContainer(): HTMLDivElement {
  if (toastContainer) return toastContainer;
  const div = document.createElement("div");
  div.id = "fuelpro-toast-container";
  div.style.cssText =
    "position:fixed;top:16px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:380px;pointer-events:none;";
  document.body.appendChild(div);
  toastContainer = div;
  return div;
}

function renderToast(t: ToastMessage): HTMLDivElement {
  const el = document.createElement("div");
  el.id = `toast-${t.id}`;
  el.style.cssText =
    "pointer-events:auto;padding:12px 16px;border-radius:10px;font-size:13px;font-weight:500;display:flex;align-items:center;gap:10px;animation:toastSlideIn 0.3s ease;box-shadow:0 4px 20px rgba(0,0,0,0.3);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.08);";

  const colors: Record<ToastType, string> = {
    success: "background:rgba(16,185,129,0.15);color:#34d399;",
    error: "background:rgba(239,68,68,0.15);color:#f87171;",
    warning: "background:rgba(245,158,11,0.15);color:#fbbf24;",
    info: "background:rgba(99,102,241,0.15);color:#818cf8;",
  };
  el.style.cssText += colors[t.type];

  const icons: Record<ToastType, string> = {
    success: "&#10003;",
    error: "&#10007;",
    warning: "&#9888;",
    info: "&#9432;",
  };
  el.innerHTML = `<span style="font-size:16px;flex-shrink:0">${icons[t.type]}</span><span style="flex:1">${t.message}</span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:inherit;cursor:pointer;font-size:14px;padding:0;margin-left:4px;opacity:0.6">&times;</button>`;
  return el;
}

// Inject CSS animation
const style = document.createElement("style");
style.textContent = `
  @keyframes toastSlideIn { from { transform:translateX(120%);opacity:0 } to { transform:translateX(0);opacity:1 } }
  @keyframes toastSlideOut { from { transform:translateX(0);opacity:1 } to { transform:translateX(120%);opacity:0 } }
`;
document.head.appendChild(style);

/** Show a toast notification (non-blocking, replaces alert) */
export function toast(
  message: string,
  type: ToastType = "info",
  duration = 3000
): void {
  const container = getContainer();
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const t: ToastMessage = {
    id,
    message,
    type,
    duration,
    createdAt: Date.now(),
  };
  toasts.push(t);
  notifyListeners();

  const el = renderToast(t);
  container.appendChild(el);

  // Auto-dismiss
  setTimeout(() => {
    el.style.animation = "toastSlideOut 0.3s ease forwards";
    setTimeout(() => {
      el.remove();
      toasts = toasts.filter(x => x.id !== id);
      notifyListeners();
    }, 300);
  }, duration);
}

/** Convenience methods */
export const toastSuccess = (msg: string, dur?: number) =>
  toast(msg, "success", dur);
export const toastError = (msg: string, dur?: number) =>
  toast(msg, "error", dur);
export const toastWarning = (msg: string, dur?: number) =>
  toast(msg, "warning", dur);
export const toastInfo = (msg: string, dur?: number) => toast(msg, "info", dur);

/** Subscribe to toast changes (for React components) */
export function subscribeToToasts(
  cb: (toasts: ToastMessage[]) => void
): () => void {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter(l => l !== cb);
  };
}
