import path from "path"
import mongoose from "mongoose"
import Meeting from "../Modals/Meeting.js"
import MeetingRecording from "../Modals/MeetingRecording.js"
import User from "../Modals/Auth.js"
import { recordingStorageService } from "../services/recordingStorageService.js"
import { recordingConfig } from "../config/index.js"
import { ApiError } from "../utils/apiError.js"
import { sendSuccess, sendError } from "../utils/apiResponse.js"
import { logger, MeetingEvents } from "../utils/logger.js"
import { MeetingRoles } from "../services/videoTokenService.js"
import { meetingStore } from "../services/meetingStore.js"

const inMemoryRecordings = new Map()

const isDbReady = () => Boolean(mongoose.connection && mongoose.connection.readyState === 1)

/**
 * Validates whether the requesting user has permission to record in this meeting.
 */
const checkCanRecord = (req, meeting) => {
  if (!req.user) {
    throw ApiError.unauthorized("AUTHENTICATION_REQUIRED", "You must be signed in to record.")
  }

  const callerId = String(req.user.id || req.user._id)
  const isHost =
    req.userRole === MeetingRoles.HOST ||
    String(meeting.hostId) === callerId

  const isCoHost =
    req.userRole === MeetingRoles.CO_HOST ||
    (Array.isArray(meeting.coHosts) && meeting.coHosts.some((id) => String(id) === callerId))

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
        recording: meeting.recording,
        message: "Recording is already active.",
      })
    }

    const now = new Date()
    const recId = `rec_${meeting.roomId}_${Date.now()}`
    meeting.recording = {
      enabled: true,
      status: "recording",
      activeRecordingId: recId,
      startedAt: now,
      endedAt: null,
      fileUrl: "",
    }

    if (typeof meeting.save === "function") {
      await meeting.save().catch(() => {})
    } else {
      await meetingStore.updateMeeting(meeting.roomId, { recording: meeting.recording }).catch(() => {})
    }

    logger.info(MeetingEvents.RECORDING_STARTED, {
      roomId: meeting.roomId,
      hostId: req.user.id || req.user._id,
      startedAt: now,
    })

    return sendSuccess(res, {
      roomId: meeting.roomId,
      status: "recording",
      startedAt: now,
      recording: {
        activeRecordingId: recId,
        startedAt: now.toISOString(),
        startedBy: String(req.user.id || req.user._id),
        status: "recording",
      },
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

    if (typeof meeting.save === "function") {
      await meeting.save().catch(() => {})
    } else {
      await meetingStore.updateMeeting(meeting.roomId, { recording: meeting.recording }).catch(() => {})
    }

    logger.info(MeetingEvents.RECORDING_STOPPED, {
      roomId: meeting.roomId,
      hostId: req.user.id || req.user._id,
      endedAt: now,
    })

    return sendSuccess(res, {
      roomId: meeting.roomId,
      status: "processing",
      endedAt: now,
      message: "Recording stopped and processing.",
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

    // Retrieve creator details safely
    let creatorName = req.user?.channelname || req.user?.name || "Host"
    if (isDbReady() && req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)) {
      try {
        const user = await User.findById(req.user.id)
        if (user) {
          creatorName = user.channelname || user.name || creatorName
        }
      } catch {}
    }

    const recId = new mongoose.Types.ObjectId().toString()
    const recordingData = {
      _id: recId,
      meetingId: meeting._id || meeting.roomId,
      roomId: meeting.roomId,
      title: title?.trim() || `${meeting.title || "Meeting"} - Recording`,
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
      createdAt: new Date(),
    }

    if (isDbReady()) {
      try {
        const recording = new MeetingRecording(recordingData)
        await recording.save()
      } catch (err) {
        logger.warn("[Recording] Failed to persist to Mongo, keeping in memory:", err.message)
      }
    }

    inMemoryRecordings.set(recId, recordingData)

    meeting.recording = meeting.recording || {}
    meeting.recording.status = "completed"
    meeting.recording.activeRecordingId = recId
    meeting.recording.fileUrl = `/api/recordings/${recId}`
    if (typeof meeting.save === "function") {
      await meeting.save().catch(() => {})
    } else {
      await meetingStore.updateMeeting(meeting.roomId, { recording: meeting.recording }).catch(() => {})
    }

    logger.info(MeetingEvents.RECORDING_UPLOADED, {
      roomId: meeting.roomId,
      recordingId: recId,
      filename: file.filename,
      fileSize: file.size,
      duration: recordingData.duration,
      uploadedBy: req.user.id,
    })

    return sendSuccess(
      res,
      {
        recording: {
          id: recId,
          recordingId: recId,
          roomId: recordingData.roomId,
          title: recordingData.title,
          duration: recordingData.duration,
          fileSize: recordingData.fileSize,
          status: recordingData.status,
          createdAt: recordingData.createdAt,
          creatorName: recordingData.creatorName,
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
    let meeting = req.meeting
    if (!meeting) {
      meeting = await meetingStore.findMeeting(roomId)
    }
    if (!meeting) {
      throw ApiError.notFound("MEETING_NOT_FOUND", "Meeting room not found")
    }

    const isHostOrCoHost =
      (req.user && String(meeting.hostId) === String(req.user.id)) ||
      req.userRole === MeetingRoles.HOST ||
      req.userRole === MeetingRoles.CO_HOST

    let recordings = []
    if (isDbReady()) {
      try {
        const query = {
          roomId: meeting.roomId,
          status: { $ne: "DELETED" },
        }
        if (!isHostOrCoHost) {
          query.accessPolicy = { $in: ["PARTICIPANTS", "PUBLIC"] }
        }
        recordings = await MeetingRecording.find(query).sort({ createdAt: -1 }).lean()
      } catch (err) {
        logger.warn("[Recording] Failed to query Mongo recordings:", err.message)
      }
    }

    // Merge in-memory recordings for this room
    const memoryRecs = Array.from(inMemoryRecordings.values()).filter(
      (r) =>
        r.roomId === roomId &&
        r.status !== "DELETED" &&
        (isHostOrCoHost || ["PARTICIPANTS", "PUBLIC"].includes(r.accessPolicy))
    )

    const seenIds = new Set(recordings.map((r) => String(r._id)))
    for (const memRec of memoryRecs) {
      if (!seenIds.has(String(memRec._id))) {
        recordings.push(memRec)
      }
    }

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
    let recording = inMemoryRecordings.get(recordingId)
    if (!recording && isDbReady() && mongoose.Types.ObjectId.isValid(recordingId)) {
      recording = await MeetingRecording.findById(recordingId).catch(() => null)
    }

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

    let recording = inMemoryRecordings.get(recordingId)
    if (!recording && isDbReady() && mongoose.Types.ObjectId.isValid(recordingId)) {
      recording = await MeetingRecording.findById(recordingId).catch(() => null)
    }

    if (!recording || recording.status === "DELETED") {
      throw ApiError.notFound("RECORDING_NOT_FOUND", "Recording not found")
    }

    // Check meeting authorization
    let meeting = null
    if (recording.roomId) {
      meeting = await meetingStore.findMeeting(recording.roomId)
    }
    if (!meeting && isDbReady() && recording.meetingId && mongoose.Types.ObjectId.isValid(recording.meetingId)) {
      meeting = await Meeting.findById(recording.meetingId).catch(() => null)
    }

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

    let recording = inMemoryRecordings.get(recordingId)
    if (!recording && isDbReady() && mongoose.Types.ObjectId.isValid(recordingId)) {
      recording = await MeetingRecording.findById(recordingId).catch(() => null)
    }

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
    if (typeof recording.save === "function") {
      recording.save().catch(() => {})
    }

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

    let recording = inMemoryRecordings.get(recordingId)
    if (!recording && isDbReady() && mongoose.Types.ObjectId.isValid(recordingId)) {
      recording = await MeetingRecording.findById(recordingId).catch(() => null)
    }

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
    if (typeof recording.save === "function") {
      recording.save().catch(() => {})
    }

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

    let recording = inMemoryRecordings.get(recordingId)
    if (!recording && isDbReady() && mongoose.Types.ObjectId.isValid(recordingId)) {
      recording = await MeetingRecording.findById(recordingId).catch(() => null)
    }

    if (!recording) {
      throw ApiError.notFound("RECORDING_NOT_FOUND", "Recording not found")
    }

    const isOwner = String(recording.createdBy) === String(req.user.id)
    let meeting = null
    if (recording.roomId) {
      meeting = await meetingStore.findMeeting(recording.roomId)
    }
    if (!meeting && isDbReady() && recording.meetingId && mongoose.Types.ObjectId.isValid(recording.meetingId)) {
      meeting = await Meeting.findById(recording.meetingId).catch(() => null)
    }
    const isMeetingHost = meeting && String(meeting.hostId) === String(req.user.id)

    if (!isOwner && !isMeetingHost) {
      throw ApiError.forbidden("FORBIDDEN", "Only the owner or meeting host can delete this recording")
    }

    // Delete physical file
    await recordingStorageService.deleteFile(recording.storagePath)

    // Mark deleted in memory and DB
    recording.status = "DELETED"
    inMemoryRecordings.delete(recordingId)
    if (typeof recording.save === "function") {
      await recording.save().catch(() => {})
    }

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

