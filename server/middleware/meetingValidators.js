import { isValidRoomId } from "../utils/roomIdGenerator.js"
import { ApiError } from "../utils/apiError.js"
import { sendError } from "../utils/apiResponse.js"

/**
 * Validates Room ID param.
 */
export const validateRoomIdParam = (req, res, next) => {
  const { roomId } = req.params
  if (!roomId || !isValidRoomId(roomId)) {
    return sendError(
      res,
      ApiError.badRequest("INVALID_ROOM_ID", "Invalid or malformed room identifier format"),
      400
    )
  }
  req.params.roomId = roomId.trim().toLowerCase()
  next()
}

/**
 * Validates meeting creation payload.
 */
export const validateCreateMeetingInput = (req, res, next) => {
  const { title, maxParticipants, permissions, accessPolicy } = req.body

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0 || title.length > 120) {
      return sendError(
        res,
        ApiError.badRequest("VALIDATION_ERROR", "Meeting title must be between 1 and 120 characters"),
        400
      )
    }
  }

  if (maxParticipants !== undefined) {
    const parsed = Number(maxParticipants)
    if (!Number.isInteger(parsed) || parsed < 2 || parsed > 100) {
      return sendError(
        res,
        ApiError.badRequest("VALIDATION_ERROR", "maxParticipants must be an integer between 2 and 100"),
        400
      )
    }
  }

  if (accessPolicy !== undefined) {
    if (!["LINK_ACCESS", "AUTHENTICATED_ONLY", "INVITE_ONLY", "HOST_APPROVAL"].includes(accessPolicy)) {
      return sendError(
        res,
        ApiError.badRequest("VALIDATION_ERROR", "accessPolicy must be LINK_ACCESS, AUTHENTICATED_ONLY, INVITE_ONLY, or HOST_APPROVAL"),
        400
      )
    }
  }

  const { scheduledStartAt, scheduledEndAt } = req.body
  if (scheduledStartAt !== undefined) {
    const startDate = new Date(scheduledStartAt)
    if (isNaN(startDate.getTime())) {
      return sendError(
        res,
        ApiError.badRequest("VALIDATION_ERROR", "scheduledStartAt must be a valid ISO date string"),
        400
      )
    }
  }

  if (scheduledEndAt !== undefined) {
    const endDate = new Date(scheduledEndAt)
    if (isNaN(endDate.getTime())) {
      return sendError(
        res,
        ApiError.badRequest("VALIDATION_ERROR", "scheduledEndAt must be a valid ISO date string"),
        400
      )
    }
    if (scheduledStartAt) {
      const startDate = new Date(scheduledStartAt)
      if (endDate <= startDate) {
        return sendError(
          res,
          ApiError.badRequest("VALIDATION_ERROR", "scheduledEndAt must be after scheduledStartAt"),
          400
        )
      }
    }
  }

  if (permissions !== undefined) {
    if (typeof permissions !== "object" || permissions === null) {
      return sendError(
        res,
        ApiError.badRequest("VALIDATION_ERROR", "permissions must be an object with boolean flags"),
        400
      )
    }
  }

  next()
}

/**
 * Validates token request input.
 */
export const validateTokenRequestInput = (req, res, next) => {
  const { displayName, guestId } = req.body

  if (displayName !== undefined && displayName !== null) {
    if (typeof displayName !== "string" || displayName.length > 50) {
      return sendError(
        res,
        ApiError.badRequest("VALIDATION_ERROR", "displayName must not exceed 50 characters"),
        400
      )
    }
    req.body.displayName = displayName.trim().replace(/[<>]/g, "") // Sanitize tags
  }

  if (guestId !== undefined && guestId !== null) {
    if (typeof guestId !== "string" || guestId.length > 64) {
      return sendError(
        res,
        ApiError.badRequest("VALIDATION_ERROR", "guestId must not exceed 64 characters"),
        400
      )
    }
  }

  next()
}
