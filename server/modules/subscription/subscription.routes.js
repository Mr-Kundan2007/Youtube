import express from "express"
import { requireAuth } from "../../middleware/authMiddleware.js"
import {
  getPlansHandler,
  getPlanDetailsHandler,
  getCurrentSubscriptionHandler,
  getSubscriptionHistoryHandler,
  getAvailableFeaturesHandler,
  getSubscriptionUsageHandler,
  recordWatchTimeHandler,
  startStreamSessionHandler,
  heartbeatStreamSessionHandler,
  endStreamSessionHandler,
} from "./subscription.controller.js"
import {
  cancelSubscriptionHandler,
  restoreCancellationHandler,
  reactivateSubscriptionHandler,
  adminLifecycleRecheckHandler,
  adminLifecycleMonitoringHandler,
} from "../../controllers/subscriptionController.js"

const router = express.Router()

// Public routes
router.get("/plans", getPlansHandler)
router.get("/plans/:planId", getPlanDetailsHandler)

// Authenticated user subscription endpoints
router.get("/current", requireAuth, getCurrentSubscriptionHandler)
router.get("/me", requireAuth, getCurrentSubscriptionHandler) // alias for convenience
router.get("/history", requireAuth, getSubscriptionHistoryHandler)
router.get("/features", requireAuth, getAvailableFeaturesHandler)
router.get("/usage", requireAuth, getSubscriptionUsageHandler)

// Cancellation and lifecycle management
router.post("/cancel", requireAuth, cancelSubscriptionHandler)
router.post("/restore-cancellation", requireAuth, restoreCancellationHandler)
router.post("/reactivate", requireAuth, reactivateSubscriptionHandler)
router.post("/lifecycle/recheck", requireAuth, adminLifecycleRecheckHandler)
router.get("/lifecycle/monitoring", requireAuth, adminLifecycleMonitoringHandler)

// Watch time & stream session tracking
router.post("/usage/watch-time", requireAuth, recordWatchTimeHandler)
router.post("/stream/start", requireAuth, startStreamSessionHandler)
router.post("/stream/heartbeat", requireAuth, heartbeatStreamSessionHandler)
router.post("/stream/end", requireAuth, endStreamSessionHandler)

export default router
