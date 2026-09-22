import express from "express"
import { toggleE2EE, rotateE2EEKey, getE2EEStatus } from "../controllers/e2ee.js"
import { requireAuth, optionalAuth } from "../middleware/authMiddleware.js"
import { validateRoomIdParam } from "../middleware/meetingValidators.js"
import { validateMeetingState, authorizeMeetingRole } from "../middleware/meetingSecurity.js"
import { generalMeetingLimiter } from "../middleware/rateLimiter.js"
import { MeetingRoles } from "../services/videoTokenService.js"

const router = express.Router({ mergeParams: true })

router.post(
  "/:roomId/e2ee/toggle",
  generalMeetingLimiter,
  requireAuth,
  validateRoomIdParam,
  validateMeetingState,
  authorizeMeetingRole(MeetingRoles.HOST),
  toggleE2EE
)

router.post(
  "/:roomId/e2ee/rotate",
  generalMeetingLimiter,
  requireAuth,
  validateRoomIdParam,
  validateMeetingState,
  authorizeMeetingRole(MeetingRoles.HOST),
  rotateE2EEKey
)

router.post(
  "/:roomId/e2ee/rotate-key",
  generalMeetingLimiter,
  requireAuth,
  validateRoomIdParam,
  validateMeetingState,
  authorizeMeetingRole(MeetingRoles.HOST),
  rotateE2EEKey
)


router.get(
  "/:roomId/e2ee/status",
  generalMeetingLimiter,
  optionalAuth,
  validateRoomIdParam,
  validateMeetingState,
  getE2EEStatus
)

export default router
