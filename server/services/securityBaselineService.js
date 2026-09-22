/**
 * Security Baseline Service (Phase 6)
 *
 * Manages the persistent SecurityBaseline records for users: retrieval,
 * initial baseline creation for first-time sign-ins, and controlled baseline
 * updates upon verified authentication.
 */

import SecurityBaseline from "../Modals/SecurityBaseline.js"
import {
  canonicalBrowserFamily,
  createDeviceComparisonKey,
  isReliableLocation,
  normalizeString,
} from "../utils/comparisonUtils.js"
import { normalizeIP, isPrivateIP } from "../utils/ipUtils.js"
import { BASELINE_LIMITS } from "../config/securityRiskConfig.js"
import { loginDetectionService } from "./loginDetectionService.js"

export class SecurityBaselineService {
  /**
   * Retrieves the current security baseline for a user.
   */
  async getBaseline(userId) {
    if (!userId) return null
    try {
      return await SecurityBaseline.findOne({ userId }).lean()
    } catch (err) {
      console.error("[SecurityBaselineService] Error fetching baseline:", err)
      return null
    }
  }

  /**
   * Creates an initial verified baseline for a first-time user login or signup.
   */
  async createInitialBaseline(userId, loginContext = {}) {
    if (!userId) return null

    try {
      const dev = loginContext.device || {}
      const net = loginContext.network || {}
      const loc = net.location || {}

      const browserFamily = canonicalBrowserFamily(
        dev.browser?.name || dev.browserFamily || "chrome"
      )
      const majorVersion = String(dev.browser?.major || dev.browser?.version || "").split(".")[0]
      const comparisonKey = createDeviceComparisonKey(dev)
      const clientIp = net.ipAddress || net.ip?.address || loginContext.clientIp || "127.0.0.1"
      const { ipAddress } = normalizeIP(clientIp)
      const isPublic = !isPrivateIP(ipAddress)

      const verifiedBrowsers = [
        {
          browserFamily,
          majorVersion,
          lastSeenAt: new Date(),
        },
      ]

      const verifiedDevices = [
        {
          deviceComparisonKey: comparisonKey,
          deviceType: dev.type || "desktop",
          model: dev.model || "Unknown",
          vendor: dev.vendor || "Unknown",
          osName: dev.os?.name || "Unknown",
          browserFamily,
          lastSeenAt: new Date(),
        },
      ]

      const verifiedIPs = [
        {
          ipAddress,
          isPublic,
          lastSeenAt: new Date(),
        },
      ]

      const verifiedLocations = []
      if (isReliableLocation(loc)) {
        verifiedLocations.push({
          city: loc.city || null,
          state: loc.state || null,
          stateCode: loc.stateCode || null,
          country: loc.country || null,
          countryCode: loc.countryCode || null,
          lastSeenAt: new Date(),
        })
      }

      const baseline = await SecurityBaseline.findOneAndUpdate(
        { userId },
        {
          $setOnInsert: {
            userId,
            verifiedBrowsers,
            verifiedDevices,
            verifiedIPs,
            verifiedLocations,
            lastVerifiedLogin: {
              timestamp: new Date(),
              ip: ipAddress,
              location: loc,
              device: dev,
            },
          },
        },
        { upsert: true, new: true }
      )

      // Also ensure device tracking baseline is synchronized
      await loginDetectionService.recordLoginBaseline(userId, loginContext, { isInitialBaseline: true })

      return baseline
    } catch (err) {
      console.error("[SecurityBaselineService] Error creating initial baseline:", err)
      return null
    }
  }

  /**
   * Updates an existing verified baseline with newly verified environment elements.
   * This is called ONLY after an ALLOW decision or successful OTP/MFA verification!
   */
  async updateVerifiedBaseline(userId, loginContext = {}) {
    if (!userId) return null

    try {
      let baseline = await SecurityBaseline.findOne({ userId })
      if (!baseline) {
        return await this.createInitialBaseline(userId, loginContext)
      }

      const dev = loginContext.device || {}
      const net = loginContext.network || {}
      const loc = net.location || {}

      const browserFamily = canonicalBrowserFamily(
        dev.browser?.name || dev.browserFamily || "chrome"
      )
      const majorVersion = String(dev.browser?.major || dev.browser?.version || "").split(".")[0]
      const comparisonKey = createDeviceComparisonKey(dev)
      const clientIp = net.ipAddress || net.ip?.address || loginContext.clientIp || "127.0.0.1"
      const { ipAddress } = normalizeIP(clientIp)
      const isPublic = !isPrivateIP(ipAddress)

      // 1. Update verified browsers
      const existingBrowserIdx = baseline.verifiedBrowsers.findIndex(
        (b) => b.browserFamily.toLowerCase() === browserFamily.toLowerCase()
      )
      if (existingBrowserIdx >= 0) {
        baseline.verifiedBrowsers[existingBrowserIdx].lastSeenAt = new Date()
        if (majorVersion) {
          baseline.verifiedBrowsers[existingBrowserIdx].majorVersion = majorVersion
        }
      } else {
        baseline.verifiedBrowsers.unshift({
          browserFamily,
          majorVersion,
          lastSeenAt: new Date(),
        })
        if (baseline.verifiedBrowsers.length > BASELINE_LIMITS.MAX_VERIFIED_BROWSERS) {
          baseline.verifiedBrowsers = baseline.verifiedBrowsers.slice(0, BASELINE_LIMITS.MAX_VERIFIED_BROWSERS)
        }
      }

      // 2. Update verified devices
      const existingDeviceIdx = baseline.verifiedDevices.findIndex(
        (d) => d.deviceComparisonKey === comparisonKey
      )
      if (existingDeviceIdx >= 0) {
        baseline.verifiedDevices[existingDeviceIdx].lastSeenAt = new Date()
      } else {
        baseline.verifiedDevices.unshift({
          deviceComparisonKey: comparisonKey,
          deviceType: dev.type || "desktop",
          model: dev.model || "Unknown",
          vendor: dev.vendor || "Unknown",
          osName: dev.os?.name || "Unknown",
          browserFamily,
          lastSeenAt: new Date(),
        })
        if (baseline.verifiedDevices.length > BASELINE_LIMITS.MAX_VERIFIED_DEVICES) {
          baseline.verifiedDevices = baseline.verifiedDevices.slice(0, BASELINE_LIMITS.MAX_VERIFIED_DEVICES)
        }
      }

      // 3. Update verified IPs
      const existingIpIdx = baseline.verifiedIPs.findIndex((i) => {
        return normalizeIP(i.ipAddress).ipAddress === ipAddress
      })
      if (existingIpIdx >= 0) {
        baseline.verifiedIPs[existingIpIdx].lastSeenAt = new Date()
      } else {
        baseline.verifiedIPs.unshift({
          ipAddress,
          isPublic,
          lastSeenAt: new Date(),
        })
        if (baseline.verifiedIPs.length > BASELINE_LIMITS.MAX_VERIFIED_IPS) {
          baseline.verifiedIPs = baseline.verifiedIPs.slice(0, BASELINE_LIMITS.MAX_VERIFIED_IPS)
        }
      }

      // 4. Update verified locations if reliable
      if (isReliableLocation(loc)) {
        const normCity = normalizeString(loc.city)
        const normCountry = normalizeString(loc.countryCode || loc.country)

        const existingLocIdx = baseline.verifiedLocations.findIndex((l) => {
          const lCity = normalizeString(l.city)
          const lCountry = normalizeString(l.countryCode || l.country)
          return lCity === normCity && lCountry === normCountry
        })

        if (existingLocIdx >= 0) {
          baseline.verifiedLocations[existingLocIdx].lastSeenAt = new Date()
        } else {
          baseline.verifiedLocations.unshift({
            city: loc.city || null,
            state: loc.state || null,
            stateCode: loc.stateCode || null,
            country: loc.country || null,
            countryCode: loc.countryCode || null,
            lastSeenAt: new Date(),
          })
          if (baseline.verifiedLocations.length > BASELINE_LIMITS.MAX_VERIFIED_LOCATIONS) {
            baseline.verifiedLocations = baseline.verifiedLocations.slice(0, BASELINE_LIMITS.MAX_VERIFIED_LOCATIONS)
          }
        }
      }

      // 5. Update last verified login metadata
      baseline.lastVerifiedLogin = {
        timestamp: new Date(),
        ip: ipAddress,
        location: loc,
        device: dev,
      }

      await baseline.save()

      // Sync device model as well
      await loginDetectionService.recordLoginBaseline(userId, loginContext, { isInitialBaseline: false })

      return baseline
    } catch (err) {
      console.error("[SecurityBaselineService] Error updating verified baseline:", err)
      return null
    }
  }
}

export const securityBaselineService = new SecurityBaselineService()
export default securityBaselineService
