/**
 * Login Detection & Comparison Service (Phase 6)
 *
 * Compares incoming login context (device signature, browser, OS, public IP, location)
 * against the user's historical baseline to identify unrecognized environments,
 * new devices, and unusual geographic locations.
 */

import Device from "../Modals/Device.js"
import Session from "../Modals/Session.js"
import {
  calculateRiskLevel,
  reasonsFromFlags,
  formatDetectionSummary,
} from "../utils/detectionUtils.js"
import { deviceService } from "./deviceService.js"

export class LoginDetectionService {
  /**
   * Evaluates incoming login context against the user's recorded historical baseline.
   *
   * @param {string|ObjectId} userId - User identifier
   * @param {Object} currentLoginContext - Current loginContext (device + network)
   * @returns {Promise<Object>} Standardized detectionResult
   */
  async evaluateLoginContext(userId, currentLoginContext = {}) {
    try {
      if (!userId) {
        return this.createDefaultResult(true)
      }

      // 1. Fetch user's active/unrevoked recorded devices
      const knownDevices = await Device.find({
        userId,
        status: { $ne: "revoked" },
      })
        .lean()
        .catch(() => [])

      // 2. Fetch user's recent sessions for baseline context
      const recentSessions = await Session.find({
        userId,
        revokedAt: null,
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean()
        .catch(() => [])

      const baselineCount = knownDevices.length + recentSessions.length

      // 3. Initial Baseline: if 0 historical records exist, seed without false alarms
      if (baselineCount === 0) {
        return {
          isUnrecognizedLogin: false,
          isInitialBaseline: true,
          flags: {
            isNewDevice: false,
            isNewBrowser: false,
            isNewOperatingSystem: false,
            isNewIP: false,
            isNewLocation: false,
            isNewCountry: false,
            isNewCity: false,
          },
          isNewDevice: false,
          isNewBrowser: false,
          isNewOperatingSystem: false,
          isNewIP: false,
          isNewLocation: false,
          isNewCountry: false,
          isNewCity: false,
          reasons: [],
          riskLevel: "low",
          riskScore: 0,
          requiresVerification: false,
          baselineCount: 0,
          summary: "Initial login baseline recorded",
          evaluatedAt: new Date().toISOString(),
        }
      }

      // 4. Build known historical sets
      const knownSignatures = new Set()
      const knownBrowsers = new Set()
      const knownOSs = new Set()
      const knownIPs = new Set()
      const knownCountries = new Set()
      const knownCities = new Set()

      // Populate from known devices
      for (const dev of knownDevices) {
        if (dev.device_identifier) knownSignatures.add(dev.device_identifier)
        if (dev.browser) knownBrowsers.add(dev.browser.toLowerCase().trim())
        if (dev.operating_system) knownOSs.add(dev.operating_system.toLowerCase().trim())
        if (dev.last_ip_address) knownIPs.add(dev.last_ip_address.trim())
        if (dev.location?.countryCode) knownCountries.add(dev.location.countryCode.toUpperCase().trim())
        if (dev.location?.country) knownCountries.add(dev.location.country.toUpperCase().trim())
        if (dev.location?.city) knownCities.add(dev.location.city.toLowerCase().trim())
      }

      // Populate from recent sessions
      for (const sess of recentSessions) {
        const dMeta = sess.deviceMetadata || sess.loginContext?.device
        if (dMeta?.signature) knownSignatures.add(dMeta.signature)
        if (dMeta?.browser?.name) knownBrowsers.add(dMeta.browser.name.toLowerCase().trim())
        if (dMeta?.operatingSystem?.name) knownOSs.add(dMeta.operatingSystem.name.toLowerCase().trim())

        const net = sess.networkInfo || sess.loginContext?.network
        const sessIp = net?.ip?.address || sess.ip
        if (sessIp) knownIPs.add(sessIp.trim())

        const loc = net?.location
        if (loc?.countryCode) knownCountries.add(loc.countryCode.toUpperCase().trim())
        if (loc?.country) knownCountries.add(loc.country.toUpperCase().trim())
        if (loc?.city) knownCities.add(loc.city.toLowerCase().trim())
      }

      // 5. Evaluate current login context against known sets
      const currentDev = currentLoginContext.device || {}
      const currentNet = currentLoginContext.network || {}
      const currentLoc = currentNet.location || {}

      const currentSig = currentDev.signature || ""
      const currentBrowser = (currentDev.browser?.name || "").toLowerCase().trim()
      const currentOS = (currentDev.operatingSystem?.name || "").toLowerCase().trim()
      const currentIP = (currentNet.ip?.address || "").trim()
      const isPublicIP = currentNet.ip?.isPublic === true

      const currentCountryCode = (currentLoc.countryCode || "").toUpperCase().trim()
      const currentCountryName = (currentLoc.country || "").toUpperCase().trim()
      const currentCity = (currentLoc.city || "").toLowerCase().trim()
      const hasLocationData = currentLoc.status === "available"

      // Flags evaluation
      const isNewDevice =
        currentSig && currentSig !== "unknown:0:unknown:0:unknown:unknown"
          ? !knownSignatures.has(currentSig)
          : false

      const isNewBrowser =
        currentBrowser && currentBrowser !== "unknown"
          ? !knownBrowsers.has(currentBrowser)
          : false

      const isNewOperatingSystem =
        currentOS && currentOS !== "unknown"
          ? !knownOSs.has(currentOS)
          : false

      // Only check isNewIP if the address is a valid public IP
      const isNewIP =
        isPublicIP && currentIP
          ? !knownIPs.has(currentIP)
          : false

      // Location checks: only when location is actually available
      let isNewCountry = false
      if (hasLocationData && (currentCountryCode || currentCountryName)) {
        const matchesCode = currentCountryCode && knownCountries.has(currentCountryCode)
        const matchesName = currentCountryName && knownCountries.has(currentCountryName)
        isNewCountry = !matchesCode && !matchesName
      }

      let isNewCity = false
      if (hasLocationData && currentCity) {
        isNewCity = !knownCities.has(currentCity)
      }

      const isNewLocation = isNewCountry || isNewCity

      // Unrecognized login heuristic:
      // True if new device, OR new country, OR combination of new browser + new location
      const isUnrecognizedLogin =
        isNewDevice ||
        isNewCountry ||
        (isNewBrowser && isNewLocation)

      const flags = {
        isNewDevice,
        isNewBrowser,
        isNewOperatingSystem,
        isNewIP,
        isNewLocation,
        isNewCountry,
        isNewCity,
      }

      const { riskLevel, riskScore } = calculateRiskLevel(flags, false)
      const reasons = reasonsFromFlags(flags)

      // Prepared for Phase 7 (OTP Verification)
      const requiresVerification = isUnrecognizedLogin && (riskLevel === "high" || isNewCountry)

      const detectionResult = {
        isUnrecognizedLogin,
        isInitialBaseline: false,
        flags,
        isNewDevice: flags.isNewDevice,
        isNewBrowser: flags.isNewBrowser,
        isNewOperatingSystem: flags.isNewOperatingSystem,
        isNewIP: flags.isNewIP,
        isNewLocation: flags.isNewLocation,
        isNewCountry: flags.isNewCountry,
        isNewCity: flags.isNewCity,
        reasons,
        riskLevel,
        riskScore,
        requiresVerification,
        baselineCount,
        summary: formatDetectionSummary({ isUnrecognizedLogin, flags }, currentLoginContext),
        evaluatedAt: new Date().toISOString(),
      }

      return detectionResult
    } catch (err) {
      console.warn("[LoginDetectionService] Non-fatal evaluation error:", err)
      return this.createDefaultResult(false)
    }
  }

  /**
   * Records or updates the login device baseline in MongoDB.
   */
  async recordLoginBaseline(userId, loginContext = {}, detectionResult = {}) {
    try {
      if (!userId) return null

      const currentDev = loginContext.device || {}
      const currentNet = loginContext.network || {}
      const currentLoc = currentNet.location || {}

      const sig =
        currentDev.signature ||
        `generic:${Date.now()}`

      const deviceType = (currentDev.device?.type || "desktop").toLowerCase()
      const deviceName =
        deviceService.formatDeviceName(currentDev) ||
        "Web Browser"

      const updates = {
        device_name: deviceName,
        device_type: ["desktop", "mobile", "tablet"].includes(deviceType)
          ? deviceType
          : "desktop",
        browser: currentDev.browser?.name || "Unknown Browser",
        operating_system: currentDev.operatingSystem?.name || "Unknown OS",
        user_agent: currentDev.userAgent || "",
        last_ip_address: currentNet.ip?.address || "",
        last_seen_at: new Date(),
        location: {
          city: currentLoc.city || null,
          state: currentLoc.state || null,
          country: currentLoc.country || null,
          countryCode: currentLoc.countryCode || null,
        },
      }

      // Upsert device record
      const device = await Device.findOneAndUpdate(
        { userId, device_identifier: sig },
        {
          $set: updates,
          $setOnInsert: {
            first_seen_at: new Date(),
            is_trusted: true,
            trusted: true,
            status: "active",
          },
        },
        { upsert: true, new: true }
      )

      return device
    } catch (err) {
      console.warn("[LoginDetectionService] Non-fatal baseline record warning:", err)
      return null
    }
  }

  /**
   * Generates a safe fallback detection result.
   */
  createDefaultResult(isInitial = false) {
    return {
      isUnrecognizedLogin: false,
      isInitialBaseline: isInitial,
      flags: {
        isNewDevice: false,
        isNewBrowser: false,
        isNewOperatingSystem: false,
        isNewIP: false,
        isNewLocation: false,
        isNewCountry: false,
        isNewCity: false,
      },
      isNewDevice: false,
      isNewBrowser: false,
      isNewOperatingSystem: false,
      isNewIP: false,
      isNewLocation: false,
      isNewCountry: false,
      isNewCity: false,
      reasons: [],
      riskLevel: "low",
      riskScore: 0,
      requiresVerification: false,
      baselineCount: 0,
      summary: isInitial
        ? "Initial login baseline recorded"
        : "Recognized device and environment",
      evaluatedAt: new Date().toISOString(),
    }
  }
}

export const loginDetectionService = new LoginDetectionService()
export default loginDetectionService
