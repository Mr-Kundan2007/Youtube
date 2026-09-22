/**
 * Session Controller (Phase 9)
 *
 * Exposes authenticated endpoints for:
 * - Listing active multi-device sessions
 * - Terminating individual remote sessions
 * - Logging out other devices
 * - Logging out all devices
 * - Refresh token rotation
 */

import sessionService from "../services/sessionService.js"
import tokenService from "../services/tokenService.js"
import Session from "../Modals/Session.js"
import User from "../Modals/Auth.js"
import { SESSION_CONFIG } from "../config/sessionConfig.js"

export const getActiveSessions = async (req, res) => {
  try {
    const userId = req.user?.id
    const currentSessionId = req.user?.sessionId || ""

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" })
    }

    const sessions = await sessionService.getActiveSessions(userId, currentSessionId)

    return res.status(200).json({
      success: true,
      sessions,
      count: sessions.length,
      maxLimit: SESSION_CONFIG.sessionMaxPerUser,
    })
  } catch (err) {
    console.error("[SessionController] getActiveSessions error:", err)
    return res.status(500).json({ message: "Error retrieving active sessions" })
  }
}

export const terminateSession = async (req, res) => {
  try {
    const userId = req.user?.id
    const { sessionId } = req.params

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" })
    }

    if (!sessionId) {
      return res.status(400).json({ message: "Session ID is required" })
    }

    await sessionService.terminateSession(userId, sessionId, SESSION_CONFIG.logoutReason.USER_REMOTE_LOGOUT)

    return res.status(200).json({
      success: true,
      message: "Session terminated successfully",
    })
  } catch (err) {
    console.error("[SessionController] terminateSession error:", err)
    return res.status(400).json({ message: err.message || "Error terminating session" })
  }
}

export const logoutOthers = async (req, res) => {
  try {
    const userId = req.user?.id
    const currentSessionId = req.user?.sessionId

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" })
    }

    if (!currentSessionId) {
      return res.status(400).json({ message: "Current session identifier missing from token" })
    }

    const result = await sessionService.logoutOthers(userId, currentSessionId)

    return res.status(200).json({
      success: true,
      message: "All other sessions terminated successfully",
      terminatedCount: result.terminatedCount,
    })
  } catch (err) {
    console.error("[SessionController] logoutOthers error:", err)
    return res.status(500).json({ message: "Error terminating other sessions" })
  }
}

export const logoutAll = async (req, res) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" })
    }

    const result = await sessionService.logoutAll(userId, SESSION_CONFIG.logoutReason.LOGOUT_ALL)

    return res.status(200).json({
      success: true,
      message: "All sessions have been terminated. Please sign in again.",
      terminatedCount: result.terminatedCount,
    })
  } catch (err) {
    console.error("[SessionController] logoutAll error:", err)
    return res.status(500).json({ message: "Error terminating all sessions" })
  }
}

export const refreshSession = async (req, res) => {
  try {
    const refreshToken =
      req.body?.refreshToken || req.headers["x-refresh-token"]
    const sessionId = req.body?.sessionId || req.user?.sessionId

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" })
    }

    // Lookup session
    let session = null
    if (sessionId) {
      session = await Session.findOne({ sessionId })
    } else {
      // Find by hash candidate if sessionId omitted
      const candidateHash = tokenService.hashRefreshToken(refreshToken)
      session = await Session.findOne({ refreshTokenHash: candidateHash })
    }

    if (!session) {
      return res.status(401).json({ message: "Session not found or already terminated" })
    }

    const user = await User.findById(session.userId)
    if (!user) {
      return res.status(401).json({ message: "User not found" })
    }

    const tokens = await tokenService.rotateRefreshToken(user, session, refreshToken)

    return res.status(200).json({
      success: true,
      message: "Session token refreshed successfully",
      ...tokens,
    })
  } catch (err) {
    console.error("[SessionController] refreshSession error:", err)
    return res.status(401).json({ message: err.message || "Invalid refresh token" })
  }
}

export default {
  getActiveSessions,
  terminateSession,
  logoutOthers,
  logoutAll,
  refreshSession,
}
