/**
 * Location Data Validator & Normalizer (Phase 5)
 *
 * Normalizes disparate vendor field keys (regionName, country_name, lat/lon)
 * and sanitizes geolocation payloads.
 */

import { normalizeCoordinate } from "../utils/locationUtils.js"

const MAX_STRING_LENGTHS = {
  city: 80,
  state: 80,
  stateCode: 10,
  country: 80,
  countryCode: 2,
  timezone: 60,
  isp: 100,
  source: 50,
}

/**
 * Sanitizes a string: strips control codes, trims, and clamps length.
 */
function cleanString(val, maxLen) {
  if (val === null || val === undefined) return null
  if (typeof val !== "string") {
    if (typeof val === "number") val = String(val)
    else return null
  }
  const cleaned = val.replace(/[\x00-\x1F\x7F]/g, "").trim()
  if (!cleaned) return null
  return cleaned.slice(0, maxLen)
}

/**
 * Normalizes ISO 3166-1 Alpha-2 country code (e.g. "in" -> "IN").
 */
function cleanCountryCode(val) {
  const cleaned = cleanString(val, 2)
  if (!cleaned || cleaned.length !== 2 || !/^[A-Za-z]{2}$/.test(cleaned)) {
    return null
  }
  return cleaned.toUpperCase()
}

/**
 * Validates and normalizes raw provider location data into the standardized schema.
 */
export function normalizeLocationData(raw = {}, source = "ip-geolocation") {
  if (!raw || typeof raw !== "object") {
    return null
  }

  // 1. City
  const city = cleanString(raw.city || raw.cityName, MAX_STRING_LENGTHS.city)

  // 2. State / Region
  const state = cleanString(
    raw.state || raw.regionName || raw.region || raw.region_name || raw.province,
    MAX_STRING_LENGTHS.state
  )
  const stateCode = cleanString(
    raw.stateCode || raw.regionCode || raw.region_code,
    MAX_STRING_LENGTHS.stateCode
  )

  // 3. Country
  const country = cleanString(
    raw.country || raw.countryName || raw.country_name,
    MAX_STRING_LENGTHS.country
  )
  const countryCode = cleanCountryCode(
    raw.countryCode || raw.country_code || raw.countryCode2
  )

  // 4. Approximate Coordinates
  const latitude = normalizeCoordinate(raw.latitude || raw.lat, -90, 90)
  const longitude = normalizeCoordinate(raw.longitude || raw.lon || raw.lng, -180, 180)

  // 5. Timezone
  const timezone = cleanString(raw.timezone || raw.timeZone, MAX_STRING_LENGTHS.timezone)

  // 6. ISP / Network
  const isp = cleanString(raw.isp || raw.org || raw.as, MAX_STRING_LENGTHS.isp)

  // If both country and city are missing, consider location unavailable
  const hasGeographicData = Boolean(country || city || state)
  const status = hasGeographicData ? "available" : "unavailable"

  return {
    city,
    state,
    stateCode,
    country,
    countryCode,
    latitude,
    longitude,
    timezone,
    isp,
    accuracy: "approximate",
    source: cleanString(source, MAX_STRING_LENGTHS.source) || "ip-geolocation",
    status,
  }
}
