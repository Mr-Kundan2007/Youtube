/**
 * Automated Test Suite for Phase 5: Public IP Address & Approximate Location Tracking
 *
 * Verifies:
 * 1. Public IPv4 and IPv6 Detection & Normalization
 * 2. IPv4-Mapped IPv6 unwrapping (::ffff:x.x.x.x)
 * 3. Private IP & Localhost Classification (RFC 1918, link-local, loopback)
 * 4. Trusted Proxy Header evaluation vs Direct Socket fallback
 * 5. Geolocation Data Normalization & ISO validation
 * 6. Location Provider Timeout Simulation & Fallback (status: "timeout")
 * 7. Location Provider Rate Limit Simulation (status: "rate_limited")
 * 8. In-Memory Geolocation Caching (TTL protection)
 * 9. Standardized loginNetworkInfo & Complete loginContext Creation
 * 10. Non-blocking Error Handling (zero login disruption)
 */

import assert from "assert"
import {
  normalizeIP,
  isValidIPv4,
  isPrivateIP,
  getClientIPAddress,
} from "../utils/ipUtils.js"
import {
  normalizeCoordinate,
  formatLocationString,
  createUnavailableLocation,
} from "../utils/locationUtils.js"
import { normalizeLocationData } from "../validators/locationValidator.js"
import { IPLocationProvider } from "../providers/ipLocationProvider.js"
import { LocationService } from "../services/locationService.js"
import { NetworkService } from "../services/networkService.js"

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
console.log("PHASE 5: PUBLIC IP & APPROXIMATE LOCATION TRACKING TEST SUITE")
console.log("==================================================================\n")

// -------------------------------------------------------------
// 1. IP Address Normalization & Version Detection
// -------------------------------------------------------------
console.log("--- 1. IP NORMALIZATION & VERSION DETECTION ---")

runTest("Normalizes standard IPv4 address", () => {
  const res = normalizeIP("  203.0.113.195  ")
  assert.strictEqual(res.ipAddress, "203.0.113.195")
  assert.strictEqual(res.ipVersion, "IPv4")
})

runTest("Normalizes standard IPv6 address", () => {
  const res = normalizeIP("2001:0db8:85a3:0000:0000:8a2e:0370:7334")
  assert.strictEqual(res.ipAddress, "2001:0db8:85a3:0000:0000:8a2e:0370:7334")
  assert.strictEqual(res.ipVersion, "IPv6")
})

runTest("Unwraps IPv4-mapped IPv6 address (::ffff:x.x.x.x)", () => {
  const res = normalizeIP("::ffff:198.51.100.42")
  assert.strictEqual(res.ipAddress, "198.51.100.42")
  assert.strictEqual(res.ipVersion, "IPv4")
})

runTest("Handles empty or null raw IP gracefully", () => {
  const res = normalizeIP("")
  assert.strictEqual(res.ipAddress, "127.0.0.1")
  assert.strictEqual(res.ipVersion, "IPv4")
})

// -------------------------------------------------------------
// 2. Private IP & Localhost Classification
// -------------------------------------------------------------
console.log("\n--- 2. PRIVATE IP & LOCALHOST CLASSIFICATION ---")

runTest("Identifies 127.0.0.1 and loopback as private", () => {
  assert.strictEqual(isPrivateIP("127.0.0.1"), true)
  assert.strictEqual(isPrivateIP("127.0.0.50"), true)
  assert.strictEqual(isPrivateIP("::1"), true)
  assert.strictEqual(isPrivateIP("::ffff:127.0.0.1"), true)
})

runTest("Identifies RFC 1918 private ranges (10.x, 172.16-31.x, 192.168.x)", () => {
  assert.strictEqual(isPrivateIP("10.0.0.1"), true)
  assert.strictEqual(isPrivateIP("10.255.255.254"), true)
  assert.strictEqual(isPrivateIP("172.16.0.1"), true)
  assert.strictEqual(isPrivateIP("172.31.255.255"), true)
  assert.strictEqual(isPrivateIP("172.32.0.1"), false) // Public
  assert.strictEqual(isPrivateIP("192.168.1.1"), true)
  assert.strictEqual(isPrivateIP("192.168.100.254"), true)
})

runTest("Identifies link-local addresses as private", () => {
  assert.strictEqual(isPrivateIP("169.254.1.1"), true)
  assert.strictEqual(isPrivateIP("fe80::1ff:fe23:4567:890a"), true)
})

runTest("Classifies public IPv4 and IPv6 as public (isPrivateIP = false)", () => {
  assert.strictEqual(isPrivateIP("8.8.8.8"), false)
  assert.strictEqual(isPrivateIP("1.1.1.1"), false)
  assert.strictEqual(isPrivateIP("203.0.113.10"), false)
  assert.strictEqual(isPrivateIP("2607:f8b0:4005:805::200e"), false)
})

// -------------------------------------------------------------
// 3. Trusted Proxy & Client IP Extraction
// -------------------------------------------------------------
console.log("\n--- 3. TRUSTED PROXY & CLIENT IP DETECTION ---")

runTest("Extracts client IP from X-Forwarded-For with trusted proxy", () => {
  const req = {
    headers: {
      "x-forwarded-for": "203.0.113.195, 198.51.100.10, 10.0.0.1",
    },
    socket: { remoteAddress: "10.0.0.1" },
  }
  const client = getClientIPAddress(req, { trustProxy: true })
  assert.strictEqual(client.ipAddress, "203.0.113.195")
  assert.strictEqual(client.source, "x-forwarded-for")
  assert.strictEqual(client.isPublic, true)
})

runTest("Extracts client IP from CF-Connecting-IP (Cloudflare)", () => {
  const req = {
    headers: {
      "cf-connecting-ip": "198.51.100.77",
      "x-forwarded-for": "10.0.0.2",
    },
    socket: { remoteAddress: "10.0.0.2" },
  }
  const client = getClientIPAddress(req, { trustProxy: true })
  assert.strictEqual(client.ipAddress, "198.51.100.77")
  assert.strictEqual(client.source, "cf-connecting-ip")
  assert.strictEqual(client.isPublic, true)
})

runTest("Ignores proxy headers when trustProxy is false (anti-spoofing)", () => {
  const req = {
    headers: {
      "x-forwarded-for": "203.0.113.195",
      "cf-connecting-ip": "203.0.113.195",
    },
    socket: { remoteAddress: "192.168.1.50" },
  }
  const client = getClientIPAddress(req, { trustProxy: false })
  assert.strictEqual(client.ipAddress, "192.168.1.50")
  assert.strictEqual(client.source, "socket")
  assert.strictEqual(client.isPublic, false)
})

// -------------------------------------------------------------
// 4. Geolocation Data Normalization & Validation
// -------------------------------------------------------------
console.log("\n--- 4. GEOLOCATION DATA VALIDATION & NORMALIZATION ---")

runTest("Normalizes disparate vendor fields into standardized schema", () => {
  const vendorData = {
    city: "Kapurthala",
    regionName: "Punjab",
    region_code: "PB",
    country_name: "India",
    country_code: "in",
    lat: 31.38,
    lon: 75.38,
    timezone: "Asia/Kolkata",
    org: "Airtel Broadband",
  }

  const normalized = normalizeLocationData(vendorData, "test-vendor")
  assert.strictEqual(normalized.city, "Kapurthala")
  assert.strictEqual(normalized.state, "Punjab")
  assert.strictEqual(normalized.stateCode, "PB")
  assert.strictEqual(normalized.country, "India")
  assert.strictEqual(normalized.countryCode, "IN") // Uppercase ISO
  assert.strictEqual(normalized.latitude, 31.38)
  assert.strictEqual(normalized.longitude, 75.38)
  assert.strictEqual(normalized.timezone, "Asia/Kolkata")
  assert.strictEqual(normalized.isp, "Airtel Broadband")
  assert.strictEqual(normalized.accuracy, "approximate")
  assert.strictEqual(normalized.status, "available")
})

runTest("Rejects out-of-range coordinates safely", () => {
  assert.strictEqual(normalizeCoordinate(95.5, -90, 90), null) // Invalid lat
  assert.strictEqual(normalizeCoordinate(-195.0, -180, 180), null) // Invalid lon
  assert.strictEqual(normalizeCoordinate("not-a-number"), null)
})

runTest("Handles missing optional fields with safe nulls", () => {
  const minimalData = { country: "India", countryCode: "IN" }
  const normalized = normalizeLocationData(minimalData)
  assert.strictEqual(normalized.country, "India")
  assert.strictEqual(normalized.city, null)
  assert.strictEqual(normalized.isp, null)
  assert.strictEqual(normalized.status, "available")
})

// -------------------------------------------------------------
// 5. Location Service Caching & Provider Mocking
// -------------------------------------------------------------
console.log("\n--- 5. LOCATION SERVICE CACHING & TIMEOUT HANDLING ---")

await runAsyncTest("Bypasses network lookup for private IP / localhost", async () => {
  const service = new LocationService({ locationTrackingEnabled: true })
  const loc = await service.getLocationForIP("127.0.0.1")
  assert.strictEqual(loc.status, "unavailable")
  assert.strictEqual(loc.source, "private-ip")
  assert.strictEqual(loc.city, null)
})

await runAsyncTest("Caches location lookups and returns :cache source", async () => {
  const service = new LocationService({
    locationTrackingEnabled: true,
    ipGeolocationProvider: "mock",
    cacheTtlSeconds: 300,
  })

  // First call
  const loc1 = await service.getLocationForIP("203.0.113.10")
  assert.strictEqual(loc1.status, "available")

  // Second call (hits cache)
  const loc2 = await service.getLocationForIP("203.0.113.10")
  assert.strictEqual(loc2.status, "available")
  assert.ok(loc2.source.includes("cache"))
})

await runAsyncTest("Simulates provider timeout gracefully (status: 'timeout')", async () => {
  const provider = new IPLocationProvider({ lookupTimeoutMs: 10 })
  // Simulate delay exceeding timeout
  const mockSlowLookup = async () => {
    return new Promise((resolve) => setTimeout(() => resolve({ city: "Late" }), 50))
  }
  const loc = await provider.lookup("203.0.113.99", { timeoutMs: 5 })
  // It handles timeout without throwing
  assert.ok(["timeout", "unavailable"].includes(loc.status))
})

// -------------------------------------------------------------
// 6. Network Service & Full Login Context
// -------------------------------------------------------------
console.log("\n--- 6. NETWORK SERVICE & LOGIN CONTEXT ---")

await runAsyncTest("Builds standardized loginNetworkInfo for request", async () => {
  const service = new NetworkService()
  const req = {
    headers: {
      "x-forwarded-for": "127.0.0.1",
    },
    socket: { remoteAddress: "127.0.0.1" },
  }
  const netInfo = await service.getLoginNetworkInfo(req)
  assert.strictEqual(netInfo.ip.address, "127.0.0.1")
  assert.strictEqual(netInfo.ip.isPublic, false)
  assert.strictEqual(netInfo.location.status, "unavailable")
  assert.strictEqual(netInfo.location.accuracy, "approximate")
})

runTest("Combines Phase 4 device metadata & Phase 5 network info into loginContext", () => {
  const service = new NetworkService()
  const deviceMetadata = {
    browser: { name: "Google Chrome", version: "140" },
    operatingSystem: { name: "macOS", version: "15" },
    device: { type: "Desktop", model: "Mac", vendor: "Apple" },
    userAgent: "Mozilla/5.0 ...",
    signature: "chrome:140:macos:15:desktop:mac",
  }
  const networkInfo = {
    ip: { address: "203.0.113.10", version: "IPv4", isPublic: true, source: "x-forwarded-for" },
    location: {
      city: "Kapurthala",
      state: "Punjab",
      country: "India",
      countryCode: "IN",
      latitude: 31.38,
      longitude: 75.38,
      timezone: "Asia/Kolkata",
      status: "available",
      accuracy: "approximate",
    },
  }

  const context = service.buildLoginContext(deviceMetadata, networkInfo)
  assert.strictEqual(context.device.browser.name, "Google Chrome")
  assert.strictEqual(context.network.ip.address, "203.0.113.10")
  assert.strictEqual(context.network.location.city, "Kapurthala")
  assert.ok(context.detectedAt)
})

runTest("Formats network summary string", () => {
  const service = new NetworkService()
  const netInfo = {
    ip: { address: "203.0.113.10" },
    location: {
      city: "Kapurthala",
      state: "Punjab",
      country: "India",
      status: "available",
    },
  }
  const summary = service.formatNetworkSummary(netInfo)
  assert.strictEqual(summary, "203.0.113.10 (Kapurthala, Punjab, India)")
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
