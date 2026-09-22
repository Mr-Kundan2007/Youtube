import crypto from "crypto"
import Session from "../Modals/Session.js"
import { ApiError } from "../utils/apiError.js"
import { sendSuccess, sendError } from "../utils/apiResponse.js"
import { logger, MeetingEvents } from "../utils/logger.js"

/**
 * Creates a new tracked session for a user upon login.
 */
export const createSession = async (userId, req, context = null) => {
  const sessionId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  let deviceMeta = null
  let networkMeta = null
  let loginCtx = null
  let detectionRes = null

  if (context) {
    if (context.loginContext || context.networkInfo || context.detectionResult) {
      deviceMeta = context.deviceMetadata || context.loginContext?.device || null
      networkMeta = context.networkInfo || context.loginContext?.network || null
      loginCtx = context.loginContext || null
      detectionRes = context.detectionResult || null
    } else {
      // Direct deviceMetadata object passed
      deviceMeta = context
    }
  }

  const userAgent =
    deviceMeta?.userAgent ||
    req?.headers?.["user-agent"] ||
    "Web Browser"

  const ip =
    networkMeta?.ip?.address ||
    req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req?.socket?.remoteAddress ||
    "127.0.0.1"

  const session = await Session.create({
    sessionId,
    userId,
    userAgent,
    ip,
    expiresAt,
    deviceMetadata: deviceMeta,
    networkInfo: networkMeta,
    loginContext: loginCtx,
    detectionResult: detectionRes,
  })

  return session
}

/**
 * Logs out user and revokes current session.
 * POST /api/auth/logout
 */
export const logout = async (req, res) => {
  try {
    const sessionId = req.user?.sessionId || req.sessionId
    if (sessionId) {
      await Session.findOneAndUpdate(
        { sessionId },
        { revokedAt: new Date() }
      )
    }

    logger.info("LOGOUT", {
      userId: req.user?.id,
      sessionId,
    })

    return sendSuccess(res, { message: "Logged out successfully" })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Lists active sessions for current user.
 * GET /api/auth/sessions
 */
export const getActiveSessions = async (req, res) => {
  try {
    const userId = req.user.id
    const currentSessionId = req.user.sessionId

    const sessions = await Session.find({
      userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .sort({ lastActiveAt: -1 })
      .lean()

    const formatted = sessions.map((s) => ({
      sessionId: s.sessionId,
      userAgent: s.userAgent,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      isCurrent: s.sessionId === currentSessionId,
    }))

    return sendSuccess(res, { sessions: formatted })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Revokes a specific session.
 * POST /api/auth/sessions/revoke
 */
export const revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.body
    if (!sessionId) {
      throw ApiError.badRequest("VALIDATION_ERROR", "Session ID is required")
    }

    const session = await Session.findOne({ sessionId, userId: req.user.id })
    if (!session) {
      throw ApiError.notFound("SESSION_NOT_FOUND", "Session not found")
    }

    session.revokedAt = new Date()
    await session.save()

    logger.info("SESSION_REVOKED", {
      userId: req.user.id,
      sessionId,
    })

    return sendSuccess(res, { message: "Session revoked successfully" })
  } catch (err) {
    return sendError(res, err)
  }
}
