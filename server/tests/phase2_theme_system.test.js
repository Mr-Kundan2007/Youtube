import assert from "assert"

// Mirroring the pure logic of src/utils/themeUtils.ts for backend/unit validation
const TIMEZONE = "Asia/Kolkata"

function getISTHour(date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      hour: "numeric",
      hourCycle: "h23",
    })
    const parts = formatter.formatToParts(date)
    const hourPart = parts.find((p) => p.type === "hour")
    if (hourPart) {
      const parsed = parseInt(hourPart.value, 10)
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 23) {
        return parsed
      }
    }
  } catch {}

  const utcTimestamp = date.getTime() + date.getTimezoneOffset() * 60000
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const istDate = new Date(utcTimestamp + istOffsetMs)
  return istDate.getHours()
}

function getISTMinutes(date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      minute: "numeric",
    })
    const parts = formatter.formatToParts(date)
    const minPart = parts.find((p) => p.type === "minute")
    if (minPart) {
      const parsed = parseInt(minPart.value, 10)
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 59) {
        return parsed
      }
    }
  } catch {}

  const utcTimestamp = date.getTime() + date.getTimezoneOffset() * 60000
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const istDate = new Date(utcTimestamp + istOffsetMs)
  return istDate.getMinutes()
}

function isMorningIST(date = new Date()) {
  const hour = getISTHour(date)
  return hour >= 5 && hour < 12
}

function getAutomaticTheme(date = new Date()) {
  return isMorningIST(date) ? "light" : "dark"
}

function resolveActiveTheme(mode, date = new Date()) {
  if (mode === "light") return "light"
  if (mode === "dark") return "dark"
  return getAutomaticTheme(date)
}

function parseStoredTheme(rawJson) {
  if (!rawJson) return null
  try {
    const parsed = JSON.parse(rawJson)
    if (!parsed || typeof parsed !== "object") return null
    const validModes = ["automatic", "light", "dark"]
    if (!validModes.includes(parsed.themeMode)) return null
    const validThemes = ["light", "dark"]
    const activeTheme = validThemes.includes(parsed.activeTheme)
      ? parsed.activeTheme
      : resolveActiveTheme(parsed.themeMode)
    return {
      themeMode: parsed.themeMode,
      activeTheme,
      lastUpdated: typeof parsed.lastUpdated === "string" ? parsed.lastUpdated : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

// Helper to construct an exact UTC Date corresponding to a given IST time
// IST is UTC + 5:30.
// So IST Year-Month-Day H:M:S corresponds to UTC: subtract 5 hours 30 minutes.
function makeDateFromIST(year, month, day, istHour, istMinute, istSecond = 0) {
  // Month is 1-indexed (1 = Jan, 12 = Dec)
  const istTimeMs = Date.UTC(year, month - 1, day, istHour, istMinute, istSecond)
  // Since IST is UTC + 5:30, the UTC time is istTimeMs - 5.5 hours
  const utcTimeMs = istTimeMs - 5.5 * 60 * 60 * 1000
  return new Date(utcTimeMs)
}

console.log("==================================================================")
console.log("PHASE 2: AUTOMATIC TIME-BASED THEME SYSTEM (IST) TEST SUITE")
console.log("==================================================================")

let passed = 0
let failed = 0

function runTest(name, fn) {
  try {
    fn()
    console.log(`  ✓ [PASS] ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`)
    console.error(`    Error: ${err.message}`)
    failed++
  }
}

// 1. Boundary Condition Tests
runTest("Boundary 1: 04:59 AM IST => DARK THEME", () => {
  const d = makeDateFromIST(2026, 9, 12, 4, 59, 0)
  assert.strictEqual(getISTHour(d), 4, "IST hour must be 4")
  assert.strictEqual(getISTMinutes(d), 59, "IST minutes must be 59")
  assert.strictEqual(isMorningIST(d), false, "4:59 AM is not morning")
  assert.strictEqual(getAutomaticTheme(d), "dark", "4:59 AM must be dark")
})

runTest("Boundary 2: 05:00 AM IST => LIGHT THEME", () => {
  const d = makeDateFromIST(2026, 9, 12, 5, 0, 0)
  assert.strictEqual(getISTHour(d), 5, "IST hour must be 5")
  assert.strictEqual(getISTMinutes(d), 0, "IST minutes must be 0")
  assert.strictEqual(isMorningIST(d), true, "5:00 AM is morning")
  assert.strictEqual(getAutomaticTheme(d), "light", "5:00 AM must be light")
})

runTest("Boundary 3: 07:30 AM IST => LIGHT THEME", () => {
  const d = makeDateFromIST(2026, 9, 12, 7, 30, 0)
  assert.strictEqual(getISTHour(d), 7, "IST hour must be 7")
  assert.strictEqual(isMorningIST(d), true, "7:30 AM is morning")
  assert.strictEqual(getAutomaticTheme(d), "light", "7:30 AM must be light")
})

runTest("Boundary 4: 11:59 AM IST => LIGHT THEME", () => {
  const d = makeDateFromIST(2026, 9, 12, 11, 59, 59)
  assert.strictEqual(getISTHour(d), 11, "IST hour must be 11")
  assert.strictEqual(getISTMinutes(d), 59, "IST minutes must be 59")
  assert.strictEqual(isMorningIST(d), true, "11:59 AM is morning")
  assert.strictEqual(getAutomaticTheme(d), "light", "11:59 AM must be light")
})

runTest("Boundary 5: 12:00 PM IST => DARK THEME", () => {
  const d = makeDateFromIST(2026, 9, 12, 12, 0, 0)
  assert.strictEqual(getISTHour(d), 12, "IST hour must be 12")
  assert.strictEqual(getISTMinutes(d), 0, "IST minutes must be 0")
  assert.strictEqual(isMorningIST(d), false, "12:00 PM is afternoon (not morning)")
  assert.strictEqual(getAutomaticTheme(d), "dark", "12:00 PM must be dark")
})

runTest("Boundary 6: 03:00 PM IST (15:00) => DARK THEME", () => {
  const d = makeDateFromIST(2026, 9, 12, 15, 0, 0)
  assert.strictEqual(getISTHour(d), 15, "IST hour must be 15")
  assert.strictEqual(getAutomaticTheme(d), "dark", "3:00 PM must be dark")
})

runTest("Boundary 7: 08:00 PM IST (20:00) => DARK THEME", () => {
  const d = makeDateFromIST(2026, 9, 12, 20, 0, 0)
  assert.strictEqual(getISTHour(d), 20, "IST hour must be 20")
  assert.strictEqual(getAutomaticTheme(d), "dark", "8:00 PM must be dark")
})

runTest("Boundary 8: 11:59 PM IST (23:59) => DARK THEME", () => {
  const d = makeDateFromIST(2026, 9, 12, 23, 59, 59)
  assert.strictEqual(getISTHour(d), 23, "IST hour must be 23")
  assert.strictEqual(getAutomaticTheme(d), "dark", "11:59 PM must be dark")
})

runTest("Boundary 9: 02:00 AM IST => DARK THEME", () => {
  const d = makeDateFromIST(2026, 9, 12, 2, 0, 0)
  assert.strictEqual(getISTHour(d), 2, "IST hour must be 2")
  assert.strictEqual(getAutomaticTheme(d), "dark", "2:00 AM must be dark")
})

// 2. 24-Hour Sweep Verification
runTest("24-Hour Sweep: Hours 5..11 are LIGHT, all other 17 hours are DARK", () => {
  for (let h = 0; h < 24; h++) {
    const d = makeDateFromIST(2026, 9, 12, h, 15, 0)
    const istHour = getISTHour(d)
    assert.strictEqual(istHour, h, `Hour check for ${h}`)
    const expected = h >= 5 && h < 12 ? "light" : "dark"
    assert.strictEqual(getAutomaticTheme(d), expected, `Hour ${h} should be ${expected}`)
  }
})

// 3. User Priority Rules: Manual Overrides
runTest("Priority 1: Manual Dark at 8:00 AM IST overrides automatic light", () => {
  const morningDate = makeDateFromIST(2026, 9, 12, 8, 0, 0)
  assert.strictEqual(getAutomaticTheme(morningDate), "light", "Auto would be light")
  // User selected manual dark
  const resolved = resolveActiveTheme("dark", morningDate)
  assert.strictEqual(resolved, "dark", "Manual Dark MUST override automatic light at 8 AM")
})

runTest("Priority 1: Manual Light at 9:00 PM IST overrides automatic dark", () => {
  const nightDate = makeDateFromIST(2026, 9, 12, 21, 0, 0)
  assert.strictEqual(getAutomaticTheme(nightDate), "dark", "Auto would be dark")
  // User selected manual light
  const resolved = resolveActiveTheme("light", nightDate)
  assert.strictEqual(resolved, "light", "Manual Light MUST override automatic dark at 9 PM")
})

runTest("Priority 2: Automatic mode uses IST time", () => {
  const morningDate = makeDateFromIST(2026, 9, 12, 9, 0, 0)
  const nightDate = makeDateFromIST(2026, 9, 12, 22, 0, 0)
  assert.strictEqual(resolveActiveTheme("automatic", morningDate), "light")
  assert.strictEqual(resolveActiveTheme("automatic", nightDate), "dark")
})

// 4. Stored Theme Parsing & Corruption Resilience
runTest("Storage: Valid stored manual light is parsed properly", () => {
  const raw = JSON.stringify({ themeMode: "light", activeTheme: "light", lastUpdated: "2026-09-12T00:00:00Z" })
  const parsed = parseStoredTheme(raw)
  assert.strictEqual(parsed.themeMode, "light")
  assert.strictEqual(parsed.activeTheme, "light")
})

runTest("Storage: Valid stored manual dark is parsed properly", () => {
  const raw = JSON.stringify({ themeMode: "dark", activeTheme: "dark", lastUpdated: "2026-09-12T00:00:00Z" })
  const parsed = parseStoredTheme(raw)
  assert.strictEqual(parsed.themeMode, "dark")
  assert.strictEqual(parsed.activeTheme, "dark")
})

runTest("Storage: Valid stored automatic mode resolves activeTheme", () => {
  const raw = JSON.stringify({ themeMode: "automatic", activeTheme: "dark", lastUpdated: "2026-09-12T00:00:00Z" })
  const parsed = parseStoredTheme(raw)
  assert.strictEqual(parsed.themeMode, "automatic")
})

runTest("Storage: Corrupted JSON returns null and safely falls back", () => {
  assert.strictEqual(parseStoredTheme("{corrupted_json"), null)
  assert.strictEqual(parseStoredTheme(""), null)
  assert.strictEqual(parseStoredTheme(null), null)
})

runTest("Storage: Invalid themeMode value is rejected (security validation)", () => {
  const raw = JSON.stringify({ themeMode: "hacked_mode_xyz", activeTheme: "light" })
  assert.strictEqual(parseStoredTheme(raw), null, "Invalid themeMode must be rejected")
})

runTest("Storage: Missing or invalid activeTheme is healed based on themeMode", () => {
  const raw = JSON.stringify({ themeMode: "light", activeTheme: "corrupted_theme" })
  const parsed = parseStoredTheme(raw)
  assert.strictEqual(parsed.themeMode, "light")
  assert.strictEqual(parsed.activeTheme, "light", "Must heal activeTheme to light")
})

console.log("------------------------------------------------------------------")
console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`)
console.log("------------------------------------------------------------------")

if (failed > 0) {
  process.exit(1)
}
