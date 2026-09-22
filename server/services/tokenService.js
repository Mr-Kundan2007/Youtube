/**
 * Token Service (Phase 9)
 *
 * Handles secure access and refresh token generation, HMAC-SHA256 refresh token hashing,
 * constant-time verification, refresh token rotation, and replay attack detection.
 */

import crypto from "crypto"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { SESSION_CONFIG } from "../config/sessionConfig.js"
import SecurityEvent from "../Modals/SecurityEvent.js"

export class TokenService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || "thisisayoutubeclonesecretkey"
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || this.jwtSecret
  }

  /**
   * Computes deterministic salted HMAC-SHA256 hash of a refresh token.
   * Plain refresh tokens are never persisted in the database.
   */
  hashRefreshToken(refreshToken = "") {
    if (!refreshToken || typeof refreshToken !== "string") return ""
    return crypto
      .createHmac("sha256", this.refreshSecret)
      .update(refreshToken)
      .digest("hex")
  }

  /**
   * Generates paired access token and single-use refresh token linked to a session.
   */
  async generateTokens(user, session) {
    if (!user || !session) {
      throw new Error("User and session are required to generate tokens")
    }

    const userId = user._id ? user._id.toString() : user.id
    const userEmail = user.email || ""
    const sessionId = session.sessionId

    // 1. Generate Access Token (Short-lived, e.g. 15m)
    const accessToken = jwt.sign(
      {
        id: userId,
        email: userEmail,
        sessionId,
        type: "ACCESS",
      },
      this.jwtSecret,
      {
        expiresIn: `${SESSION_CONFIG.accessTokenExpiryMinutes}m`,
      }
    )

    // 2. Generate Cryptographically Secure Refresh Token
    const randomHex = crypto.randomBytes(48).toString("hex")
    const refreshToken = `rft_${sessionId}_${randomHex}`

    // 3. Hash and store on session
    const refreshTokenHash = this.hashRefreshToken(refreshToken)
    session.refreshTokenHash = refreshTokenHash
    if (typeof session.save === "function") {
      await session.save()
    }

    return {
      accessToken,
      refreshToken,
      token: accessToken, // Backwards-compatible alias
      sessionId,
      expiresIn: SESSION_CONFIG.accessTokenExpiryMinutes * 60,
    }
  }

  /**
   * Timing-safe verification of candidate refresh token against session's stored hash.
   */
  verifyRefreshToken(refreshToken, session) {
    if (!refreshToken || !session?.refreshTokenHash) return false

    const candidateHash = this.hashRefreshToken(refreshToken)
    const storedHash = session.refreshTokenHash

    try {
      const a = Buffer.from(candidateHash, "hex")
      const b = Buffer.from(storedHash, "hex")
      if (a.length !== b.length) return false
      return crypto.timingSafeEqual(a, b)
    } catch {
      return false
    }
  }

  /**
   * Rotates refresh token upon presentation.
   * Enforces single-use policy: if a previously invalidated/reused token is presented,
   * detects token theft, immediately revokes the session, and logs a critical security event.
   */
  async rotateRefreshToken(user, session, presentedRefreshToken) {
    if (!session) {
      throw new Error("Session not found")
    }

    if (session.status !== SESSION_CONFIG.status.ACTIVE || new Date() > new Date(session.expiresAt)) {
      throw new Error("Session is no longer active or has expired. Please sign in again.")
    }

    const isValid = this.verifyRefreshToken(presentedRefreshToken, session)

    if (!isValid) {
      // Token Replay / Theft Detection
      session.status = SESSION_CONFIG.status.REVOKED
      session.logoutReason = SESSION_CONFIG.logoutReason.SECURITY_REVOCATION
      session.terminatedAt = new Date()
      session.refreshTokenHash = null
      if (typeof session.save === "function") {
        await session.save()
      }

      if (mongoose.connection?.readyState === 1) {
        await SecurityEvent.create({
          eventType: SESSION_CONFIG.eventTypes.REFRESH_TOKEN_REUSED,
          userId: user._id ? user._id.toString() : user.id,
          severity: "CRITICAL",
          metadata: {
            sessionId: session.sessionId,
            reason: "SUSPECTED_TOKEN_THEFT_REUSE",
          },
          timestamp: new Date(),
        }).catch((e) => console.warn("[TokenService] SecurityEvent notice:", e.message))
      }

      // Phase 10: Trigger Critical Security Alert & Account Lockdown
      try {
        const { suspiciousActivityService } = await import("./suspiciousActivityService.js")
        await suspiciousActivityService.handleRefreshTokenReplay({
          userId: user._id ? user._id.toString() : user.id,
          sessionId: session.sessionId,
          ip: session.ip || null,
        })
      } catch (alertErr) {
        console.warn("[TokenService] Non-fatal alert dispatch warning:", alertErr.message)
      }

      throw new Error(
        "Security alert: Token reuse detected. Your session has been terminated for your protection. Please sign in again."
      )
    }

    // Hash matched: Issue new tokens and update session
    const tokens = await this.generateTokens(user, session)

    if (mongoose.connection?.readyState === 1) {
      await SecurityEvent.create({
        eventType: SESSION_CONFIG.eventTypes.REFRESH_TOKEN_ROTATED,
        userId: user._id ? user._id.toString() : user.id,
        severity: "LOW",
        metadata: {
          sessionId: session.sessionId,
        },
        timestamp: new Date(),
      }).catch((e) => console.warn("[TokenService] SecurityEvent notice:", e.message))
    }

    return tokens
  }
}

export const tokenService = new TokenService()
export default tokenService
