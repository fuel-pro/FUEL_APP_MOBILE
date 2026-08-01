/**
 * App Router Type Definition
 * 
 * This is a stub file for static Vercel deployments.
 * Primary cloud storage is now Firebase Firestore.
 * 
 * Optional REST API backend can be configured via VITE_BACKEND_URL.
 * If not configured, the app uses Firebase-only mode with local storage fallback.
 * 
 * For TypeScript to compile without the actual backend, we define a minimal
 * type structure that matches what the frontend expects.
 * 
 * Since tRPC requires specific types, we use 'any' as a fallback for static builds.
 * This allows the app to compile while using Firebase as the primary data source.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRouter = {
  _def: any;
  _output: any;
  createCaller: any;
  [key: string]: any;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppRouter = AnyRouter;

export type RouterTypes = {
  [K in keyof AppRouter]: AppRouter[K] extends { _output: infer T } ? T : never;
};

// Stub for when backend is not available - allows Firebase-only mode
export const isBackendConfigured = false;
