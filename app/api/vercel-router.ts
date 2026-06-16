import { z } from "zod";
import { createRouter, adminQuery } from "./middleware";

// Vercel API integration for deployment management
export const vercelRouter = createRouter({
  // List recent deployments
  listDeployments: adminQuery.query(async () => {
    const projectId = process.env.VERCEL_PROJECT_ID;
    const token = process.env.VERCEL_API_TOKEN;
    
    if (!token || !projectId) {
      return { 
        error: "Vercel API not configured",
        deployments: [],
        configured: false 
      };
    }

    try {
      const response = await fetch(
        `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=10`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          next: { revalidate: 0 },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return { 
          error: `Vercel API error: ${response.status}`,
          deployments: [],
          configured: true,
        };
      }

      const data = await response.json();
      return {
        configured: true,
        deployments: (data.deployments || []).map((d: any) => ({
          id: d.uid,
          url: d.url,
          name: d.name,
          status: d.state,
          createdAt: d.createdAt,
          ready: d.ready,
          target: d.target,
          meta: d.meta,
        })),
      };
    } catch (error) {
      return { 
        error: "Failed to fetch deployments",
        deployments: [],
        configured: true,
      };
    }
  }),

  // Get deployment details
  getDeployment: adminQuery
    .input(z.object({ deploymentId: z.string() }))
    .query(async ({ input }) => {
      const token = process.env.VERCEL_API_TOKEN;
      
      if (!token) {
        return { error: "Vercel API not configured" };
      }

      try {
        const response = await fetch(
          `https://api.vercel.com/v6/deployments/${input.deploymentId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          return { error: `Deployment not found: ${response.status}` };
        }

        const data = await response.json();
        return {
          id: data.uid,
          url: data.url,
          name: data.name,
          status: data.state,
          createdAt: data.createdAt,
          ready: data.ready,
          target: data.target,
          meta: data.meta,
          inspections: data.inspections,
          functions: data.functions,
        };
      } catch (error) {
        return { error: "Failed to fetch deployment details" };
      }
    }),

  // Trigger rollback to a specific deployment
  rollback: adminQuery
    .input(z.object({ deploymentId: z.string() }))
    .mutation(async ({ input }) => {
      const projectId = process.env.VERCEL_PROJECT_ID;
      const token = process.env.VERCEL_API_TOKEN;
      
      if (!token || !projectId) {
        return { 
          success: false, 
          error: "Vercel API not configured. Set VERCEL_API_TOKEN and VERCEL_PROJECT_ID environment variables." 
        };
      }

      try {
        // First, get the deployment to verify it exists
        const deployResponse = await fetch(
          `https://api.vercel.com/v6/deployments/${input.deploymentId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!deployResponse.ok) {
          return { success: false, error: "Deployment not found" };
        }

        // Trigger the rollback
        const response = await fetch(
          `https://api.vercel.com/v1/projects/${projectId}/rollback/${input.deploymentId}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          return { 
            success: true, 
            message: "Rollback initiated successfully",
            jobId: data.jobId,
          };
        } else {
          const errorData = await response.json();
          return { 
            success: false, 
            error: errorData.error?.message || "Failed to initiate rollback" 
          };
        }
      } catch (error) {
        return { 
          success: false, 
          error: "Failed to connect to Vercel API" 
        };
      }
    }),

  // Get current production deployment
  getProduction: adminQuery.query(async () => {
    const projectId = process.env.VERCEL_PROJECT_ID;
    const token = process.env.VERCEL_API_TOKEN;
    
    if (!token || !projectId) {
      return { configured: false };
    }

    try {
      const response = await fetch(
        `https://api.vercel.com/v6/projects/${projectId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return { configured: true, error: "Failed to fetch project" };
      }

      const data = await response.json();
      return {
        configured: true,
        productionDeploymentId: data.targetConfiguration?.productionDeployment,
        projectId: data.id,
        name: data.name,
      };
    } catch (error) {
      return { configured: true, error: "Failed to fetch project" };
    }
  }),
});

// Helper to check if Vercel is configured
export async function isVercelConfigured(): Promise<boolean> {
  return !!(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID);
}
