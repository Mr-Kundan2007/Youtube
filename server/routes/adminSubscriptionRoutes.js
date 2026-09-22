import express from "express"
import { requireAuth } from "../middleware/authMiddleware.js"
import { requireAdminRole } from "../middleware/adminPermissionMiddleware.js"
import {
  getAnalyticsOverviewHandler,
  getRevenueTrendsHandler,
  getSubscribersHandler,
  getSubscriberProfileHandler,
  extendValidityHandler,
  suspendSubscriptionHandler,
  restoreSubscriptionHandler,
  moveToFreeHandler,
  getPlansHandler,
  updatePlanHandler,
  togglePlanStatusHandler,
  getPaymentsListHandler,
  getReportHandler,
  exportReportCsvHandler,
  getAuditLogsHandler,
} from "../controllers/adminSubscriptionManagementController.js"

const router = express.Router()

// All routes require authenticated admin credentials
router.use(requireAuth, requireAdminRole)

// -------------------------------------------------------------
// 1. Subscription & Revenue Analytics
// -------------------------------------------------------------
router.get("/analytics", getAnalyticsOverviewHandler)
router.get("/analytics/overview", getAnalyticsOverviewHandler)
router.get("/analytics/revenue-trends", getRevenueTrendsHandler)

// -------------------------------------------------------------
// 2. Subscriber Directory & Management
// -------------------------------------------------------------
router.get("/subscribers", getSubscribersHandler)
router.get("/subscribers/:userId", getSubscriberProfileHandler)

// Admin Actions with mandatory audit reason
router.post("/subscribers/:userId/extend", extendValidityHandler)
router.post("/subscribers/:userId/suspend", suspendSubscriptionHandler)
router.post("/subscribers/:userId/restore", restoreSubscriptionHandler)
router.post("/subscribers/:userId/move-to-free", moveToFreeHandler)

// -------------------------------------------------------------
// 3. Subscription Plan Configurations
// -------------------------------------------------------------
router.get("/plans", getPlansHandler)
router.put("/plans/:planId", updatePlanHandler)
router.patch("/plans/:planId/toggle-status", togglePlanStatusHandler)

// -------------------------------------------------------------
// 4. Payment Transactions Oversight
// -------------------------------------------------------------
router.get("/payments", getPaymentsListHandler)

// -------------------------------------------------------------
// 5. Reports & Data Export
// -------------------------------------------------------------
router.get("/reports", getReportHandler)
router.get("/reports/export-csv", exportReportCsvHandler)

// -------------------------------------------------------------
// 6. Administrative Audit Logs
// -------------------------------------------------------------
router.get("/audit-logs", getAuditLogsHandler)

export default router
