import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "logo-main.jpg", "logo-small.jpg", "*.svg"],
      manifest: {
        name: "FuelPro - Fuel Management System",
        short_name: "FuelPro",
        description: "Complete fuel station management, sales tracking, EPRA compliance, and real-time analytics",
        theme_color: "#f59e0b",
        background_color: "#0a0a0f",
        display: "standalone",
        orientation: "any",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/logo-main.jpg",
            sizes: "192x192",
            type: "image/jpeg",
            purpose: "any maskable",
          },
          {
            src: "/logo-small.jpg",
            sizes: "512x512",
            type: "image/jpeg",
            purpose: "any maskable",
          },
        ],
        categories: ["business", "productivity", "finance"],
        shortcuts: [
          {
            name: "Dashboard",
            short_name: "Dashboard",
            description: "View station dashboard",
            url: "/#/?tab=dashboard",
          },
          {
            name: "Point of Sale",
            short_name: "POS",
            description: "Quick fuel sales",
            url: "/#/?tab=pos",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,woff,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/ojjscjwatikixlpshmub\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
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
