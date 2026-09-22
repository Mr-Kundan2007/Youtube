import DownloadRecord from "../Modals/DownloadRecord.js"
import { downloadSecurityConfig } from "../config/index.js"

/**
 * High-performance abuse detection service providing in-memory sliding window
 * rate limiting and behavioral pattern detection (rapid device switching, rapid IP changes).
 */
export class DownloadAbuseService {
  constructor(config = downloadSecurityConfig) {
    this.config = config
    // In-memory sliding window request timestamps
    this.userRequests = new Map()
    this.deviceRequests = new Map()
    this.ipRequests = new Map()

    // Periodic cleanup of stale tracking data every 5 minutes
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000)
    if (this.cleanupTimer.unref) this.cleanupTimer.unref()
  }

  /**
   * Slides window and cleans expired timestamps.
   */
  pruneTimestamps(timestamps, windowMs) {
    const cutoff = Date.now() - windowMs
    return timestamps.filter((t) => t > cutoff)
  }

  /**
   * Evaluates request rate limits for user, device, and client IP.
   */
  checkRateLimits({ userId, deviceId, clientIp } = {}) {
    const now = Date.now()
    const windowMs = this.config?.rateLimits?.windowMs || 60 * 1000
    const limits = this.config?.rateLimits || {
      userRequestsPerMinute: 20,
      deviceRequestsPerMinute: 20,
      ipRequestsPerMinute: 60,
    }

    // 1. User rate limit check
    if (userId) {
      const uKey = String(userId)
      const uHistory = this.pruneTimestamps(this.userRequests.get(uKey) || [], windowMs)
      if (uHistory.length >= limits.userRequestsPerMinute) {
        return {
          limited: true,
          limitType: "user",
          current: uHistory.length,
          max: limits.userRequestsPerMinute,
          retryAfter: Math.ceil((uHistory[0] + windowMs - now) / 1000),
        }
      }
      uHistory.push(now)
      this.userRequests.set(uKey, uHistory)
    }

    // 2. Device rate limit check
    if (deviceId && deviceId !== "web" && deviceId !== "device_web_default") {
      const dKey = String(deviceId)
      const dHistory = this.pruneTimestamps(this.deviceRequests.get(dKey) || [], windowMs)
      if (dHistory.length >= limits.deviceRequestsPerMinute) {
        return {
          limited: true,
          limitType: "device",
          current: dHistory.length,
          max: limits.deviceRequestsPerMinute,
          retryAfter: Math.ceil((dHistory[0] + windowMs - now) / 1000),
        }
      }
      dHistory.push(now)
      this.deviceRequests.set(dKey, dHistory)
    }

    // 3. IP rate limit check
    if (clientIp) {
      const ipKey = String(clientIp)
      const ipHistory = this.pruneTimestamps(this.ipRequests.get(ipKey) || [], windowMs)
      if (ipHistory.length >= limits.ipRequestsPerMinute) {
        return {
          limited: true,
          limitType: "ip",
          current: ipHistory.length,
          max: limits.ipRequestsPerMinute,
          retryAfter: Math.ceil((ipHistory[0] + windowMs - now) / 1000),
        }
      }
      ipHistory.push(now)
      this.ipRequests.set(ipKey, ipHistory)
    }

    return { limited: false }
  }

  /**
   * Detects rapid device switching across a short time window.
   */
  async detectRapidDeviceSwitch(userId, currentDeviceId, windowMinutes = null, threshold = null) {
    if (!userId || !currentDeviceId) return { detected: false, count: 0, devices: [] }

    const winMin = windowMinutes || this.config?.rapidDeviceSwitchWindowMinutes || 10
    const thresh = threshold || this.config?.rapidDeviceSwitchThreshold || 3
    const cutoff = new Date(Date.now() - winMin * 60 * 1000)

    const recentRecords = await DownloadRecord.find({
      $or: [{ userId }, { user_id: userId }],
      createdAt: { $gte: cutoff },
    })
      .select("device_id createdAt")
      .lean()

    const devices = new Set()
    devices.add(currentDeviceId)

    for (const r of recentRecords) {
      if (r.device_id) devices.add(r.device_id)
    }

    if (devices.size >= thresh) {
      return {
        detected: true,
        count: devices.size,
        devices: Array.from(devices),
        windowMinutes: winMin,
      }
    }

    return { detected: false, count: devices.size, devices: Array.from(devices) }
  }

  /**
   * Detects rapid IP address switching across a short time window.
   */
  async detectRapidIpChange(userId, currentIp, windowMinutes = null, threshold = null) {
    if (!userId || !currentIp) return { detected: false, count: 0, ips: [] }

    const winMin = windowMinutes || this.config?.rapidIpChangeWindowMinutes || 10
    const thresh = threshold || this.config?.rapidIpChangeThreshold || 3
    const cutoff = new Date(Date.now() - winMin * 60 * 1000)

    const recentRecords = await DownloadRecord.find({
      $or: [{ userId }, { user_id: userId }],
      createdAt: { $gte: cutoff },
    })
      .select("ip_address createdAt")
      .lean()

    const ips = new Set()
    ips.add(currentIp)

    for (const r of recentRecords) {
      if (r.ip_address) ips.add(r.ip_address)
    }

    if (ips.size >= thresh) {
      return {
        detected: true,
        count: ips.size,
        ips: Array.from(ips),
        windowMinutes: winMin,
      }
    }

    return { detected: false, count: ips.size, ips: Array.from(ips) }
  }

  /**
   * Cleans internal memory maps.
   */
  cleanup() {
    const windowMs = this.config?.rateLimits?.windowMs || 60 * 1000
    for (const [key, history] of this.userRequests.entries()) {
      const pruned = this.pruneTimestamps(history, windowMs)
      if (pruned.length === 0) this.userRequests.delete(key)
      else this.userRequests.set(key, pruned)
    }
    for (const [key, history] of this.deviceRequests.entries()) {
      const pruned = this.pruneTimestamps(history, windowMs)
      if (pruned.length === 0) this.deviceRequests.delete(key)
      else this.deviceRequests.set(key, pruned)
    }
    for (const [key, history] of this.ipRequests.entries()) {
      const pruned = this.pruneTimestamps(history, windowMs)
      if (pruned.length === 0) this.ipRequests.delete(key)
      else this.ipRequests.set(key, pruned)
    }
  }

  /**
   * Resets internal maps (used for testing).
   */
  reset() {
    this.userRequests.clear()
    this.deviceRequests.clear()
    this.ipRequests.clear()
  }
}

export const downloadAbuseService = new DownloadAbuseService()
export default downloadAbuseService
