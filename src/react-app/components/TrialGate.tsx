import type { ReactNode } from "react";

interface TrialGateProps {
  children: ReactNode;
}

/**
 * Trial gate component - currently disabled
 * All users have full access to all features
 */
export default function TrialGate({ children }: TrialGateProps) {
  return <>{children}</>;
}
