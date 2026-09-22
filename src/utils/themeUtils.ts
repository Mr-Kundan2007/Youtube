/**
 * Theme System Utilities (Phase 2)
 *
 * Implements Indian Standard Time (IST, Asia/Kolkata) calculations,
 * automatic time-based theme determination (5 AM–11:59 AM IST = Light, otherwise Dark),
 * safe localStorage persistence, and DOM class application.
 */

export type ThemeMode = "automatic" | "light" | "dark"
export type ActiveTheme = "light" | "dark"

export interface StoredThemeSettings {
  themeMode: ThemeMode
  activeTheme: ActiveTheme
  lastUpdated: string
}

export const STORAGE_KEY = "youtube_theme_settings"
export const TIMEZONE = "Asia/Kolkata"

/**
 * Extracts the current hour in Indian Standard Time (IST, Asia/Kolkata).
 * Returns an integer between 0 and 23.
 */
export function getISTHour(date: Date = new Date()): number {
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
  } catch {
    // Fallback: manual calculation with UTC offset (+05:30)
  }

  // Exact UTC + 5.5 hours calculation
  const utcTimestamp = date.getTime() + date.getTimezoneOffset() * 60000
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const istDate = new Date(utcTimestamp + istOffsetMs)
  return istDate.getHours()
}

/**
 * Extracts the current minute in Indian Standard Time (IST, Asia/Kolkata).
 * Returns an integer between 0 and 59.
 */
export function getISTMinutes(date: Date = new Date()): number {
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
  } catch {
    // Fallback
  }

  const utcTimestamp = date.getTime() + date.getTimezoneOffset() * 60000
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const istDate = new Date(utcTimestamp + istOffsetMs)
  return istDate.getMinutes()
}

/**
 * Formats current IST time as a readable string (e.g. "09:30 AM IST").
 */
export function getISTTimeString(date: Date = new Date()): string {
  try {
    return (
      new Intl.DateTimeFormat("en-IN", {
        timeZone: TIMEZONE,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(date) + " IST"
    )
  } catch {
    const hour = getISTHour(date)
    const minutes = getISTMinutes(date)
    const period = hour >= 12 ? "PM" : "AM"
    const displayHour = hour % 12 === 0 ? 12 : hour % 12
    const displayMin = String(minutes).padStart(2, "0")
    return `${displayHour}:${displayMin} ${period} IST`
  }
}

/**
 * Determines whether the given time falls within the morning IST window:
 * 5:00 AM IST (inclusive) to 11:59 AM IST (inclusive).
 * Specifically: 5 <= hour < 12.
 */
export function isMorningIST(date: Date = new Date()): boolean {
  const hour = getISTHour(date)
  return hour >= 5 && hour < 12
}

/**
 * Calculates the automatic theme based on Indian Standard Time:
 * 5:00 AM IST – 11:59 AM IST  => "light"
 * 12:00 PM IST – 4:59 AM IST => "dark"
 */
export function getAutomaticTheme(date: Date = new Date()): ActiveTheme {
  return isMorningIST(date) ? "light" : "dark"
}

/**
 * Resolves the effective active theme given a selected mode and reference time.
 * - If mode is "light", returns "light" (Manual Override Priority 1)
 * - If mode is "dark", returns "dark" (Manual Override Priority 1)
 * - If mode is "automatic", evaluates IST time (Priority 2)
 */
export function resolveActiveTheme(mode: ThemeMode, date: Date = new Date()): ActiveTheme {
  if (mode === "light") return "light"
  if (mode === "dark") return "dark"
  return getAutomaticTheme(date)
}

/**
 * Safely loads stored theme settings from localStorage.
 * Validates data structure and falls back to null if corrupted or unavailable.
 */
export function getStoredTheme(): StoredThemeSettings | null {
  if (typeof window === "undefined") return null

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null

    const validModes: ThemeMode[] = ["automatic", "light", "dark"]
    if (!validModes.includes(parsed.themeMode)) {
      return null
    }

    const validThemes: ActiveTheme[] = ["light", "dark"]
    const activeTheme = validThemes.includes(parsed.activeTheme)
      ? parsed.activeTheme
      : resolveActiveTheme(parsed.themeMode)

    return {
      themeMode: parsed.themeMode,
      activeTheme,
      lastUpdated: typeof parsed.lastUpdated === "string" ? parsed.lastUpdated : new Date().toISOString(),
    }
  } catch (err) {
    console.warn("[Theme] Could not read stored theme:", err)
    return null
  }
}

/**
 * Safely persists theme settings to localStorage.
 */
export function setStoredTheme(data: StoredThemeSettings): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.warn("[Theme] Could not persist theme:", err)
  }
}

/**
 * Clears stored theme settings from localStorage.
 */
export function clearStoredTheme(): void {
  if (typeof window === "undefined") return

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn("[Theme] Could not clear stored theme:", err)
  }
}

/**
 * Applies the active theme to document.documentElement and document.body.
 * Toggles the "dark" class and sets attributes "data-theme" and "color-scheme".
 */
export function applyThemeToDocument(theme: ActiveTheme): void {
  if (typeof window === "undefined" || !document?.documentElement) return

  const root = document.documentElement
  const body = document.body

  if (theme === "dark") {
    root.classList.add("dark")
    root.setAttribute("data-theme", "dark")
    root.style.colorScheme = "dark"
    if (body) {
      body.classList.add("dark")
    }
  } else {
    root.classList.remove("dark")
    root.setAttribute("data-theme", "light")
    root.style.colorScheme = "light"
    if (body) {
      body.classList.remove("dark")
    }
  }
}
