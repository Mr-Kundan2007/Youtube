import { logger } from "../../utils/logger.js"
import securityAuditService from "./securityAuditService.js"

export class SecurityAlertService {
  constructor() {
    // Stores recent alerts in memory (capped)
    this.alerts = []
    this.maxAlerts = 100
    // Cooldown map: key -> timestamp of last dispatch
    this.cooldowns = new Map()
    this.cooldownDurationMs = 15 * 60 * 1000 // 15 minutes
  }

  /**
   * Dispatches a deduplicated security alert.
   * Suppresses alert storms when matching key triggers repeatedly within 15 minutes.
   */
  async dispatchAlert({
    alertType,
    title,
    message,
    severity = "HIGH",
    metadata = {},
    dedupeKey = null,
  }) {
    const key = dedupeKey || `${alertType}_${severity}`
    const now = Date.now()
    const lastDispatched = this.cooldowns.get(key)

    if (lastDispatched && now - lastDispatched < this.cooldownDurationMs) {
      logger.info(`[SecurityAlertService] Alert '${key}' suppressed due to active 15m cooldown`)
      return {
        dispatched: false,
        suppressed: true,
        reason: "COOLDOWN_ACTIVE",
        cooldownRemainingSec: Math.ceil((this.cooldownDurationMs - (now - lastDispatched)) / 1000),
      }
    }

    // Set cooldown timestamp
    this.cooldowns.set(key, now)

    const alertId = `ALT-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    const alertRecord = {
      alertId,
      alertType,
      title,
      message,
      severity,
      metadata,
      dispatchedAt: new Date(),
    }

    // Store in circular alert history
    this.alerts.unshift(alertRecord)
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.pop()
    }

    logger.warn(`[SECURITY ALERT - ${severity}] ${title}: ${message}`)

    // Record into persistent Security Audit Log
    await securityAuditService.recordEvent({
      eventType: alertType || "PAYMENT_ANOMALY_DETECTED",
      severity,
      safeMetadata: {
        ...metadata,
        alertTitle: title,
        alertMessage: message,
      },
    }).catch((err) => logger.warn("[SecurityAlertService] Failed to record alert event:", err.message))

    return {
      dispatched: true,
      alertId,
      alert: alertRecord,
    }
  }

  /**
   * Retrieves active/recent security alerts.
   */
  getActiveAlerts({ limit = 20, severity = null } = {}) {
    let list = this.alerts
    if (severity) {
      list = list.filter((a) => a.severity === severity)
    }
    return list.slice(0, limit)
  }

  /**
   * Clears alerts and cooldowns (useful in tests and manual maintenance).
   */
  clear() {
    this.alerts = []
    this.cooldowns.clear()
  }
}

const securityAlertService = new SecurityAlertService()
export default securityAlertService
