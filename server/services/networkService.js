/**
 * Central Network & Login Context Service (Phase 5)
 *
 * Integrates client IP detection and approximate geolocation into standardized
 * login network metadata and complete security login context.
 */

import { getClientIPAddress } from "../utils/ipUtils.js"
import { locationService } from "./locationService.js"

export class NetworkService {
  constructor(locService = locationService) {
    this.locationService = locService
  }

  /**
   * Resolves public/private IP and approximate location for an incoming request.
   *
   * @param {Object} req - Express request object
   * @param {Object} options - Custom options (mocking, timeout override, etc.)
   * @returns {Promise<Object>} Standardized loginNetworkInfo
   */
  async getLoginNetworkInfo(req = {}, options = {}) {
    try {
      // 1. Detect and normalize client IP address
      const ipData = getClientIPAddress(req, options)

      // 2. Look up approximate location
      const locationData = await this.locationService.getLocationForIP(
        ipData.ipAddress,
        options
      )

      return {
        ip: {
          address: ipData.ipAddress,
          version: ipData.ipVersion,
          isPublic: ipData.isPublic,
          source: ipData.source,
        },
        location: locationData,
      }
    } catch (err) {
      console.warn("[NetworkService] Error resolving network metadata:", err)
      return {
        ip: {
          address: "127.0.0.1",
          version: "IPv4",
          isPublic: false,
          source: "error-fallback",
        },
        location: {
          city: null,
          state: null,
          stateCode: null,
          country: null,
          countryCode: null,
          latitude: null,
          longitude: null,
          timezone: null,
          isp: null,
          accuracy: "approximate",
          status: "unavailable",
          source: "internal-fallback",
        },
      }
    }
  }

  /**
   * Combines Phase 4 device metadata with Phase 5 network and location metadata
   * into the standardized loginContext ready for Phase 6 security comparison.
   *
   * @param {Object} deviceMetadata - Phase 4 device metadata
   * @param {Object} networkInfo - Phase 5 loginNetworkInfo
   * @returns {Object} Standardized loginContext
   */
  buildLoginContext(deviceMetadata = {}, networkInfo = {}) {
    return {
      device: deviceMetadata,
      network: networkInfo,
      detectedAt: new Date().toISOString(),
    }
  }

  /**
   * Formats a summary string of network info.
   * e.g. "203.0.113.10 (Kapurthala, Punjab, India)"
   */
  formatNetworkSummary(networkInfo = {}) {
    const ip = networkInfo.ip?.address || "Unknown IP"
    const locStr = this.locationService.formatLocation(networkInfo.location)
    return locStr && locStr !== "Location Unavailable"
      ? `${ip} (${locStr})`
      : ip
  }
}

export const networkService = new NetworkService()
export default networkService
