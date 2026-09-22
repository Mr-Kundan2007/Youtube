/**
 * Central Location Service (Phase 5)
 *
 * Coordinates IP geolocation lookups with an in-memory TTL cache,
 * private IP avoidance, and non-blocking timeout handling.
 */

import { securityConfig } from "../config/securityConfig.js"
import { isPrivateIP } from "../utils/ipUtils.js"
import { createUnavailableLocation, formatLocationString } from "../utils/locationUtils.js"
import { IPLocationProvider } from "../providers/ipLocationProvider.js"

export class LocationService {
  constructor(config = securityConfig) {
    this.config = config
    this.provider = new IPLocationProvider(config)
    this.cache = new Map() // In-memory cache: ip -> { location, expiresAt }
  }

  /**
   * Retrieves approximate location for an IP address.
   * If the IP is private or loopback, returns unavailable status immediately without network call.
   */
  async getLocationForIP(ipAddress = "", options = {}) {
    if (!this.config.locationTrackingEnabled) {
      return createUnavailableLocation("unavailable", "disabled")
    }

    if (!ipAddress || isPrivateIP(ipAddress)) {
      return createUnavailableLocation("unavailable", "private-ip")
    }

    // Check in-memory cache
    const cached = this.cache.get(ipAddress)
    if (cached) {
      if (Date.now() < cached.expiresAt) {
        return {
          ...cached.location,
          source: `${cached.location.source || "ip-geolocation"}:cache`,
        }
      }
      this.cache.delete(ipAddress)
    }

    // Query location provider
    const location = await this.provider.lookup(ipAddress, options)

    // Cache successful lookups
    if (location && location.status === "available") {
      const ttlMs = (this.config.cacheTtlSeconds || 3600) * 1000
      this.cache.set(ipAddress, {
        location,
        expiresAt: Date.now() + ttlMs,
      })

      // Clean up cache if it exceeds 10,000 entries
      if (this.cache.size > 10000) {
        const now = Date.now()
        for (const [key, val] of this.cache.entries()) {
          if (val.expiresAt < now) {
            this.cache.delete(key)
          }
        }
      }
    }

    return location
  }

  /**
   * Formats location into a user-friendly string.
   */
  formatLocation(loc) {
    return formatLocationString(loc)
  }

  /**
   * Clears the in-memory cache (useful in tests).
   */
  clearCache() {
    this.cache.clear()
  }
}

export const locationService = new LocationService()
export default locationService
