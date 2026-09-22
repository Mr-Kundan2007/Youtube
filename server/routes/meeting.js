import express from "express"
import {
  createMeeting,
  getMeeting,
  joinMeeting,
  getMeetingToken,
  leaveMeeting,
  endMeeting,
  executeHostAction,
  getParticipants,
  muteParticipant,
  removeParticipant,
  promoteCoHost,
  demoteCoHost,
  lockMeeting,
  unlockMeeting,
  getChatHistory,
  sendChatMessage,
  uploadChatAttachment,
  downloadChatAttachment,
  toggleHandRaise,
} from "../controllers/meeting.js"
import { requireAuth, optionalAuth } from "../middleware/authMiddleware.js"
import {
  validateRoomIdParam,
  validateCreateMeetingInput,
  validateTokenRequestInput,
} from "../middleware/meetingValidators.js"
import {
  validateMeetingState,
  authorizeMeetingRole,
  authorizeMeetingPermission,
} from "../middleware/meetingSecurity.js"
import {
  createMeetingLimiter,
  meetingTokenLimiter,
  generalMeetingLimiter,
} from "../middleware/rateLimiter.js"
import { MeetingRoles } from "../services/videoTokenService.js"
import { chatAttachmentUpload } from "../middleware/uploadMiddleware.js"

const router = express.Router()

// 1. Create a new meeting (Authenticated, Rate-limited, Validated)
router.post(
  "/",
  createMeetingLimiter,
  requireAuth,
  validateCreateMeetingInput,
  createMeeting
)
router.post(
  "/create",
  createMeetingLimiter,
  requireAuth,
  validateCreateMeetingInput,
  createMeeting
)

// 2. Get meeting status (Validated, Rate-limited, State-verified)
router.get(
  "/:roomId",
  generalMeetingLimiter,
  optionalAuth,
  validateRoomIdParam,
  validateMeetingState,
  getMeeting
)

// 3. Join meeting room & obtain temporary LiveKit token (Scoped, Rate-limited, State-verified)
router.post(
  "/:roomId/join",
  meetingTokenLimiter,
  optionalAuth,
  validateRoomIdParam,
  validateTokenRequestInput,
  validateMeetingState,
  joinMeeting
)

router.post(
  "/:roomId/token",
  meetingTokenLimiter,
  optionalAuth,
  validateRoomIdParam,
  validateTokenRequestInput,
  validateMeetingState,
  getMeetingToken
)

// 4. Host moderation action (Lock, unlock, mute, remove participant, update permissions)
router.post(
  "/:roomId/host-action",
  generalMeetingLimiter,
  requireAuth,
  validateRoomIdParam,
  validateMeetingState,
  authorizeMeetingRole(MeetingRoles.HOST, MeetingRoles.CO_HOST),
  executeHostAction
)

// Dedicated moderation endpoints
router.post(
  "/:roomId/mute-participant",
  generalMeetingLimiter,
  requireAuth,
  validateRoomIdParam,
  validateMeetingState,
  authorizeMeetingRole(MeetingRoles.HOST, MeetingRoles.CO_HOST),
  muteParticipant
)

router.post(
  "/:roomId/remove-participant",
  generalMeetingLimiter,
  requireAuth,
  validateRoomIdParam,
  validateMeetingState,
  authorizeMeetingRole(MeetingRoles.HOST, MeetingRoles.CO_HOST),
  removeParticipant
)

router.post(
  "/:roomId/promote-cohost",
  generalMeetingLimiter,
  requireAuth,
  validateRoomIdParam,
  validateMeetingState,
  authorizeMeetingRole(MeetingRoles.HOST),
  promoteCoHost
)

router.post(
  "/:roomId/demote-cohost",
  generalMeetingLimiter,
  requireAuth,
  validateRoomIdParam,
  validateMeetingState,
  authorizeMeetingRole(MeetingRoles.HOST),
  demoteCoHost
)

router.post(
  "/:roomId/lock",
  generalMeetingLimiter,
  requireAuth,
  validateRoomIdParam,
  validateMeetingState,
  authorizeMeetingRole(MeetingRoles.HOST, MeetingRoles.CO_HOST),
  lockMeeting
)

router.post(
  "/:roomId/unlock",
  generalMeetingLimiter,
  requireAuth,
  validateRoomIdParam,
  validateMeetingState,
  authorizeMeetingRole(MeetingRoles.HOST, MeetingRoles.CO_HOST),
  unlockMeeting
)

// 5. Host ends meeting for everyone (Host only)
router.post(
  "/:roomId/end",
  generalMeetingLimiter,
  requireAuth,
  validateRoomIdParam,
  validateMeetingState,
  authorizeMeetingRole(MeetingRoles.HOST),
  endMeeting
)

// 6. Leave meeting
router.post(
  "/:roomId/leave",
  optionalAuth,
  validateRoomIdParam,
  leaveMeeting
)

// 7. List participants
router.get(
  "/:roomId/participants",
  generalMeetingLimiter,
  validateRoomIdParam,
  getParticipants
)

// 8. Collaboration - Chat & File sharing
router.get(
  "/:roomId/chat",
  generalMeetingLimiter,
  optionalAuth,
  validateRoomIdParam,
  validateMeetingState,
  getChatHistory
)

router.post(
  "/:roomId/chat",
  generalMeetingLimiter,
  optionalAuth,
  validateRoomIdParam,
  validateMeetingState,
  authorizeMeetingPermission("allowChat"),
  sendChatMessage
)

router.post(
  "/:roomId/chat/attachment",
  generalMeetingLimiter,
  optionalAuth,
  validateRoomIdParam,
  validateMeetingState,
  authorizeMeetingPermission("allowFileSharing"),
  chatAttachmentUpload.single("file"),
  uploadChatAttachment
)

router.get(
  "/:roomId/chat/attachment/:messageId",
  generalMeetingLimiter,
  optionalAuth,
  validateRoomIdParam,
  validateMeetingState,
  downloadChatAttachment
)

// 9. Collaboration - Hand Raise
router.post(
  "/:roomId/hand-raise",
  generalMeetingLimiter,
  optionalAuth,
  validateRoomIdParam,
  validateMeetingState,
  toggleHandRaise
)

export default router
