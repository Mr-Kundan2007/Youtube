/**
 * Security & Network Configuration (Phase 5)
 *
 * Configures trusted proxies, location tracking settings, and geolocation provider options.
 */

import dotenv from "dotenv"
import fs from "fs"

if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" })
}
dotenv.config()

const getEnv = (key, defaultValue = "") => {
  return process.env[key] !== undefined ? process.env[key] : defaultValue
}

export const securityConfig = {
  // Trusted proxy configuration for Express:
  // - "loopback, linklocal, uniquelocal" (default safe setting for standard reverse proxies)
  // - or custom IP/CIDR/boolean e.g. "127.0.0.1, 10.0.0.0/8"
  trustedProxies: getEnv("TRUSTED_PROXIES", "loopback, linklocal, uniquelocal"),

  // Master switch for location tracking (can be disabled in testing or local dev)
  locationTrackingEnabled: getEnv("LOCATION_TRACKING_ENABLED", "true") === "true",

  // Geolocation provider: "ip-api" | "ipwhois" | "mock"
  ipGeolocationProvider: getEnv("IP_GEOLOCATION_PROVIDER", "ip-api"),

  // Optional API key for commercial geolocation providers
  ipGeolocationApiKey: getEnv("IP_GEOLOCATION_API_KEY", ""),

  // Max timeout for location lookups to ensure login is NEVER blocked
  lookupTimeoutMs: Number(getEnv("LOCATION_LOOKUP_TIMEOUT_MS", 2000)),

  // In-memory cache TTL for IP location lookups (in seconds, default 1 hour)
  cacheTtlSeconds: Number(getEnv("LOCATION_CACHE_TTL_SECONDS", 3600)),
}

export default securityConfig
