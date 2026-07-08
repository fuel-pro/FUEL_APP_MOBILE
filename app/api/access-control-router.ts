/**
 * Access Control Router - tRPC procedures for RBAC management
 */

import { z } from "zod";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { accessControl, PERMISSIONS, DEFAULT_ROLES } from "./lib/access-control";
import { auditService } from "./lib/audit-service";
import { getDb } from "@db/connection";
import { 
  permissions, 
  roles, 
  teams, 
  teamMembers, 
  dataScopes, 
  actionScopes,
  teamInvitations,
  auditLogEntries,
} from "@db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

const db = getDb();
const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

// ─── Context Type ───
interface TrpcContext {
  user?: { id: number; name?: string; email?: string };
  teamId?: number;
  stationId?: number;
  req?: Request;
}

// ─── Permission Check Middleware ───

const requirePermission = (permission: string) =>
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    if (!ctx.teamId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Team context required for permission checks",
      });
    }

    const hasPermission = await accessControl.hasPermission(
      ctx.user!.id,
      permission,
      { teamId: ctx.teamId }
    );

    if (!hasPermission) {
      // Log the denied access
      await auditService.logEvent(
        {
          userId: ctx.user!.id,
          userName: ctx.user.name,
          userEmail: ctx.user.email,
          teamId: ctx.teamId,
          ipAddress: ctx.req?.headers?.get?.("x-forwarded-for") ?? undefined,
          userAgent: ctx.req?.headers?.get?.("user-agent") ?? undefined,
        },
        {
          eventType: "authorization",
          action: permission,
          actionResult: "denied",
          resourceType: "permission",
          resourceId: permission,
          riskLevel: "medium",
          isComplianceRelevant: true,
        }
      );

      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Permission '${permission}' required`,
      });
    }

    return next({ ctx });
  });

// ─── Export Procedures ───

export const accessControlRouter = t.router({
  // Get current user's permissions
  getMyPermissions: t.procedure.query(async ({ ctx }) => {
    if (!ctx.user?.id || !ctx.teamId) {
      return [];
    }

    return accessControl.getUserPermissions(ctx.user!.id, ctx.teamId);
  }),

  // Get all available permissions
  getAllPermissions: t.procedure.query(async () => {
    return db.select().from(permissions).where(eq(permissions.isActive, true));
  }),

  // Get all roles
  getRoles: t.procedure.query(async () => {
    return db.select().from(roles).where(eq(roles.isActive, true));
  }),

  // Get role by ID
  getRole: t.procedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const role = await db.select().from(roles).where(eq(roles.id, input.id)).limit(1);
      return role[0] || null;
    }),

  // Create role (requires ROLES_CREATE permission)
  createRole: t.procedure
    .use(requirePermission(PERMISSIONS.ROLES_CREATE))
    .input(
      z.object({
        name: z.string().min(1).max(100),
        code: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/),
        description: z.string().optional(),
        level: z.number().min(0).max(100),
        permissions: z.array(z.string()),
        canManageUsers: z.boolean().optional(),
        canManageRoles: z.boolean().optional(),
        canViewAuditLogs: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await db.insert(roles).values({
        name: input.name,
        code: input.code,
        description: input.description,
        level: input.level,
        type: "custom",
        permissions: JSON.stringify(input.permissions),
        canManageUsers: input.canManageUsers || false,
        canManageRoles: input.canManageRoles || false,
        canViewAuditLogs: input.canViewAuditLogs || false,
        createdBy: ctx.user!.id,
      });

      await auditService.logEvent(
        { userId: ctx.user!.id, teamId: ctx.teamId },
        {
          eventType: "data_modification",
          action: "create",
          resourceType: "role",
          newValue: input,
          isComplianceRelevant: true,
        }
      );

      return result;
    }),

  // Update role
  updateRole: t.procedure
    .use(requirePermission(PERMISSIONS.ROLES_UPDATE))
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        level: z.number().min(0).max(100).optional(),
        permissions: z.array(z.string()).optional(),
        canManageUsers: z.boolean().optional(),
        canManageRoles: z.boolean().optional(),
        canViewAuditLogs: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      
      // Get previous value for audit
      const previous = await db.select().from(roles).where(eq(roles.id, id)).limit(1);

      if (updates.permissions) {
        (updates as unknown as { permissions?: string }).permissions = JSON.stringify(updates.permissions);
      }

      await db.update(roles).set(updates as any).where(eq(roles.id, id));

      await auditService.logEvent(
        { userId: ctx.user!.id, teamId: ctx.teamId },
        {
          eventType: "data_modification",
          action: "update",
          resourceType: "role",
          previousValue: previous,
          newValue: updates,
          isComplianceRelevant: true,
        }
      );

      return { success: true };
    }),

  // Delete role
  deleteRole: t.procedure
    .use(requirePermission(PERMISSIONS.ROLES_DELETE))
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Check if role is in use
      const members = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.roleId, input.id))
        .limit(1);

      if (members.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Cannot delete role that is assigned to users",
        });
      }

      // Soft delete - just mark inactive
      await db
        .update(roles)
        .set({ isActive: false })
        .where(eq(roles.id, input.id));

      await auditService.logEvent(
        { userId: ctx.user!.id, teamId: ctx.teamId },
        {
          eventType: "data_modification",
          action: "delete",
          resourceType: "role",
          resourceId: input.id.toString(),
          isComplianceRelevant: true,
        }
      );

      return { success: true };
    }),

  // Get team members
  getTeamMembers: t.procedure
    .use(requirePermission(PERMISSIONS.USERS_READ))
    .input(z.object({ teamId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const targetTeamId = input.teamId || ctx.teamId;
      if (!targetTeamId) throw new Error("Team ID required");

      const members = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.teamId, targetTeamId));

      // Get role details for each member
      const enriched = await Promise.all(
        members.map(async (member) => {
          const roleResult = await db.select().from(roles).where(eq(roles.id, member.roleId)).limit(1);
          return { ...member, role: roleResult[0] || null };
        })
      );

      return enriched;
    }),

  // Add team member
  addTeamMember: t.procedure
    .use(requirePermission(PERMISSIONS.USERS_INVITE))
    .input(
      z.object({
        teamId: z.number(),
        userId: z.number(),
        roleId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if already a member
      const existing = await db
        .select()
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, input.teamId),
            eq(teamMembers.userId, input.userId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User is already a team member",
        });
      }

      const result = await db.insert(teamMembers).values({
        teamId: input.teamId,
        userId: input.userId,
        roleId: input.roleId,
        status: "active",
        joinedAt: new Date(),
      });

      await auditService.logEvent(
        { userId: ctx.user!.id, teamId: ctx.teamId },
        {
          eventType: "data_modification",
          action: "add_member",
          resourceType: "team",
          resourceId: input.teamId.toString(),
          newValue: { userId: input.userId, roleId: input.roleId },
          isComplianceRelevant: true,
        }
      );

      return result;
    }),

  // Update member role
  updateMemberRole: t.procedure
    .use(requirePermission(PERMISSIONS.USERS_UPDATE))
    .input(
      z.object({
        memberId: z.number(),
        roleId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const previous = await db.select().from(teamMembers).where(eq(teamMembers.id, input.memberId)).limit(1);

      await db
        .update(teamMembers)
        .set({ roleId: input.roleId, updatedAt: new Date() })
        .where(eq(teamMembers.id, input.memberId));

      await auditService.logEvent(
        { userId: ctx.user!.id, teamId: ctx.teamId },
        {
          eventType: "data_modification",
          action: "update_role",
          resourceType: "team_member",
          resourceId: input.memberId.toString(),
          previousValue: { roleId: previous?.[0]?.roleId },
          newValue: { roleId: input.roleId },
          isComplianceRelevant: true,
        }
      );

      return { success: true };
    }),

  // Remove team member
  removeTeamMember: t.procedure
    .use(requirePermission(PERMISSIONS.USERS_DELETE))
    .input(
      z.object({
        memberId: z.number(),
        teamId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const targetTeamId = input.teamId || ctx.teamId;

      await db
        .update(teamMembers)
        .set({ status: "removed" })
        .where(eq(teamMembers.id, input.memberId));

      await auditService.logEvent(
        { userId: ctx.user!.id, teamId: targetTeamId },
        {
          eventType: "data_modification",
          action: "remove_member",
          resourceType: "team",
          resourceId: targetTeamId?.toString(),
          previousValue: { memberId: input.memberId },
          isComplianceRelevant: true,
        }
      );

      return { success: true };
    }),

  // Create invitation
  createInvitation: t.procedure
    .use(requirePermission(PERMISSIONS.USERS_INVITE))
    .input(
      z.object({
        teamId: z.number(),
        email: z.string().email(),
        roleId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const token = nanoid(32);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      await db.insert(teamInvitations).values({
        teamId: input.teamId,
        email: input.email,
        roleId: input.roleId,
        invitedBy: ctx.user!.id,
        token,
        status: "pending",
        expiresAt,
      });

      // In production, send email here

      await auditService.logEvent(
        { userId: ctx.user!.id, teamId: ctx.teamId },
        {
          eventType: "data_modification",
          action: "invite_user",
          resourceType: "team_invitation",
          resourceName: input.email,
          isComplianceRelevant: true,
        }
      );

      return { token };
    }),

  // Accept invitation
  acceptInvitation: t.procedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const invitation = await db.select().from(teamInvitations)
        .where(and(eq(teamInvitations.token, input.token), eq(teamInvitations.status, "pending")))
        .limit(1);

      const inv = invitation[0];
      
      if (!inv) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found or expired",
        });
      }

      if (inv.expiresAt < new Date()) {
        await db
          .update(teamInvitations)
          .set({ status: "expired" })
          .where(eq(teamInvitations.id, inv.id));

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation has expired",
        });
      }

      // Create team membership
      await db.insert(teamMembers).values({
        teamId: inv.teamId,
        userId: 0, // Would come from authenticated user
        roleId: inv.roleId,
        status: "active",
        invitedBy: inv.invitedBy,
        joinedAt: new Date(),
      });

      // Update invitation
      await db
        .update(teamInvitations)
        .set({ status: "accepted", acceptedAt: new Date() })
        .where(eq(teamInvitations.id, inv.id));

      return { success: true };
    }),

  // Get data scopes for user
  getDataScopes: t.procedure
    .input(
      z.object({
        userId: z.number().optional(),
        resourceType: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = input.userId || ctx.user?.id;
      if (!userId || !ctx.teamId) return [];

      return accessControl.getDataScopes(userId, ctx.teamId, input.resourceType);
    }),

  // Create data scope
  createDataScope: t.procedure
    .use(requirePermission(PERMISSIONS.ROLES_UPDATE))
    .input(
      z.object({
        resourceType: z.string(),
        filterConfig: z.record(z.string(), z.any()),
        roleId: z.number().optional(),
        userId: z.number().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await db.insert(dataScopes).values({
        teamId: ctx.teamId!,
        resourceType: input.resourceType,
        filterConfig: JSON.stringify(input.filterConfig),
        roleId: input.roleId ?? 0,
        userId: input.userId,
        description: input.description,
      } as any);

      await auditService.logEvent(
        { userId: ctx.user!.id, teamId: ctx.teamId },
        {
          eventType: "data_modification",
          action: "create",
          resourceType: "data_scope",
          isComplianceRelevant: true,
        }
      );

      return result;
    }),

  // Initialize default roles and permissions
  seedDefaults: t.procedure.mutation(async () => {
    await accessControl.seedDefaults();
    return { success: true };
  }),
});

export type AccessControlRouter = typeof accessControlRouter;