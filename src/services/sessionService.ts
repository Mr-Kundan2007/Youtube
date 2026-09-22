/**
 * Session Management Client Service (Phase 9)
 *
 * Provides API client methods for querying active multi-device sessions,
 * terminating remote sessions, logging out other devices, logging out all devices,
 * and performing refresh token rotations.
 */

import apiClient from "./apiClient"

export interface SessionBrowser {
  name: string
  version: string
}

export interface SessionOS {
  name: string
  version: string
}

export interface SessionDevice {
  type: string
  model: string
}

export interface SessionLocation {
  city: string | null
  state: string | null
  country: string | null
}

export interface UserSession {
  id: string
  sessionId: string
  browser: SessionBrowser
  operatingSystem: SessionOS
  device: SessionDevice
  location: SessionLocation
  maskedIP: string
  createdAt: string
  lastActivityAt: string
  expiresAt: string
  isCurrentSession: boolean
}

export interface ActiveSessionsResponse {
  success: boolean
  sessions: UserSession[]
  count: number
  maxLimit: number
}

export const sessionService = {
  /**
   * Retrieves all active authenticated sessions for the current user.
   */
  async getActiveSessions(): Promise<ActiveSessionsResponse> {
    return apiClient.get<ActiveSessionsResponse>("/api/security/sessions")
  },

  /**
   * Remotely terminates an individual session by sessionId.
   */
  async terminateSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete<{ success: boolean; message: string }>(
      `/api/security/sessions/${sessionId}`
    )
  },

  /**
   * Terminates all active sessions except the current device.
   */
  async logoutOthers(): Promise<{ success: boolean; message: string; terminatedCount: number }> {
    return apiClient.post<{ success: boolean; message: string; terminatedCount: number }>(
      "/api/security/sessions/logout-others"
    )
  },

  /**
   * Terminates all active sessions (including the current device).
   */
  async logoutAll(): Promise<{ success: boolean; message: string; terminatedCount: number }> {
    return apiClient.post<{ success: boolean; message: string; terminatedCount: number }>(
      "/api/security/sessions/logout-all"
    )
  },

  /**
   * Standard logout for current session.
   */
  async logoutCurrent(): Promise<{ success: boolean; message: string }> {
    try {
      return await apiClient.post<{ success: boolean; message: string }>("/api/auth/logout")
    } catch {
      return { success: true, message: "Logged out locally" }
    }
  },

  /**
   * Rotates refresh token to obtain a new access token.
   */
  async refreshSession(refreshToken: string, sessionId?: string): Promise<{
    accessToken: string
    refreshToken: string
    sessionId: string
    expiresIn: number
  }> {
    return apiClient.post("/api/security/sessions/refresh", {
      refreshToken,
      sessionId,
    })
  },
}

export default sessionService
