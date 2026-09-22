/**
 * Security Comparison Service (Phase 6)
 *
 * Compares incoming login context (device, browser, IP, location) against the user's
 * verified SecurityBaseline to detect new access patterns and compute multi-signal risk decisions.
 */

import {
  normalizeString,
  canonicalBrowserFamily,
  isSameBrowserFamily,
  createDeviceComparisonKey,
  isReliableLocation,
} from "../utils/comparisonUtils.js"
import { normalizeIP } from "../utils/ipUtils.js"
import {
  RISK_WEIGHTS,
  RISK_LEVEL_THRESHOLDS,
  SECURITY_POLICIES,
} from "../config/securityRiskConfig.js"

/**
 * Compares incoming browser against verified browsers in baseline.
 * Uses canonical family grouping to prevent false alarms on minor version bumps.
 */
export function compareBrowser(incomingBrowser = {}, verifiedBrowsers = []) {
  if (!verifiedBrowsers || verifiedBrowsers.length === 0) {
    return { isNew: true, family: canonicalBrowserFamily(incomingBrowser.name || incomingBrowser.family) }
  }

  const incomingFamily = canonicalBrowserFamily(
    incomingBrowser.family || incomingBrowser.name || ""
  )

  // If browser is completely unknown, avoid false alarms
  if (incomingFamily === "unknown") {
    return { isNew: false, family: "unknown" }
  }

  const match = verifiedBrowsers.find((b) =>
    isSameBrowserFamily(incomingFamily, b.browserFamily)
  )

  return {
    isNew: !match,
    family: incomingFamily,
    matchedEntry: match || null,
  }
}

/**
 * Compares incoming device against verified devices in baseline.
 * Uses deterministic privacy-conscious device comparison key.
 */
export function compareDevice(incomingDevice = {}, verifiedDevices = []) {
  if (!verifiedDevices || verifiedDevices.length === 0) {
    return { isNew: true, comparisonKey: createDeviceComparisonKey(incomingDevice) }
  }

  const incomingKey = createDeviceComparisonKey(incomingDevice)

  const match = verifiedDevices.find(
    (d) => d.deviceComparisonKey === incomingKey
  )

  return {
    isNew: !match,
    comparisonKey: incomingKey,
    matchedEntry: match || null,
  }
}

/**
 * Compares incoming IP against verified IPs in baseline.
 */
export function compareIPAddress(incomingIP = "", verifiedIPs = []) {
  const { ipAddress } = normalizeIP(incomingIP)

  if (!verifiedIPs || verifiedIPs.length === 0) {
    return { isNew: true, normalizedIP: ipAddress }
  }

  const match = verifiedIPs.find((v) => {
    const verifiedNorm = normalizeIP(v.ipAddress).ipAddress
    return verifiedNorm === ipAddress
  })

  return {
    isNew: !match,
    normalizedIP: ipAddress,
    matchedEntry: match || null,
  }
}

/**
 * Compares incoming location against verified locations in baseline.
 * Respects data reliability: missing, local, or provider-failed data will NEVER
 * trigger false location alarms.
 */
export function compareLocation(incomingLocation = null, verifiedLocations = []) {
  if (!isReliableLocation(incomingLocation)) {
    return {
      isReliable: false,
      isNewCity: false,
      isNewState: false,
      isNewCountry: false,
    }
  }

  if (!verifiedLocations || verifiedLocations.length === 0) {
    return {
      isReliable: true,
      isNewCity: Boolean(incomingLocation.city),
      isNewState: Boolean(incomingLocation.state || incomingLocation.stateCode),
      isNewCountry: Boolean(incomingLocation.country || incomingLocation.countryCode),
    }
  }

  const incomingCountry = normalizeString(
    incomingLocation.countryCode || incomingLocation.country
  )
  const incomingState = normalizeString(
    incomingLocation.stateCode || incomingLocation.state || incomingLocation.region
  )
  const incomingCity = normalizeString(incomingLocation.city)

  // 1. Check Country
  let countryMatch = false
  if (incomingCountry) {
    countryMatch = verifiedLocations.some((v) => {
      const vCountry = normalizeString(v.countryCode || v.country)
      return vCountry && vCountry === incomingCountry
    })
  } else {
    countryMatch = true // Don't trigger if country is missing
  }

  // 2. Check State
  let stateMatch = false
  if (incomingState) {
    stateMatch = verifiedLocations.some((v) => {
      const vState = normalizeString(v.stateCode || v.state)
      return vState && vState === incomingState
    })
  } else {
    stateMatch = true // Don't trigger if state is missing
  }

  // 3. Check City
  let cityMatch = false
  if (incomingCity) {
    cityMatch = verifiedLocations.some((v) => {
      const vCity = normalizeString(v.city)
      return vCity && vCity === incomingCity
    })
  } else {
    cityMatch = true // Don't trigger if city is missing
  }

  return {
    isReliable: true,
    isNewCountry: !countryMatch,
    isNewState: !stateMatch,
    isNewCity: !cityMatch,
  }
}

/**
 * Evaluates an incoming login attempt against the user's verified baseline.
 * If baseline is null or newly created for initial login, baseline is seeded and ALLOWed.
 * If any significant dimension has changed, computes risk score and decision.
 */
export function evaluateLogin(baseline = null, incomingContext = {}) {
  try {
    // 1. Initial baseline check (First-time user or empty baseline)
    const hasExistingData =
      baseline &&
      (
        (baseline.verifiedBrowsers && baseline.verifiedBrowsers.length > 0) ||
        (baseline.verifiedDevices && baseline.verifiedDevices.length > 0) ||
        (baseline.verifiedIPs && baseline.verifiedIPs.length > 0)
      )

    if (!hasExistingData) {
      return {
        decision: SECURITY_POLICIES.DECISIONS.ALLOW,
        riskScore: 0,
        riskLevel: "LOW",
        reasons: ["INITIAL_BASELINE"],
        signals: {
          isNewBrowser: false,
          isNewDevice: false,
          isNewIP: false,
          isNewCity: false,
          isNewState: false,
          isNewCountry: false,
        },
        isInitialBaseline: true,
      }
    }

    // 2. Extract context parameters
    const incomingBrowser =
      incomingContext.device?.browser || incomingContext.browser || {}
    const incomingDevice = incomingContext.device || {}
    const incomingIP =
      incomingContext.network?.ipAddress ||
      incomingContext.clientIp ||
      incomingContext.ip ||
      ""
    const incomingLocation =
      incomingContext.network?.location || incomingContext.location || null

    // 3. Run individual comparisons
    const browserResult = compareBrowser(incomingBrowser, baseline.verifiedBrowsers)
    const deviceResult = compareDevice(incomingDevice, baseline.verifiedDevices)
    const ipResult = compareIPAddress(incomingIP, baseline.verifiedIPs)
    const locationResult = compareLocation(incomingLocation, baseline.verifiedLocations)

    const signals = {
      isNewBrowser: browserResult.isNew,
      isNewDevice: deviceResult.isNew,
      isNewIP: ipResult.isNew,
      isNewCity: locationResult.isNewCity,
      isNewState: locationResult.isNewState,
      isNewCountry: locationResult.isNewCountry,
    }

    // 4. Calculate Risk Score
    let riskScore = 0
    const reasons = []

    if (signals.isNewDevice) {
      riskScore += RISK_WEIGHTS.NEW_DEVICE
      reasons.push("NEW_DEVICE")
    }
    if (signals.isNewCountry) {
      riskScore += RISK_WEIGHTS.NEW_COUNTRY
      reasons.push("NEW_COUNTRY")
    }
    if (signals.isNewBrowser) {
      riskScore += RISK_WEIGHTS.NEW_BROWSER
      reasons.push("NEW_BROWSER")
    }
    if (signals.isNewState) {
      riskScore += RISK_WEIGHTS.NEW_STATE
      reasons.push("NEW_STATE")
    }
    if (signals.isNewCity) {
      riskScore += RISK_WEIGHTS.NEW_CITY
      reasons.push("NEW_CITY")
    }
    if (signals.isNewIP) {
      riskScore += RISK_WEIGHTS.NEW_IP
      reasons.push("NEW_IP")
    }

    riskScore = Math.min(100, riskScore)

    // 5. Determine Risk Level
    let riskLevel = "LOW"
    if (riskScore >= RISK_LEVEL_THRESHOLDS.HIGH.min) {
      riskLevel = "HIGH"
    } else if (riskScore >= RISK_LEVEL_THRESHOLDS.MEDIUM.min) {
      riskLevel = "MEDIUM"
    }

    // 6. Determine Security Decision
    let decision = SECURITY_POLICIES.DECISIONS.ALLOW

    // Check mandatory verification rule:
    // Any new browser, device, public IP, city, or state triggers verification
    const mandatoryTriggered = SECURITY_POLICIES.MANDATORY_VERIFICATION_SIGNALS.some(
      (sig) => signals[sig] === true
    )

    if (riskLevel === "HIGH") {
      decision = SECURITY_POLICIES.DECISIONS.HIGH_RISK
    } else if (mandatoryTriggered || riskLevel === "MEDIUM") {
      decision = SECURITY_POLICIES.DECISIONS.VERIFICATION_REQUIRED
    }

    return {
      decision,
      riskScore,
      riskLevel,
      reasons,
      signals,
      isInitialBaseline: false,
    }
  } catch (error) {
    console.error("[evaluateLogin] Error evaluating login security:", error)
    // Fail secure
    return {
      decision: SECURITY_POLICIES.DECISIONS.VERIFICATION_REQUIRED,
      riskScore: 50,
      riskLevel: "MEDIUM",
      reasons: ["SECURITY_EVALUATION_ERROR"],
      signals: {
        isNewBrowser: false,
        isNewDevice: false,
        isNewIP: false,
        isNewCity: false,
        isNewState: false,
        isNewCountry: false,
      },
      isInitialBaseline: false,
    }
  }
}

export default {
  compareBrowser,
  compareDevice,
  compareIPAddress,
  compareLocation,
  evaluateLogin,
}
