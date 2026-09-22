import User from "../Modals/Auth.js"
import { ApiError } from "../utils/apiError.js"
import { sendError } from "../utils/apiResponse.js"

export const AdminPermissions = {
  VIEW_DASHBOARD: "VIEW_DASHBOARD",
  VIEW_DOWNLOADS: "VIEW_DOWNLOADS",
  MANAGE_DOWNLOADS: "MANAGE_DOWNLOADS",
  VIEW_USERS: "VIEW_USERS",
  MANAGE_USERS: "MANAGE_USERS",
  VIEW_ANALYTICS: "VIEW_ANALYTICS",
  VIEW_REPORTS: "VIEW_REPORTS",
  EXPORT_REPORTS: "EXPORT_REPORTS",
  VIEW_SECURITY: "VIEW_SECURITY",
  MANAGE_SECURITY: "MANAGE_SECURITY",
  VIEW_DEVICES: "VIEW_DEVICES",
  MANAGE_DEVICES: "MANAGE_DEVICES",
  VIEW_AUDIT_LOGS: "VIEW_AUDIT_LOGS",
}

/**
 * Verifies that the authenticated request originates from an admin user.
 */
export const requireAdminRole = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return sendError(res, ApiError.unauthorized("UNAUTHORIZED", "Authentication required"))
  }

  let role = req.user.role

  if (!role || role === "user") {
    try {
      const userDoc = await User.findById(req.user.id).select("role email").lean()
      role = userDoc?.role
    } catch {
      // Fallback
    }
  }

  if (role !== "admin") {
    return sendError(
      res,
      ApiError.forbidden("FORBIDDEN", "Admin privileges required to access this resource")
    )
  }

  next()
}

/**
 * Optional granular permission check middleware.
 * Admins possess all permissions by default.
 */
export const checkAdminPermission = (permission) => {
  return async (req, res, next) => {
    return requireAdminRole(req, res, next)
  }
}

/**
 * Verifies that the authenticated request originates from a moderator or admin user.
 */
export const requireModeratorOrAdminRole = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return sendError(res, ApiError.unauthorized("UNAUTHORIZED", "Authentication required"))
  }

  let role = req.user.role

  if (!role || role === "user") {
    try {
      const userDoc = await User.findById(req.user.id).select("role email").lean()
      role = userDoc?.role
    } catch {
      // Fallback
    }
  }

  if (role !== "admin" && role !== "moderator") {
    return sendError(
      res,
      ApiError.forbidden("FORBIDDEN", "Moderator or Admin privileges required to access this resource")
    )
  }

  next()
}

export default {
  AdminPermissions,
  requireAdminRole,
  requireModeratorOrAdminRole,
  checkAdminPermission,
}
