import { type ReactNode } from "react";

interface SubscriptionCheckerProps {
  children: ReactNode;
}

export default function SubscriptionChecker({
  children,
}: SubscriptionCheckerProps) {
  // Subscription checking disabled - all users have full access
  return <>{children}</>;
}
