/**
 * Location Utilities (Phase 5)
 *
 * Helper functions for coordinate validation, location string formatting,
 * and standard unavailable location builders.
 */

/**
 * Validates and normalizes latitude or longitude.
 */
export function normalizeCoordinate(val, min = -90, max = 90) {
  if (val === null || val === undefined || val === "") return null
  const num = typeof val === "number" ? val : parseFloat(val)
  if (isNaN(num) || num < min || num > max) return null
  // Round to 4 decimal places (~11 meters approx, preserving privacy)
  return Math.round(num * 10000) / 10000
}

/**
 * Formats a location object into a clean human-readable string.
 * Examples:
 * - "Kapurthala, Punjab, India"
 * - "Punjab, India"
 * - "India"
 * - "Location Unavailable"
 */
export function formatLocationString(loc = {}) {
  if (!loc || loc.status !== "available") {
    return "Location Unavailable"
  }

  const parts = []
  if (loc.city && loc.city !== "Unknown") parts.push(loc.city)
  if (loc.state && loc.state !== "Unknown") parts.push(loc.state)
  if (loc.country && loc.country !== "Unknown") parts.push(loc.country)

  return parts.length > 0 ? parts.join(", ") : "Location Unavailable"
}

/**
 * Creates a standardized unavailable location object.
 */
export function createUnavailableLocation(status = "unavailable", source = "internal") {
  return {
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
    source,
    status,
  }
}
