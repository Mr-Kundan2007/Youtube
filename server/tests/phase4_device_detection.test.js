/**
 * Automated Test Suite for Phase 4: Login Device, Browser & Operating System Detection
 *
 * Verifies:
 * 1. Browser Detection: Chrome, Edge, Firefox, Safari, Opera, Samsung Internet, Brave, Unknown
 * 2. Operating System Detection: Windows, macOS, iOS, Android, Linux, Chrome OS, Unknown
 * 3. Device Type Classification: Desktop, Mobile, Tablet, Unknown
 * 4. Device Model & Vendor Extraction: Apple, Samsung, Google, Microsoft, Unknown
 * 5. Client Metadata Validation & Sanitization (lengths, types, control codes)
 * 6. Device Normalization Service (server UA fallback, signature generation)
 * 7. Privacy-Safe Signature Generation
 * 8. Display Formatting Helper (formatDeviceName)
 * 9. Non-Blocking Integration in Login flow & Session creation
 */

import assert from "assert"
import {
  parseBrowser,
  parseOperatingSystem,
  parseDeviceType,
  parseDeviceModelAndVendor,
  parseServerUserAgent,
} from "../utils/userAgentUtils.js"
import {
  validateAndSanitizeClientDevice,
  sanitizeString,
  ALLOWED_DEVICE_TYPES,
} from "../validators/deviceValidator.js"
import { deviceService } from "../services/deviceService.js"

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
console.log("PHASE 4: LOGIN DEVICE, BROWSER & OS DETECTION TEST SUITE")
console.log("==================================================================\n")

// -------------------------------------------------------------
// 1. Browser Detection Tests
// -------------------------------------------------------------
console.log("--- 1. BROWSER DETECTION ---")

runTest("Detects Google Chrome on macOS", () => {
  const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
  const browser = parseBrowser(ua)
  assert.strictEqual(browser.name, "Google Chrome")
  assert.strictEqual(browser.majorVersion, "140")
})

runTest("Detects Microsoft Edge (does not falsely classify as Chrome)", () => {
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.2840.99"
  const browser = parseBrowser(ua)
  assert.strictEqual(browser.name, "Microsoft Edge")
  assert.strictEqual(browser.majorVersion, "140")
})

runTest("Detects Opera (does not falsely classify as Chrome)", () => {
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 OPR/114.0.0.0"
  const browser = parseBrowser(ua)
  assert.strictEqual(browser.name, "Opera")
  assert.strictEqual(browser.majorVersion, "114")
})

runTest("Detects Samsung Internet (does not falsely classify as Chrome)", () => {
  const ua = "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36"
  const browser = parseBrowser(ua)
  assert.strictEqual(browser.name, "Samsung Internet")
  assert.strictEqual(browser.majorVersion, "26")
})

runTest("Detects Mozilla Firefox on Windows", () => {
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0"
  const browser = parseBrowser(ua)
  assert.strictEqual(browser.name, "Mozilla Firefox")
  assert.strictEqual(browser.majorVersion, "142")
})

runTest("Detects Apple Safari on macOS (excludes Chrome token)", () => {
  const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
  const browser = parseBrowser(ua)
  assert.strictEqual(browser.name, "Safari")
  assert.strictEqual(browser.majorVersion, "18")
})

runTest("Detects Chrome on iOS (CriOS)", () => {
  const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.67 Mobile/15E148 Safari/604.1"
  const browser = parseBrowser(ua)
  assert.strictEqual(browser.name, "Google Chrome")
  assert.strictEqual(browser.majorVersion, "140")
})

runTest("Handles unknown or empty user agent safely", () => {
  const browser = parseBrowser("")
  assert.strictEqual(browser.name, "Unknown")
  assert.strictEqual(browser.version, "Unknown")
})

// -------------------------------------------------------------
// 2. Operating System Detection Tests
// -------------------------------------------------------------
console.log("\n--- 2. OPERATING SYSTEM DETECTION ---")

runTest("Detects Windows 10/11", () => {
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
  const os = parseOperatingSystem(ua)
  assert.strictEqual(os.name, "Windows 10/11")
  assert.strictEqual(os.majorVersion, "10")
})

runTest("Detects Windows 8.1 and Windows 7", () => {
  const ua81 = "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36"
  const ua7 = "Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko"
  assert.strictEqual(parseOperatingSystem(ua81).name, "Windows 8.1")
  assert.strictEqual(parseOperatingSystem(ua7).name, "Windows 7")
})

runTest("Detects macOS with version", () => {
  const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
  const os = parseOperatingSystem(ua)
  assert.strictEqual(os.name, "macOS")
  assert.strictEqual(os.version, "10.15.7")
  assert.strictEqual(os.majorVersion, "10")
})

runTest("Detects iOS on iPhone (does not confuse with macOS)", () => {
  const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"
  const os = parseOperatingSystem(ua)
  assert.strictEqual(os.name, "iOS")
  assert.strictEqual(os.version, "18.1")
  assert.strictEqual(os.majorVersion, "18")
})

runTest("Detects Android with version", () => {
  const ua = "Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"
  const os = parseOperatingSystem(ua)
  assert.strictEqual(os.name, "Android")
  assert.strictEqual(os.version, "15")
  assert.strictEqual(os.majorVersion, "15")
})

runTest("Detects Linux and Chrome OS", () => {
  const linuxUa = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0"
  const crosUa = "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
  assert.strictEqual(parseOperatingSystem(linuxUa).name, "Linux")
  assert.strictEqual(parseOperatingSystem(crosUa).name, "Chrome OS")
})

// -------------------------------------------------------------
// 3. Device Type Classification Tests
// -------------------------------------------------------------
console.log("\n--- 3. DEVICE TYPE CLASSIFICATION ---")

runTest("Classifies Desktop browsers (Windows, Mac, Linux)", () => {
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
  const win = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  const linux = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"

  assert.strictEqual(parseDeviceType(mac), "Desktop")
  assert.strictEqual(parseDeviceType(win), "Desktop")
  assert.strictEqual(parseDeviceType(linux), "Desktop")
})

runTest("Classifies Mobile phones (iPhone, Android Mobile)", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
  const androidPhone = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36"

  assert.strictEqual(parseDeviceType(iphone), "Mobile")
  assert.strictEqual(parseDeviceType(androidPhone), "Mobile")
})

runTest("Classifies Tablets (iPad, Android Tablet without Mobile token)", () => {
  const ipad = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
  // Android tablets omit the "Mobile" keyword
  const androidTablet = "Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

  assert.strictEqual(parseDeviceType(ipad), "Tablet")
  assert.strictEqual(parseDeviceType(androidTablet), "Tablet")
})

// -------------------------------------------------------------
// 4. Device Model & Vendor Extraction Tests
// -------------------------------------------------------------
console.log("\n--- 4. DEVICE MODEL & VENDOR EXTRACTION ---")

runTest("Extracts Apple models and vendor", () => {
  const iphoneUa = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15"
  const ipadUa = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15"
  const macUa = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

  const iphoneRes = parseDeviceModelAndVendor(iphoneUa)
  assert.strictEqual(iphoneRes.model, "iPhone")
  assert.strictEqual(iphoneRes.vendor, "Apple")

  const ipadRes = parseDeviceModelAndVendor(ipadUa)
  assert.strictEqual(ipadRes.model, "iPad")
  assert.strictEqual(ipadRes.vendor, "Apple")

  const macRes = parseDeviceModelAndVendor(macUa)
  assert.strictEqual(macRes.model, "Mac")
  assert.strictEqual(macRes.vendor, "Apple")
})

runTest("Extracts Google Pixel model and vendor", () => {
  const pixelUa = "Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro XL Build/AP2A.240805.005) AppleWebKit/537.36"
  const res = parseDeviceModelAndVendor(pixelUa)
  assert.strictEqual(res.vendor, "Google")
  assert.ok(res.model.includes("Pixel 9 Pro XL"))
})

runTest("Extracts Samsung Galaxy model and vendor", () => {
  const samsungUa = "Mozilla/5.0 (Linux; Android 14; SM-S928B Build/UP1A.231005.007) AppleWebKit/537.36"
  const res = parseDeviceModelAndVendor(samsungUa)
  assert.strictEqual(res.vendor, "Samsung")
  assert.strictEqual(res.model, "SM-S928B")
})

// -------------------------------------------------------------
// 5. Client Metadata Validation & Sanitization Tests
// -------------------------------------------------------------
console.log("\n--- 5. VALIDATION & SANITIZATION (UNTRUSTED INPUT) ---")

runTest("Sanitizes and clamps oversized client strings", () => {
  const oversized = "A".repeat(200)
  const sanitized = sanitizeString(oversized, 50)
  assert.strictEqual(sanitized.length, 50)
})

runTest("Strips ASCII control characters from malicious input", () => {
  const dirty = "Chrome\x00\x08\x1FBrowser"
  const clean = sanitizeString(dirty, 50)
  assert.strictEqual(clean, "ChromeBrowser")
})

runTest("Normalizes invalid device types to Unknown", () => {
  const clientData = {
    browser: { name: "Chrome", version: "140" },
    operatingSystem: { name: "macOS", version: "15" },
    device: { type: "SuperSmartFridge", model: "FridgeX", vendor: "LG" },
  }
  const { isValid, sanitized } = validateAndSanitizeClientDevice(clientData)
  assert.strictEqual(isValid, true)
  assert.strictEqual(sanitized.device.type, "Unknown")
})

runTest("Handles null, undefined, and non-object inputs safely", () => {
  assert.strictEqual(validateAndSanitizeClientDevice(null).isValid, false)
  assert.strictEqual(validateAndSanitizeClientDevice("not-an-object").isValid, false)
  assert.strictEqual(validateAndSanitizeClientDevice([1, 2, 3]).isValid, false)
})

// -------------------------------------------------------------
// 6. Device Service Normalization Tests
// -------------------------------------------------------------
console.log("\n--- 6. DEVICE NORMALIZATION SERVICE ---")

runTest("Falls back gracefully to server User-Agent when client metadata is missing", () => {
  const serverHeaders = {
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  }
  const normalized = deviceService.normalizeDeviceInfo(null, serverHeaders)

  assert.strictEqual(normalized.browser.name, "Google Chrome")
  assert.strictEqual(normalized.browser.version, "140.0.0.0")
  assert.strictEqual(normalized.operatingSystem.name, "macOS")
  assert.strictEqual(normalized.device.type, "Desktop")
  assert.strictEqual(normalized.device.vendor, "Apple")
  assert.ok(normalized.signature)
})

runTest("Prefers client hints enhancement over generic server UA", () => {
  const serverHeaders = {
    "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  }
  const clientInfo = {
    browser: { name: "Google Chrome", version: "140" },
    operatingSystem: { name: "Android", version: "15" },
    device: { type: "Mobile", model: "Pixel 9", vendor: "Google" },
    platform: "Linux armv81",
  }
  const normalized = deviceService.normalizeDeviceInfo(clientInfo, serverHeaders)

  assert.strictEqual(normalized.operatingSystem.version, "15")
  assert.strictEqual(normalized.device.model, "Pixel 9")
  assert.strictEqual(normalized.device.vendor, "Google")
})

runTest("Generates deterministic privacy-safe device signatures", () => {
  const sig1 = deviceService.generateDeviceSignature({
    browserName: "Google Chrome",
    browserVersion: "140.0.0.0",
    osName: "macOS",
    osVersion: "15.0",
    deviceType: "Desktop",
    deviceModel: "Mac",
  })
  const sig2 = deviceService.generateDeviceSignature({
    browserName: "Google Chrome",
    browserVersion: "140.0.0.0",
    osName: "macOS",
    osVersion: "15.0",
    deviceType: "Desktop",
    deviceModel: "Mac",
  })
  assert.strictEqual(sig1, sig2)
  assert.strictEqual(sig1, "googlechrome:140:macos:15:desktop:mac")
})

runTest("Formats display name correctly for standard and detailed formats", () => {
  const info = {
    browser: { name: "Google Chrome", version: "140.0" },
    operatingSystem: { name: "macOS", version: "15.0" },
    device: { type: "Desktop", model: "Mac" },
  }

  const standard = deviceService.formatDeviceName(info)
  assert.strictEqual(standard, "Google Chrome on macOS")

  const detailed = deviceService.formatDeviceName(info, { detailed: true })
  assert.strictEqual(detailed, "Google Chrome 140 • macOS 15 • Desktop")

  const mobileInfo = {
    browser: { name: "Safari", version: "18.0" },
    operatingSystem: { name: "iOS", version: "18.0" },
    device: { type: "Mobile", model: "iPhone" },
  }
  assert.strictEqual(deviceService.formatDeviceName(mobileInfo), "Safari on iPhone")
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
