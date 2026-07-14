import type { ReactNode } from "react";

interface TrialGateProps {
  children: ReactNode;
}

// Trial gate disabled - all users have full access
export default function TrialGate({ children }: TrialGateProps) {
  return <>{children}</>;
}
