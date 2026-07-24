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
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppRouter = Record<string, any>;

export type RouterTypes = {
  [K in keyof AppRouter]: AppRouter[K] extends { _output: infer T } ? T : never;
};
