import { z } from "zod";
import { eq, and, desc, sql, isNull, or } from "drizzle-orm";
import { createRouter, authedQuery, adminQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  featureFlags, pricingPlans, subscriptions, coupons,
  systemConfig, apiKeys, webhooks, emailTemplates, backups,
  users, stations, sales, auditLogs, founderSessions,
  userActivityLog, siteConfigs, configVersions,
} from "@db/schema";

// ═══════════════════════════ FEATURE FLAGS ═══════════════════════════

export const featureFlagRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db.select().from(featureFlags).orderBy(desc(featureFlags.updatedAt));
  }),

  get: authedQuery
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [flag] = await db.select().from(featureFlags).where(eq(featureFlags.flagKey, input.key));
      return flag || null;
    }),

  create: adminQuery
    .input(z.object({
      flagKey: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      enabled: z.boolean().default(false),
      scope: z.enum(["global", "station", "user"]).default("global"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [result] = await db.insert(featureFlags).values({
        ...input,
        createdBy: ctx.user.id,
      }).$returningId();
      return { id: result.id, ...input };
    }),

  toggle: adminQuery
    .input(z.object({ id: z.number(), enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(featureFlags).set({ enabled: input.enabled }).where(eq(featureFlags.id, input.id));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(featureFlags).where(eq(featureFlags.id, input.id));
      return { success: true };
    }),
});

// ═══════════════════════════ PRICING & SUBSCRIPTIONS ═══════════════════════════

export const pricingRouter = createRouter({
  listPlans: authedQuery.query(async () => {
    const db = getDb();
    return db.select().from(pricingPlans).where(eq(pricingPlans.isActive, true)).orderBy(pricingPlans.sortOrder);
  }),

  createPlan: adminQuery
    .input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      description: z.string().optional(),
      price: z.string(),
      currency: z.string().default("USD"),
      billingPeriod: z.enum(["monthly", "quarterly", "yearly", "lifetime"]).default("monthly"),
      maxStations: z.number().default(1),
      maxUsers: z.number().default(5),
      features: z.string().optional(), // JSON string
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [result] = await db.insert(pricingPlans).values(input).$returningId();
      return { id: result.id, ...input };
    }),

  updatePlan: adminQuery
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      price: z.string().optional(),
      isActive: z.boolean().optional(),
      maxStations: z.number().optional(),
      maxUsers: z.number().optional(),
      features: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(pricingPlans).set(data).where(eq(pricingPlans.id, id));
      return { success: true };
    }),

  deletePlan: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(pricingPlans).set({ isActive: false }).where(eq(pricingPlans.id, input.id));
      return { success: true };
    }),

  // ─── Subscriptions ───
  listSubscriptions: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt));
  }),

  createSubscription: adminQuery
    .input(z.object({
      userId: z.number(),
      planId: z.number(),
      status: z.enum(["active", "trialing", "past_due", "canceled", "expired"]).default("active"),
      trialEndsAt: z.string().optional(),
      currentPeriodEnd: z.string(),
      paymentMethod: z.string().optional(),
      amountPaid: z.string().default("0"),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(subscriptions).values({
        ...input,
        trialEndsAt: input.trialEndsAt ? new Date(input.trialEndsAt) : undefined,
        currentPeriodEnd: new Date(input.currentPeriodEnd),
      }).$returningId();
      return { id: result.id, ...input };
    }),

  cancelSubscription: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(subscriptions).set({ status: "canceled", cancelAtPeriodEnd: true }).where(eq(subscriptions.id, input.id));
      return { success: true };
    }),

  subscriptionAnalytics: adminQuery.query(async () => {
    const db = getDb();
    const total = await db.select({ count: sql<number>`COUNT(*)` }).from(subscriptions);
    const byStatus = await db.select({
      status: subscriptions.status,
      count: sql<number>`COUNT(*)`,
    }).from(subscriptions).groupBy(subscriptions.status);
    const revenue = await db.select({
      total: sql<string>`COALESCE(SUM(${subscriptions.amountPaid}), 0)`,
    }).from(subscriptions);
    return { total: total[0]?.count || 0, byStatus, revenue: revenue[0]?.total || "0" };
  }),
});

// ═══════════════════════════ COUPONS ═══════════════════════════

export const couponRouter = createRouter({
  list: authedQuery.query(async () => {
    const db = getDb();
    return db.select().from(coupons).orderBy(desc(coupons.createdAt));
  }),

  create: adminQuery
    .input(z.object({
      code: z.string().min(1),
      description: z.string().optional(),
      discountType: z.enum(["percentage", "fixed_amount"]).default("percentage"),
      discountValue: z.string(),
      maxUses: z.number().default(0),
      minOrderAmount: z.string().default("0"),
      validFrom: z.string().optional(),
      validUntil: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [result] = await db.insert(coupons).values({
        code: input.code,
        description: input.description,
        discountType: input.discountType,
        discountValue: input.discountValue,
        maxUses: input.maxUses,
        minOrderAmount: input.minOrderAmount,
        validFrom: input.validFrom ? new Date(input.validFrom) : undefined,
        validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
        createdBy: ctx.user.id,
      }).$returningId();
      return { id: result.id, ...input };
    }),

  toggle: adminQuery
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(coupons).set({ isActive: input.isActive }).where(eq(coupons.id, input.id));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(coupons).where(eq(coupons.id, input.id));
      return { success: true };
    }),
});

// ═══════════════════════════ SYSTEM CONFIG ═══════════════════════════

export const systemConfigRouter = createRouter({
  list: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(systemConfig).orderBy(systemConfig.configGroup, systemConfig.configKey);
  }),

  get: authedQuery
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [cfg] = await db.select().from(systemConfig).where(eq(systemConfig.configKey, input.key));
      return cfg?.configValue || null;
    }),

  getPublic: authedQuery
    .input(z.object({ keys: z.array(z.string()).optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const all = await db.select().from(systemConfig).where(eq(systemConfig.isPublic, true));
      if (input.keys) {
        return all.filter(c => input.keys!.includes(c.configKey));
      }
      return all;
    }),

  set: adminQuery
    .input(z.object({
      configKey: z.string().min(1),
      configValue: z.string(),
      configGroup: z.string().default("general"),
      description: z.string().optional(),
      isPublic: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [existing] = await db.select().from(systemConfig).where(eq(systemConfig.configKey, input.configKey));
      if (existing) {
        await db.update(systemConfig)
          .set({ configValue: input.configValue, updatedBy: ctx.user.id })
          .where(eq(systemConfig.id, existing.id));
        return { id: existing.id, ...input };
      }
      const [result] = await db.insert(systemConfig).values({
        ...input,
        updatedBy: ctx.user.id,
      }).$returningId();
      return { id: result.id, ...input };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(systemConfig).where(eq(systemConfig.id, input.id));
      return { success: true };
    }),
});

// ═══════════════════════════ API KEYS & WEBHOOKS ═══════════════════════════

export const apiKeyRouter = createRouter({
  list: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  }),

  create: adminQuery
    .input(z.object({
      name: z.string().min(1),
      keyHash: z.string().min(1),
      prefix: z.string().min(1),
      permissions: z.string().optional(),
      expiresAt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [result] = await db.insert(apiKeys).values({
        ...input,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        createdBy: ctx.user.id,
      }).$returningId();
      return { id: result.id, ...input };
    }),

  toggle: adminQuery
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(apiKeys).set({ isActive: input.isActive }).where(eq(apiKeys.id, input.id));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(apiKeys).where(eq(apiKeys.id, input.id));
      return { success: true };
    }),
});

export const webhookRouter = createRouter({
  list: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(webhooks).orderBy(desc(webhooks.createdAt));
  }),

  create: adminQuery
    .input(z.object({
      name: z.string().min(1),
      url: z.string().url(),
      events: z.string().optional(),
      secret: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [result] = await db.insert(webhooks).values({ ...input, createdBy: ctx.user.id }).$returningId();
      return { id: result.id, ...input };
    }),

  toggle: adminQuery
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(webhooks).set({ isActive: input.isActive }).where(eq(webhooks.id, input.id));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(webhooks).where(eq(webhooks.id, input.id));
      return { success: true };
    }),
});

// ═══════════════════════════ EMAIL TEMPLATES ═══════════════════════════

export const emailTemplateRouter = createRouter({
  list: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(emailTemplates).orderBy(emailTemplates.templateKey);
  }),

  get: adminQuery
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [tpl] = await db.select().from(emailTemplates).where(eq(emailTemplates.templateKey, input.key));
      return tpl || null;
    }),

  create: adminQuery
    .input(z.object({
      templateKey: z.string().min(1),
      name: z.string().min(1),
      subject: z.string().min(1),
      bodyHtml: z.string().min(1),
      bodyText: z.string().optional(),
      variables: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [result] = await db.insert(emailTemplates).values({
        ...input,
        updatedBy: ctx.user.id,
      }).$returningId();
      return { id: result.id, ...input };
    }),

  update: adminQuery
    .input(z.object({
      id: z.number(),
      subject: z.string().optional(),
      bodyHtml: z.string().optional(),
      bodyText: z.string().optional(),
      variables: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(emailTemplates)
        .set({ ...data, updatedBy: ctx.user.id })
        .where(eq(emailTemplates.id, id));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(emailTemplates).where(eq(emailTemplates.id, input.id));
      return { success: true };
    }),
});

// ═══════════════════════════ USER MANAGEMENT (ADMIN) ═══════════════════════════

export const userManagementRouter = createRouter({
  list: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(users).orderBy(desc(users.createdAt));
  }),

  get: adminQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [user] = await db.select().from(users).where(eq(users.id, input.id));
      return user || null;
    }),

  updateRole: adminQuery
    .input(z.object({ id: z.number(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.id));
      return { success: true };
    }),

  updateStatus: adminQuery
    .input(z.object({ id: z.number(), status: z.enum(["active", "suspended", "banned", "pending"]) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(users).set({ status: input.status }).where(eq(users.id, input.id));
      return { success: true };
    }),

  stats: adminQuery.query(async () => {
    const db = getDb();
    const total = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
    const byRole = await db.select({
      role: users.role,
      count: sql<number>`COUNT(*)`,
    }).from(users).groupBy(users.role);
    const byStatus = await db.select({
      status: users.status,
      count: sql<number>`COUNT(*)`,
    }).from(users).groupBy(users.status);
    const recent = await db.select({ count: sql<number>`COUNT(*)` }).from(users)
      .where(sql`${users.createdAt} > DATE_SUB(NOW(), INTERVAL 7 DAY)`);
    return {
      total: total[0]?.count || 0,
      byRole, byStatus,
      recent7Days: recent[0]?.count || 0,
    };
  }),
});

// ═══════════════════════════ BACKUPS ═══════════════════════════

export const backupRouter = createRouter({
  list: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(backups).orderBy(desc(backups.createdAt));
  }),

  create: adminQuery
    .input(z.object({
      name: z.string().min(1),
      type: z.enum(["full", "schema", "data", "settings"]).default("full"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [result] = await db.insert(backups).values({
        ...input,
        status: "running",
        createdBy: ctx.user.id,
      }).$returningId();
      // Simulate async completion
      setTimeout(async () => {
        await db.update(backups)
          .set({ status: "completed", completedAt: new Date(), size: "2.4 MB" })
          .where(eq(backups.id, result.id));
      }, 5000);
      return { id: result.id, ...input, status: "running" };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(backups).where(eq(backups.id, input.id));
      return { success: true };
    }),
});

// ═══════════════════════════ FOUNDER DASHBOARD ═══════════════════════════

export const founderDashboardRouter = createRouter({
  overview: adminQuery.query(async () => {
    const db = getDb();
    const userCount = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
    const stationCount = await db.select({ count: sql<number>`COUNT(*)` }).from(stations);
    const saleCount = await db.select({ count: sql<number>`COUNT(*)` }).from(sales);
    const totalRevenue = await db.select({ total: sql<string>`COALESCE(SUM(${sales.total}), 0)` }).from(sales);
    const subscriptionCount = await db.select({ count: sql<number>`COUNT(*)` }).from(subscriptions);
    const auditCount = await db.select({ count: sql<number>`COUNT(*)` }).from(auditLogs);
    return {
      users: userCount[0]?.count || 0,
      stations: stationCount[0]?.count || 0,
      sales: saleCount[0]?.count || 0,
      revenue: totalRevenue[0]?.total || "0",
      subscriptions: subscriptionCount[0]?.count || 0,
      auditEvents: auditCount[0]?.count || 0,
    };
  }),
});

// ═══════════════════════════ SITE CONFIG (Dynamic Settings) ═══════════════════════════

export const siteConfigRouter = createRouter({
  // List all configs (public ones without auth)
  listPublic: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(siteConfigs).where(eq(siteConfigs.isPublic, true));
  }),

  // List all configs (admin only)
  list: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(siteConfigs).orderBy(siteConfigs.category, siteConfigs.key);
  }),

  // Get config by key
  get: authedQuery
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [config] = await db.select().from(siteConfigs).where(eq(siteConfigs.key, input.key));
      return config || null;
    }),

  // Get all configs as key-value pairs (for instant frontend integration)
  getAll: authedQuery.query(async () => {
    const db = getDb();
    const configs = await db.select().from(siteConfigs);
    const result: Record<string, any> = {};
    for (const c of configs) {
      let val: any = c.value;
      if (c.type === "number") val = Number(val);
      else if (c.type === "boolean") val = val === "true" || val === "1";
      else if (c.type === "json") {
        try { val = JSON.parse(val); } catch { /* keep as string */ }
      }
      result[c.key] = val;
    }
    return result;
  }),

  // Create or update a config
  upsert: adminQuery
    .input(z.object({
      key: z.string().min(1),
      value: z.string(),
      type: z.enum(["string", "number", "boolean", "json"]).default("string"),
      category: z.string().default("general"),
      description: z.string().optional(),
      isPublic: z.boolean().default(false),
      isEncrypted: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const existing = await db.select().from(siteConfigs).where(eq(siteConfigs.key, input.key)).limit(1);
      
      if (existing.length > 0) {
        await db.update(siteConfigs)
          .set({ 
            value: input.value,
            type: input.type,
            category: input.category,
            description: input.description,
            isPublic: input.isPublic,
            isEncrypted: input.isEncrypted,
            updatedBy: ctx.user?.id,
            updatedAt: new Date(),
          })
          .where(eq(siteConfigs.key, input.key));
        return { success: true, action: "updated", key: input.key };
      } else {
        const [result] = await db.insert(siteConfigs).values({
          key: input.key,
          value: input.value,
          type: input.type,
          category: input.category,
          description: input.description,
          isPublic: input.isPublic,
          isEncrypted: input.isEncrypted,
          createdBy: ctx.user?.id,
          updatedBy: ctx.user?.id,
        }).$returningId();
        return { success: true, action: "created", key: input.key, id: result.id };
      }
    }),

  // Delete a config
  delete: adminQuery
    .input(z.object({ key: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(siteConfigs).where(eq(siteConfigs.key, input.key));
      return { success: true };
    }),

  // Publish a snapshot (version control)
  publishSnapshot: adminQuery
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const configs = await db.select().from(siteConfigs);
      const snapshot = JSON.stringify(configs.map(c => ({
        key: c.key,
        value: c.value,
        type: c.type,
        category: c.category,
      })));
      const version = `v${Date.now()}`;
      
      // Archive any existing published versions
      await db.update(configVersions)
        .set({ status: "archived", archivedAt: new Date() })
        .where(eq(configVersions.status, "published"));
      
      // Create new published version
      const [result] = await db.insert(configVersions).values({
        version,
        name: input.name,
        description: input.description,
        snapshot,
        status: "published",
        createdBy: ctx.user?.id,
        publishedAt: new Date(),
      }).$returningId();
      
      return { success: true, version, id: result.id };
    }),

  // List version history
  listVersions: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(configVersions).orderBy(desc(configVersions.createdAt));
  }),

  // Get a specific version snapshot
  getVersion: adminQuery
    .input(z.object({ version: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [v] = await db.select().from(configVersions).where(eq(configVersions.version, input.version));
      if (!v) return null;
      return {
        ...v,
        snapshot: JSON.parse(v.snapshot || "[]"),
      };
    }),

  // Restore a previous version
  restoreVersion: adminQuery
    .input(z.object({ version: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [v] = await db.select().from(configVersions).where(eq(configVersions.version, input.version));
      if (!v || !v.snapshot) {
        return { success: false, error: "Version not found" };
      }
      
      const snapshot = JSON.parse(v.snapshot);
      
      // Update all configs from the snapshot
      for (const item of snapshot) {
        const existing = await db.select().from(siteConfigs).where(eq(siteConfigs.key, item.key)).limit(1);
        if (existing.length > 0) {
          await db.update(siteConfigs)
            .set({ 
              value: item.value,
              type: item.type,
              updatedBy: ctx.user?.id,
              updatedAt: new Date(),
            })
            .where(eq(siteConfigs.key, item.key));
        } else {
          await db.insert(siteConfigs).values({
            key: item.key,
            value: item.value,
            type: item.type,
            category: item.category || "general",
            createdBy: ctx.user?.id,
            updatedBy: ctx.user?.id,
          });
        }
      }
      
      return { success: true, restored: snapshot.length };
    }),
});
