import User from "../../Modals/Auth.js"
import { ApiError } from "../../utils/apiError.js"
import { sendError } from "../../utils/response.js"
import securityAuditService from "../services/securityAuditService.js"
import { getClientIp, hashIp } from "../utils/ipUtils.js"
import { logger } from "../../utils/logger.js"

/**
 * Enforces admin role and audits unauthorized privilege escalation attempts.
 */
export const requireAdminSecurity = async (req, res, next) => {
  const userId = req.user?.id || req.user?._id

  if (!userId) {
    return sendError(
      res,
      ApiError.unauthorized("UNAUTHORIZED", "Authentication required to access security administration.")
    )
  }

  let role = req.user?.role

  if (!role || role === "user") {
    try {
      const userDoc = await User.findById(userId).select("role email").lean()
      role = userDoc?.role
    } catch {
      // Fallback
    }
  }

  if (role !== "admin") {
    const ip = getClientIp(req)
    logger.warn(`[AdminSecurity] Unauthorized admin access attempt by user ${userId} from IP ${ip}`)

    // Record unauthorized admin access attempt in audit log
    await securityAuditService
      .recordEvent({
        eventType: "UNAUTHORIZED_ADMIN_ACCESS",
        severity: "HIGH",
        userId,
        riskScore: 65,
        ipHash: hashIp(ip),
        userAgent: req.headers["user-agent"],
        requestId: req.id || req.headers["x-request-id"],
        safeMetadata: {
          targetUrl: req.originalUrl,
          method: req.method,
          attemptedRole: role || "unknown",
        },
      })
      .catch(() => {})

    return sendError(
      res,
      ApiError.forbidden("FORBIDDEN", "Administrative authorization required to access security management.")
    )
  }

  next()
}

export default requireAdminSecurity
