/**
 * Sync Router - Handles cross-device data synchronization
 * Fetches all user data from MySQL database for consistent cross-device experience
 */

import { z } from "zod";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { stations, stationUsers, sales, inventory, users } from "@db/schema";

export const syncRouter = createRouter({
  // ─── Full sync: Get all user data for cross-device consistency ───
  fullSync: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;

    // Get user's station memberships
    const memberships = await db
      .select()
      .from(stationUsers)
      .where(and(
        eq(stationUsers.userId, userId),
        eq(stationUsers.isActive, true)
      ));

    const stationIds = memberships.map(m => m.stationId);
    const userRoleMap: Record<number, string> = {};
    memberships.forEach(m => {
      userRoleMap[m.stationId] = m.role;
    });

    // Get all stations the user has access to
    const stationList = stationIds.length > 0
      ? await db
          .select()
          .from(stations)
          .where(inArray(stations.id, stationIds))
      : [];

    // Get all sales across user's stations
    const salesList = stationIds.length > 0
      ? await db
          .select()
          .from(sales)
          .where(inArray(sales.stationId, stationIds))
          .orderBy(desc(sales.createdAt))
      : [];

    // Get all inventory across user's stations
    const inventoryList = stationIds.length > 0
      ? await db
          .select()
          .from(inventory)
          .where(inArray(inventory.stationId, stationIds))
      : [];

    // Get user profile
    const [userProfile] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId));

    // Calculate aggregated stats
    const salesAgg = stationIds.length > 0
      ? await db
          .select({
            totalRevenue: sql<string>`COALESCE(SUM(${sales.total}), 0)`,
            totalCount: sql<number>`COUNT(*)`,
            totalLiters: sql<string>`COALESCE(SUM(${sales.quantityLiters}), 0)`,
          })
          .from(sales)
          .where(inArray(sales.stationId, stationIds))
      : [{ totalRevenue: "0", totalCount: 0, totalLiters: "0" }];

    return {
      success: true,
      timestamp: Date.now(),
      user: userProfile,
      stations: stationList.map(s => ({
        ...s,
        userRole: userRoleMap[s.id] || "viewer",
      })),
      stationCount: stationList.length,
      sales: salesList,
      salesCount: salesList.length,
      inventory: inventoryList,
      stats: {
        totalRevenue: salesAgg[0]?.totalRevenue || "0",
        totalSales: Number(salesAgg[0]?.totalCount || 0),
        totalLiters: salesAgg[0]?.totalLiters || "0",
      },
    };
  }),

  // ─── Station sync: Get station with all related data ───
  syncStation: authedQuery
    .input(z.object({ stationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      // Verify access
      const [membership] = await db
        .select()
        .from(stationUsers)
        .where(and(
          eq(stationUsers.stationId, input.stationId),
          eq(stationUsers.userId, userId),
          eq(stationUsers.isActive, true)
        ));

      if (!membership) {
        throw new Error("Access denied to this station");
      }

      // Get station
      const [station] = await db
        .select()
        .from(stations)
        .where(eq(stations.id, input.stationId));

      // Get sales
      const stationSales = await db
        .select()
        .from(sales)
        .where(eq(sales.stationId, input.stationId))
        .orderBy(desc(sales.createdAt));

      // Get inventory
      const stationInventory = await db
        .select()
        .from(inventory)
        .where(eq(inventory.stationId, input.stationId));

      return {
        station,
        sales: stationSales,
        inventory: stationInventory,
        userRole: membership.role,
      };
    }),

  // ─── Push local changes to server ───
  pushChanges: authedQuery
    .input(z.object({
      stationData: z.array(z.object({
        id: z.number().optional(),
        name: z.string(),
        code: z.string(),
        location: z.string().optional(),
        phone: z.string().optional(),
        managerName: z.string().optional(),
        taxRate: z.string().optional(),
      })).optional(),
      salesData: z.array(z.object({
        stationId: z.number(),
        fuelType: z.string(),
        quantityLiters: z.string(),
        pricePerLiter: z.string(),
        subtotal: z.string(),
        total: z.string(),
        paymentMethod: z.string(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;
      const results: { stations: any[], sales: any[] } = { stations: [], sales: [] };

      // Handle station updates/creates
      if (input.stationData && input.stationData.length > 0) {
        for (const station of input.stationData) {
          if (station.id) {
            // Update existing
            await db.update(stations)
              .set({
                name: station.name,
                code: station.code,
                location: station.location,
                phone: station.phone,
                managerName: station.managerName,
                taxRate: station.taxRate,
              })
              .where(eq(stations.id, station.id));
            results.stations.push({ id: station.id, action: "updated" });
          } else {
            // Create new
            const [newStation] = await db.insert(stations).values({
              name: station.name,
              code: station.code,
              location: station.location,
              phone: station.phone,
              managerName: station.managerName,
              taxRate: station.taxRate || "0",
              createdBy: userId,
            }).$returningId();
            
            // Auto-assign as owner
            await db.insert(stationUsers).values({
              stationId: newStation.id,
              userId: userId,
              role: "owner",
            });
            results.stations.push({ id: newStation.id, action: "created" });
          }
        }
      }

      // Handle sales creates
      if (input.salesData && input.salesData.length > 0) {
        for (const sale of input.salesData) {
          // Verify user has access to this station
          const [membership] = await db
            .select()
            .from(stationUsers)
            .where(and(
              eq(stationUsers.stationId, sale.stationId),
              eq(stationUsers.userId, userId),
              eq(stationUsers.isActive, true)
            ));

          if (membership) {
            const [newSale] = await db.insert(sales).values({
              stationId: sale.stationId,
              fuelType: sale.fuelType as any,
              quantityLiters: sale.quantityLiters,
              pricePerLiter: sale.pricePerLiter,
              subtotal: sale.subtotal,
              total: sale.total,
              paymentMethod: sale.paymentMethod,
              userId: userId,
            }).$returningId();
            results.sales.push({ id: newSale.id, action: "created" });
          }
        }
      }

      return {
        success: true,
        timestamp: Date.now(),
        results,
      };
    }),
});
