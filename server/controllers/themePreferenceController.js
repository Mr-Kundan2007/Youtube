import users from "../Modals/Auth.js"
import { ApiError } from "../utils/apiError.js"
import { sendSuccess, sendError } from "../utils/apiResponse.js"

export const VALID_THEME_MODES = ["automatic", "light", "dark"]
export const VALID_THEMES = ["light", "dark"]

/**
 * Calculates current active theme in Indian Standard Time (IST, Asia/Kolkata).
 * 5:00 AM IST – 11:59 AM IST => "light"
 * 12:00 PM IST – 4:59 AM IST => "dark"
 */
export const calculateISTTheme = (date = new Date()) => {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hourCycle: "h23",
    })
    const parts = formatter.formatToParts(date)
    const hourPart = parts.find((p) => p.type === "hour")
    if (hourPart) {
      const hour = parseInt(hourPart.value, 10)
      if (!isNaN(hour)) {
        return hour >= 5 && hour < 12 ? "light" : "dark"
      }
    }
  } catch {}

  // Arithmetic fallback: UTC + 5:30
  const utcTimestamp = date.getTime() + date.getTimezoneOffset() * 60000
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const istDate = new Date(utcTimestamp + istOffsetMs)
  const hour = istDate.getHours()
  return hour >= 5 && hour < 12 ? "light" : "dark"
}

/**
 * Retrieves the authenticated user's persistent theme preference.
 * GET /api/user/theme or GET /user/theme
 */
export const getThemePreference = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Authentication required to access theme preferences")
    }

    if (mongoose.connection.readyState !== 1) {
      const currentPref = calculateISTTheme()
      return sendSuccess(res, {
        themeSettings: { mode: "automatic", preference: currentPref, updatedAt: new Date().toISOString() },
        themeMode: "automatic",
        themePreference: currentPref,
        lastThemeUpdatedAt: new Date().toISOString(),
      })
    }

    const user = await users.findById(userId)
    if (!user) {
      throw ApiError.notFound("USER_NOT_FOUND", "User not found")
    }

    // Existing user migration: if theme settings are absent, assign default automatic mode
    let mode = user.themeSettings?.mode || user.themeMode
    let preference = user.themeSettings?.preference || user.themePreference
    let updatedAt = user.themeSettings?.updatedAt || user.lastThemeUpdatedAt

    if (!mode || !VALID_THEME_MODES.includes(mode)) {
      mode = "automatic"
      preference = calculateISTTheme()
      updatedAt = new Date()

      // Asynchronously heal user document with default settings
      users.findByIdAndUpdate(userId, {
        $set: {
          themeMode: mode,
          themePreference: preference,
          lastThemeUpdatedAt: updatedAt,
          themeSettings: { mode, preference, updatedAt },
        },
      }).catch(() => {})
    } else if (mode === "automatic") {
      // For automatic mode, ensure current preference matches IST
      preference = calculateISTTheme()
    }

    const themeSettings = {
      mode,
      preference,
      updatedAt: updatedAt ? new Date(updatedAt).toISOString() : new Date().toISOString(),
    }

    return sendSuccess(res, {
      themeSettings,
      themeMode: mode,
      themePreference: preference,
      lastThemeUpdatedAt: themeSettings.updatedAt,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Updates the authenticated user's persistent theme preference across all devices.
 * PUT /api/user/theme or PATCH /api/user/theme
 */
export const updateThemePreference = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Authentication required to update theme preferences")
    }

    // Support both { mode } or { themeMode } or { themeSettings: { mode } }
    const rawMode = req.body?.mode || req.body?.themeMode || req.body?.themeSettings?.mode

    if (!rawMode || typeof rawMode !== "string") {
      throw ApiError.badRequest("VALIDATION_ERROR", "Field 'mode' is required and must be a string")
    }

    const mode = rawMode.trim().toLowerCase()

    if (!VALID_THEME_MODES.includes(mode)) {
      throw ApiError.badRequest(
        "INVALID_THEME_MODE",
        `Invalid theme mode '${rawMode}'. Must be one of: ${VALID_THEME_MODES.join(", ")}`
      )
    }

    // Validate optional explicit preference if provided
    const rawPreference = req.body?.preference || req.body?.themePreference || req.body?.themeSettings?.preference
    if (rawPreference && !VALID_THEMES.includes(String(rawPreference).trim().toLowerCase())) {
      throw ApiError.badRequest(
        "INVALID_THEME_PREFERENCE",
        `Invalid theme preference '${rawPreference}'. Must be one of: ${VALID_THEMES.join(", ")}`
      )
    }

    // Determine applied theme preference
    let preference
    if (mode === "automatic") {
      preference = calculateISTTheme()
    } else {
      preference = mode // "light" or "dark"
    }

    const updatedAt = new Date()

    const updates = {
      themeMode: mode,
      themePreference: preference,
      lastThemeUpdatedAt: updatedAt,
      themeSettings: {
        mode,
        preference,
        updatedAt,
      },
    }

    const updatedUser = await users.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    )

    if (!updatedUser) {
      throw ApiError.notFound("USER_NOT_FOUND", "User not found")
    }

    const themeSettings = {
      mode: updatedUser.themeSettings?.mode || mode,
      preference: updatedUser.themeSettings?.preference || preference,
      updatedAt: updatedAt.toISOString(),
    }

    return sendSuccess(
      res,
      {
        themeSettings,
        themeMode: mode,
        themePreference: preference,
        lastThemeUpdatedAt: themeSettings.updatedAt,
      },
      200,
      "Theme preference updated successfully"
    )
  } catch (err) {
    return sendError(res, err)
  }
}
