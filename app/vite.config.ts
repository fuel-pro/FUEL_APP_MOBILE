import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Only load dev server plugin when not in production build
const plugins = [react()];

// Dynamic import for dev server (ESM-compatible)
if (process.env.NODE_ENV !== "production") {
  try {
    const devServer = await import("@hono/vite-dev-server");
    if (devServer?.default) {
      plugins.unshift(devServer.default({
        entry: "api/boot.ts",
        exclude: [/^\/(?!api\/).*$/],
      }));
    }
  } catch {
    // @hono/vite-dev-server not available during production build
  }
}

export default defineConfig({
  plugins,
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
