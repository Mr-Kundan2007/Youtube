import { userNotificationService } from "../services/userNotificationService.js"
import { sendSuccess, sendError } from "../utils/apiResponse.js"

/**
 * GET /api/notifications
 */
export const getUserNotificationsHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const { page, limit, unreadOnly } = req.query
    const result = await userNotificationService.getUserNotifications(userId, {
      page,
      limit,
      unreadOnly,
    })
    return sendSuccess(res, result, "Notifications retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * PATCH /api/notifications/:id/read
 */
export const markNotificationReadHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const { id } = req.params
    const updated = await userNotificationService.markAsRead(userId, id)
    return sendSuccess(res, updated, "Notification marked as read")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * PATCH /api/notifications/read-all
 */
export const markAllNotificationsReadHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const result = await userNotificationService.markAllAsRead(userId)
    return sendSuccess(res, result, "All notifications marked as read")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * DELETE /api/notifications/:id
 */
export const deleteNotificationHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const { id } = req.params
    const result = await userNotificationService.deleteNotification(userId, id)
    return sendSuccess(res, result, "Notification deleted successfully")
  } catch (err) {
    return sendError(res, err)
  }
}
