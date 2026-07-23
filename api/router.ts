/**
 * App Router Type Definition
 * 
 * This is a stub file for static Vercel deployments.
 * In production, the actual router is defined on the backend at:
 * https://fuel-pro-backend-v2-production-7c2b.up.railway.app/api/trpc
 * 
 * The frontend uses Vercel rewrites to proxy /api/* requests to the backend.
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
