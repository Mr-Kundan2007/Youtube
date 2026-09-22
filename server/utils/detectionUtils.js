/**
 * Login Detection Utilities (Phase 6)
 *
 * Provides risk scoring, reason mapping, and summary formatting
 * for multi-dimensional login environment analysis.
 */

/**
 * Calculates risk level and numeric score based on detection flags.
 * Initial baselines always evaluate to "low" risk.
 */
export function calculateRiskLevel(flags = {}, isInitialBaseline = false) {
  if (isInitialBaseline) {
    return {
      riskLevel: "low",
      riskScore: 0,
    }
  }

  let score = 0

  if (flags.isNewCountry) score += 40
  if (flags.isNewDevice) score += 35
  if (flags.isNewOperatingSystem) score += 20
  if (flags.isNewLocation) score += 15
  if (flags.isNewBrowser) score += 15
  if (flags.isNewIP) score += 10

  // Cap score at 100
  score = Math.min(100, score)

  let riskLevel = "low"
  if (score >= 50) {
    riskLevel = "high"
  } else if (score >= 25) {
    riskLevel = "medium"
  }

  return {
    riskLevel,
    riskScore: score,
  }
}

/**
 * Maps boolean detection flags to standardized reason codes.
 */
export function reasonsFromFlags(flags = {}) {
  const reasons = []

  if (flags.isNewDevice) reasons.push("NEW_DEVICE")
  if (flags.isNewCountry) reasons.push("NEW_COUNTRY")
  if (flags.isNewCity) reasons.push("NEW_CITY")
  if (flags.isNewLocation && !flags.isNewCountry && !flags.isNewCity) reasons.push("NEW_LOCATION")
  if (flags.isNewBrowser) reasons.push("NEW_BROWSER")
  if (flags.isNewOperatingSystem) reasons.push("NEW_OPERATING_SYSTEM")
  if (flags.isNewIP) reasons.push("NEW_IP_ADDRESS")

  return reasons
}

/**
 * Formats a clear human-readable summary of the detection outcome.
 */
export function formatDetectionSummary(detectionResult = {}, context = {}) {
  if (detectionResult.isInitialBaseline) {
    return "Initial login baseline recorded"
  }

  if (!detectionResult.isUnrecognizedLogin) {
    return "Recognized device and environment"
  }

  const parts = []
  if (detectionResult.flags?.isNewDevice) parts.push("New Device")
  if (detectionResult.flags?.isNewBrowser) parts.push("New Browser")
  if (detectionResult.flags?.isNewOperatingSystem) parts.push("New OS")

  const loc = context.network?.location
  if (detectionResult.flags?.isNewCountry && loc?.country) {
    parts.push(`New Country (${loc.country})`)
  } else if (detectionResult.flags?.isNewCity && loc?.city) {
    parts.push(`New City (${loc.city})`)
  } else if (detectionResult.flags?.isNewLocation) {
    parts.push("New Location")
  }

  if (detectionResult.flags?.isNewIP) {
    parts.push("New IP Address")
  }

  return `Unrecognized login: ${parts.join(", ")}`
}
