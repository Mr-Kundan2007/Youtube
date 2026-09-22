/**
 * Central Device, Browser & Operating System Detection Service (Phase 4)
 *
 * Privacy-conscious technical metadata collector for login authentication.
 * Uses modern User-Agent Client Hints (navigator.userAgentData) when available,
 * paired with a robust fallback parser.
 *
 * Strict Privacy Guidelines:
 * - NO Canvas, Audio, WebGL, Font, or Battery fingerprinting.
 * - Collects only standard technical metadata for device recognition and security.
 */

export type DeviceType = "Desktop" | "Mobile" | "Tablet" | "Unknown"

export interface BrowserInfo {
  name: string
  version: string
  majorVersion?: string
}

export interface OperatingSystemInfo {
  name: string
  version: string
  majorVersion?: string
}

export interface DeviceInfoModel {
  type: DeviceType
  model: string
  vendor: string
}

export interface ClientDeviceInfo {
  browser: BrowserInfo
  operatingSystem: OperatingSystemInfo
  device: DeviceInfoModel
  userAgent: string
  platform: string
  browserTimezone?: string
  signature?: string
  detectedAt?: string
}

export interface FormatDeviceOptions {
  detailed?: boolean
  includePlatform?: boolean
}

/**
 * Standardizes browser identification across diverse user-agents.
 * Prevents Edge, Opera, Samsung Internet, and Brave from being falsely identified as generic Chrome.
 */
export function parseBrowser(ua: string): BrowserInfo {
  if (!ua || typeof ua !== "string") {
    return { name: "Unknown", version: "Unknown", majorVersion: "Unknown" }
  }

  // 1. Samsung Internet (must precede Chrome)
  const samsungMatch = ua.match(/SamsungBrowser\/([\d.]+)/i)
  if (samsungMatch) {
    const full = samsungMatch[1]
    return { name: "Samsung Internet", version: full, majorVersion: full.split(".")[0] }
  }

  // 2. Microsoft Edge (Edg/ or Edge/) (must precede Chrome)
  const edgeMatch = ua.match(/Edg(?:e|A|iOS)?\/([\d.]+)/i)
  if (edgeMatch) {
    const full = edgeMatch[1]
    return { name: "Microsoft Edge", version: full, majorVersion: full.split(".")[0] }
  }

  // 3. Opera (OPR/ or Opera/) (must precede Chrome)
  const operaMatch = ua.match(/(?:OPR|Opera|OPT)\/([\d.]+)/i)
  if (operaMatch) {
    const full = operaMatch[1]
    return { name: "Opera", version: full, majorVersion: full.split(".")[0] }
  }

  // 4. Firefox (Firefox/ or FxiOS/)
  const firefoxMatch = ua.match(/(?:Firefox|FxiOS)\/([\d.]+)/i)
  if (firefoxMatch) {
    const full = firefoxMatch[1]
    return { name: "Mozilla Firefox", version: full, majorVersion: full.split(".")[0] }
  }

  // 5. Google Chrome (or CriOS on iOS)
  const chromeMatch = ua.match(/(?:Chrome|CriOS)\/([\d.]+)/i)
  if (chromeMatch) {
    const full = chromeMatch[1]
    return { name: "Google Chrome", version: full, majorVersion: full.split(".")[0] }
  }

  // 6. Apple Safari (Version/X.Y Safari/Z and NOT Chrome/CriOS/Edg/OPR)
  const safariMatch = ua.match(/Version\/([\d.]+).*Safari/i)
  if (safariMatch && !ua.includes("Chrome") && !ua.includes("CriOS") && !ua.includes("Android")) {
    const full = safariMatch[1]
    return { name: "Safari", version: full, majorVersion: full.split(".")[0] }
  }

  // Generic Safari match on iOS devices if Version/ was missing
  if (ua.includes("Safari") && (ua.includes("iPhone") || ua.includes("iPad") || ua.includes("iPod"))) {
    return { name: "Safari", version: "Unknown", majorVersion: "Unknown" }
  }

  return { name: "Unknown", version: "Unknown", majorVersion: "Unknown" }
}

/**
 * Parses operating system and version.
 * Accurately distinguishes iOS, macOS, Windows, Android, Linux, and Chrome OS.
 */
export function parseOperatingSystem(ua: string, platformHint = ""): OperatingSystemInfo {
  if (!ua && !platformHint) {
    return { name: "Unknown", version: "Unknown", majorVersion: "Unknown" }
  }

  const cleanUa = ua || ""

  // 1. iOS (iPhone, iPad, iPod)
  if (/(?:iPhone|iPad|iPod)/i.test(cleanUa) || (platformHint === "iOS")) {
    const iosMatch = cleanUa.match(/OS ([\d_]+) like Mac OS X/i)
    if (iosMatch) {
      const ver = iosMatch[1].replace(/_/g, ".")
      return { name: "iOS", version: ver, majorVersion: ver.split(".")[0] }
    }
    return { name: "iOS", version: "Unknown", majorVersion: "Unknown" }
  }

  // 2. Android
  const androidMatch = cleanUa.match(/Android\s+([\d.]+)/i)
  if (androidMatch || platformHint === "Android") {
    const ver = androidMatch ? androidMatch[1] : "Unknown"
    return { name: "Android", version: ver, majorVersion: ver.split(".")[0] }
  }

  // 3. macOS (Exclude iOS)
  if (/Mac OS X/i.test(cleanUa) || platformHint === "macOS" || platformHint === "MacIntel") {
    const macMatch = cleanUa.match(/Mac OS X\s+([\d_]+)/i)
    if (macMatch) {
      const ver = macMatch[1].replace(/_/g, ".")
      return { name: "macOS", version: ver, majorVersion: ver.split(".")[0] }
    }
    return { name: "macOS", version: "Unknown", majorVersion: "Unknown" }
  }

  // 4. Windows NT
  if (/Windows/i.test(cleanUa) || platformHint === "Windows") {
    const winMatch = cleanUa.match(/Windows NT ([\d.]+)/i)
    if (winMatch) {
      const nt = winMatch[1]
      let name = "Windows"
      let ver = nt
      if (nt === "10.0") {
        name = "Windows 10/11"
        ver = "10.0"
      } else if (nt === "6.3") {
        name = "Windows 8.1"
        ver = "8.1"
      } else if (nt === "6.2") {
        name = "Windows 8"
        ver = "8.0"
      } else if (nt === "6.1") {
        name = "Windows 7"
        ver = "7.0"
      }
      return { name, version: ver, majorVersion: ver.split(".")[0] }
    }
    return { name: "Windows", version: "Unknown", majorVersion: "Unknown" }
  }

  // 5. Chrome OS
  if (/CrOS/i.test(cleanUa) || platformHint === "Chrome OS") {
    return { name: "Chrome OS", version: "Unknown", majorVersion: "Unknown" }
  }

  // 6. Linux (Exclude Android)
  if (/Linux/i.test(cleanUa) && !/Android/i.test(cleanUa)) {
    return { name: "Linux", version: "Unknown", majorVersion: "Unknown" }
  }

  return { name: "Unknown", version: "Unknown", majorVersion: "Unknown" }
}

/**
 * Classifies device type into Desktop, Mobile, Tablet, or Unknown.
 * Handles iPads with desktop-like user-agents and Android tablets.
 */
export function parseDeviceType(
  ua: string,
  touchPoints = 0,
  isMobileHint?: boolean
): DeviceType {
  const cleanUa = ua || ""

  // 1. Explicit iPad or iPadOS Safari reporting as Macintosh with multi-touch
  if (/iPad/i.test(cleanUa)) {
    return "Tablet"
  }
  if (/Macintosh/i.test(cleanUa) && touchPoints > 1) {
    return "Tablet"
  }

  // 2. Android tablets (Android UA lacking 'Mobile')
  if (/Android/i.test(cleanUa)) {
    if (!/Mobile/i.test(cleanUa) || /Tablet/i.test(cleanUa)) {
      return "Tablet"
    }
    return "Mobile"
  }

  // 3. Other tablets (Kindle, Silk, PlayBook)
  if (/(?:Tablet|Silk|PlayBook|Kindle)/i.test(cleanUa)) {
    return "Tablet"
  }

  // 4. Mobile phones
  if (/(?:iPhone|iPod|Windows Phone|BlackBerry|IEMobile|Mobile)/i.test(cleanUa)) {
    return "Mobile"
  }

  // 5. Mobile Client Hint
  if (isMobileHint === true) {
    return "Mobile"
  }

  // 6. Desktop OSs
  if (/(?:Windows NT|Mac OS X|Macintosh|Linux|CrOS)/i.test(cleanUa)) {
    return "Desktop"
  }

  if (isMobileHint === false) {
    return "Desktop"
  }

  return "Unknown"
}

/**
 * Extracts device model and vendor where available without invasive fingerprinting.
 */
export function parseDeviceModelAndVendor(
  ua: string,
  deviceType: DeviceType,
  hintModel = ""
): { model: string; vendor: string } {
  const cleanUa = ua || ""

  // Client hint model provided
  if (hintModel && hintModel !== "Unknown" && hintModel.trim().length > 0) {
    const cleanHint = hintModel.trim()
    if (/iPhone/i.test(cleanHint)) return { model: cleanHint, vendor: "Apple" }
    if (/iPad/i.test(cleanHint)) return { model: cleanHint, vendor: "Apple" }
    if (/Pixel/i.test(cleanHint)) return { model: cleanHint, vendor: "Google" }
    if (/SM-/i.test(cleanHint) || /Samsung/i.test(cleanHint)) return { model: cleanHint, vendor: "Samsung" }
    return { model: cleanHint, vendor: "Unknown" }
  }

  // Apple Devices
  if (/iPhone/i.test(cleanUa)) {
    return { model: "iPhone", vendor: "Apple" }
  }
  if (/iPad/i.test(cleanUa)) {
    return { model: "iPad", vendor: "Apple" }
  }
  if (/Macintosh|Mac OS X/i.test(cleanUa)) {
    return { model: "Mac", vendor: "Apple" }
  }

  // Google Pixel
  const pixelMatch = cleanUa.match(/Pixel\s*([\w\s]+?)(?:Build|\)|;)/i)
  if (pixelMatch) {
    return { model: `Pixel ${pixelMatch[1].trim()}`, vendor: "Google" }
  }

  // Samsung Galaxy (SM-* or GT-*)
  const samsungMatch = cleanUa.match(/(SM-[A-Z0-9]+|GT-[A-Z0-9]+)/i)
  if (samsungMatch) {
    return { model: samsungMatch[1], vendor: "Samsung" }
  }

  // Microsoft
  if (/Windows/i.test(cleanUa)) {
    return { model: "PC", vendor: "Microsoft" }
  }

  return { model: "Unknown", vendor: "Unknown" }
}

/**
 * Generates a privacy-safe, deterministic device signature.
 * Combines normalized attributes without hardware/canvas tracking.
 */
export function generateDeviceSignature(info: {
  browserName: string
  browserMajor: string
  osName: string
  osMajor: string
  deviceType: string
  model: string
}): string {
  const parts = [
    (info.browserName || "Unknown").toLowerCase().replace(/\s+/g, ""),
    info.browserMajor || "0",
    (info.osName || "Unknown").toLowerCase().replace(/\s+/g, ""),
    info.osMajor || "0",
    (info.deviceType || "Unknown").toLowerCase(),
    (info.model || "Unknown").toLowerCase().replace(/\s+/g, ""),
  ]
  return parts.join(":")
}

/**
 * Formats device information into user-friendly display text.
 * Examples:
 * - "Google Chrome on macOS"
 * - "Safari on iPhone"
 * - "Google Chrome 140 • macOS 15 • Desktop" (detailed)
 */
export function formatDeviceName(
  info: Partial<ClientDeviceInfo>,
  options: FormatDeviceOptions = {}
): string {
  const browser = info.browser?.name || "Unknown Browser"
  const browserVer = info.browser?.majorVersion || info.browser?.version
  const os = info.operatingSystem?.name || "Unknown OS"
  const osVer = info.operatingSystem?.majorVersion || info.operatingSystem?.version
  const type = info.device?.type || "Unknown Device"
  const model = info.device?.model

  if (options.detailed) {
    const parts: string[] = []
    if (browserVer && browserVer !== "Unknown") {
      parts.push(`${browser} ${browserVer}`)
    } else {
      parts.push(browser)
    }

    if (osVer && osVer !== "Unknown") {
      parts.push(`${os} ${osVer}`)
    } else {
      parts.push(os)
    }

    if (type && type !== "Unknown") {
      parts.push(type)
    }
    return parts.join(" • ")
  }

  // Model-first format for mobile/tablets if known
  if (model && model !== "Unknown" && (type === "Mobile" || type === "Tablet")) {
    return `${browser} on ${model}`
  }

  return `${browser} on ${os}`
}

/**
 * Collects complete client device metadata.
 * Uses navigator.userAgentData where supported and falls back gracefully.
 * Never throws — always returns safe metadata.
 */
export async function getDeviceInfo(): Promise<ClientDeviceInfo> {
  const fallbackUa = typeof navigator !== "undefined" ? navigator.userAgent || "" : ""
  const fallbackPlatform = typeof navigator !== "undefined" ? navigator.platform || "" : ""
  const touchPoints = typeof navigator !== "undefined" ? navigator.maxTouchPoints || 0 : 0

  let browser = parseBrowser(fallbackUa)
  let os = parseOperatingSystem(fallbackUa, fallbackPlatform)
  let deviceType = parseDeviceType(fallbackUa, touchPoints)
  let { model, vendor } = parseDeviceModelAndVendor(fallbackUa, deviceType)

  // Enhance using modern User-Agent Client Hints if available
  if (typeof navigator !== "undefined" && (navigator as any).userAgentData) {
    try {
      const uad = (navigator as any).userAgentData
      const isMobileHint = uad.mobile
      const platformHint = uad.platform

      if (isMobileHint !== undefined) {
        deviceType = parseDeviceType(fallbackUa, touchPoints, isMobileHint)
      }

      if (platformHint) {
        const enhancedOs = parseOperatingSystem(fallbackUa, platformHint)
        if (enhancedOs.name !== "Unknown") {
          os = enhancedOs
        }
      }

      // Check brands for accurate browser name & major version
      if (Array.isArray(uad.brands) && uad.brands.length > 0) {
        const nonGenericBrand = uad.brands.find(
          (b: { brand: string; version: string }) =>
            !/Not[\s_]A[\s_]Brand/i.test(b.brand) &&
            !/Chromium/i.test(b.brand)
        )
        if (nonGenericBrand) {
          let bName = nonGenericBrand.brand
          if (bName.includes("Edge")) bName = "Microsoft Edge"
          if (bName.includes("Opera")) bName = "Opera"
          if (bName.includes("Samsung")) bName = "Samsung Internet"
          if (bName.includes("Chrome")) bName = "Google Chrome"
          browser = {
            name: bName,
            version: nonGenericBrand.version,
            majorVersion: nonGenericBrand.version,
          }
        }
      }

      // Non-blocking query for high entropy values with safe 250ms timeout
      if (typeof uad.getHighEntropyValues === "function") {
        const hintsPromise = uad.getHighEntropyValues(["model", "platformVersion"])
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 250))
        const hints: any = await Promise.race([hintsPromise, timeoutPromise])

        if (hints && typeof hints === "object") {
          if (hints.model) {
            const parsed = parseDeviceModelAndVendor(fallbackUa, deviceType, hints.model)
            model = parsed.model
            vendor = parsed.vendor
          }
          if (hints.platformVersion && os.name.includes("Windows")) {
            const majorPv = parseInt(hints.platformVersion.split(".")[0], 10)
            if (majorPv >= 13) {
              os.name = "Windows 11"
            }
          }
        }
      }
    } catch {
      // Ignore Client Hints errors and continue with reliable fallback
    }
  }

  // Check Brave browser flag if available on window/navigator
  if (typeof (navigator as any)?.brave?.isBrave === "function") {
    try {
      const isBrave = await (navigator as any).brave.isBrave()
      if (isBrave) {
        browser.name = "Brave"
      }
    } catch {}
  }

  const signature = generateDeviceSignature({
    browserName: browser.name,
    browserMajor: browser.majorVersion || browser.version,
    osName: os.name,
    osMajor: os.majorVersion || os.version,
    deviceType,
    model,
  })

  return {
    browser,
    operatingSystem: os,
    device: {
      type: deviceType,
      model,
      vendor,
    },
    userAgent: fallbackUa,
    platform: fallbackPlatform,
    browserTimezone:
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown"
        : "Unknown",
    signature,
    detectedAt: new Date().toISOString(),
  }
}
