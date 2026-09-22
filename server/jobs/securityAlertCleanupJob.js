/**
 * Security Alert Cleanup Job (Phase 10)
 *
 * Purges expired security alerts past retention window (default: 365 days).
 * Strictly preserves active, unresolved ACTION_REQUIRED, and unread CRITICAL alerts.
 */

import mongoose from "mongoose"
import { SECURITY_ALERT_CONFIG } from "../config/securityAlertConfig.js"
import SecurityAlert from "../Modals/SecurityAlert.js"
import { logger } from "../utils/logger.js"

export class SecurityAlertCleanupJob {
  /**
   * Executes scheduled purge of aged alerts.
   */
  async cleanExpiredAlerts() {
    if (mongoose.connection?.readyState !== 1) {
      return { purgedCount: 0 }
    }

    try {
      const cutoffDate = new Date(
        Date.now() - SECURITY_ALERT_CONFIG.alertRetentionDays * 24 * 60 * 60 * 1000
      )

      // Only purge alerts older than retention period that are NOT currently ACTION_REQUIRED
      // and NOT unread CRITICAL alerts
      const filter = {
        createdAt: { $lt: cutoffDate },
        status: {
          $nin: [
            SECURITY_ALERT_CONFIG.statuses.ACTION_REQUIRED,
          ],
        },
        $nor: [
          {
            severity: SECURITY_ALERT_CONFIG.severities.CRITICAL,
            status: SECURITY_ALERT_CONFIG.statuses.UNREAD,
          },
        ],
      }

      const result = await SecurityAlert.deleteMany(filter)
      const purgedCount = result.deletedCount || 0

      if (purgedCount > 0) {
        logger.info(`[SecurityAlertCleanupJob] Purged ${purgedCount} expired security alerts`)
      }

      return { purgedCount }
    } catch (err) {
      logger.error(`[SecurityAlertCleanupJob] Error purging expired alerts: ${err.message}`)
      return { purgedCount: 0, error: err.message }
    }
  }
}

export const securityAlertCleanupJob = new SecurityAlertCleanupJob()
export default securityAlertCleanupJob
