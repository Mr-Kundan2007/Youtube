import path from "path"
import fs from "fs"
import mongoose from "mongoose"
import Meeting from "../Modals/Meeting.js"
import MeetingParticipant from "../Modals/MeetingParticipant.js"
import MeetingChatMessage from "../Modals/MeetingChatMessage.js"
import User from "../Modals/Auth.js"
import { generateRoomId } from "../utils/roomIdGenerator.js"
import {
  generateMeetingToken,
  MeetingRoles,
  formatSafeParticipantIdentity,
} from "../services/videoTokenService.js"
import { ApiError } from "../utils/apiError.js"
import { sendSuccess, sendError } from "../utils/apiResponse.js"
import { logger, MeetingEvents } from "../utils/logger.js"
import { appConfig, videoConfig, storageConfig } from "../config/index.js"
import meetingStore from "../services/meetingStore.js"

/**
 * Creates a new meeting room.
 * POST /api/meetings
 * Protected by requireAuth, validateCreateMeetingInput, createMeetingLimiter.
 */
export const createMeeting = async (req, res) => {
  try {
    const { title, maxParticipants, permissions, accessPolicy, scheduledStartAt, scheduledEndAt } = req.body
    const userId = req.user.id

    // Fetch user details for host name safely
    let hostName = "Host"
    let hostImage = ""
    if (meetingStore.isDbConnected() && req.user?.id) {
      try {
        const hostUser = await meetingStore.findHostUser(userId)
        if (hostUser) {
          hostName = hostUser.channelname || hostUser.name || "Host"
          hostImage = hostUser.image || ""
        }
      } catch {}
    } else if (req.user?.name || req.user?.channelname) {
      hostName = req.user.channelname || req.user.name || "Host"
    }

    let roomId = generateRoomId()
    let taken = await meetingStore.isRoomIdTaken(roomId)
    while (taken) {
      roomId = generateRoomId()
      taken = await meetingStore.isRoomIdTaken(roomId)
    }

    const meetingData = {
      roomId,
      title: title?.trim() || "Quick Meeting",
      hostId: userId,
      hostName,
      accessPolicy: accessPolicy || "LINK_ACCESS",
      maxParticipants: maxParticipants ? Math.min(Math.max(Number(maxParticipants), 2), 100) : 25,
      permissions: {
        allowChat: permissions?.allowChat !== false,
        allowScreenShare: permissions?.allowScreenShare !== false,
        allowFileSharing: permissions?.allowFileSharing !== false,
        allowCamera: permissions?.allowCamera !== false,
        allowMicrophone: permissions?.allowMicrophone !== false,
      },
      scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt) : undefined,
      scheduledEndAt: scheduledEndAt ? new Date(scheduledEndAt) : undefined,
      status: "LIVE",
      startedAt: new Date(),
    }

    const meeting = await meetingStore.createMeeting(meetingData)

    const meetingLink = `${appConfig.frontendUrl}/meet/${meeting.roomId}`

    // Generate initial host token
    const { token, identity, expiresAt } = await generateMeetingToken({
      roomId,
      participantId: String(userId),
      participantName: hostName,
      role: MeetingRoles.HOST,
      permissions: meeting.permissions,
      image: hostImage,
      isGuest: false,
    })

    // Record host in participants collection
    await meetingStore.upsertParticipant(roomId, identity, {
      meetingId: meeting._id,
      roomId,
      userId: identity,
      providerParticipantId: identity,
      name: hostName,
      image: hostImage,
      role: MeetingRoles.HOST,
      status: "JOINED",
      connectionState: "connected",
      joinedAt: new Date(),
      lastSeenAt: new Date(),
    })

    logger.info(MeetingEvents.MEETING_CREATED, {
      roomId,
      hostId: userId,
      hostName,
    })

    return sendSuccess(
      res,
      {
        meeting: {
          id: meeting._id,
          meetingId: meeting._id,
          roomId: meeting.roomId,
          publicRoomId: meeting.roomId,
          meetingLink,
          title: meeting.title,
          hostId: meeting.hostId,
          hostName: meeting.hostName,
          accessPolicy: meeting.accessPolicy,
          status: meeting.status,
          isLocked: meeting.isLocked,
          maxParticipants: meeting.maxParticipants,
          permissions: meeting.permissions,
          startedAt: meeting.startedAt,
          scheduledStartAt: meeting.scheduledStartAt,
          scheduledEndAt: meeting.scheduledEndAt,
        },
        meetingId: meeting._id,
        roomId: meeting.roomId,
        publicRoomId: meeting.roomId,
        meetingLink,
        title: meeting.title,
        status: meeting.status,
        livekitUrl: videoConfig.livekitUrl,
        token,
        identity,
        expiresAt,
        role: MeetingRoles.HOST,
      },
      201
    )
  } catch (err) {
    logger.error("CREATE_MEETING_ERROR", err)
    return sendError(res, err)
  }
}

/**
 * Inspects a meeting by room ID.
 * GET /api/meetings/:roomId
 * Protected by validateRoomIdParam, validateMeetingState, generalMeetingLimiter.
 */
export const getMeeting = async (req, res) => {
  try {
    const meeting = req.meeting
    let activeParticipantCount = 0
    try {
      if (meetingStore.isDbConnected()) {
        activeParticipantCount = await MeetingParticipant.countDocuments({
          roomId: meeting.roomId,
          status: { $in: ["JOINED", "connected"] },
        })
      } else {
        const parts = await meetingStore.getParticipants(meeting.roomId)
        activeParticipantCount = parts.filter((p) => ["JOINED", "connected"].includes(p.status)).length
      }
    } catch {
      const parts = await meetingStore.getParticipants(meeting.roomId)
      activeParticipantCount = parts.filter((p) => ["JOINED", "connected"].includes(p.status)).length
    }

    const meetingLink = `${appConfig.frontendUrl}/meet/${meeting.roomId}`

    logger.info(MeetingEvents.MEETING_LOOKUP, {
      roomId: meeting.roomId,
      userId: req.user?.id || "anonymous",
    })

    return sendSuccess(res, {
      meeting: {
        id: meeting._id,
        meetingId: meeting._id,
        roomId: meeting.roomId,
        publicRoomId: meeting.roomId,
        meetingLink,
        title: meeting.title,
        host: {
          displayName: meeting.hostName,
        },
        hostId: meeting.hostId,
        hostName: meeting.hostName,
        accessPolicy: meeting.accessPolicy,
        status: meeting.status,
        isLocked: meeting.isLocked,
        maxParticipants: meeting.maxParticipants,
        currentParticipantCount: activeParticipantCount,
        participantCount: activeParticipantCount,
        permissions: meeting.permissions,
        startedAt: meeting.startedAt,
        endedAt: meeting.endedAt,
      },
      roomId: meeting.roomId,
      publicRoomId: meeting.roomId,
      title: meeting.title,
      host: {
        displayName: meeting.hostName,
      },
      status: meeting.status,
      isLocked: meeting.isLocked,
      maxParticipants: meeting.maxParticipants,
      currentParticipantCount: activeParticipantCount,
      meetingLink,
    })
  } catch (err) {
    logger.error("GET_MEETING_ERROR", err)
    return sendError(res, err)
  }
}

/**
 * Securely joins a meeting room and generates an authenticated LiveKit token.
 * POST /api/meetings/:roomId/join
 * Protected by optionalAuth, validateRoomIdParam, validateTokenRequestInput, validateMeetingState, meetingTokenLimiter.
 */
export const joinMeeting = async (req, res) => {
  try {
    const meeting = req.meeting
    const role = req.userRole
    const { displayName, guestId, isMuted, cameraEnabled } = req.body

    logger.info(MeetingEvents.MEETING_JOIN_REQUESTED, {
      roomId: meeting.roomId,
      userId: req.user?.id || "guest",
      role,
    })

    const isGuest = !req.user
    const candidateId = req.user ? String(req.user.id) : guestId || `guest_${Date.now()}`

    let participantName = displayName?.trim() || "Participant"
    let participantImage = ""

    if (req.user) {
      if (meetingStore.isDbConnected()) {
        try {
          const dbUser = await meetingStore.findHostUser(req.user.id)
          if (dbUser) {
            participantName = dbUser.channelname || dbUser.name || participantName
            participantImage = dbUser.image || ""
          }
        } catch {}
      } else if (req.user?.name || req.user?.channelname) {
        participantName = req.user.channelname || req.user.name || participantName
      }
    }

    const { token, identity, expiresAt } = await generateMeetingToken({
      roomId: meeting.roomId,
      participantId: candidateId,
      participantName,
      role,
      permissions: meeting.permissions,
      image: participantImage,
      isGuest,
    })

    // Upsert participant record with Phase 3 status and device states
    await meetingStore.upsertParticipant(meeting.roomId, identity, {
      meetingId: meeting._id,
      roomId: meeting.roomId,
      userId: identity,
      providerParticipantId: identity,
      name: participantName,
      image: participantImage,
      role,
      status: "JOINED",
      isMuted: Boolean(isMuted),
      cameraEnabled: cameraEnabled !== false,
      connectionState: "connected",
      joinedAt: new Date(),
      lastSeenAt: new Date(),
    })

    logger.info(MeetingEvents.MEETING_JOINED, {
      roomId: meeting.roomId,
      identity,
      role,
    })

    const meetingLink = `${appConfig.frontendUrl}/meet/${meeting.roomId}`

    return sendSuccess(res, {
      token,
      identity,
      expiresAt,
      livekitUrl: videoConfig.livekitUrl,
      role,
      roomId: meeting.roomId,
      publicRoomId: meeting.roomId,
      title: meeting.title,
      status: meeting.status,
      meetingLink,
      permissions: meeting.permissions,
      isLocked: meeting.isLocked,
    })
  } catch (err) {
    logger.error("JOIN_MEETING_ERROR", err)
    return sendError(res, err)
  }
}

/**
 * Token endpoint alias for backward compatibility.
 * POST /api/meetings/:roomId/token -> joinMeeting
 */
export const getMeetingToken = joinMeeting

/**
 * Records a participant leaving.
 * POST /api/meetings/:roomId/leave
 */
export const leaveMeeting = async (req, res) => {
  try {
    const { roomId } = req.params
    const { participantId, identity } = req.body
    const candidate = req.user ? formatSafeParticipantIdentity(req.user.id, false) : (participantId || identity)

    if (candidate) {
      if (meetingStore.isDbConnected()) {
        try {
          await MeetingParticipant.findOneAndUpdate(
            { roomId, userId: candidate },
            { status: "LEFT", connectionState: "disconnected", leftAt: new Date() }
          )
        } catch {}
      }
      await meetingStore.upsertParticipant(roomId, candidate, {
        status: "LEFT",
        connectionState: "disconnected",
        leftAt: new Date(),
      })
      logger.info(MeetingEvents.MEETING_LEFT, { roomId, userId: candidate })
    }

    return sendSuccess(res, { message: "Left meeting successfully" })
  } catch (err) {
    logger.error("LEAVE_MEETING_ERROR", err)
    return sendError(res, err)
  }
}

/**
 * Host ends meeting for all participants.
 * POST /api/meetings/:roomId/end
 * Protected by requireAuth, validateRoomIdParam, validateMeetingState, authorizeMeetingRole(HOST).
 */
export const endMeeting = async (req, res) => {
  try {
    const meeting = req.meeting
    const userId = req.user.id

    meeting.status = "ENDED"
    meeting.endedAt = new Date()
    if (typeof meeting.save === "function") {
      try {
        await meeting.save()
      } catch {}
    }
    await meetingStore.updateMeeting(meeting.roomId, { status: "ENDED", endedAt: meeting.endedAt })

    // Mark all active participants as LEFT / disconnected
    if (meetingStore.isDbConnected()) {
      try {
        await MeetingParticipant.updateMany(
          { roomId: meeting.roomId, status: { $in: ["JOINED", "connected"] } },
          { status: "LEFT", connectionState: "disconnected", leftAt: new Date() }
        )
      } catch {}
    }

    logger.info(MeetingEvents.MEETING_ENDED, { roomId: meeting.roomId, hostId: userId })

    return sendSuccess(res, { message: "Meeting ended for all participants" })
  } catch (err) {
    logger.error("END_MEETING_ERROR", err)
    return sendError(res, err)
  }
}

/**
 * Host & Co-host execution of moderation actions.
 * POST /api/meetings/:roomId/host-action
 * Protected by requireAuth, validateRoomIdParam, validateMeetingState, authorizeMeetingRole(HOST, CO_HOST).
 */
export const executeHostAction = async (req, res) => {
  try {
    const meeting = req.meeting
    const callerRole = req.userRole
    const { action, targetUserId, permissions, isLocked } = req.body

    switch (action) {
      case "LOCK_MEETING":
      case "UNLOCK_MEETING": {
        const lockValue = action === "LOCK_MEETING" ? true : Boolean(isLocked)
        meeting.isLocked = lockValue
        if (typeof meeting.save === "function") {
          try { await meeting.save() } catch {}
        }
        await meetingStore.updateMeeting(meeting.roomId, { isLocked: lockValue })
        logger.info(lockValue ? MeetingEvents.MEETING_LOCKED : MeetingEvents.MEETING_UNLOCKED, {
          roomId: meeting.roomId,
          executorId: req.user.id,
        })
        return sendSuccess(res, { isLocked: meeting.isLocked })
      }

      case "UPDATE_PERMISSIONS": {
        if (permissions && typeof permissions === "object") {
          meeting.permissions = {
            ...meeting.permissions,
            ...permissions,
          }
          if (typeof meeting.save === "function") {
            try { await meeting.save() } catch {}
          }
          await meetingStore.updateMeeting(meeting.roomId, { permissions: meeting.permissions })
          logger.info(MeetingEvents.PERMISSION_CHANGED, {
            roomId: meeting.roomId,
            executorId: req.user.id,
            updatedPermissions: permissions,
          })
          return sendSuccess(res, { permissions: meeting.permissions })
        }
        throw ApiError.badRequest("VALIDATION_ERROR", "permissions object is required")
      }

      case "REMOVE_PARTICIPANT": {
        if (!targetUserId) {
          throw ApiError.badRequest("VALIDATION_ERROR", "targetUserId is required to remove participant")
        }

        // Host cannot remove themselves; Co-host cannot remove Host
        if (targetUserId === String(meeting.hostId) || targetUserId === `user_${meeting.hostId}`) {
          throw ApiError.forbidden("FORBIDDEN", "The meeting host cannot be removed")
        }

        if (!meeting.bannedParticipants) meeting.bannedParticipants = []
        if (!meeting.bannedParticipants.includes(targetUserId)) {
          meeting.bannedParticipants.push(targetUserId)
          if (typeof meeting.save === "function") {
            try { await meeting.save() } catch {}
          }
          await meetingStore.updateMeeting(meeting.roomId, { bannedParticipants: meeting.bannedParticipants })
        }

        if (meetingStore.isDbConnected()) {
          try {
            await MeetingParticipant.findOneAndUpdate(
              { roomId: meeting.roomId, userId: targetUserId },
              { status: "REMOVED", connectionState: "disconnected", leftAt: new Date() }
            )
          } catch {}
        }
        await meetingStore.upsertParticipant(meeting.roomId, targetUserId, {
          status: "REMOVED",
          connectionState: "disconnected",
          leftAt: new Date(),
        })

        logger.info(MeetingEvents.PARTICIPANT_REMOVED, {
          roomId: meeting.roomId,
          targetUserId,
          executorId: req.user.id,
          callerRole,
        })

        return sendSuccess(res, { message: "Participant removed and banned from rejoining" })
      }

      default:
        throw ApiError.badRequest("VALIDATION_ERROR", `Unknown host action: ${action}`)
    }
  } catch (err) {
    logger.error("HOST_ACTION_ERROR", err)
    return sendError(res, err)
  }
}

/**
 * Gets active participants list for a room.
 * GET /api/meetings/:roomId/participants
 */
export const getParticipants = async (req, res) => {
  try {
    const { roomId } = req.params
    let rawParticipants = []
    if (meetingStore.isDbConnected()) {
      try {
        rawParticipants = await MeetingParticipant.find({
          roomId,
          status: { $in: ["JOINED", "connected"] },
        })
          .select("userId providerParticipantId name image role status isMuted cameraEnabled isHandRaised handRaisedAt joinedAt")
          .sort({ joinedAt: 1 })
      } catch {}
    }
    if (!rawParticipants || rawParticipants.length === 0) {
      const parts = await meetingStore.getParticipants(roomId)
      rawParticipants = parts.filter((p) => ["JOINED", "connected"].includes(p.status))
    }

    const participants = (rawParticipants || []).map((p) => ({
      participantId: p.userId,
      userId: p.userId,
      displayName: p.name,
      name: p.name,
      image: p.image || "",
      role: p.role,
      status: p.status === "connected" ? "JOINED" : p.status,
      isMuted: Boolean(p.isMuted),
      cameraEnabled: p.cameraEnabled !== false,
      isHandRaised: Boolean(p.isHandRaised),
      handRaisedAt: p.handRaisedAt || null,
      joinedAt: p.joinedAt,
    }))

    return sendSuccess(res, { participants })
  } catch (err) {
    logger.error("GET_PARTICIPANTS_ERROR", err)
    return sendError(res, err)
  }
}

/**
 * Host/Co-host mutes a participant.
 * POST /api/meetings/:roomId/mute-participant
 */
export const muteParticipant = async (req, res) => {
  try {
    const { roomId } = req.params
    const { targetUserId } = req.body
    if (!targetUserId) {
      throw ApiError.badRequest("VALIDATION_ERROR", "targetUserId is required to mute participant")
    }

    if (meetingStore.isDbConnected()) {
      try {
        await MeetingParticipant.findOneAndUpdate(
          { roomId, userId: targetUserId },
          { isMuted: true },
          { new: true }
        )
      } catch {}
    }
    await meetingStore.upsertParticipant(roomId, targetUserId, { isMuted: true })

    logger.info("PARTICIPANT_MUTED", { roomId, targetUserId, mutedBy: req.user?.id })

    return sendSuccess(res, {
      message: "Participant muted successfully",
      targetUserId,
      isMuted: true,
    })
  } catch (err) {
    logger.error("MUTE_PARTICIPANT_ERROR", err)
    return sendError(res, err)
  }
}

/**
 * Host/Co-host removes a participant and bans them from rejoining.
 * POST /api/meetings/:roomId/remove-participant
 */
export const removeParticipant = async (req, res) => {
  try {
    const meeting = req.meeting
    const callerRole = req.userRole
    const { targetUserId } = req.body

    if (!targetUserId) {
      throw ApiError.badRequest("VALIDATION_ERROR", "targetUserId is required to remove participant")
    }

    // Host cannot be removed
    if (targetUserId === String(meeting.hostId) || targetUserId === `user_${meeting.hostId}`) {
      throw ApiError.forbidden("FORBIDDEN", "The meeting host cannot be removed")
    }

    // Co-host cannot remove Host or fellow Co-host
    if (callerRole === MeetingRoles.CO_HOST) {
      const targetParticipant = await meetingStore.findParticipant(meeting.roomId, targetUserId)
      if (targetParticipant && (targetParticipant.role === MeetingRoles.HOST || targetParticipant.role === MeetingRoles.CO_HOST)) {
        throw ApiError.forbidden("FORBIDDEN", "Co-hosts cannot remove hosts or fellow co-hosts")
      }
    }

    if (!meeting.bannedParticipants) meeting.bannedParticipants = []
    if (!meeting.bannedParticipants.includes(targetUserId)) {
      meeting.bannedParticipants.push(targetUserId)
      if (typeof meeting.save === "function") {
        try { await meeting.save() } catch {}
      }
      await meetingStore.updateMeeting(meeting.roomId, { bannedParticipants: meeting.bannedParticipants })
    }

    if (meetingStore.isDbConnected()) {
      try {
        await MeetingParticipant.findOneAndUpdate(
          { roomId: meeting.roomId, userId: targetUserId },
          {
            status: "REMOVED",
            isRemoved: true,
            removedAt: new Date(),
            removedBy: req.user.id,
            connectionState: "disconnected",
            leftAt: new Date(),
          }
        )
      } catch {}
    }
    await meetingStore.upsertParticipant(meeting.roomId, targetUserId, {
      status: "REMOVED",
      isRemoved: true,
      removedAt: new Date(),
      removedBy: req.user.id,
      connectionState: "disconnected",
      leftAt: new Date(),
    })

    logger.info(MeetingEvents.PARTICIPANT_REMOVED, {
      roomId: meeting.roomId,
      targetUserId,
      executorId: req.user.id,
      callerRole,
    })

    return sendSuccess(res, {
      message: "Participant removed and banned from rejoining",
      targetUserId,
      isRemoved: true,
    })
  } catch (err) {
    logger.error("REMOVE_PARTICIPANT_ERROR", err)
    return sendError(res, err)
  }
}

/**
 * Host promotes a participant to Co-Host.
 * POST /api/meetings/:roomId/promote-cohost
 */
export const promoteCoHost = async (req, res) => {
  try {
    const meeting = req.meeting
    const { targetUserId } = req.body

    if (!targetUserId) {
      throw ApiError.badRequest("VALIDATION_ERROR", "targetUserId is required to promote to co-host")
    }

    if (targetUserId === String(meeting.hostId) || targetUserId === `user_${meeting.hostId}`) {
      throw ApiError.badRequest("VALIDATION_ERROR", "User is already the meeting host")
    }

    const rawUserId = targetUserId.startsWith("user_") ? targetUserId.slice(5) : targetUserId

    if (!meeting.coHosts) meeting.coHosts = []
    if (!meeting.coHosts.includes(rawUserId)) {
      meeting.coHosts.push(rawUserId)
      if (typeof meeting.save === "function") {
        try { await meeting.save() } catch {}
      }
      await meetingStore.updateMeeting(meeting.roomId, { coHosts: meeting.coHosts })
    }

    if (meetingStore.isDbConnected()) {
      try {
        await MeetingParticipant.findOneAndUpdate(
          { roomId: meeting.roomId, userId: targetUserId },
          { role: MeetingRoles.CO_HOST }
        )
      } catch {}
    }
    await meetingStore.upsertParticipant(meeting.roomId, targetUserId, { role: MeetingRoles.CO_HOST })

    logger.info("CO_HOST_PROMOTED", {
      roomId: meeting.roomId,
      targetUserId,
      promotedBy: req.user.id,
    })

    return sendSuccess(res, {
      message: "Participant promoted to co-host",
      targetUserId,
      role: MeetingRoles.CO_HOST,
    })
  } catch (err) {
    logger.error("PROMOTE_CO_HOST_ERROR", err)
    return sendError(res, err)
  }
}

/**
 * Host demotes a Co-Host back to Participant.
 * POST /api/meetings/:roomId/demote-cohost
 */
export const demoteCoHost = async (req, res) => {
  try {
    const meeting = req.meeting
    const { targetUserId } = req.body

    if (!targetUserId) {
      throw ApiError.badRequest("VALIDATION_ERROR", "targetUserId is required to demote co-host")
    }

    const rawUserId = targetUserId.startsWith("user_") ? targetUserId.slice(5) : targetUserId
    if (meeting.coHosts) {
      meeting.coHosts = meeting.coHosts.filter((id) => String(id) !== String(rawUserId))
    }
    if (typeof meeting.save === "function") {
      try { await meeting.save() } catch {}
    }
    await meetingStore.updateMeeting(meeting.roomId, { coHosts: meeting.coHosts })

    if (meetingStore.isDbConnected()) {
      try {
        await MeetingParticipant.findOneAndUpdate(
          { roomId: meeting.roomId, userId: targetUserId },
          { role: MeetingRoles.PARTICIPANT }
        )
      } catch {}
    }
    await meetingStore.upsertParticipant(meeting.roomId, targetUserId, { role: MeetingRoles.PARTICIPANT })

    logger.info("CO_HOST_DEMOTED", {
      roomId: meeting.roomId,
      targetUserId,
      demotedBy: req.user.id,
    })

    return sendSuccess(res, {
      message: "Co-host demoted to participant",
      targetUserId,
      role: MeetingRoles.PARTICIPANT,
    })
  } catch (err) {
    logger.error("DEMOTE_CO_HOST_ERROR", err)
    return sendError(res, err)
  }
}

/**
 * Host/Co-host locks meeting.
 * POST /api/meetings/:roomId/lock
 */
export const lockMeeting = async (req, res) => {
  try {
    const meeting = req.meeting
    meeting.isLocked = true
    if (typeof meeting.save === "function") {
      try { await meeting.save() } catch {}
    }
    await meetingStore.updateMeeting(meeting.roomId, { isLocked: true })

    logger.info(MeetingEvents.MEETING_LOCKED, {
      roomId: meeting.roomId,
      executorId: req.user.id,
    })

    return sendSuccess(res, { isLocked: true, message: "Meeting locked successfully" })
  } catch (err) {
    logger.error("LOCK_MEETING_ERROR", err)
    return sendError(res, err)
  }
}

/**
 * Host/Co-host unlocks meeting.
 * POST /api/meetings/:roomId/unlock
 */
export const unlockMeeting = async (req, res) => {
  try {
    const meeting = req.meeting
    meeting.isLocked = false
    if (typeof meeting.save === "function") {
      try { await meeting.save() } catch {}
    }
    await meetingStore.updateMeeting(meeting.roomId, { isLocked: false })

    logger.info(MeetingEvents.MEETING_UNLOCKED, {
      roomId: meeting.roomId,
      executorId: req.user.id,
    })

    return sendSuccess(res, { isLocked: false, message: "Meeting unlocked successfully" })
  } catch (err) {
    logger.error("UNLOCK_MEETING_ERROR", err)
    return sendError(res, err)
  }
}

/**
 * Retrieves in-call chat history.
 * GET /api/meetings/:roomId/chat
 */
export const getChatHistory = async (req, res) => {
  try {
    const { roomId } = req.params
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100)
    const before = req.query.before ? new Date(req.query.before) : null

    let messages = []
    if (meetingStore.isDbConnected()) {
      try {
        const query = { roomId }
        if (before && !isNaN(before.getTime())) {
          query.timestamp = { $lt: before }
        }
        const rawMessages = await MeetingChatMessage.find(query)
          .sort({ timestamp: 1 })
          .limit(limit)

        messages = rawMessages.map((m) => ({
          id: m._id,
          messageId: m._id,
          roomId: m.roomId,
          messageType: m.messageType || "TEXT",
          senderId: m.senderId,
          senderName: m.senderName,
          senderImage: m.senderImage || "",
          text: m.text,
          attachment: m.attachment,
          timestamp: m.timestamp,
        }))
      } catch {}
    }

    if (!messages || messages.length === 0) {
      messages = meetingStore.getChatHistory(roomId)
    }

    return sendSuccess(res, { messages })
  } catch (err) {
    logger.error("GET_CHAT_HISTORY_ERROR", err)
    return sendError(res, err)
  }
}

/**
 * Sends a chat message.
 * POST /api/meetings/:roomId/chat
 */
export const sendChatMessage = async (req, res) => {
  try {
    const meeting = req.meeting
    const { text, senderId, senderName, senderImage } = req.body

    if (!text || !text.trim()) {
      throw ApiError.badRequest("VALIDATION_ERROR", "Message text cannot be empty")
    }

    if (text.length > 2000) {
      throw ApiError.badRequest("VALIDATION_ERROR", "Message text exceeds maximum length of 2000 characters")
    }

    let finalSenderId = senderId
    let finalSenderName = senderName || "Participant"
    let finalSenderImage = senderImage || ""

    if (req.user) {
      finalSenderId = formatSafeParticipantIdentity(req.user.id, false)
      if (meetingStore.isDbConnected()) {
        try {
          const dbUser = await meetingStore.findHostUser(req.user.id)
          if (dbUser) {
            finalSenderName = dbUser.channelname || dbUser.name || finalSenderName
            finalSenderImage = dbUser.image || ""
          }
        } catch {}
      } else if (req.user.name || req.user.channelname) {
        finalSenderName = req.user.channelname || req.user.name || finalSenderName
      }
    } else if (!finalSenderId) {
      finalSenderId = `guest_${Date.now()}`
    }

    // Sanitize user text against XSS injection
    const sanitizedText = text
      .trim()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")

    let messageId = new mongoose.Types.ObjectId().toString()
    let timestamp = new Date()

    if (meetingStore.isDbConnected()) {
      try {
        const created = await MeetingChatMessage.create({
          meetingId: meeting._id,
          roomId: meeting.roomId,
          messageType: "TEXT",
          senderId: finalSenderId,
          senderName: finalSenderName,
          senderImage: finalSenderImage,
          text: sanitizedText,
          timestamp,
        })
        messageId = created._id
        timestamp = created.timestamp
      } catch {}
    }

    const message = {
      id: messageId,
      messageId,
      roomId: meeting.roomId,
      messageType: "TEXT",
      senderId: finalSenderId,
      senderName: finalSenderName,
      senderImage: finalSenderImage,
      text: sanitizedText,
      timestamp,
    }

    meetingStore.addChatMessage(meeting.roomId, message)

    return sendSuccess(res, { message }, 201)
  } catch (err) {
    logger.error("SEND_CHAT_MESSAGE_ERROR", err)
    return sendError(res, err)
  }
}

/**
 * Uploads an attachment for in-call chat.
 * POST /api/meetings/:roomId/chat/attachment
 */
export const uploadChatAttachment = async (req, res) => {
  try {
    const meeting = req.meeting
    const file = req.file

    if (!file) {
      throw ApiError.badRequest("VALIDATION_ERROR", "No file uploaded")
    }

    const { text, senderId, senderName, senderImage } = req.body

    let finalSenderId = senderId
    let finalSenderName = senderName || "Participant"
    let finalSenderImage = senderImage || ""

    if (req.user) {
      finalSenderId = formatSafeParticipantIdentity(req.user.id, false)
      const dbUser = await User.findById(req.user.id)
      if (dbUser) {
        finalSenderName = dbUser.channelname || dbUser.name || finalSenderName
        finalSenderImage = dbUser.image || ""
      }
    } else if (!finalSenderId) {
      finalSenderId = `guest_${Date.now()}`
    }

    const message = new MeetingChatMessage({
      meetingId: meeting._id,
      roomId: meeting.roomId,
      messageType: "FILE",
      senderId: finalSenderId,
      senderName: finalSenderName,
      senderImage: finalSenderImage,
      text: text?.trim() || "",
      attachment: {
        filename: file.filename,
        originalName: file.originalname,
        filesize: file.size,
        filetype: file.mimetype,
      },
      timestamp: new Date(),
    })

    message.attachment.fileUrl = `/api/meetings/${meeting.roomId}/chat/attachment/${message._id}`
    await message.save()

    logger.info("ATTACHMENT_UPLOADED", {
      roomId: meeting.roomId,
      messageId: message._id,
      filename: file.filename,
      filesize: file.size,
    })

    return sendSuccess(
      res,
      {
        message: {
          id: message._id,
          messageId: message._id,
          roomId: message.roomId,
          messageType: message.messageType,
          senderId: message.senderId,
          senderName: message.senderName,
          senderImage: message.senderImage,
          text: message.text,
          attachment: message.attachment,
          timestamp: message.timestamp,
        },
      },
      201
    )
  } catch (err) {
    logger.error("UPLOAD_ATTACHMENT_ERROR", err)
    return sendError(res, err)
  }
}

/**
 * Downloads a chat attachment with security checks against directory traversal.
 * GET /api/meetings/:roomId/chat/attachment/:messageId
 */
export const downloadChatAttachment = async (req, res) => {
  try {
    const { roomId, messageId } = req.params
    let message = null
    if (meetingStore.isDbConnected()) {
      try {
        message = await MeetingChatMessage.findOne({ _id: messageId, roomId })
      } catch {}
    }

    if (!message || !message.attachment || !message.attachment.filename) {
      throw ApiError.notFound("ATTACHMENT_NOT_FOUND", "Attachment not found")
    }

    const attachmentsDir = path.resolve(storageConfig.uploadDir, "attachments")
    const filePath = path.resolve(attachmentsDir, message.attachment.filename)

    // Security Check: Path Traversal prevention
    if (!filePath.startsWith(attachmentsDir)) {
      logger.warn("PATH_TRAVERSAL_ATTEMPT", {
        roomId,
        messageId,
        filename: message.attachment.filename,
      })
      throw ApiError.forbidden("FORBIDDEN", "Access denied")
    }

    if (!fs.existsSync(filePath)) {
      throw ApiError.notFound("FILE_NOT_FOUND", "File no longer exists on the server")
    }

    return res.download(filePath, message.attachment.originalName || "attachment")
  } catch (err) {
    logger.error("DOWNLOAD_ATTACHMENT_ERROR", err)
    return sendError(res, err)
  }
}

/**
 * Toggles hand raise status for a participant.
 * POST /api/meetings/:roomId/hand-raise
 */
export const toggleHandRaise = async (req, res) => {
  try {
    const { roomId } = req.params
    const { identity } = req.body

    const candidate = req.user
      ? formatSafeParticipantIdentity(req.user.id, false)
      : identity

    if (!candidate) {
      throw ApiError.badRequest("VALIDATION_ERROR", "Identity is required to toggle hand raise")
    }

    let participant = null
    if (meetingStore.isDbConnected()) {
      try {
        participant = await MeetingParticipant.findOne({ roomId, userId: candidate })
      } catch {}
    }
    if (!participant) {
      participant = await meetingStore.findParticipant(roomId, candidate)
    }

    if (!participant) {
      throw ApiError.notFound("PARTICIPANT_NOT_FOUND", "Participant not found in meeting")
    }

    const newHandState = !participant.isHandRaised
    const handRaisedAt = newHandState ? new Date() : undefined

    if (meetingStore.isDbConnected()) {
      try {
        await MeetingParticipant.findOneAndUpdate(
          { roomId, userId: candidate },
          { isHandRaised: newHandState, handRaisedAt }
        )
      } catch {}
    }

    await meetingStore.upsertParticipant(roomId, candidate, {
      ...participant,
      isHandRaised: newHandState,
      handRaisedAt,
    })

    logger.info("HAND_RAISE_TOGGLED", { roomId, userId: candidate, isHandRaised: newHandState })

    return sendSuccess(res, {
      isHandRaised: newHandState,
      handRaisedAt,
      userId: candidate,
    })
  } catch (err) {
    logger.error("TOGGLE_HAND_RAISE_ERROR", err)
    return sendError(res, err)
  }
}

