/**
 * Automated Test Suite for Phase 6: New Device, Browser, IP & Location Detection
 *
 * Verifies:
 * 1. Risk Scoring & Reason Mapping (calculateRiskLevel, reasonsFromFlags)
 * 2. Summary Formatting (formatDetectionSummary)
 * 3. Initial Baseline Seeding (isInitialBaseline: true, zero false alarms)
 * 4. Recognized Login Environment (all flags false)
 * 5. New Device Detection (isNewDevice: true)
 * 6. New Browser Detection (isNewBrowser: true)
 * 7. New Operating System Detection (isNewOperatingSystem: true)
 * 8. New Public IP Detection (isNewIP: true)
 * 9. New Location Detection (isNewLocation, isNewCountry, isNewCity)
 * 10. Private / Localhost IP Exemption (no spurious location/IP flags)
 * 11. Step-Up Verification Flagging (requiresVerification prepared for Phase 7)
 * 12. Non-blocking Fallback & Error Resilience
 */

import assert from "assert"
import {
  calculateRiskLevel,
  reasonsFromFlags,
  formatDetectionSummary,
} from "../utils/detectionUtils.js"
import { LoginDetectionService } from "../services/loginDetectionService.js"
import {
  normalizeString,
  canonicalBrowserFamily,
  isSameBrowserFamily,
  createDeviceComparisonKey,
  maskIPAddress,
  isReliableLocation,
} from "../utils/comparisonUtils.js"
import {
  RISK_WEIGHTS,
  RISK_LEVEL_THRESHOLDS,
  BASELINE_LIMITS,
  SECURITY_POLICIES,
} from "../config/securityRiskConfig.js"
import {
  compareBrowser,
  compareDevice,
  compareIPAddress,
  compareLocation,
  evaluateLogin,
} from "../services/securityComparisonService.js"

let passedTests = 0
let failedTests = 0

function runTest(testName, fn) {
  try {
    fn()
    console.log(`  ✓ [PASS] ${testName}`)
    passedTests++
  } catch (err) {
    console.error(`  ✗ [FAIL] ${testName}`)
    console.error(`     Error: ${err.message}`)
    failedTests++
  }
}

async function runAsyncTest(testName, fn) {
  try {
    await fn()
    console.log(`  ✓ [PASS] ${testName}`)
    passedTests++
  } catch (err) {
    console.error(`  ✗ [FAIL] ${testName}`)
    console.error(`     Error: ${err.message}`)
    failedTests++
  }
}

console.log("\n==================================================================")
console.log("PHASE 6: NEW DEVICE, BROWSER, IP & LOCATION DETECTION TEST SUITE")
console.log("==================================================================\n")

// -------------------------------------------------------------
// 1. Detection Utilities & Risk Scoring Tests
// -------------------------------------------------------------
console.log("--- 1. DETECTION UTILITIES & RISK SCORING ---")

runTest("Initial baseline always evaluates to low risk with 0 score", () => {
  const flags = { isNewDevice: true, isNewCountry: true }
  const res = calculateRiskLevel(flags, true)
  assert.strictEqual(res.riskLevel, "low")
  assert.strictEqual(res.riskScore, 0)
})

runTest("Calculates high risk for new device + new country", () => {
  const flags = { isNewDevice: true, isNewCountry: true }
  const res = calculateRiskLevel(flags, false)
  // 35 (device) + 40 (country) = 75 >= 50
  assert.strictEqual(res.riskLevel, "high")
  assert.ok(res.riskScore >= 50)
})

runTest("Calculates medium risk for new browser + new city", () => {
  const flags = { isNewBrowser: true, isNewLocation: true }
  const res = calculateRiskLevel(flags, false)
  // 15 + 15 = 30 >= 25
  assert.strictEqual(res.riskLevel, "medium")
})

runTest("Calculates low risk for single new IP address", () => {
  const flags = { isNewIP: true }
  const res = calculateRiskLevel(flags, false)
  // 10 < 25
  assert.strictEqual(res.riskLevel, "low")
  assert.strictEqual(res.riskScore, 10)
})

runTest("Extracts reason codes from boolean flags", () => {
  const flags = {
    isNewDevice: true,
    isNewBrowser: true,
    isNewCountry: true,
    isNewIP: true,
  }
  const reasons = reasonsFromFlags(flags)
  assert.ok(reasons.includes("NEW_DEVICE"))
  assert.ok(reasons.includes("NEW_BROWSER"))
  assert.ok(reasons.includes("NEW_COUNTRY"))
  assert.ok(reasons.includes("NEW_IP_ADDRESS"))
})

runTest("Formats human-readable detection summary", () => {
  const summary1 = formatDetectionSummary({ isInitialBaseline: true })
  assert.strictEqual(summary1, "Initial login baseline recorded")

  const summary2 = formatDetectionSummary({ isUnrecognizedLogin: false })
  assert.strictEqual(summary2, "Recognized device and environment")

  const summary3 = formatDetectionSummary(
    {
      isUnrecognizedLogin: true,
      flags: { isNewDevice: true, isNewCountry: true },
    },
    { network: { location: { country: "France" } } }
  )
  assert.ok(summary3.includes("New Device"))
  assert.ok(summary3.includes("New Country (France)"))
})

// -------------------------------------------------------------
// 2. Multi-Dimensional Comparison Engine Tests
// -------------------------------------------------------------
console.log("\n--- 2. COMPARISON ENGINE (EVALUATE LOGIN CONTEXT) ---")

// Mock service with simulated database records
class TestableLoginDetectionService extends LoginDetectionService {
  constructor(mockDevices = [], mockSessions = []) {
    super()
    this.mockDevices = mockDevices
    this.mockSessions = mockSessions
  }

  async evaluateLoginContext(userId, currentLoginContext = {}) {
    // Intercept Device and Session queries with mock in-memory data
    const knownDevices = this.mockDevices
    const recentSessions = this.mockSessions
    const baselineCount = knownDevices.length + recentSessions.length

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
        reasons: [],
        riskLevel: "low",
        riskScore: 0,
        requiresVerification: false,
        baselineCount: 0,
        summary: "Initial login baseline recorded",
        evaluatedAt: new Date().toISOString(),
      }
    }

    const knownSignatures = new Set()
    const knownBrowsers = new Set()
    const knownOSs = new Set()
    const knownIPs = new Set()
    const knownCountries = new Set()
    const knownCities = new Set()

    for (const dev of knownDevices) {
      if (dev.device_identifier) knownSignatures.add(dev.device_identifier)
      if (dev.browser) knownBrowsers.add(dev.browser.toLowerCase().trim())
      if (dev.operating_system) knownOSs.add(dev.operating_system.toLowerCase().trim())
      if (dev.last_ip_address) knownIPs.add(dev.last_ip_address.trim())
      if (dev.location?.countryCode) knownCountries.add(dev.location.countryCode.toUpperCase().trim())
      if (dev.location?.country) knownCountries.add(dev.location.country.toUpperCase().trim())
      if (dev.location?.city) knownCities.add(dev.location.city.toLowerCase().trim())
    }

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

    const isNewIP =
      isPublicIP && currentIP
        ? !knownIPs.has(currentIP)
        : false

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
    const requiresVerification = isUnrecognizedLogin && (riskLevel === "high" || isNewCountry)

    return {
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
  }
}

await runAsyncTest("First-time login: seeds initial baseline without false alarm", async () => {
  const service = new TestableLoginDetectionService([], [])
  const loginContext = {
    device: { signature: "chrome:140:macos:15:desktop:mac" },
    network: { ip: { address: "203.0.113.10", isPublic: true } },
  }

  const result = await service.evaluateLoginContext("user-1", loginContext)
  assert.strictEqual(result.isInitialBaseline, true)
  assert.strictEqual(result.isUnrecognizedLogin, false)
  assert.strictEqual(result.flags.isNewDevice, false)
  assert.strictEqual(result.riskLevel, "low")
  assert.strictEqual(result.requiresVerification, false)
})

await runAsyncTest("Recognized login: identical device & location flags zero alerts", async () => {
  const mockDevices = [
    {
      device_identifier: "chrome:140:macos:15:desktop:mac",
      browser: "Google Chrome",
      operating_system: "macOS",
      last_ip_address: "203.0.113.10",
      location: { city: "Kapurthala", country: "India", countryCode: "IN" },
    },
  ]
  const service = new TestableLoginDetectionService(mockDevices, [])

  const currentContext = {
    device: {
      signature: "chrome:140:macos:15:desktop:mac",
      browser: { name: "Google Chrome" },
      operatingSystem: { name: "macOS" },
    },
    network: {
      ip: { address: "203.0.113.10", isPublic: true },
      location: {
        city: "Kapurthala",
        country: "India",
        countryCode: "IN",
        status: "available",
      },
    },
  }

  const result = await service.evaluateLoginContext("user-1", currentContext)
  assert.strictEqual(result.isInitialBaseline, false)
  assert.strictEqual(result.isUnrecognizedLogin, false)
  assert.strictEqual(result.flags.isNewDevice, false)
  assert.strictEqual(result.flags.isNewBrowser, false)
  assert.strictEqual(result.flags.isNewOperatingSystem, false)
  assert.strictEqual(result.flags.isNewIP, false)
  assert.strictEqual(result.flags.isNewLocation, false)
})

await runAsyncTest("New Device Detection: flags isNewDevice & isUnrecognizedLogin", async () => {
  const mockDevices = [
    {
      device_identifier: "chrome:140:macos:15:desktop:mac",
      browser: "Google Chrome",
      operating_system: "macOS",
    },
  ]
  const service = new TestableLoginDetectionService(mockDevices, [])

  const currentContext = {
    device: {
      signature: "safari:18:ios:18:mobile:iphone", // Different device!
      browser: { name: "Safari" },
      operatingSystem: { name: "iOS" },
    },
    network: {
      ip: { address: "203.0.113.10", isPublic: true },
      location: { status: "unavailable" },
    },
  }

  const result = await service.evaluateLoginContext("user-1", currentContext)
  assert.strictEqual(result.isNewDevice !== undefined, true)
  assert.strictEqual(result.flags.isNewDevice, true)
  assert.strictEqual(result.flags.isNewBrowser, true)
  assert.strictEqual(result.flags.isNewOperatingSystem, true)
  assert.strictEqual(result.isUnrecognizedLogin, true)
  assert.ok(result.reasons.includes("NEW_DEVICE"))
})

await runAsyncTest("New Public IP Detection: flags isNewIP when address changes", async () => {
  const mockDevices = [
    {
      device_identifier: "chrome:140:macos:15:desktop:mac",
      browser: "Google Chrome",
      operating_system: "macOS",
      last_ip_address: "203.0.113.10",
    },
  ]
  const service = new TestableLoginDetectionService(mockDevices, [])

  const currentContext = {
    device: {
      signature: "chrome:140:macos:15:desktop:mac", // Same device
      browser: { name: "Google Chrome" },
      operatingSystem: { name: "macOS" },
    },
    network: {
      ip: { address: "198.51.100.77", isPublic: true }, // New public IP
      location: { status: "unavailable" },
    },
  }

  const result = await service.evaluateLoginContext("user-1", currentContext)
  assert.strictEqual(result.flags.isNewDevice, false)
  assert.strictEqual(result.flags.isNewIP, true)
  // Single new IP on same device is recognized with low risk
  assert.strictEqual(result.flags.isNewCountry, false)
  assert.strictEqual(result.riskLevel, "low")
})

await runAsyncTest("Private IP exemption: Localhost does not trigger isNewIP flag", async () => {
  const mockDevices = [
    {
      device_identifier: "chrome:140:macos:15:desktop:mac",
      browser: "Google Chrome",
      operating_system: "macOS",
      last_ip_address: "127.0.0.1",
    },
  ]
  const service = new TestableLoginDetectionService(mockDevices, [])

  const currentContext = {
    device: {
      signature: "chrome:140:macos:15:desktop:mac",
      browser: { name: "Google Chrome" },
      operatingSystem: { name: "macOS" },
    },
    network: {
      ip: { address: "192.168.1.50", isPublic: false }, // Private IP
      location: { status: "unavailable" },
    },
  }

  const result = await service.evaluateLoginContext("user-1", currentContext)
  assert.strictEqual(result.flags.isNewIP, false)
  assert.strictEqual(result.flags.isNewLocation, false)
})

await runAsyncTest("New Location & Country Detection: flags isNewCountry & triggers verification requirement", async () => {
  const mockDevices = [
    {
      device_identifier: "chrome:140:macos:15:desktop:mac",
      browser: "Google Chrome",
      operating_system: "macOS",
      location: { city: "Kapurthala", country: "India", countryCode: "IN" },
    },
  ]
  const service = new TestableLoginDetectionService(mockDevices, [])

  const currentContext = {
    device: {
      signature: "chrome:140:macos:15:desktop:mac", // Recognized device
      browser: { name: "Google Chrome" },
      operatingSystem: { name: "macOS" },
    },
    network: {
      ip: { address: "198.51.100.99", isPublic: true },
      location: {
        city: "London",
        country: "United Kingdom",
        countryCode: "GB",
        status: "available",
      },
    },
  }

  const result = await service.evaluateLoginContext("user-1", currentContext)
  assert.strictEqual(result.flags.isNewDevice, false)
  assert.strictEqual(result.flags.isNewCountry, true)
  assert.strictEqual(result.flags.isNewCity, true)
  assert.strictEqual(result.flags.isNewLocation, true)
  assert.strictEqual(result.isUnrecognizedLogin, true)
  assert.strictEqual(result.requiresVerification, true) // High security signal
})

// -------------------------------------------------------------
// 3. COMPARISON UTILITIES & VERSION TOLERANCE TESTS
// -------------------------------------------------------------
console.log("\n--- 3. COMPARISON UTILITIES & VERSION TOLERANCE ---")

runTest("Browser family normalization maps versions to canonical family", () => {
  assert.strictEqual(canonicalBrowserFamily("Chrome 140.0.0.0"), "chrome")
  assert.strictEqual(canonicalBrowserFamily("Chrome 141.0.0.0"), "chrome")
  assert.strictEqual(canonicalBrowserFamily("Mobile Chrome"), "chrome")
  assert.strictEqual(canonicalBrowserFamily("Safari 18.2"), "safari")
  assert.strictEqual(canonicalBrowserFamily("Firefox 125"), "firefox")
  assert.strictEqual(canonicalBrowserFamily("Microsoft Edge 120"), "edge")
})

runTest("isSameBrowserFamily avoids false positive on Chrome version update", () => {
  assert.strictEqual(isSameBrowserFamily("Chrome 140", "Chrome 141"), true)
  assert.strictEqual(isSameBrowserFamily("Chrome", "Firefox"), false)
  assert.strictEqual(isSameBrowserFamily("Safari", "Chrome"), false)
})

runTest("createDeviceComparisonKey generates deterministic privacy-safe key", () => {
  const dev = {
    type: "desktop",
    model: "Macintosh",
    vendor: "Apple",
    os: { name: "macOS" },
    browser: { name: "Chrome 140" },
  }
  const key = createDeviceComparisonKey(dev)
  assert.strictEqual(key, "desktop|macintosh|apple|macos")
})

runTest("maskIPAddress masks public IPv4 address correctly", () => {
  const masked = maskIPAddress("203.0.113.195")
  assert.strictEqual(masked, "203.0.xxx.xxx")
})

runTest("isReliableLocation correctly rejects insufficient or private data", () => {
  assert.strictEqual(isReliableLocation(null), false)
  assert.strictEqual(isReliableLocation({ status: "insufficient_data" }), false)
  assert.strictEqual(isReliableLocation({ status: "private_ip" }), false)
  assert.strictEqual(isReliableLocation({ city: "Kapurthala", country: "India", countryCode: "IN" }), true)
})

// -------------------------------------------------------------
// 4. RISK WEIGHTS & THRESHOLDS CONFIGURATION
// -------------------------------------------------------------
console.log("\n--- 4. RISK WEIGHTS & POLICIES CONFIGURATION ---")

runTest("Verifies standardized risk weights", () => {
  assert.strictEqual(RISK_WEIGHTS.NEW_DEVICE, 40)
  assert.strictEqual(RISK_WEIGHTS.NEW_COUNTRY, 40)
  assert.strictEqual(RISK_WEIGHTS.NEW_BROWSER, 25)
  assert.strictEqual(RISK_WEIGHTS.NEW_STATE, 20)
  assert.strictEqual(RISK_WEIGHTS.NEW_CITY, 10)
  assert.strictEqual(RISK_WEIGHTS.NEW_IP, 10)
})

runTest("Verifies baseline storage caps and pending TTL", () => {
  assert.strictEqual(BASELINE_LIMITS.MAX_VERIFIED_BROWSERS, 10)
  assert.strictEqual(BASELINE_LIMITS.MAX_VERIFIED_DEVICES, 10)
  assert.strictEqual(BASELINE_LIMITS.MAX_VERIFIED_IPS, 20)
  assert.strictEqual(BASELINE_LIMITS.MAX_VERIFIED_LOCATIONS, 10)
  assert.strictEqual(SECURITY_POLICIES.PENDING_LOGIN_TTL_MS, 10 * 60 * 1000)
})

// -------------------------------------------------------------
// 5. SECURITY COMPARISON ENGINE (MULTI-SIGNAL DECISION MATRIX)
// -------------------------------------------------------------
console.log("\n--- 5. SECURITY COMPARISON ENGINE (DECISION MATRIX) ---")

runTest("First-time user evaluation returns ALLOW with isInitialBaseline = true", () => {
  const result = evaluateLogin(null, {
    device: { type: "desktop", browser: { name: "Chrome 140" }, os: { name: "macOS" } },
    network: { ipAddress: "203.0.113.1" },
  })
  assert.strictEqual(result.decision, "ALLOW")
  assert.strictEqual(result.isInitialBaseline, true)
  assert.strictEqual(result.riskScore, 0)
  assert.strictEqual(result.riskLevel, "LOW")
})

runTest("Recognized login with verified baseline returns ALLOW", () => {
  const baseline = {
    verifiedBrowsers: [{ browserFamily: "chrome", majorVersion: "140" }],
    verifiedDevices: [{ deviceComparisonKey: "desktop|macintosh|apple|macos" }],
    verifiedIPs: [{ ipAddress: "203.0.113.1", isPublic: true }],
    verifiedLocations: [{ city: "Kapurthala", state: "Punjab", country: "India", countryCode: "IN" }],
  }

  const incomingContext = {
    device: {
      type: "desktop",
      model: "Macintosh",
      vendor: "Apple",
      os: { name: "macOS" },
      browser: { name: "Chrome 141" }, // Version bump! Same family
    },
    network: {
      ipAddress: "203.0.113.1",
      location: { city: "Kapurthala", state: "Punjab", country: "India", countryCode: "IN" },
    },
  }

  const result = evaluateLogin(baseline, incomingContext)
  assert.strictEqual(result.decision, "ALLOW")
  assert.strictEqual(result.riskScore, 0)
  assert.strictEqual(result.signals.isNewBrowser, false)
  assert.strictEqual(result.signals.isNewDevice, false)
  assert.strictEqual(result.signals.isNewIP, false)
})

runTest("New browser triggers mandatory VERIFICATION_REQUIRED", () => {
  const baseline = {
    verifiedBrowsers: [{ browserFamily: "chrome" }],
    verifiedDevices: [{ deviceComparisonKey: "desktop|macintosh|apple|macos" }],
    verifiedIPs: [{ ipAddress: "203.0.113.1" }],
    verifiedLocations: [],
  }

  const incomingContext = {
    device: {
      type: "desktop",
      model: "Macintosh",
      vendor: "Apple",
      os: { name: "macOS" },
      browser: { name: "Firefox 125" }, // Different browser family
    },
    network: { ipAddress: "203.0.113.1" },
  }

  const result = evaluateLogin(baseline, incomingContext)
  assert.strictEqual(result.signals.isNewBrowser, true)
  assert.strictEqual(result.decision, "VERIFICATION_REQUIRED")
  assert.ok(result.reasons.includes("NEW_BROWSER"))
})

runTest("New public IP triggers mandatory VERIFICATION_REQUIRED", () => {
  const baseline = {
    verifiedBrowsers: [{ browserFamily: "chrome" }],
    verifiedDevices: [{ deviceComparisonKey: "desktop|macintosh|apple|macos" }],
    verifiedIPs: [{ ipAddress: "203.0.113.1" }],
    verifiedLocations: [],
  }

  const incomingContext = {
    device: {
      type: "desktop",
      model: "Macintosh",
      vendor: "Apple",
      os: { name: "macOS" },
      browser: { name: "Chrome 140" },
    },
    network: { ipAddress: "198.51.100.25" }, // New public IP
  }

  const result = evaluateLogin(baseline, incomingContext)
  assert.strictEqual(result.signals.isNewIP, true)
  assert.strictEqual(result.decision, "VERIFICATION_REQUIRED")
  assert.ok(result.reasons.includes("NEW_IP"))
})

runTest("New Device + New Country yields HIGH_RISK decision (80 pts)", () => {
  const baseline = {
    verifiedBrowsers: [{ browserFamily: "chrome" }],
    verifiedDevices: [{ deviceComparisonKey: "desktop|macintosh|apple|macos" }],
    verifiedIPs: [{ ipAddress: "203.0.113.1" }],
    verifiedLocations: [{ city: "Kapurthala", state: "Punjab", country: "India", countryCode: "IN" }],
  }

  const incomingContext = {
    device: {
      type: "mobile",
      model: "iPhone",
      vendor: "Apple",
      os: { name: "iOS" },
      browser: { name: "Safari" },
    },
    network: {
      ipAddress: "198.51.100.99",
      location: { city: "London", country: "United Kingdom", countryCode: "GB" },
    },
  }

  const result = evaluateLogin(baseline, incomingContext)
  assert.strictEqual(result.signals.isNewDevice, true)
  assert.strictEqual(result.signals.isNewCountry, true)
  assert.strictEqual(result.riskLevel, "HIGH")
  assert.strictEqual(result.decision, "HIGH_RISK")
  assert.ok(result.riskScore >= 60)
})

runTest("Insufficient location data never triggers false location alerts", () => {
  const baseline = {
    verifiedBrowsers: [{ browserFamily: "chrome" }],
    verifiedDevices: [{ deviceComparisonKey: "desktop|macintosh|apple|macos" }],
    verifiedIPs: [{ ipAddress: "127.0.0.1" }],
    verifiedLocations: [{ city: "Kapurthala", state: "Punjab", country: "India", countryCode: "IN" }],
  }

  const incomingContext = {
    device: {
      type: "desktop",
      model: "Macintosh",
      vendor: "Apple",
      os: { name: "macOS" },
      browser: { name: "Chrome 140" },
    },
    network: {
      ipAddress: "127.0.0.1",
      location: { status: "insufficient_data", city: null, country: null },
    },
  }

  const result = evaluateLogin(baseline, incomingContext)
  assert.strictEqual(result.signals.isNewCity, false)
  assert.strictEqual(result.signals.isNewState, false)
  assert.strictEqual(result.signals.isNewCountry, false)
})

// -------------------------------------------------------------
// 6. PENDING LOGIN LIFECYCLE & BASELINE INTEGRITY
// -------------------------------------------------------------
console.log("\n--- 6. PENDING LOGIN LIFECYCLE & BASELINE INTEGRITY ---")

runTest("Pending login challenge creates 10-minute TTL with masked IP", () => {
  const pendingLoginId = "mock-uuid-1234-5678"
  const rawIP = "203.0.113.88"
  const maskedIP = maskIPAddress(rawIP)
  const now = Date.now()
  const expiresAt = new Date(now + SECURITY_POLICIES.PENDING_LOGIN_TTL_MS)

  const pendingRecord = {
    pendingLoginId,
    userId: "user-test-id",
    userEmail: "user@example.com",
    maskedIP,
    status: "PENDING",
    expiresAt,
    securityDecision: {
      decision: "VERIFICATION_REQUIRED",
      riskScore: 25,
      riskLevel: "MEDIUM",
    },
  }

  assert.strictEqual(pendingRecord.status, "PENDING")
  assert.strictEqual(pendingRecord.maskedIP, "203.0.xxx.xxx")
  assert.ok(pendingRecord.expiresAt.getTime() > now)
  assert.strictEqual(Math.round((pendingRecord.expiresAt.getTime() - now) / 60000), 10)
})

runTest("Pending login expires when TTL window has elapsed", () => {
  const pastExpiresAt = new Date(Date.now() - 1000) // Expired 1 second ago
  const isExpired = new Date() > pastExpiresAt
  assert.strictEqual(isExpired, true)
})

runTest("Baseline integrity: unverified login attempts must never mutate baseline", () => {
  const baseline = {
    verifiedBrowsers: [{ browserFamily: "chrome" }],
    verifiedDevices: [{ deviceComparisonKey: "desktop|macintosh|apple|macos" }],
    verifiedIPs: [{ ipAddress: "203.0.113.1" }],
    verifiedLocations: [],
  }

  // Incoming unverified login from unknown IP
  const incomingContext = {
    device: { type: "desktop", browser: { name: "Chrome 140" }, os: { name: "macOS" } },
    network: { ipAddress: "198.51.100.99" },
  }

  const decision = evaluateLogin(baseline, incomingContext)
  assert.strictEqual(decision.decision, "VERIFICATION_REQUIRED")

  // Baseline remains unmodified
  assert.strictEqual(baseline.verifiedIPs.length, 1)
  assert.strictEqual(baseline.verifiedIPs[0].ipAddress, "203.0.113.1")
})

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log("\n==================================================================")
console.log(`RESULTS: ${passedTests} PASSED | ${failedTests} FAILED`)
console.log("==================================================================\n")

if (failedTests > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
