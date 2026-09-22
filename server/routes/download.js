import express from "express"
import {
  authorizeVideoDownload,
  requestDownloadDeliveryHandler,
  streamProtectedVideoHandler,
  streamVideoDownload,
  validateDownloadTokenHandler,
  revokeDownloadTokenHandler,
  getUserDownloads,
  getUserQuotaStatus,
  getDownloadById,
  getDownloadStatusHandler,
  retryDownload,
  getSubscriptionPlans,
  getUserSubscription,
  getUserEntitlement,
  upgradeSubscription,
  cancelUserSubscription,
  renewUserSubscription,
} from "../controllers/download.js"
import { requireAuth, optionalAuth } from "../middleware/authMiddleware.js"
import {
  downloadAuthLimiter,
  downloadQueryLimiter,
  downloadTokenValidationLimiter,
} from "../middleware/rateLimiter.js"
import { getDownloadEntitlement } from "../controllers/downloadEntitlementController.js"
import {
  getUserDashboardHandler,
  getActiveDownloadsHandler,
  cancelUserDownloadHandler,
  exportUserDownloadHistoryHandler,
  getUserSecurityOverviewHandler,
  reportSuspiciousActivityHandler,
  getDownloadPreferencesHandler,
  updateDownloadPreferencesHandler,
} from "../controllers/userDownloadCenterController.js"

const router = express.Router()

// --- Video Download Authorization, Delivery & Streaming Endpoints ---
// POST /api/download/authorize or /api/videos/:videoId/download/authorize
router.post(
  "/authorize",
  downloadAuthLimiter,
  requireAuth,
  authorizeVideoDownload
)

// Alias for /authorize
router.post(
  "/request",
  downloadAuthLimiter,
  requireAuth,
  authorizeVideoDownload
)

// POST /api/download/deliver - Authorize delivery and generate signed temporary URL
router.post(
  "/deliver",
  downloadAuthLimiter,
  requireAuth,
  requestDownloadDeliveryHandler
)

// GET /api/download/stream - Protected streaming endpoint using signed URL token
router.get(
  "/stream",
  optionalAuth,
  streamProtectedVideoHandler
)

router.get(
  "/stream/:token",
  optionalAuth,
  streamProtectedVideoHandler
)

router.post(
  "/validate-token",
  downloadTokenValidationLimiter,
  requireAuth,
  validateDownloadTokenHandler
)

router.post(
  "/tokens/revoke",
  requireAuth,
  revokeDownloadTokenHandler
)

router.post(
  "/:videoId/authorize",
  downloadAuthLimiter,
  requireAuth,
  authorizeVideoDownload
)

router.post(
  "/:videoId/download/authorize",
  downloadAuthLimiter,
  requireAuth,
  authorizeVideoDownload
)

router.get(
  "/:downloadId/status",
  downloadQueryLimiter,
  requireAuth,
  getDownloadStatusHandler
)

router.post(
  "/:downloadId/retry",
  downloadAuthLimiter,
  requireAuth,
  retryDownload
)

// GET /api/download/:token - Legacy / direct file streaming with Range requests
router.get(
  "/:token",
  optionalAuth,
  streamVideoDownload
)

// Export standalone routers for clean mounting
export const videoScopedDownloadRouter = express.Router({ mergeParams: true })
videoScopedDownloadRouter.post(
  "/download/authorize",
  downloadAuthLimiter,
  requireAuth,
  authorizeVideoDownload
)

// User downloads history & quota router
export const userDownloadsRouter = express.Router()

userDownloadsRouter.post(
  "/authorize",
  downloadAuthLimiter,
  requireAuth,
  authorizeVideoDownload
)

// POST /api/downloads/deliver - Delivery authorization & signed URL generation
userDownloadsRouter.post(
  "/deliver",
  downloadAuthLimiter,
  requireAuth,
  requestDownloadDeliveryHandler
)

// GET /api/downloads/stream - Protected streaming endpoint using signed URL token
userDownloadsRouter.get(
  "/stream",
  optionalAuth,
  streamProtectedVideoHandler
)

userDownloadsRouter.get(
  "/stream/:token",
  optionalAuth,
  streamProtectedVideoHandler
)

userDownloadsRouter.post(
  "/validate-token",
  downloadTokenValidationLimiter,
  requireAuth,
  validateDownloadTokenHandler
)

userDownloadsRouter.post(
  "/tokens/revoke",
  requireAuth,
  revokeDownloadTokenHandler
)

userDownloadsRouter.get(
  "/dashboard",
  downloadQueryLimiter,
  requireAuth,
  getUserDashboardHandler
)

userDownloadsRouter.get(
  "/active",
  downloadQueryLimiter,
  requireAuth,
  getActiveDownloadsHandler
)

userDownloadsRouter.get(
  "/export",
  downloadQueryLimiter,
  requireAuth,
  exportUserDownloadHistoryHandler
)

userDownloadsRouter.get(
  "/security",
  downloadQueryLimiter,
  requireAuth,
  getUserSecurityOverviewHandler
)

userDownloadsRouter.post(
  "/report-suspicious",
  downloadAuthLimiter,
  requireAuth,
  reportSuspiciousActivityHandler
)

userDownloadsRouter.get(
  "/preferences",
  downloadQueryLimiter,
  requireAuth,
  getDownloadPreferencesHandler
)

userDownloadsRouter.put(
  "/preferences",
  downloadAuthLimiter,
  requireAuth,
  updateDownloadPreferencesHandler
)

userDownloadsRouter.get(
  "/quota",
  downloadQueryLimiter,
  requireAuth,
  getUserQuotaStatus
)

userDownloadsRouter.get(
  "/entitlement",
  downloadQueryLimiter,
  requireAuth,
  getDownloadEntitlement
)

userDownloadsRouter.get(
  "/",
  downloadQueryLimiter,
  requireAuth,
  getUserDownloads
)

userDownloadsRouter.get(
  "/:downloadId/status",
  downloadQueryLimiter,
  requireAuth,
  getDownloadStatusHandler
)

userDownloadsRouter.post(
  "/:downloadId/cancel",
  downloadAuthLimiter,
  requireAuth,
  cancelUserDownloadHandler
)

userDownloadsRouter.get(
  "/:downloadId",
  downloadQueryLimiter,
  requireAuth,
  getDownloadById
)

userDownloadsRouter.post(
  "/:downloadId/retry",
  downloadAuthLimiter,
  requireAuth,
  retryDownload
)

// Subscription management router
export const subscriptionRouter = express.Router()

subscriptionRouter.get("/plans", getSubscriptionPlans)
subscriptionRouter.get("/current", requireAuth, getUserSubscription)
subscriptionRouter.get("/entitlement", requireAuth, getDownloadEntitlement)
subscriptionRouter.post("/upgrade", requireAuth, upgradeSubscription)
subscriptionRouter.post("/cancel", requireAuth, cancelUserSubscription)
subscriptionRouter.post("/renew", requireAuth, renewUserSubscription)

export default router
