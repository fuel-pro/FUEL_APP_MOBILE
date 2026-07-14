// FuelProProvider — unified context wrapper for Geo + Store + TRPC
// Wraps the entire app with location context, cross-tab sync, and global state

import { ReactNode } from "react";
import { GeoProvider } from "@/react-app/hooks/useGeo";
import { useFuelStoreSync } from "@/react-app/hooks/useFuelStore";

function StoreSyncWrapper({ children }: { children: ReactNode }) {
  useFuelStoreSync();
  return <>{children}</>;
}

export function FuelProProvider({ children }: { children: ReactNode }) {
  return (
    <GeoProvider>
      <StoreSyncWrapper>{children}</StoreSyncWrapper>
    </GeoProvider>
  );
}
