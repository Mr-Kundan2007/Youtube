/**
 * IP Geolocation Provider Layer (Phase 5)
 *
 * Modular provider implementation with timeout protection, rate-limit awareness,
 * and reliable fallback handling.
 */

import { normalizeLocationData } from "../validators/locationValidator.js"
import { createUnavailableLocation } from "../utils/locationUtils.js"

export class IPLocationProvider {
  constructor(config = {}) {
    this.providerName = config.ipGeolocationProvider || "ip-api"
    this.apiKey = config.ipGeolocationApiKey || ""
    this.timeoutMs = config.lookupTimeoutMs || 2000
  }

  /**
   * Performs an approximate geolocation lookup for a public IP address.
   * Never throws — always returns a standardized location object with appropriate status.
   */
  async lookup(ipAddress, options = {}) {
    const timeout = options.timeoutMs || this.timeoutMs

    // Support mock provider for offline testing and unit tests
    if (this.providerName === "mock" || options.mockData) {
      if (options.mockData) {
        return normalizeLocationData(options.mockData, "mock-provider")
      }
      return {
        city: "Kapurthala",
        state: "Punjab",
        stateCode: "PB",
        country: "India",
        countryCode: "IN",
        latitude: 31.38,
        longitude: 75.38,
        timezone: "Asia/Kolkata",
        isp: "Example Network",
        accuracy: "approximate",
        source: "mock-provider",
        status: "available",
      }
    }

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeout)

      let result
      try {
        if (this.providerName === "ipwhois") {
          result = await this.lookupIpWhois(ipAddress, controller.signal)
        } else {
          // Default: ip-api.com
          result = await this.lookupIpApi(ipAddress, controller.signal)
        }
      } finally {
        clearTimeout(timer)
      }

      return result
    } catch (err) {
      if (err.name === "AbortError" || err.code === "ABORT_ERR") {
        return createUnavailableLocation("timeout", this.providerName)
      }
      return createUnavailableLocation("unavailable", this.providerName)
    }
  }

  /**
   * Queries ip-api.com (JSON endpoint).
   */
  async lookupIpApi(ip, signal) {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,query`
    const res = await fetch(url, { signal })

    if (res.status === 429) {
      return createUnavailableLocation("rate_limited", "ip-api")
    }

    if (!res.ok) {
      return createUnavailableLocation("unavailable", "ip-api")
    }

    const data = await res.json()
    if (data.status === "fail") {
      if (/rate/i.test(data.message || "")) {
        return createUnavailableLocation("rate_limited", "ip-api")
      }
      return createUnavailableLocation("unavailable", "ip-api")
    }

    return normalizeLocationData(data, "ip-api")
  }

  /**
   * Fallback provider: ipwhois.app
   */
  async lookupIpWhois(ip, signal) {
    const url = `https://ipwhois.app/json/${encodeURIComponent(ip)}`
    const res = await fetch(url, { signal })

    if (res.status === 429) {
      return createUnavailableLocation("rate_limited", "ipwhois")
    }

    if (!res.ok) {
      return createUnavailableLocation("unavailable", "ipwhois")
    }

    const data = await res.json()
    if (data.success === false) {
      return createUnavailableLocation("unavailable", "ipwhois")
    }

    return normalizeLocationData(
      {
        city: data.city,
        regionName: data.region,
        regionCode: data.region_code,
        country: data.country,
        countryCode: data.country_code,
        lat: data.latitude,
        lon: data.longitude,
        timezone: data.timezone,
        isp: data.isp,
      },
      "ipwhois"
    )
  }
}

export default IPLocationProvider
