import express from "express"
import {
  startRecording,
  stopRecording,
  uploadRecording,
  getMeetingRecordings,
  getRecordingMetadata,
  getRecordingAccess,
  streamRecording,
  downloadRecording,
  deleteRecording,
} from "../controllers/recording.js"
import { requireAuth, optionalAuth } from "../middleware/authMiddleware.js"
import { validateRoomIdParam } from "../middleware/meetingValidators.js"
import { validateMeetingState, authorizeMeetingRole } from "../middleware/meetingSecurity.js"
import { generalMeetingLimiter } from "../middleware/rateLimiter.js"
import { recordingUpload } from "../middleware/uploadMiddleware.js"
import { MeetingRoles } from "../services/videoTokenService.js"

const router = express.Router({ mergeParams: true })

// --- Meeting-scoped recording endpoints ---
router.post(
  "/:roomId/recordings/start",
  generalMeetingLimiter,
  requireAuth,
  validateRoomIdParam,
  validateMeetingState,
  authorizeMeetingRole(MeetingRoles.HOST, MeetingRoles.CO_HOST),
  startRecording
)

router.post(
  "/:roomId/recordings/stop",
  generalMeetingLimiter,
  requireAuth,
  validateRoomIdParam,
  validateMeetingState,
  authorizeMeetingRole(MeetingRoles.HOST, MeetingRoles.CO_HOST),
  stopRecording
)

router.post(
  "/:roomId/recordings/upload",
  generalMeetingLimiter,
  requireAuth,
  validateRoomIdParam,
  validateMeetingState,
  authorizeMeetingRole(MeetingRoles.HOST, MeetingRoles.CO_HOST),
  recordingUpload.single("recording"),
  uploadRecording
)

router.get(
  "/:roomId/recordings",
  generalMeetingLimiter,
  optionalAuth,
  validateRoomIdParam,
  getMeetingRecordings
)

// Export standalone recording router for /api/recordings
export const standaloneRecordingRouter = express.Router()

standaloneRecordingRouter.get(
  "/:recordingId",
  generalMeetingLimiter,
  optionalAuth,
  getRecordingMetadata
)

standaloneRecordingRouter.get(
  "/:recordingId/access",
  generalMeetingLimiter,
  requireAuth,
  getRecordingAccess
)

standaloneRecordingRouter.get(
  "/:recordingId/stream",
  optionalAuth,
  streamRecording
)

standaloneRecordingRouter.get(
  "/:recordingId/download",
  optionalAuth,
  downloadRecording
)

standaloneRecordingRouter.delete(
  "/:recordingId",
  generalMeetingLimiter,
  requireAuth,
  deleteRecording
)

export default router
