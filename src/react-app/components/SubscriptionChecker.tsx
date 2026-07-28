import { type ReactNode } from "react";

interface SubscriptionCheckerProps {
  children: ReactNode;
}

/**
 * Subscription checker component - currently disabled
 * All users have full access to all features
 */
export default function SubscriptionChecker({
  children,
}: SubscriptionCheckerProps) {
  return <>{children}</>;
}
