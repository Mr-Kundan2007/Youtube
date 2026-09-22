/**
 * Server-side User-Agent Parser Utility (Phase 4)
 *
 * Provides resilient, privacy-safe parsing of HTTP User-Agent request headers.
 * Extracts browser name/version, operating system/version, device type, model, and vendor.
 */

export const ALLOWED_DEVICE_TYPES = ["Desktop", "Mobile", "Tablet", "Unknown"]

/**
 * Standardizes browser identification across user agents.
 * Distinguishes Edge, Opera, Samsung Internet, Firefox, Chrome, and Safari.
 */
export function parseBrowser(ua = "") {
  if (!ua || typeof ua !== "string") {
    return { name: "Unknown", version: "Unknown", majorVersion: "Unknown" }
  }

  // 1. Samsung Internet
  const samsungMatch = ua.match(/SamsungBrowser\/([\d.]+)/i)
  if (samsungMatch) {
    const full = samsungMatch[1]
    return { name: "Samsung Internet", version: full, majorVersion: full.split(".")[0] }
  }

  // 2. Microsoft Edge
  const edgeMatch = ua.match(/Edg(?:e|A|iOS)?\/([\d.]+)/i)
  if (edgeMatch) {
    const full = edgeMatch[1]
    return { name: "Microsoft Edge", version: full, majorVersion: full.split(".")[0] }
  }

  // 3. Opera
  const operaMatch = ua.match(/(?:OPR|Opera|OPT)\/([\d.]+)/i)
  if (operaMatch) {
    const full = operaMatch[1]
    return { name: "Opera", version: full, majorVersion: full.split(".")[0] }
  }

  // 4. Firefox
  const firefoxMatch = ua.match(/(?:Firefox|FxiOS)\/([\d.]+)/i)
  if (firefoxMatch) {
    const full = firefoxMatch[1]
    return { name: "Mozilla Firefox", version: full, majorVersion: full.split(".")[0] }
  }

  // 5. Google Chrome
  const chromeMatch = ua.match(/(?:Chrome|CriOS)\/([\d.]+)/i)
  if (chromeMatch) {
    const full = chromeMatch[1]
    return { name: "Google Chrome", version: full, majorVersion: full.split(".")[0] }
  }

  // 6. Apple Safari
  const safariMatch = ua.match(/Version\/([\d.]+).*Safari/i)
  if (safariMatch && !ua.includes("Chrome") && !ua.includes("CriOS") && !ua.includes("Android")) {
    const full = safariMatch[1]
    return { name: "Safari", version: full, majorVersion: full.split(".")[0] }
  }

  // Generic Safari on iOS
  if (ua.includes("Safari") && (ua.includes("iPhone") || ua.includes("iPad") || ua.includes("iPod"))) {
    return { name: "Safari", version: "Unknown", majorVersion: "Unknown" }
  }

  return { name: "Unknown", version: "Unknown", majorVersion: "Unknown" }
}

/**
 * Parses operating system and version from user agent.
 */
export function parseOperatingSystem(ua = "") {
  if (!ua || typeof ua !== "string") {
    return { name: "Unknown", version: "Unknown", majorVersion: "Unknown" }
  }

  // 1. iOS (iPhone, iPad, iPod)
  if (/(?:iPhone|iPad|iPod)/i.test(ua)) {
    const iosMatch = ua.match(/OS ([\d_]+) like Mac OS X/i)
    if (iosMatch) {
      const ver = iosMatch[1].replace(/_/g, ".")
      return { name: "iOS", version: ver, majorVersion: ver.split(".")[0] }
    }
    return { name: "iOS", version: "Unknown", majorVersion: "Unknown" }
  }

  // 2. Android
  const androidMatch = ua.match(/Android\s+([\d.]+)/i)
  if (androidMatch) {
    const ver = androidMatch[1]
    return { name: "Android", version: ver, majorVersion: ver.split(".")[0] }
  }

  // 3. macOS
  if (/Mac OS X/i.test(ua)) {
    const macMatch = ua.match(/Mac OS X\s+([\d_]+)/i)
    if (macMatch) {
      const ver = macMatch[1].replace(/_/g, ".")
      return { name: "macOS", version: ver, majorVersion: ver.split(".")[0] }
    }
    return { name: "macOS", version: "Unknown", majorVersion: "Unknown" }
  }

  // 4. Windows
  if (/Windows/i.test(ua)) {
    const winMatch = ua.match(/Windows NT ([\d.]+)/i)
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
  if (/CrOS/i.test(ua)) {
    return { name: "Chrome OS", version: "Unknown", majorVersion: "Unknown" }
  }

  // 6. Linux (Exclude Android)
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) {
    return { name: "Linux", version: "Unknown", majorVersion: "Unknown" }
  }

  return { name: "Unknown", version: "Unknown", majorVersion: "Unknown" }
}

/**
 * Classifies device type into Desktop, Mobile, Tablet, or Unknown.
 */
export function parseDeviceType(ua = "") {
  if (!ua || typeof ua !== "string") {
    return "Unknown"
  }

  // Tablets
  if (/iPad/i.test(ua)) {
    return "Tablet"
  }
  if (/Android/i.test(ua)) {
    if (!/Mobile/i.test(ua) || /Tablet/i.test(ua)) {
      return "Tablet"
    }
    return "Mobile"
  }
  if (/(?:Tablet|Silk|PlayBook|Kindle)/i.test(ua)) {
    return "Tablet"
  }

  // Mobiles
  if (/(?:iPhone|iPod|Windows Phone|BlackBerry|IEMobile|Mobile)/i.test(ua)) {
    return "Mobile"
  }

  // Desktops
  if (/(?:Windows NT|Mac OS X|Macintosh|Linux|CrOS)/i.test(ua)) {
    return "Desktop"
  }

  return "Unknown"
}

/**
 * Extracts device model and vendor from user agent.
 */
export function parseDeviceModelAndVendor(ua = "") {
  if (!ua || typeof ua !== "string") {
    return { model: "Unknown", vendor: "Unknown" }
  }

  // Apple
  if (/iPhone/i.test(ua)) return { model: "iPhone", vendor: "Apple" }
  if (/iPad/i.test(ua)) return { model: "iPad", vendor: "Apple" }
  if (/Macintosh|Mac OS X/i.test(ua)) return { model: "Mac", vendor: "Apple" }

  // Google Pixel
  const pixelMatch = ua.match(/Pixel\s*([\w\s]+?)(?:Build|\)|;)/i)
  if (pixelMatch) {
    return { model: `Pixel ${pixelMatch[1].trim()}`, vendor: "Google" }
  }

  // Samsung Galaxy
  const samsungMatch = ua.match(/(SM-[A-Z0-9]+|GT-[A-Z0-9]+)/i)
  if (samsungMatch) {
    return { model: samsungMatch[1], vendor: "Samsung" }
  }

  // Microsoft PC
  if (/Windows/i.test(ua)) {
    return { model: "PC", vendor: "Microsoft" }
  }

  return { model: "Unknown", vendor: "Unknown" }
}

/**
 * Full parsing of server User-Agent header into structured metadata.
 */
export function parseServerUserAgent(ua = "") {
  const browser = parseBrowser(ua)
  const operatingSystem = parseOperatingSystem(ua)
  const deviceType = parseDeviceType(ua)
  const { model, vendor } = parseDeviceModelAndVendor(ua)

  return {
    browser,
    operatingSystem,
    device: {
      type: deviceType,
      model,
      vendor,
    },
    userAgent: ua,
  }
}
