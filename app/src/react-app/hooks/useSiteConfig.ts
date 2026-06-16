/**
 * useSiteConfig - Hook for fetching dynamic site configuration
 * Enables instant config changes without code redeployment
 */
import { trpc } from "@/providers/trpc";
import { useState, useEffect } from "react";

export interface SiteConfig {
  key: string;
  value: any;
  type: "string" | "number" | "boolean" | "json";
  category: string;
  description?: string;
  isPublic: boolean;
  updatedAt: Date;
}

export interface ConfigSnapshot {
  version: string;
  name: string;
  description?: string;
  status: "draft" | "published" | "archived";
  createdAt: Date;
  publishedAt?: Date;
  restoredConfigs?: number;
}

const CONFIG_CACHE_KEY = "fuelpro_site_config_cache";
const CACHE_TTL = 5000; // 5 seconds for near-instant updates

export function useSiteConfig() {
  const [isConfigured, setIsConfigured] = useState(false);
  
  // Query all configs
  const { data: configs, refetch: refetchConfigs } = trpc.siteConfig.list.useQuery(undefined, {
    enabled: false, // Only fetch when explicitly requested
  });

  // Get all configs as key-value pairs
  const { data: allConfigs, refetch: refetchAllConfigs } = trpc.siteConfig.getAll.useQuery(undefined, {
    enabled: false,
  });

  // List version history
  const { data: versions, refetch: refetchVersions } = trpc.siteConfig.listVersions.useQuery(undefined, {
    enabled: false,
  });

  // Upsert config mutation
  const upsertConfig = trpc.siteConfig.upsert.useMutation();
  
  // Delete config mutation
  const deleteConfig = trpc.siteConfig.delete.useMutation();

  // Publish snapshot mutation
  const publishSnapshot = trpc.siteConfig.publishSnapshot.useMutation({
    onSuccess: () => {
      refetchVersions();
    },
  });

  // Restore version mutation
  const restoreVersion = trpc.siteConfig.restoreVersion.useMutation({
    onSuccess: () => {
      refetchAllConfigs();
    },
  });

  // List deployments (Vercel)
  const { data: deployments, refetch: refetchDeployments } = trpc.vercel.listDeployments.useQuery(undefined, {
    enabled: false,
  });

  // Rollback mutation (Vercel)
  const rollbackDeployment = trpc.vercel.rollback.useMutation();

  // Get production deployment info
  const { data: production, refetch: refetchProduction } = trpc.vercel.getProduction.useQuery(undefined, {
    enabled: false,
  });

  // Check if config has been set up
  useEffect(() => {
    const cache = localStorage.getItem(CONFIG_CACHE_KEY);
    if (cache) {
      try {
        const parsed = JSON.parse(cache);
        if (Date.now() - parsed.timestamp < CACHE_TTL) {
          setIsConfigured(true);
        }
      } catch {}
    }
  }, []);

  // Update cache on config change
  useEffect(() => {
    if (allConfigs && Object.keys(allConfigs).length > 0) {
      localStorage.setItem(
        CONFIG_CACHE_KEY,
        JSON.stringify({ configs: allConfigs, timestamp: Date.now() })
      );
      setIsConfigured(true);
    }
  }, [allConfigs]);

  return {
    // State
    isConfigured,
    configs: configs || [],
    allConfigs: allConfigs || {},
    versions: versions || [],
    deployments: deployments?.deployments || [],
    deploymentsConfigured: deployments?.configured ?? false,
    deploymentsError: deployments?.error,
    production: production || {},
    
    // Actions
    refetchConfigs: () => refetchConfigs(),
    refetchAllConfigs: () => refetchAllConfigs(),
    refetchVersions: () => refetchVersions(),
    refetchDeployments: () => refetchDeployments(),
    refetchProduction: () => refetchProduction(),
    
    // Config mutations
    upsertConfig: async (config: {
      key: string;
      value: string;
      type?: "string" | "number" | "boolean" | "json";
      category?: string;
      description?: string;
      isPublic?: boolean;
    }) => {
      const result = await upsertConfig.mutateAsync(config);
      refetchAllConfigs();
      return result;
    },
    deleteConfig: async (key: string) => {
      const result = await deleteConfig.mutateAsync({ key });
      refetchAllConfigs();
      return result;
    },
    
    // Version control mutations
    publishSnapshot: async (name: string, description?: string) => {
      return publishSnapshot.mutateAsync({ name, description });
    },
    restoreVersion: async (version: string) => {
      return restoreVersion.mutateAsync({ version });
    },
    
    // Vercel mutations
    rollbackDeployment: async (deploymentId: string) => {
      return rollbackDeployment.mutateAsync({ deploymentId });
    },
  };
}

/**
 * Get a specific config value with optional default
 */
export function useConfigValue(key: string, defaultValue: any = null) {
  const { allConfigs, refetchAllConfigs } = useSiteConfig();
  
  useEffect(() => {
    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      refetchAllConfigs();
    }, 5000);
    return () => clearInterval(interval);
  }, [refetchAllConfigs]);

  return allConfigs[key] ?? defaultValue;
}
