import crypto from "crypto"
import { AccessToken } from "livekit-server-sdk"
import { videoConfig } from "../config/index.js"
import { ApiError } from "../utils/apiError.js"
import { logger, MeetingEvents } from "../utils/logger.js"

export const MeetingRoles = {
  HOST: "HOST",
  CO_HOST: "CO_HOST",
  PARTICIPANT: "PARTICIPANT",
}

/**
 * Creates a safe, non-sensitive participant identity for video transport.
 * Never leaks user email or database internals to other peers.
 */
export const formatSafeParticipantIdentity = (userId, isGuest = false) => {
  if (!userId) return `guest_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`
  const cleanId = String(userId).trim()
  if (cleanId.startsWith("user_") || cleanId.startsWith("guest_")) return cleanId
  return isGuest ? `guest_${cleanId}` : `user_${cleanId}`
}

/**
 * Generates a short-lived, cryptographically signed LiveKit Access Token.
 *
 * @param {Object} params
 * @param {string} params.roomId - Public unique room ID
 * @param {string} params.participantId - User identity
 * @param {string} params.participantName - Clean display name
 * @param {string} [params.role] - HOST, CO_HOST, or PARTICIPANT
 * @param {Object} [params.permissions] - Meeting permissions
 * @param {string} [params.image] - Safe avatar URL
 * @param {boolean} [params.isGuest] - Whether participant is guest
 * @returns {Promise<{ token: string, identity: string, expiresAt: string }>}
 */
export const generateMeetingToken = async ({
  roomId,
  participantId,
  participantName,
  role = MeetingRoles.PARTICIPANT,
  permissions = {},
  image = "",
  isGuest = false,
}) => {
  if (!roomId || !participantId) {
    throw ApiError.badRequest("VALIDATION_ERROR", "roomId and participantId are required for token generation")
  }

  const identity = formatSafeParticipantIdentity(participantId, isGuest)
  const ttlSeconds = videoConfig.tokenTtlSeconds || 60 * 30 // 30 minutes short-lived
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()

  const { apiKey, apiSecret, isConfigured } = videoConfig

  if (!isConfigured) {
    logger.warn(MeetingEvents.TOKEN_GENERATED, {
      roomId,
      identity,
      warning: "LiveKit not configured with live credentials. Emitting dev token.",
    })
    return {
      token: `mock-livekit-token-${identity}-${roomId}-${Date.now()}`,
      identity,
      expiresAt,
    }
  }

  try {
    const isHostOrCoHost = role === MeetingRoles.HOST || role === MeetingRoles.CO_HOST

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: participantName || "Participant",
      ttl: ttlSeconds,
      metadata: JSON.stringify({
        role,
        image: image || "",
      }),
    })

    // Configure role-based grants
    at.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: permissions.allowCamera !== false && permissions.allowMicrophone !== false,
      canSubscribe: true,
      canPublishData: permissions.allowChat !== false,
      roomAdmin: isHostOrCoHost,
    })

    const token = await at.toJwt()

    logger.info(MeetingEvents.TOKEN_GENERATED, {
      roomId,
      identity,
      role,
      expiresAt,
    })

    return {
      token,
      identity,
      expiresAt,
    }
  } catch (error) {
    logger.error(MeetingEvents.TOKEN_GENERATED, error, { roomId, identity })
    throw ApiError.internal("Failed to generate meeting access token")
  }
}
