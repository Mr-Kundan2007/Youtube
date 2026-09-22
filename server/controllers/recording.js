import path from "path"
import Meeting from "../Modals/Meeting.js"
import MeetingRecording from "../Modals/MeetingRecording.js"
import User from "../Modals/Auth.js"
import { recordingStorageService } from "../services/recordingStorageService.js"
import { recordingConfig } from "../config/index.js"
import { ApiError } from "../utils/apiError.js"
import { sendSuccess, sendError } from "../utils/apiResponse.js"
import { logger, MeetingEvents } from "../utils/logger.js"
import { MeetingRoles } from "../services/videoTokenService.js"

/**
 * Validates whether the requesting user has permission to record in this meeting.
 */
const checkCanRecord = (req, meeting) => {
  if (!req.user) {
    throw ApiError.unauthorized("AUTHENTICATION_REQUIRED", "You must be signed in to record.")
  }

  const isHost = String(meeting.hostId) === String(req.user.id) || req.userRole === MeetingRoles.HOST
  const isCoHost =
    req.userRole === MeetingRoles.CO_HOST ||
    meeting.coHosts.some((id) => String(id) === String(req.user.id))

  if (isHost) return true
  if (isCoHost && meeting.permissions?.allowRecording !== false) return true

  throw ApiError.forbidden("FORBIDDEN", "Only the host or authorized co-hosts can record this meeting.")
}

/**
 * Starts meeting recording.
 * POST /api/meetings/:roomId/recordings/start
 */
export const startRecording = async (req, res) => {
  try {
    const meeting = req.meeting
    checkCanRecord(req, meeting)

    const isEnded =
      meeting.status === "ended" || meeting.status === "ENDED" || meeting.status === "CANCELLED"
    if (isEnded) {
      throw ApiError.badRequest("MEETING_ENDED", "Cannot record an ended meeting.")
    }

    if (meeting.recording?.status === "recording") {
      return sendSuccess(res, {
        roomId: meeting.roomId,
        status: "recording",
        startedAt: meeting.recording.startedAt,
        message: "Recording is already active.",
      })
    }

    const now = new Date()
    meeting.recording = {
      enabled: true,
      status: "recording",
      startedAt: now,
      endedAt: null,
      fileUrl: "",
    }

    await meeting.save()

    logger.info(MeetingEvents.RECORDING_STARTED, {
      roomId: meeting.roomId,
      hostId: req.user.id,
      startedAt: now,
    })

    return sendSuccess(res, {
      roomId: meeting.roomId,
      status: "recording",
      startedAt: now,
    })
  } catch (err) {
    logger.error("START_RECORDING_ERROR", err, { roomId: req.params.roomId })
    return sendError(res, err)
  }
}

/**
 * Stops meeting recording.
 * POST /api/meetings/:roomId/recordings/stop
 */
export const stopRecording = async (req, res) => {
  try {
    const meeting = req.meeting
    checkCanRecord(req, meeting)

    const now = new Date()
    meeting.recording = meeting.recording || {}
    meeting.recording.status = "processing"
    meeting.recording.endedAt = now

    await meeting.save()

    logger.info(MeetingEvents.RECORDING_STOPPED, {
      roomId: meeting.roomId,
      hostId: req.user.id,
      endedAt: now,
    })

    return sendSuccess(res, {
      roomId: meeting.roomId,
      status: "processing",
      endedAt: now,
    })
  } catch (err) {
    logger.error("STOP_RECORDING_ERROR", err, { roomId: req.params.roomId })
    return sendError(res, err)
  }
}

/**
 * Uploads a finalized recording chunk/file.
 * POST /api/meetings/:roomId/recordings/upload
 */
export const uploadRecording = async (req, res) => {
  try {
    const meeting = req.meeting
    checkCanRecord(req, meeting)

    const file = req.file
    if (!file) {
      throw ApiError.badRequest("VALIDATION_ERROR", "No recording file uploaded")
    }

    const { title, duration, resolution, startedAt, endedAt, participantCount } = req.body

    // Retrieve creator details
    let creatorName = "Host"
    const user = await User.findById(req.user.id)
    if (user) {
      creatorName = user.channelname || user.name || "Host"
    }

    const recording = new MeetingRecording({
      meetingId: meeting._id,
      roomId: meeting.roomId,
      title: title?.trim() || `${meeting.title} - Recording`,
      createdBy: req.user.id,
      creatorName,
      filename: file.filename,
      originalName: file.originalname || file.filename,
      storagePath: file.path,
      mimeType:
        file.mimetype && file.mimetype !== "application/octet-stream"
          ? file.mimetype
          : path.extname(file.originalname || "").toLowerCase() === ".mp4"
          ? "video/mp4"
          : "video/webm",
      fileSize: file.size,
      duration: Math.max(0, parseInt(duration, 10) || 0),
      resolution: resolution || "1280x720",
      status: "READY",
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      endedAt: endedAt ? new Date(endedAt) : new Date(),
      participantCount: parseInt(participantCount, 10) || 1,
      accessPolicy: "HOST_ONLY",
    })

    await recording.save()

    meeting.recording = meeting.recording || {}
    meeting.recording.status = "completed"
    meeting.recording.activeRecordingId = recording._id
    meeting.recording.fileUrl = `/api/recordings/${recording._id}`
    await meeting.save()

    logger.info(MeetingEvents.RECORDING_UPLOADED, {
      roomId: meeting.roomId,
      recordingId: recording._id,
      filename: file.filename,
      fileSize: file.size,
      duration: recording.duration,
      uploadedBy: req.user.id,
    })

    return sendSuccess(
      res,
      {
        recording: {
          id: recording._id,
          recordingId: recording._id,
          roomId: recording.roomId,
          title: recording.title,
          duration: recording.duration,
          fileSize: recording.fileSize,
          status: recording.status,
          createdAt: recording.createdAt,
          creatorName: recording.creatorName,
        },
      },
      201
    )
  } catch (err) {
    logger.error("UPLOAD_RECORDING_ERROR", err, { roomId: req.params.roomId })
    return sendError(res, err)
  }
}

/**
 * Lists recordings for a meeting.
 * GET /api/meetings/:roomId/recordings
 */
export const getMeetingRecordings = async (req, res) => {
  try {
    const roomId = req.params.roomId
    const meeting = req.meeting || (await Meeting.findOne({ roomId }))
    if (!meeting) {
      throw ApiError.notFound("MEETING_NOT_FOUND", "Meeting room not found")
    }

    const isHostOrCoHost =
      (req.user && String(meeting.hostId) === String(req.user.id)) ||
      req.userRole === MeetingRoles.HOST ||
      req.userRole === MeetingRoles.CO_HOST

    // Regular participants can only view if accessPolicy is not strictly HOST_ONLY
    const query = {
      roomId: meeting.roomId,
      status: { $ne: "DELETED" },
    }

    if (!isHostOrCoHost) {
      query.accessPolicy = { $in: ["PARTICIPANTS", "PUBLIC"] }
    }

    const recordings = await MeetingRecording.find(query).sort({ createdAt: -1 })

    const formatted = recordings.map((rec) => ({
      id: rec._id,
      recordingId: rec._id,
      roomId: rec.roomId,
      title: rec.title,
      creatorName: rec.creatorName,
      createdBy: rec.createdBy,
      duration: rec.duration,
      fileSize: rec.fileSize,
      mimeType: rec.mimeType,
      status: rec.status,
      startedAt: rec.startedAt,
      endedAt: rec.endedAt,
      createdAt: rec.createdAt,
      canDelete: isHostOrCoHost,
    }))

    return sendSuccess(res, { recordings: formatted })
  } catch (err) {
    logger.error("LIST_RECORDINGS_ERROR", err, { roomId: req.params.roomId })
    return sendError(res, err)
  }
}

/**
 * Gets recording metadata by recordingId.
 * GET /api/recordings/:recordingId
 */
export const getRecordingMetadata = async (req, res) => {
  try {
    const { recordingId } = req.params
    const recording = await MeetingRecording.findById(recordingId)

    if (!recording || recording.status === "DELETED") {
      throw ApiError.notFound("RECORDING_NOT_FOUND", "Recording not found")
    }

    return sendSuccess(res, {
      recording: {
        id: recording._id,
        recordingId: recording._id,
        roomId: recording.roomId,
        title: recording.title,
        creatorName: recording.creatorName,
        duration: recording.duration,
        fileSize: recording.fileSize,
        mimeType: recording.mimeType,
        status: recording.status,
        createdAt: recording.createdAt,
      },
    })
  } catch (err) {
    logger.error("GET_RECORDING_ERROR", err, { recordingId: req.params.recordingId })
    return sendError(res, err)
  }
}

/**
 * Generates short-lived signed access token for video playback or download.
 * GET /api/recordings/:recordingId/access
 */
export const getRecordingAccess = async (req, res) => {
  try {
    const { recordingId } = req.params
    const { action = "stream" } = req.query

    if (!req.user) {
      throw ApiError.unauthorized("AUTHENTICATION_REQUIRED", "Authentication required to access recordings")
    }

    const recording = await MeetingRecording.findById(recordingId)
    if (!recording || recording.status === "DELETED") {
      throw ApiError.notFound("RECORDING_NOT_FOUND", "Recording not found")
    }

    // Check meeting authorization
    const meeting = await Meeting.findById(recording.meetingId)
    const isOwner = String(recording.createdBy) === String(req.user.id)
    const isMeetingHost = meeting && String(meeting.hostId) === String(req.user.id)

    if (!isOwner && !isMeetingHost && recording.accessPolicy === "HOST_ONLY") {
      throw ApiError.forbidden("FORBIDDEN", "You are not authorized to view this recording")
    }

    const token = recordingStorageService.generateSignedAccessToken(
      recording._id,
      req.user.id,
      action,
      recordingConfig.signedUrlExpirySeconds
    )

    logger.info(MeetingEvents.RECORDING_ACCESSED, {
      recordingId: recording._id,
      userId: req.user.id,
      action,
    })

    return sendSuccess(res, {
      recordingId: recording._id,
      token,
      streamUrl: `/api/recordings/${recording._id}/stream?token=${token}`,
      downloadUrl: `/api/recordings/${recording._id}/download?token=${token}`,
      expiresIn: recordingConfig.signedUrlExpirySeconds,
    })
  } catch (err) {
    logger.error("GET_RECORDING_ACCESS_ERROR", err, { recordingId: req.params.recordingId })
    return sendError(res, err)
  }
}

/**
 * Streams recording video bytes with HTTP 206 Range requests support.
 * GET /api/recordings/:recordingId/stream
 */
export const streamRecording = async (req, res) => {
  try {
    const { recordingId } = req.params
    const { token } = req.query

    const recording = await MeetingRecording.findById(recordingId)
    if (!recording || recording.status === "DELETED") {
      throw ApiError.notFound("RECORDING_NOT_FOUND", "Recording not found")
    }

    // Verify token or authenticated session
    let authorized = false
    if (token) {
      try {
        recordingStorageService.verifySignedAccessToken(token, recording._id, "stream")
        authorized = true
      } catch (e) {}
    }

    if (!authorized && req.user) {
      const isOwner = String(recording.createdBy) === String(req.user.id)
      if (isOwner) authorized = true
    }

    if (!authorized) {
      throw ApiError.unauthorized("INVALID_ACCESS_TOKEN", "Valid signed access token is required to stream recording")
    }

    logger.info(MeetingEvents.RECORDING_STREAMED, {
      recordingId: recording._id,
      roomId: recording.roomId,
    })

    recording.playbackCount = (recording.playbackCount || 0) + 1
    recording.save().catch(() => {})

    return recordingStorageService.streamFile(req, res, recording.storagePath, recording.mimeType)
  } catch (err) {
    logger.error("STREAM_RECORDING_ERROR", err, { recordingId: req.params.recordingId })
    return sendError(res, err)
  }
}

/**
 * Securely downloads the recording file.
 * GET /api/recordings/:recordingId/download
 */
export const downloadRecording = async (req, res) => {
  try {
    const { recordingId } = req.params
    const { token } = req.query

    const recording = await MeetingRecording.findById(recordingId)
    if (!recording || recording.status === "DELETED") {
      throw ApiError.notFound("RECORDING_NOT_FOUND", "Recording not found")
    }

    let authorized = false
    if (token) {
      try {
        recordingStorageService.verifySignedAccessToken(token, recording._id, "download")
        authorized = true
      } catch (e) {}
    }

    if (!authorized && req.user) {
      const isOwner = String(recording.createdBy) === String(req.user.id)
      if (isOwner) authorized = true
    }

    if (!authorized) {
      throw ApiError.unauthorized("INVALID_ACCESS_TOKEN", "Valid signed access token is required to download recording")
    }

    logger.info(MeetingEvents.RECORDING_DOWNLOADED, {
      recordingId: recording._id,
      roomId: recording.roomId,
    })

    recording.downloadCount = (recording.downloadCount || 0) + 1
    recording.save().catch(() => {})

    return recordingStorageService.downloadFile(
      res,
      recording.storagePath,
      recording.originalName || `${recording.title || "recording"}.webm`
    )
  } catch (err) {
    logger.error("DOWNLOAD_RECORDING_ERROR", err, { recordingId: req.params.recordingId })
    return sendError(res, err)
  }
}

/**
 * Deletes a recording safely.
 * DELETE /api/recordings/:recordingId
 */
export const deleteRecording = async (req, res) => {
  try {
    const { recordingId } = req.params
    if (!req.user) {
      throw ApiError.unauthorized("AUTHENTICATION_REQUIRED", "Sign in required to delete recordings")
    }

    const recording = await MeetingRecording.findById(recordingId)
    if (!recording) {
      throw ApiError.notFound("RECORDING_NOT_FOUND", "Recording not found")
    }

    const isOwner = String(recording.createdBy) === String(req.user.id)
    const meeting = await Meeting.findById(recording.meetingId)
    const isMeetingHost = meeting && String(meeting.hostId) === String(req.user.id)

    if (!isOwner && !isMeetingHost) {
      throw ApiError.forbidden("FORBIDDEN", "Only the owner or meeting host can delete this recording")
    }

    // Delete physical file
    await recordingStorageService.deleteFile(recording.storagePath)

    // Mark deleted in DB
    recording.status = "DELETED"
    await recording.save()

    logger.info(MeetingEvents.RECORDING_DELETED, {
      recordingId: recording._id,
      roomId: recording.roomId,
      deletedBy: req.user.id,
    })

    return sendSuccess(res, {
      message: "Recording deleted successfully",
      recordingId: recording._id,
    })
  } catch (err) {
    logger.error("DELETE_RECORDING_ERROR", err, { recordingId: req.params.recordingId })
    return sendError(res, err)
  }
}
