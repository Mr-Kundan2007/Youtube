import express from "express"
import { requireAuth } from "../middleware/authMiddleware.js"
import { requireAdminRole } from "../middleware/adminPermissionMiddleware.js"

// Controllers
import {
  getDashboardSummaryHandler,
  getOperationsSummaryHandler,
  getActiveDownloadsHandler,
  cancelActiveDownloadHandler,
} from "../controllers/adminDashboardController.js"

import {
  getDownloadsListHandler,
  getDownloadDetailHandler,
  addDownloadNoteHandler,
} from "../controllers/adminDownloadController.js"

import {
  getUserDownloadProfileHandler,
  adjustUserQuotaHandler,
  getUserQuotaHistoryHandler,
  addUserNoteHandler,
} from "../controllers/adminUserDownloadController.js"

import {
  getTopVideosHandler,
  getVideoPerformanceHandler,
  getDownloadTrendsHandler,
  getHourlyTrendsHandler,
  getSubscriptionAnalyticsHandler,
  getDeviceAnalyticsHandler,
  getFailureAnalyticsHandler,
} from "../controllers/adminAnalyticsController.js"

import {
  generateReportHandler,
  requestExportJobHandler,
  getExportJobStatusHandler,
  downloadExportFileHandler,
} from "../controllers/adminReportController.js"

import { getAuditLogsHandler } from "../controllers/adminAuditController.js"
import {
  getAdminBillingAnalyticsHandler,
  getAdminTransactionsHandler,
  overrideUserSubscriptionHandler,
} from "../controllers/adminSubscriptionController.js"

const router = express.Router()

// Note: Export download endpoint may be accessed with a signed download token or admin header
router.get("/reports/exports/:jobId/download", downloadExportFileHandler)

// All other endpoints require full admin authentication & verification
router.use(requireAuth, requireAdminRole)

// -------------------------------------------------------------
// 1. Dashboard & Operations
// -------------------------------------------------------------
router.get("/dashboard/summary", getDashboardSummaryHandler)
router.get("/operations/summary", getOperationsSummaryHandler)
router.get("/operations/active-downloads", getActiveDownloadsHandler)
router.post("/operations/downloads/:downloadId/cancel", cancelActiveDownloadHandler)

// -------------------------------------------------------------
// 2. Download Management
// -------------------------------------------------------------
router.get("/downloads", getDownloadsListHandler)
// Backward compatibility for /api/admin/downloads/statistics
router.get("/downloads/statistics", getDashboardSummaryHandler)
router.get("/downloads/:downloadId", getDownloadDetailHandler)
router.post("/downloads/:downloadId/notes", addDownloadNoteHandler)

// -------------------------------------------------------------
// 3. User Download Management & Quota Adjustments
// -------------------------------------------------------------
router.get("/users/:userId/downloads", getUserDownloadProfileHandler)
router.post("/users/:userId/quota/adjust", adjustUserQuotaHandler)
router.get("/users/:userId/quota/history", getUserQuotaHistoryHandler)
router.post("/users/:userId/notes", addUserNoteHandler)

// -------------------------------------------------------------
// 4. Analytics
// -------------------------------------------------------------
router.get("/analytics/videos/top", getTopVideosHandler)
router.get("/analytics/videos/:videoId/performance", getVideoPerformanceHandler)
router.get("/analytics/trends", getDownloadTrendsHandler)
router.get("/analytics/downloads/trends", getDownloadTrendsHandler)
router.get("/analytics/hourly", getHourlyTrendsHandler)
router.get("/analytics/subscriptions", getSubscriptionAnalyticsHandler)
router.get("/analytics/devices", getDeviceAnalyticsHandler)
router.get("/analytics/failures", getFailureAnalyticsHandler)

// -------------------------------------------------------------
// 5. Reports & Exports
// -------------------------------------------------------------
router.get("/reports/:reportType", generateReportHandler)
router.post("/reports/export", requestExportJobHandler)
router.get("/reports/exports/:jobId", getExportJobStatusHandler)

// -------------------------------------------------------------
// 6. Audit Logs
// -------------------------------------------------------------
router.get("/audit-logs", getAuditLogsHandler)

// -------------------------------------------------------------
// 7. Subscription Billing & Transactions Oversight
// -------------------------------------------------------------
router.get("/subscriptions/analytics", getAdminBillingAnalyticsHandler)
router.get("/subscriptions/transactions", getAdminTransactionsHandler)
router.post("/subscriptions/:userId/override", overrideUserSubscriptionHandler)

export default router
