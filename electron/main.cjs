const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

// Live site URLs (Cloudflare Pages primary, Vercel fallback).
const URLS = [
  "https://fuel-app-mobile.pages.dev/",
  "https://fuel-app-mobile.vercel.app/",
];
const ALLOWED_HOSTS = URLS.map((u) => new URL(u).host);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: "#0a0e17",
    icon: path.join(__dirname, "../public/icon-512.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.setMenuBarVisibility(false);

  // Open external links (supabase, youtube, docs, exports, etc.) in the
  // system browser so the app keeps control of its own window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (ALLOWED_HOSTS.includes(new URL(url).host)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!ALLOWED_HOSTS.includes(new URL(url).host)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Try Cloudflare first, then Vercel, then the bundled offline build.
  const tryLoad = (index) => {
    if (index >= URLS.length) {
      win.loadFile(path.join(__dirname, "../dist/index.html"));
      return;
    }
    win.loadURL(URLS[index]).catch(() => tryLoad(index + 1));
  };
  tryLoad(0);
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
