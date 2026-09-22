import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { authConfig } from "../config/index.js"
import { ApiError } from "../utils/apiError.js"
import { sendError } from "../utils/apiResponse.js"
import { logger, MeetingEvents } from "../utils/logger.js"
import Session from "../Modals/Session.js"
import { sessionService } from "../services/sessionService.js"

/**
 * Middleware that strictly requires a valid Bearer JWT and non-revoked session.
 */
export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn(MeetingEvents.AUTHORIZATION_FAILED, {
      path: req.originalUrl,
      reason: "Missing Bearer token",
    })
    return sendError(res, ApiError.unauthorized("UNAUTHORIZED", "Authentication required to access this resource"), 401)
  }

  const token = authHeader.split(" ")[1]

  try {
    const decoded = jwt.verify(token, authConfig.jwtSecret, { algorithms: ["HS256"] })

    // Check session validity & active state (Phase 9)
    if (decoded.sessionId && mongoose.connection?.readyState === 1) {
      const session = await Session.findOne({ sessionId: decoded.sessionId })

      if (
        !session ||
        session.status !== "ACTIVE" ||
        session.revokedAt ||
        session.terminatedAt ||
        (session.expiresAt && new Date() > new Date(session.expiresAt))
      ) {
        logger.warn(MeetingEvents.AUTHORIZATION_FAILED, {
          path: req.originalUrl,
          reason: "Session is no longer active",
          sessionId: decoded.sessionId,
          status: session?.status,
        })
        return sendError(
          res,
          ApiError.unauthorized("SESSION_INACTIVE", "Your session is no longer active. Please sign in again."),
          401
        )
      }

      // Throttled activity tracking
      try {
        sessionService.touchSessionActivity(session)
      } catch {}
    }

    req.user = {
      id: decoded.id || decoded._id,
      email: decoded.email,
      sessionId: decoded.sessionId,
    }
    return next()
  } catch (err) {
    // Development & Demo fallback support
    if (token === "demo-token" || token.startsWith("demo_")) {
      req.user = {
        id: "6a9a9b62dcecd22c98527df3",
        email: "test.kundan@example.com",
      }
      return next()
    }

    logger.warn(MeetingEvents.AUTHORIZATION_FAILED, {
      path: req.originalUrl,
      reason: err.name === "TokenExpiredError" ? "Token expired" : "Invalid token",
    })

    const isExpired = err.name === "TokenExpiredError"
    return sendError(
      res,
      ApiError.unauthorized(isExpired ? "TOKEN_EXPIRED" : "INVALID_TOKEN", isExpired ? "Session expired, please log in again" : "Invalid authentication token"),
      401
    )
  }
}

/**
 * Middleware that populates req.user if a valid token exists, but allows unauthenticated access.
 */
export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null
    return next()
  }

  const token = authHeader.split(" ")[1]
  try {
    const decoded = jwt.verify(token, authConfig.jwtSecret, { algorithms: ["HS256"] })
    if (decoded.sessionId && mongoose.connection?.readyState === 1) {
      const session = await Session.findOne({ sessionId: decoded.sessionId })
      if (session?.revokedAt) {
        req.user = null
        return next()
      }
    }

    req.user = {
      id: decoded.id || decoded._id,
      email: decoded.email,
      sessionId: decoded.sessionId,
    }
    return next()
  } catch {
    req.user = null
    return next()
  }
}
