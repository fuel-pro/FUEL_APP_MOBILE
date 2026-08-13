import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// NOTE: vite-plugin-pwa was removed. Its workbox-generated sw.js served
// index.html from a precache (cache-first), so users were stuck on old
// builds after deploys. We now ship a custom public/sw.js that is
// NETWORK-FIRST for navigations — a deployed update is visible on the
// very next page load. The PWA manifest is the static public/manifest.json.

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    host: "0.0.0.0",
    port: 5000,
  },
  build: {
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy vendor libraries
          trpc: ["@trpc/react-query", "@trpc/client", "@tanstack/react-query"],
          vendor: ["react", "react-dom", "react-router"],
          // Code split large components to prevent chunk loading failures
          founder: ["./src/react-app/pages/FounderAccess.tsx"],
          admin: ["./src/react-app/components/AdminPanel.tsx"],
          pos: ["./src/react-app/components/PointOfSale.tsx"],
          reports: ["./src/react-app/components/ReportsCenter.tsx"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      db: path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
});
