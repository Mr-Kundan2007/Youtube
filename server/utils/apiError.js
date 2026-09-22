/**
 * Standard Application Error with typed error code and HTTP status code.
 */
export class ApiError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.details = details
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }

  static badRequest(code, message, details = null) {
    return new ApiError(400, code, message, details)
  }

  static unauthorized(code = "UNAUTHORIZED", message = "Authentication required") {
    return new ApiError(401, code, message)
  }

  static forbidden(code = "FORBIDDEN", message = "Permission denied for this action") {
    return new ApiError(403, code, message)
  }

  static notFound(code = "NOT_FOUND", message = "Resource not found") {
    return new ApiError(404, code, message)
  }

  static conflict(code = "CONFLICT", message = "Resource state conflict") {
    return new ApiError(409, code, message)
  }

  static internal(codeOrMessage = "INTERNAL_SERVER_ERROR", message = null) {
    if (message) {
      return new ApiError(500, codeOrMessage, message)
    }
    return new ApiError(500, "INTERNAL_SERVER_ERROR", codeOrMessage)
  }
}

export const ErrorCodes = {
  MEETING_NOT_FOUND: "MEETING_NOT_FOUND",
  MEETING_LOCKED: "MEETING_LOCKED",
  MEETING_FULL: "MEETING_FULL",
  MEETING_ENDED: "MEETING_ENDED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  INVALID_ROOM_ID: "INVALID_ROOM_ID",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  MEDIA_PERMISSION_DENIED: "MEDIA_PERMISSION_DENIED",
  ATTACHMENT_TOO_LARGE: "ATTACHMENT_TOO_LARGE",
  INVALID_MIME_TYPE: "INVALID_MIME_TYPE",
}
