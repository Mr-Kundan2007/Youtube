/**
 * Security Alert & Account Protection Routes (Phase 10)
 *
 * Authenticated endpoints for security alerts, notifications,
 * user confirmation/reporting, emergency lockdowns, and preferences.
 */

import express from "express"
import { requireAuth } from "../middleware/authMiddleware.js"
import {
  getAlerts,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  confirmAlert,
  reportSuspicious,
  secureAccount,
  getProtectionStatus,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../controllers/securityAlertController.js"

const router = express.Router()

// All security alert routes require authentication
router.use(requireAuth)

// Alerts Query & Lifecycle
router.get("/alerts", getAlerts)
router.get("/alerts/unread-count", getUnreadCount)
router.patch("/alerts/read-all", markAllAsRead)
router.patch("/alerts/:alertId/read", markAsRead)

// User Security Responses
router.post("/alerts/:alertId/confirm", confirmAlert)
router.post("/alerts/:alertId/report-suspicious", reportSuspicious)

// Account Protection & Status
router.post("/secure-account", secureAccount)
router.get("/protection-status", getProtectionStatus)

// Notification Preferences
router.get("/preferences/notifications", getNotificationPreferences)
router.put("/preferences/notifications", updateNotificationPreferences)

export default router
