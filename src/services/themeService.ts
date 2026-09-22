/**
 * Persistent User Theme Service (Phase 3)
 *
 * Manages cross-device theme preference synchronization with the backend API.
 * Includes request cancellation to prevent race conditions during rapid theme toggling.
 */

import { apiClient, isApiError } from "@/services/apiClient"
import { ThemeMode, ActiveTheme } from "@/utils/themeUtils"

export interface ThemeSettingsObject {
  mode: ThemeMode
  preference: ActiveTheme
  updatedAt: string
}

export interface UserThemePreferenceResponse {
  themeSettings?: ThemeSettingsObject
  themeMode: ThemeMode
  themePreference: ActiveTheme
  lastThemeUpdatedAt: string | null
}

export interface UpdateThemePayload {
  mode?: ThemeMode
  themeMode?: ThemeMode
  themePreference?: ActiveTheme
}

class ThemeService {
  private activeAbortController: AbortController | null = null

  /**
   * Fetches the authenticated user's remote theme settings from GET /api/user/theme.
   * Returns null if unauthenticated or on network/API failure.
   */
  async getThemeSettings(): Promise<UserThemePreferenceResponse | null> {
    return this.getUserThemePreference()
  }

  async getUserThemePreference(): Promise<UserThemePreferenceResponse | null> {
    try {
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("token")
        if (!token || token === "demo-token") {
          return null
        }
      }

      const response = await apiClient.get<any>("/api/user/theme", {
        timeoutMs: 5000,
      })

      if (!response) return null

      // Normalize envelope response: data or direct object
      const data = response.data || response
      const settings = data.themeSettings || {}
      const mode: ThemeMode = settings.mode || data.themeMode || "automatic"
      const preference: ActiveTheme = settings.preference || data.themePreference || "dark"
      const lastThemeUpdatedAt: string | null = settings.updatedAt || data.lastThemeUpdatedAt || null

      return {
        themeSettings: {
          mode,
          preference,
          updatedAt: lastThemeUpdatedAt || new Date().toISOString(),
        },
        themeMode: mode,
        themePreference: preference,
        lastThemeUpdatedAt,
      }
    } catch (err) {
      if (isApiError(err) && (err.status === 401 || err.status === 403)) {
        return null
      }
      console.warn("[ThemeService] Failed to fetch remote theme preference:", err)
      return null
    }
  }

  /**
   * Updates the authenticated user's persistent theme preference across all devices.
   * Cancels prior in-flight requests to eliminate race conditions during rapid toggling.
   * PUT /api/user/theme
   */
  async updateThemeSettings(mode: ThemeMode): Promise<UserThemePreferenceResponse> {
    return this.updateUserThemePreference({ mode, themeMode: mode })
  }

  async updateUserThemePreference(payload: UpdateThemePayload): Promise<UserThemePreferenceResponse> {
    // Abort any prior in-flight request so latest user intent strictly wins
    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort()
      } catch {}
      this.activeAbortController = null
    }

    const abortController = new AbortController()
    this.activeAbortController = abortController

    try {
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("token")
        if (!token || token === "demo-token") {
          // Unauthenticated guest user: simulate local success
          const mode = payload.mode || payload.themeMode || "automatic"
          return {
            themeMode: mode,
            themePreference: mode === "light" ? "light" : "dark",
            lastThemeUpdatedAt: new Date().toISOString(),
          }
        }
      }

      const modeToSend = payload.mode || payload.themeMode || "automatic"

      const response = await apiClient.put<any>(
        "/api/user/theme",
        { mode: modeToSend, themeMode: modeToSend },
        {
          signal: abortController.signal,
          timeoutMs: 6000,
        }
      )

      const data = response?.data || response
      const settings = data?.themeSettings || {}
      const mode: ThemeMode = settings.mode || data?.themeMode || modeToSend
      const preference: ActiveTheme = settings.preference || data?.themePreference || (mode === "light" ? "light" : "dark")
      const lastThemeUpdatedAt: string | null = settings.updatedAt || data?.lastThemeUpdatedAt || new Date().toISOString()

      return {
        themeSettings: {
          mode,
          preference,
          updatedAt: lastThemeUpdatedAt || new Date().toISOString(),
        },
        themeMode: mode,
        themePreference: preference,
        lastThemeUpdatedAt,
      }
    } catch (err: any) {
      // If request was aborted because user clicked another option immediately, rethrow abort cleanly
      if (err?.name === "AbortError" || err?.code === "REQUEST_TIMEOUT" && abortController.signal.aborted) {
        throw new Error("REQUEST_ABORTED")
      }
      console.warn("[ThemeService] Failed to persist remote theme preference:", err)
      throw err
    } finally {
      if (this.activeAbortController === abortController) {
        this.activeAbortController = null
      }
    }
  }
}

export const themeService = new ThemeService()
export default themeService
