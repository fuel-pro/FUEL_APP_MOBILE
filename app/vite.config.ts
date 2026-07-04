import path from "path";
const __dirname = import.meta.dirname;
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Only load dev server plugin when not in production build
const plugins = [react()];

try {
  if (process.env.NODE_ENV !== "production") {
    // Only load dev server plugin if available (not during Vercel build)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const devServer = require("@hono/vite-dev-server");
    if (devServer?.default) {
      plugins.unshift(devServer.default({ 
        entry: "api/boot.ts", 
        exclude: [/^\/(?!api\/).*$/] 
      }));
    }
  }
} catch {
  // @hono/vite-dev-server not available during production build
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
