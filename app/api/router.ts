import { authRouter } from "./auth-router";
import { stationRouter } from "./station-router";
import { saleRouter } from "./sale-router";
import { inventoryRouter } from "./inventory-router";
import { paymentRouter } from "./payment-router";
import { auditRouter } from "./audit-router";
import { founderAuthRouter } from "./founder-auth-router";
import { accessControlRouter } from "./access-control-router";
import {
  featureFlagRouter,
  pricingRouter,
  couponRouter,
  systemConfigRouter,
  apiKeyRouter,
  webhookRouter,
  emailTemplateRouter,
  userManagementRouter,
  backupRouter,
  founderDashboardRouter,
} from "./founder-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  station: stationRouter,
  sale: saleRouter,
  inventory: inventoryRouter,
  payment: paymentRouter,
  audit: auditRouter,
  // ─── Access Control ───
  accessControl: accessControlRouter,
  // ─── Founder Authentication (public, for login) ───
  founderAuth: founderAuthRouter,
  // ─── Founder Access (admin-protected) ───
  featureFlag: featureFlagRouter,
  pricing: pricingRouter,
  coupon: couponRouter,
  systemConfig: systemConfigRouter,
  apiKey: apiKeyRouter,
  webhook: webhookRouter,
  emailTemplate: emailTemplateRouter,
  userMgmt: userManagementRouter,
  backup: backupRouter,
  founderDashboard: founderDashboardRouter,
});

export type AppRouter = typeof appRouter;
