/**
 * Session Service (Phase 9)
 *
 * Coordinates multi-device session creation, capacity limit enforcement,
 * active session retrieval, individual remote logout, logout others,
 * logout all, session validation, and throttled activity tracking.
 */

import crypto from "crypto"
import mongoose from "mongoose"
import Session from "../Modals/Session.js"
import SecurityEvent from "../Modals/SecurityEvent.js"
import { SESSION_CONFIG } from "../config/sessionConfig.js"
import { tokenService } from "./tokenService.js"
import { maskIPAddress } from "../utils/comparisonUtils.js"

export class SessionService {
  /**
   * Creates a new managed session upon successful authentication.
   * Enforces session capacity limits (max 10 per user).
   */
  async createSession({
    userId,
    user = null,
    req = null,
    loginContext = {},
    authenticationMethod = "PASSWORD",
    trustedDeviceId = null,
    loginHistoryId = null,
  }) {
    if (!userId) {
      throw new Error("userId is required to create a session")
    }

    const dev = loginContext.device || {}
    const net = loginContext.network || {}
    const loc = net.location || {}

    const rawIp =
      net.ipAddress ||
      net.ip?.address ||
      loginContext.clientIp ||
      req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req?.socket?.remoteAddress ||
      "127.0.0.1"

    const maskedIp = rawIp ? maskIPAddress(rawIp) : "127.0.xxx.xxx"

    // 1. Capacity Limit Enforcement (Max 10 Active Sessions per User)
    const activeSessions = await Session.find({
      userId,
      status: SESSION_CONFIG.status.ACTIVE,
      expiresAt: { $gt: new Date() },
    }).sort({ lastActivityAt: 1 })

    if (activeSessions.length >= SESSION_CONFIG.sessionMaxPerUser) {
      const oldest = activeSessions[0]
      if (oldest) {
        oldest.status = SESSION_CONFIG.status.TERMINATED
        oldest.logoutReason = SESSION_CONFIG.logoutReason.SESSION_LIMIT_REACHED
        oldest.terminatedAt = new Date()
        oldest.refreshTokenHash = null
        oldest.revokedAt = new Date()
        await oldest.save()

        await SecurityEvent.create({
          eventType: SESSION_CONFIG.eventTypes.SESSION_AUTO_TERMINATED,
          userId: userId.toString(),
          severity: "LOW",
          metadata: {
            terminatedSessionId: oldest.sessionId,
            reason: "SESSION_LIMIT_EXCEEDED",
          },
          timestamp: new Date(),
        })
      }
    }

    // 2. Generate Unique Session ID and Expiration
    const sessionId = crypto.randomUUID()
    const sessionDurationMs = SESSION_CONFIG.sessionExpiryDays * 24 * 60 * 60 * 1000
    const expiresAt = new Date(Date.now() + sessionDurationMs)

    const userAgent =
      dev.userAgent ||
      req?.headers?.["user-agent"] ||
      `${dev.browser?.name || "Browser"} on ${dev.os?.name || "OS"}`

    // 3. Create Session Record
    const session = new Session({
      sessionId,
      userId,
      trustedDeviceId: trustedDeviceId || null,
      loginHistoryId: loginHistoryId || null,
      authenticationMethod,
      browser: {
        name: dev.browser?.name || "Unknown Browser",
        version: dev.browser?.version || "",
        family: dev.browser?.family || "unknown",
      },
      operatingSystem: {
        name: dev.os?.name || "Unknown OS",
        version: dev.os?.version || "",
      },
      device: {
        type: dev.type || "desktop",
        model: dev.model || "Unknown",
        vendor: dev.vendor || "Unknown",
      },
      ipAddress: rawIp,
      maskedIP: maskedIp,
      location: {
        city: loc.city || null,
        state: loc.state || null,
        country: loc.country || null,
        countryCode: loc.countryCode || null,
      },
      status: SESSION_CONFIG.status.ACTIVE,
      lastActivityAt: new Date(),
      expiresAt,

      // Backwards-compatible fields
      userAgent,
      ip: rawIp,
      lastActiveAt: new Date(),
      deviceMetadata: dev,
      networkInfo: net,
      loginContext,
    })

    await session.save()

    // 4. Generate Paired Access and Refresh Tokens
    const userPayload = user || { _id: userId, email: req?.body?.email || "" }
    const tokens = await tokenService.generateTokens(userPayload, session)

    // 5. Emit Security Event
    await SecurityEvent.create({
      eventType: SESSION_CONFIG.eventTypes.SESSION_CREATED,
      userId: userId.toString(),
      severity: "LOW",
      metadata: {
        sessionId,
        browser: dev.browser?.name,
        deviceType: dev.type,
        city: loc.city,
      },
      ip: maskedIp,
      timestamp: new Date(),
    })

    return {
      session,
      tokens,
      sessionId,
    }
  }

  /**
   * Retrieves all active, non-expired sessions for a user with current session identified.
   */
  async getActiveSessions(userId, currentSessionId = "") {
    if (!userId) return []

    try {
      const now = new Date()
      const sessions = await Session.find({
        userId,
        status: SESSION_CONFIG.status.ACTIVE,
        expiresAt: { $gt: now },
      })
        .sort({ lastActivityAt: -1 })
        .lean()

      const formatted = []

      for (const s of sessions) {
        // Idle timeout verification
        if (SESSION_CONFIG.sessionIdleTimeoutDays > 0) {
          const idleThreshold =
            SESSION_CONFIG.sessionIdleTimeoutDays * 24 * 60 * 60 * 1000
          if (now.getTime() - new Date(s.lastActivityAt || s.createdAt).getTime() > idleThreshold) {
            Session.updateOne(
              { _id: s._id },
              {
                status: SESSION_CONFIG.status.EXPIRED,
                logoutReason: SESSION_CONFIG.logoutReason.IDLE_TIMEOUT,
              }
            ).exec()
            continue
          }
        }

        const isCurrentSession = Boolean(
          currentSessionId && s.sessionId === currentSessionId
        )

        formatted.push({
          id: s.sessionId,
          sessionId: s.sessionId,
          browser: {
            name: s.browser?.name || "Unknown Browser",
            version: s.browser?.version || "",
          },
          operatingSystem: {
            name: s.operatingSystem?.name || "Unknown OS",
            version: s.operatingSystem?.version || "",
          },
          device: {
            type: s.device?.type || "desktop",
            model: s.device?.model || "Unknown Device",
          },
          location: {
            city: s.location?.city || null,
            state: s.location?.state || null,
            country: s.location?.country || null,
          },
          maskedIP: s.maskedIP || (s.ipAddress ? maskIPAddress(s.ipAddress) : "Masked"),
          createdAt: s.createdAt,
          lastActivityAt: s.lastActivityAt || s.lastActiveAt,
          expiresAt: s.expiresAt,
          isCurrentSession,
        })
      }

      return formatted
    } catch (err) {
      console.error("[SessionService] Error fetching active sessions:", err)
      return []
    }
  }

  /**
   * Validates a session by ID. Rejects terminated, revoked, or expired sessions.
   */
  async validateSession(sessionId) {
    if (!sessionId) return null

    try {
      const session = await Session.findOne({ sessionId })
      if (!session) return null

      if (session.status !== SESSION_CONFIG.status.ACTIVE) {
        return null
      }

      const now = new Date()
      if (now > new Date(session.expiresAt)) {
        session.status = SESSION_CONFIG.status.EXPIRED
        await session.save()
        return null
      }

      // Check idle timeout
      if (SESSION_CONFIG.sessionIdleTimeoutDays > 0) {
        const idleThreshold =
          SESSION_CONFIG.sessionIdleTimeoutDays * 24 * 60 * 60 * 1000
        if (now.getTime() - new Date(session.lastActivityAt).getTime() > idleThreshold) {
          session.status = SESSION_CONFIG.status.EXPIRED
          session.logoutReason = SESSION_CONFIG.logoutReason.IDLE_TIMEOUT
          await session.save()
          return null
        }
      }

      return session
    } catch (err) {
      console.error("[SessionService] Error validating session:", err)
      return null
    }
  }

  /**
   * Throttled update of lastActivityAt to avoid excessive DB writes.
   */
  touchSessionActivity(session) {
    if (!session || !session.lastActivityAt) return

    const now = Date.now()
    const elapsedMs = now - new Date(session.lastActivityAt).getTime()
    const throttleMs = SESSION_CONFIG.sessionActivityUpdateMinutes * 60 * 1000

    if (elapsedMs > throttleMs) {
      Session.updateOne(
        { _id: session._id },
        {
          $set: {
            lastActivityAt: new Date(now),
            lastActiveAt: new Date(now),
          },
        }
      )
        .exec()
        .catch((e) => console.warn("[SessionService] Non-fatal activity update warning:", e))
    }
  }

  /**
   * Terminates a single session owned by the authenticated user.
   */
  async terminateSession(userId, sessionId, reason = SESSION_CONFIG.logoutReason.USER_REMOTE_LOGOUT) {
    if (!userId || !sessionId) {
      throw new Error("userId and sessionId are required")
    }

    const session = await Session.findOne({ sessionId, userId })
    if (!session) {
      throw new Error("Session not found or does not belong to user")
    }

    session.status = SESSION_CONFIG.status.TERMINATED
    session.logoutReason = reason
    session.terminatedAt = new Date()
    session.refreshTokenHash = null
    session.revokedAt = new Date() // backwards-compat
    await session.save()

    const eventType =
      reason === SESSION_CONFIG.logoutReason.USER_LOGOUT
        ? SESSION_CONFIG.eventTypes.SESSION_TERMINATED
        : SESSION_CONFIG.eventTypes.SESSION_REMOTE_LOGOUT

    await SecurityEvent.create({
      eventType,
      userId: userId.toString(),
      severity: "LOW",
      metadata: {
        sessionId,
        reason,
        device: session.device?.model || session.device?.type,
      },
      timestamp: new Date(),
    })

    return session
  }

  /**
   * Terminates all other active sessions for user, keeping currentSessionId intact.
   */
  async logoutOthers(userId, currentSessionId) {
    if (!userId || !currentSessionId) {
      throw new Error("userId and currentSessionId are required")
    }

    if (mongoose.connection?.readyState !== 1 || !mongoose.Types.ObjectId.isValid(userId)) {
      return { terminatedCount: 0 }
    }

    const result = await Session.updateMany(
      {
        userId,
        sessionId: { $ne: currentSessionId },
        status: SESSION_CONFIG.status.ACTIVE,
      },
      {
        $set: {
          status: SESSION_CONFIG.status.TERMINATED,
          logoutReason: SESSION_CONFIG.logoutReason.LOGOUT_OTHERS,
          terminatedAt: new Date(),
          refreshTokenHash: null,
          revokedAt: new Date(),
        },
      }
    )

    await SecurityEvent.create({
      eventType: SESSION_CONFIG.eventTypes.SESSION_LOGOUT_OTHERS,
      userId: userId.toString(),
      severity: "MEDIUM",
      metadata: {
        currentSessionId,
        terminatedCount: result.modifiedCount,
      },
      timestamp: new Date(),
    })

    return { terminatedCount: result.modifiedCount }
  }

  /**
   * Terminates all active sessions for a user (including current).
   */
  async logoutAll(userId, reason = SESSION_CONFIG.logoutReason.LOGOUT_ALL) {
    if (!userId) {
      throw new Error("userId is required")
    }

    if (mongoose.connection?.readyState !== 1 || !mongoose.Types.ObjectId.isValid(userId)) {
      return { terminatedCount: 0 }
    }

    const result = await Session.updateMany(
      {
        userId,
        status: SESSION_CONFIG.status.ACTIVE,
      },
      {
        $set: {
          status: SESSION_CONFIG.status.TERMINATED,
          logoutReason: reason,
          terminatedAt: new Date(),
          refreshTokenHash: null,
          revokedAt: new Date(),
        },
      }
    )

    await SecurityEvent.create({
      eventType: SESSION_CONFIG.eventTypes.SESSION_LOGOUT_ALL,
      userId: userId.toString(),
      severity: "MEDIUM",
      metadata: {
        reason,
        terminatedCount: result.modifiedCount,
      },
      timestamp: new Date(),
    })

    return { terminatedCount: result.modifiedCount }
  }

  // Aliases for account protection integration
  async terminateAllUserSessionsExceptCurrent(userId, currentSessionId, reason) {
    return this.logoutOthers(userId, currentSessionId)
  }

  async terminateAllUserSessions(userId, reason) {
    return this.logoutAll(userId, reason)
  }
}

export const sessionService = new SessionService()
export default sessionService
