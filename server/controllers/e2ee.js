import Meeting from "../Modals/Meeting.js"
import { ApiError } from "../utils/apiError.js"
import { sendSuccess, sendError } from "../utils/apiResponse.js"
import { logger, MeetingEvents } from "../utils/logger.js"
import { MeetingRoles } from "../services/videoTokenService.js"

/**
 * Toggles E2EE mode for a meeting room (Host only).
 * POST /api/meetings/:roomId/e2ee/toggle
 */
export const toggleE2EE = async (req, res) => {
  try {
    const meeting = req.meeting
    if (req.userRole !== MeetingRoles.HOST) {
      throw ApiError.forbidden("FORBIDDEN", "Only the host can toggle End-to-End Encryption")
    }

    const { enabled, securityMode } = req.body
    const isEnabled = enabled !== undefined ? Boolean(enabled) : securityMode === "E2EE"

    meeting.securityMode = isEnabled ? "E2EE" : "STANDARD"
    if (isEnabled && (!meeting.e2eeKeyVersion || meeting.e2eeKeyVersion === 0)) {
      meeting.e2eeKeyVersion = 1
    }

    await meeting.save()

    logger.info(isEnabled ? "E2EE_ENABLED" : "E2EE_DISABLED", {
      roomId: meeting.roomId,
      hostId: req.user.id,
      securityMode: meeting.securityMode,
      keyVersion: meeting.e2eeKeyVersion,
    })

    return sendSuccess(res, {
      securityMode: meeting.securityMode,
      isE2EE: meeting.securityMode === "E2EE",
      e2eeKeyVersion: meeting.e2eeKeyVersion || 1,
      keyVersion: meeting.e2eeKeyVersion || 1,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Notifies server of an E2EE key rotation event (Host only).
 * POST /api/meetings/:roomId/e2ee/rotate
 */
export const rotateE2EEKey = async (req, res) => {
  try {
    const meeting = req.meeting
    if (req.userRole !== MeetingRoles.HOST) {
      throw ApiError.forbidden("FORBIDDEN", "Only the host can rotate End-to-End Encryption keys")
    }

    meeting.e2eeKeyVersion = (meeting.e2eeKeyVersion || 1) + 1
    await meeting.save()

    logger.info("E2EE_KEY_ROTATED", {
      roomId: meeting.roomId,
      hostId: req.user.id,
      keyVersion: meeting.e2eeKeyVersion,
    })

    return sendSuccess(res, {
      message: "Key rotated successfully",
      securityMode: meeting.securityMode,
      isE2EE: meeting.securityMode === "E2EE",
      e2eeKeyVersion: meeting.e2eeKeyVersion,
      keyVersion: meeting.e2eeKeyVersion,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Returns current E2EE status and key version for a meeting room.
 * GET /api/meetings/:roomId/e2ee/status
 */
export const getE2EEStatus = async (req, res) => {
  try {
    const meeting = req.meeting
    return sendSuccess(res, {
      securityMode: meeting.securityMode || "STANDARD",
      isE2EE: meeting.securityMode === "E2EE",
      e2eeKeyVersion: meeting.e2eeKeyVersion || 1,
      keyVersion: meeting.e2eeKeyVersion || 1,
    })

  } catch (err) {
    return sendError(res, err)
  }
}
