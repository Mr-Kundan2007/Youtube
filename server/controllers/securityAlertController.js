/**
 * Security Alert Controller (Phase 10)
 *
 * Exposes REST API endpoints for security alerts, unread counts,
 * user confirmation/suspicious reporting, account lockdowns, and notification preferences.
 */

import { securityAlertService } from "../services/securityAlertService.js"
import { accountProtectionService } from "./../services/accountProtectionService.js"
import { securityNotificationService } from "../services/securityNotificationService.js"
import SecurityNotificationPreference from "../Modals/SecurityNotificationPreference.js"
import { logger } from "../utils/logger.js"

export const getAlerts = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" })
    }

    const { page, limit, status, severity, unreadOnly } = req.query
    const result = await securityAlertService.getAlerts(userId, {
      page,
      limit,
      status,
      severity,
      unreadOnly: unreadOnly === "true",
    })

    return res.status(200).json({
      success: true,
      ...result,
    })
  } catch (err) {
    logger.error("[SecurityAlertController] getAlerts error:", err)
    return res.status(500).json({ success: false, message: "Error fetching security alerts" })
  }
}

export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" })
    }

    const result = await securityAlertService.getUnreadCount(userId)
    return res.status(200).json({
      success: true,
      ...result,
    })
  } catch (err) {
    logger.error("[SecurityAlertController] getUnreadCount error:", err)
    return res.status(500).json({ success: false, message: "Error counting unread alerts" })
  }
}

export const markAsRead = async (req, res) => {
  try {
    const userId = req.user?.id
    const { alertId } = req.params

    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" })
    }

    const alert = await securityAlertService.markAsRead(userId, alertId)
    return res.status(200).json({
      success: true,
      message: "Alert marked as read",
      alert,
    })
  } catch (err) {
    logger.error("[SecurityAlertController] markAsRead error:", err)
    const status = err.message.includes("not found") || err.message.includes("unauthorized") ? 404 : 500
    return res.status(status).json({ success: false, message: err.message || "Error marking alert as read" })
  }
}

export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" })
    }

    const result = await securityAlertService.markAllAsRead(userId)
    return res.status(200).json({
      success: true,
      message: "All unread alerts marked as read",
      updatedCount: result.updatedCount,
    })
  } catch (err) {
    logger.error("[SecurityAlertController] markAllAsRead error:", err)
    return res.status(500).json({ success: false, message: "Error marking all alerts as read" })
  }
}

export const confirmAlert = async (req, res) => {
  try {
    const userId = req.user?.id
    const { alertId } = req.params

    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" })
    }

    const result = await securityAlertService.confirmAlert(userId, alertId)
    return res.status(200).json(result)
  } catch (err) {
    logger.error("[SecurityAlertController] confirmAlert error:", err)
    const status = err.message.includes("not found") || err.message.includes("unauthorized") ? 404 : 500
    return res.status(status).json({ success: false, message: err.message || "Error confirming alert" })
  }
}

export const reportSuspicious = async (req, res) => {
  try {
    const userId = req.user?.id
    const { alertId } = req.params
    const currentSessionId = req.user?.sessionId || null

    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" })
    }

    const result = await securityAlertService.reportSuspicious(userId, alertId, { currentSessionId })
    return res.status(200).json(result)
  } catch (err) {
    logger.error("[SecurityAlertController] reportSuspicious error:", err)
    const status = err.message.includes("not found") || err.message.includes("unauthorized") ? 404 : 500
    return res.status(status).json({ success: false, message: err.message || "Error reporting suspicious activity" })
  }
}

export const secureAccount = async (req, res) => {
  try {
    const userId = req.user?.id
    const currentSessionId = req.user?.sessionId || null
    const { reason = "USER_REQUESTED_LOCKDOWN" } = req.body || {}

    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" })
    }

    const result = await accountProtectionService.secureAccount(userId, {
      currentSessionId,
      reason,
    })

    // Also dispatch security alert
    await securityAlertService.createAlert({
      userId,
      type: "ACCOUNT_PROTECTION_TRIGGERED",
      severity: "HIGH",
      title: "Account Lockdown Initiated",
      message: "You initiated an emergency account lockdown. All other active sessions have been terminated.",
      actionRequired: false,
      metadata: {
        reason,
        sessionsRevoked: result.sessionsRevoked,
        timestamp: new Date(),
      },
    })

    return res.status(200).json(result)
  } catch (err) {
    logger.error("[SecurityAlertController] secureAccount error:", err)
    return res.status(500).json({ success: false, message: "Error activating account protection" })
  }
}

export const getProtectionStatus = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" })
    }

    const result = await accountProtectionService.getProtectionStatus(userId)
    return res.status(200).json({
      success: true,
      ...result,
    })
  } catch (err) {
    logger.error("[SecurityAlertController] getProtectionStatus error:", err)
    return res.status(500).json({ success: false, message: "Error fetching protection status" })
  }
}

export const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" })
    }

    const prefs = await securityNotificationService.getPreferences(userId)
    return res.status(200).json({
      success: true,
      preferences: prefs,
    })
  } catch (err) {
    logger.error("[SecurityAlertController] getNotificationPreferences error:", err)
    return res.status(500).json({ success: false, message: "Error fetching preferences" })
  }
}

export const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" })
    }

    const { inAppEnabled, emailNewLoginEnabled, emailHighRiskEnabled, smsCriticalEnabled } = req.body

    const update = { updatedAt: new Date() }
    if (inAppEnabled !== undefined) update.inAppEnabled = Boolean(inAppEnabled)
    if (emailNewLoginEnabled !== undefined) update.emailNewLoginEnabled = Boolean(emailNewLoginEnabled)
    if (emailHighRiskEnabled !== undefined) update.emailHighRiskEnabled = Boolean(emailHighRiskEnabled)
    if (smsCriticalEnabled !== undefined) update.smsCriticalEnabled = Boolean(smsCriticalEnabled)

    const updated = await SecurityNotificationPreference.findOneAndUpdate(
      { userId },
      { $set: update },
      { new: true, upsert: true }
    )

    return res.status(200).json({
      success: true,
      message: "Notification preferences updated",
      preferences: updated,
    })
  } catch (err) {
    logger.error("[SecurityAlertController] updateNotificationPreferences error:", err)
    return res.status(500).json({ success: false, message: "Error updating preferences" })
  }
}
