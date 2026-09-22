import DownloadSecurityEvent from "../Modals/DownloadSecurityEvent.js"
import securityPolicyService from "./securityPolicyService.js"
import { downloadSecurityConfig } from "../config/index.js"

/**
 * Service calculating user and device risk scores with mathematical time decay.
 */
export class RiskAssessmentService {
  constructor(config = downloadSecurityConfig) {
    this.config = config
  }

  /**
   * Calculates total active risk score for a user or device, applying time decay.
   * Older events decay linearly towards 0 over decayHours.
   */
  async calculateRiskScore({ userId, deviceId, windowHours = null } = {}) {
    if (!userId && !deviceId) {
      return { riskScore: 0, riskLevel: "low", activeFlags: [], eventsCount: 0 }
    }

    const decayHours = windowHours !== null ? Number(windowHours) : (this.config?.decayHours || 24)
    const windowMs = decayHours * 60 * 60 * 1000
    const cutoffDate = new Date(Date.now() - windowMs)

    const query = {
      createdAt: { $gte: cutoffDate },
      status: { $in: ["open", "investigating"] },
    }

    const isGenericDevice =
      !deviceId ||
      ["web", "unknown", "browser", "default"].includes(String(deviceId).toLowerCase().trim())

    if (userId && deviceId && !isGenericDevice) {
      query.$or = [{ userId }, { user_id: userId }, { deviceId }, { device_id: deviceId }]
    } else if (userId) {
      query.$or = [{ userId }, { user_id: userId }]
    } else if (deviceId && !isGenericDevice) {
      query.$or = [{ deviceId }, { device_id: deviceId }]
    } else {
      return { riskScore: 0, riskLevel: "low", activeFlags: [], eventsCount: 0 }
    }

    const events = await DownloadSecurityEvent.find(query).lean()

    if (!events || events.length === 0) {
      return { riskScore: 0, riskLevel: "low", activeFlags: [], eventsCount: 0 }
    }

    const now = Date.now()
    let totalScore = 0
    const flagsSet = new Set()

    for (const event of events) {
      const ageMs = Math.max(0, now - new Date(event.createdAt).getTime())
      // Linear time decay: 1 at age 0, 0 at windowMs
      const decayFactor = Math.max(0, 1 - ageMs / windowMs)
      const basePoints = (event.riskPoints || 0) * (event.event_count || 1)
      totalScore += basePoints * decayFactor

      if (event.eventType) {
        flagsSet.add(event.eventType)
      }
    }

    const roundedScore = Math.round(totalScore)
    const riskLevel = securityPolicyService.getRiskLevel(roundedScore)

    return {
      riskScore: roundedScore,
      riskLevel,
      activeFlags: Array.from(flagsSet),
      eventsCount: events.length,
    }
  }
}

export const riskAssessmentService = new RiskAssessmentService()
export default riskAssessmentService
