/**
 * Standard API response envelope helpers.
 */
export const sendSuccess = (res, data, statusCodeOrMessage = 200, maybeMessage = "") => {
  let statusCode = 200
  let message = ""

  if (typeof statusCodeOrMessage === "number") {
    statusCode = statusCodeOrMessage
    message = maybeMessage || ""
  } else if (typeof statusCodeOrMessage === "string") {
    message = statusCodeOrMessage
    statusCode = 200
  }

  const responseBody = {
    success: true,
    data,
  }

  if (message) {
    responseBody.message = message
  }

  return res.status(statusCode).json(responseBody)
}

export const sendError = (res, error, statusCode = error?.statusCode || 500) => {
  const code = error?.code || "INTERNAL_SERVER_ERROR"
  const message = error?.message || "An unexpected error occurred"
  const details = error?.details || null

  return res.status(statusCode).json({
    success: false,
    code,
    message,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  })
}
