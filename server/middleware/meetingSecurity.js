import Meeting from "../Modals/Meeting.js"
import MeetingParticipant from "../Modals/MeetingParticipant.js"
import { ApiError } from "../utils/apiError.js"
import { sendError } from "../utils/apiResponse.js"
import { logger, MeetingEvents } from "../utils/logger.js"
import { MeetingRoles } from "../services/videoTokenService.js"
import meetingStore from "../services/meetingStore.js"

/**
 * Middleware that validates the existence and access policy of a meeting.
 * Sets req.meeting and server-authoritative req.userRole on the request object.
 */
export const validateMeetingState = async (req, res, next) => {
  const { roomId } = req.params

  try {
    const meeting = await meetingStore.findMeeting(roomId)
    if (!meeting) {
      logger.warn(MeetingEvents.MEETING_ACCESS_DENIED, {
        roomId,
        reason: "Meeting not found",
        userId: req.user?.id || "anonymous",
      })
      return sendError(
        res,
        ApiError.notFound("MEETING_NOT_FOUND", "Meeting room not found or has expired"),
        404
      )
    }

    const isEnded = meeting.status === "ended" || meeting.status === "ENDED" || meeting.status === "CANCELLED"
    if (isEnded) {
      logger.warn(MeetingEvents.MEETING_ACCESS_DENIED, {
        roomId,
        reason: "Meeting ended",
        userId: req.user?.id || "anonymous",
      })
      return sendError(
        res,
        ApiError.badRequest("MEETING_ENDED", "This meeting has already ended"),
        400
      )
    }

    // Determine role authoritatively on the server
    let role = MeetingRoles.PARTICIPANT
    if (req.user) {
      const callerId = String(req.user.id || req.user._id)
      const hostId = String(meeting.hostId)
      if (hostId === callerId) {
        role = MeetingRoles.HOST
      } else if (Array.isArray(meeting.coHosts) && meeting.coHosts.some((id) => String(id) === callerId)) {
        role = MeetingRoles.CO_HOST
      }
    }

    // Guard against client-side privilege escalation attempts
    if (
      req.body?.role ||
      req.body?.isHost ||
      req.body?.isAdmin ||
      req.body?.isCoHost ||
      req.body?.permissions
    ) {
      logger.warn(MeetingEvents.ROLE_CHANGE_ATTEMPT, {
        roomId,
        userId: req.user?.id || "anonymous",
        clientSuppliedRole: req.body?.role || req.body?.isHost,
        resolvedServerRole: role,
      })
      // Strip client-supplied roles and permissions completely
      delete req.body.role
      delete req.body.isHost
      delete req.body.isAdmin
      delete req.body.isCoHost
      delete req.body.permissions
    }

    const isPrivileged = role === MeetingRoles.HOST || role === MeetingRoles.CO_HOST

    // Check Access Policy
    if (meeting.accessPolicy === "AUTHENTICATED_ONLY" && !req.user) {
      logger.warn(MeetingEvents.UNAUTHORIZED_MEETING_ACCESS, {
        roomId,
        reason: "Meeting requires authenticated user",
      })
      return sendError(
        res,
        ApiError.unauthorized("AUTHENTICATION_REQUIRED", "Authentication is required to join this meeting room"),
        401
      )
    }

    // Check Banned Participants list
    const candidateId = req.user ? String(req.user.id) : req.body?.guestId
    if (candidateId && meeting.bannedParticipants && Array.isArray(meeting.bannedParticipants) && meeting.bannedParticipants.includes(candidateId)) {
      logger.warn(MeetingEvents.MEETING_ACCESS_DENIED, {
        roomId,
        candidateId,
        reason: "Participant is on banned list",
      })
      return sendError(
        res,
        ApiError.forbidden("FORBIDDEN", "You have been removed from this meeting and cannot rejoin"),
        403
      )
    }

    // Check Locked Meeting (only host/co-host can join locked meetings)
    if (meeting.isLocked && !isPrivileged) {
      logger.warn(MeetingEvents.MEETING_LOCKED, {
        roomId,
        reason: "Meeting is locked",
        userId: req.user?.id || "anonymous",
      })
      return sendError(
        res,
        ApiError.forbidden("MEETING_LOCKED", "This meeting has been locked by the host"),
        403
      )
    }

    // Check Participant Limits
    if (!isPrivileged) {
      let activeCount = 0
      let isAlreadyJoined = false

      if (meetingStore.isDbConnected()) {
        try {
          activeCount = await MeetingParticipant.countDocuments({
            roomId,
            status: { $in: ["JOINED", "connected"] },
          })
          if (candidateId) {
            const existingParticipant = await MeetingParticipant.findOne({
              roomId,
              userId: { $regex: new RegExp(candidateId, "i") },
              status: { $in: ["JOINED", "connected"] },
            })
            if (existingParticipant) {
              isAlreadyJoined = true
            }
          }
        } catch {}
      }

      if (activeCount === 0 && !isAlreadyJoined) {
        const parts = await meetingStore.getParticipants(roomId)
        activeCount = parts.filter((p) => ["JOINED", "connected"].includes(p.status)).length
        if (candidateId) {
          isAlreadyJoined = parts.some(
            (p) => String(p.userId).includes(String(candidateId)) && ["JOINED", "connected"].includes(p.status)
          )
        }
      }

      const limit = meeting.maxParticipants || 25
      if (!isAlreadyJoined && activeCount >= limit) {
        logger.warn(MeetingEvents.MEETING_FULL, {
          roomId,
          reason: "Meeting capacity reached",
          activeCount,
          max: limit,
        })
        return sendError(
          res,
          ApiError.forbidden("MEETING_FULL", "This meeting has reached its maximum participant limit"),
          403
        )
      }
    }

    // Attach verified state
    req.meeting = meeting
    req.userRole = role
    next()
  } catch (err) {
    logger.error("VALIDATE_MEETING_ERROR", err, { roomId })
    return sendError(res, err)
  }
}

/**
 * Middleware that authorizes access based on server-verified meeting roles.
 *
 * @param  {...string} allowedRoles - e.g. MeetingRoles.HOST, MeetingRoles.CO_HOST
 */
export const authorizeMeetingRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      logger.warn(MeetingEvents.AUTHORIZATION_FAILED, {
        path: req.originalUrl,
        userRole: req.userRole || "NONE",
        requiredRoles: allowedRoles,
        userId: req.user?.id,
      })
      return sendError(
        res,
        ApiError.forbidden("FORBIDDEN", "You do not have the required role to perform this action"),
        403
      )
    }
    next()
  }
}

/**
 * Middleware that verifies whether a specific meeting permission is enabled.
 *
 * @param {string} permissionKey - e.g. "allowChat", "allowScreenShare"
 */
export const authorizeMeetingPermission = (permissionKey) => {
  return (req, res, next) => {
    if (req.userRole === MeetingRoles.HOST || req.userRole === MeetingRoles.CO_HOST) {
      return next() // Hosts & Co-hosts bypass participant permission restrictions
    }

    if (req.meeting && req.meeting.permissions && req.meeting.permissions[permissionKey] === false) {
      logger.warn(MeetingEvents.PERMISSION_DENIED, {
        roomId: req.meeting.roomId,
        permissionKey,
        userId: req.user?.id,
      })
      return sendError(
        res,
        ApiError.forbidden("PERMISSION_DENIED", `The host has disabled ${permissionKey} for this meeting`),
        403
      )
    }
    next()
  }
}
