/// <reference types="vite/client" />

// Global reload guard injected by index.html — all reload paths go through
// this to prevent infinite refresh loops.
interface Window {
  __fuelproSafeReload?: (reason: string) => boolean;
  __BUILD_VERSION__?: string;
}

interface ImportMetaEnv {
  readonly VITE_CLOUDFLARE_ACCOUNT_ID: string;
  // R2 public configuration only - secrets must be server-side
  readonly VITE_R2_BUCKET_NAME: string;
  readonly VITE_R2_PUBLIC_URL: string;
  // Upstash public configuration only - token must be server-side
  readonly VITE_UPSTASH_REDIS_REST_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_API_URL: string;
  // AI/API keys for client-side features (public or rate-limited)
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_POSTHOG_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
