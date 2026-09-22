import mongoose from "mongoose"
import DownloadNotification from "../Modals/DownloadNotification.js"
import DownloadPreference from "../Modals/DownloadPreference.js"
import { ApiError } from "../utils/apiError.js"

export class UserNotificationService {
  /**
   * Creates an in-app download notification, checking user notification preferences.
   */
  async createNotification({ userId, type, title, message, metadata = {} }) {
    if (!userId || !type || !title || !message) {
      return null
    }

    try {
      // Check user preferences if available
      const prefs = await DownloadPreference.findOne({
        $or: [{ userId }, { user_id: userId }],
      }).lean()

      if (prefs) {
        if (type === "DOWNLOAD_COMPLETED" && prefs.notifyOnComplete === false) return null
        if (type === "DOWNLOAD_FAILED" && prefs.notifyOnFailure === false) return null
        if (type === "QUOTA_WARNING" && prefs.notifyOnQuotaWarning === false) return null
      }

      const notification = await DownloadNotification.create({
        userId,
        user_id: userId,
        type,
        title,
        message,
        metadata: {
          downloadId: metadata.downloadId || undefined,
          videoId: metadata.videoId || undefined,
          videoTitle: metadata.videoTitle || undefined,
          plan: metadata.plan || undefined,
        },
      })

      return notification
    } catch (err) {
      console.warn("Failed to create download notification:", err.message)
      return null
    }
  }

  /**
   * Retrieves paginated notifications for the authenticated user.
   */
  async getUserNotifications(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "User authentication required")
    }

    const safePage = Math.max(1, parseInt(page, 10) || 1)
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20))
    const skip = (safePage - 1) * safeLimit

    const query = {
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { user_id: new mongoose.Types.ObjectId(userId) },
      ],
    }

    if (unreadOnly === true || unreadOnly === "true") {
      query.read = false
    }

    const [notifications, total, unreadCount] = await Promise.all([
      DownloadNotification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      DownloadNotification.countDocuments(query),
      DownloadNotification.countDocuments({
        $or: [
          { userId: new mongoose.Types.ObjectId(userId) },
          { user_id: new mongoose.Types.ObjectId(userId) },
        ],
        read: false,
      }),
    ])

    return {
      notifications: notifications.map((n) => ({
        id: n._id,
        _id: n._id,
        type: n.type,
        title: n.title,
        message: n.message,
        metadata: n.metadata,
        read: n.read,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      unreadCount,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
      },
    }
  }

  /**
   * Marks a single notification as read, validating ownership.
   */
  async markAsRead(userId, notificationId) {
    if (!userId || !notificationId) {
      throw ApiError.badRequest("MISSING_PARAMETERS", "User ID and notification ID required")
    }

    const notification = await DownloadNotification.findOne({
      _id: notificationId,
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { user_id: new mongoose.Types.ObjectId(userId) },
      ],
    })

    if (!notification) {
      throw ApiError.notFound("NOTIFICATION_NOT_FOUND", "Notification not found or access denied")
    }

    notification.read = true
    notification.readAt = new Date()
    await notification.save()

    return notification
  }

  /**
   * Marks all notifications for a user as read.
   */
  async markAllAsRead(userId) {
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "User authentication required")
    }

    const result = await DownloadNotification.updateMany(
      {
        $or: [
          { userId: new mongoose.Types.ObjectId(userId) },
          { user_id: new mongoose.Types.ObjectId(userId) },
        ],
        read: false,
      },
      {
        $set: { read: true, readAt: new Date() },
      }
    )

    return { modifiedCount: result.modifiedCount }
  }

  /**
   * Deletes a notification, validating ownership.
   */
  async deleteNotification(userId, notificationId) {
    if (!userId || !notificationId) {
      throw ApiError.badRequest("MISSING_PARAMETERS", "User ID and notification ID required")
    }

    const deleted = await DownloadNotification.findOneAndDelete({
      _id: notificationId,
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { user_id: new mongoose.Types.ObjectId(userId) },
      ],
    })

    if (!deleted) {
      throw ApiError.notFound("NOTIFICATION_NOT_FOUND", "Notification not found or access denied")
    }

    return { success: true }
  }
}

export const userNotificationService = new UserNotificationService()
export default userNotificationService
