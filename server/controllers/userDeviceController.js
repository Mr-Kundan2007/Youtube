import mongoose from "mongoose"
import DownloadDevice from "../Modals/DownloadDevice.js"
import DownloadRecord from "../Modals/DownloadRecord.js"
import { downloadAuditService, DownloadEvents } from "../services/downloadAuditService.js"
import { userNotificationService } from "../services/userNotificationService.js"
import { sendSuccess, sendError } from "../utils/apiResponse.js"
import { ApiError } from "../utils/apiError.js"

/**
 * GET /api/devices
 */
export const getUserDevicesHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const currentDeviceId =
      req.headers["x-device-id"] ||
      req.headers["x-device-identifier"] ||
      req.cookies?.deviceId ||
      null

    const devices = await DownloadDevice.find({
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { user_id: new mongoose.Types.ObjectId(userId) },
      ],
    })
      .sort({ last_download_at: -1, createdAt: -1 })
      .lean()

    const sanitized = devices.map((d) => ({
      deviceId: d.device_identifier || d._id,
      id: d._id,
      deviceName: d.device_name || d.device_type || "Unknown Device",
      deviceType: d.device_type || "browser",
      browser: d.browser || "Unknown Browser",
      operatingSystem: d.operating_system || "Unknown OS",
      status: d.status || "authorized",
      isCurrentDevice: currentDeviceId
        ? d.device_identifier === currentDeviceId || String(d._id) === currentDeviceId
        : false,
      lastActivityAt: d.last_download_at || d.updatedAt || d.createdAt,
      registeredAt: d.createdAt,
    }))

    return sendSuccess(res, { devices: sanitized }, "Registered devices retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * PATCH /api/devices/:deviceId
 * Rename device
 */
export const renameUserDeviceHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const { deviceId } = req.params
    const { deviceName, name } = req.body
    const newName = (deviceName || name || "").trim()

    if (!newName) {
      throw ApiError.badRequest("MISSING_DEVICE_NAME", "A valid device name is required")
    }

    const isObjectId = mongoose.Types.ObjectId.isValid(deviceId)
    const device = await DownloadDevice.findOne({
      $and: [
        {
          $or: [
            { userId: new mongoose.Types.ObjectId(userId) },
            { user_id: new mongoose.Types.ObjectId(userId) },
          ],
        },
        {
          $or: [
            { device_identifier: deviceId },
            ...(isObjectId ? [{ _id: new mongoose.Types.ObjectId(deviceId) }] : []),
          ],
        },
      ],
    })

    if (!device) {
      throw ApiError.notFound("DEVICE_NOT_FOUND", "Device not found or access denied")
    }

    device.device_name = newName
    await device.save()

    return sendSuccess(
      res,
      {
        deviceId: device.device_identifier || device._id,
        deviceName: device.device_name,
      },
      "Device renamed successfully"
    )
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * DELETE /api/devices/:deviceId
 * Revoke device
 */
export const revokeUserDeviceHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const { deviceId } = req.params

    const isObjectId = mongoose.Types.ObjectId.isValid(deviceId)
    const device = await DownloadDevice.findOne({
      $and: [
        {
          $or: [
            { userId: new mongoose.Types.ObjectId(userId) },
            { user_id: new mongoose.Types.ObjectId(userId) },
          ],
        },
        {
          $or: [
            { device_identifier: deviceId },
            ...(isObjectId ? [{ _id: new mongoose.Types.ObjectId(deviceId) }] : []),
          ],
        },
      ],
    })

    if (!device) {
      throw ApiError.notFound("DEVICE_NOT_FOUND", "Device not found or access denied")
    }

    device.status = "revoked"
    device.revoked_at = new Date()
    device.revocation_reason = "USER_REMOVED_DEVICE"
    await device.save()

    // Audit log
    downloadAuditService.logEvent(DownloadEvents.DEVICE_REVOKED, {
      userId,
      deviceId: device.device_identifier,
      reason: "USER_REMOVED_DEVICE",
    })

    // User notification
    await userNotificationService.createNotification({
      userId,
      type: "DEVICE_REVOKED",
      title: "Device Removed",
      message: `Device "${device.device_name || device.device_identifier}" was removed from your account.`,
      metadata: { deviceId: device.device_identifier },
    })

    return sendSuccess(
      res,
      {
        deviceId: device.device_identifier || device._id,
        status: "revoked",
      },
      "Device revoked successfully"
    )
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * GET /api/devices/:deviceId/downloads
 */
export const getDeviceDownloadsHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const { deviceId } = req.params

    const downloads = await DownloadRecord.find({
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { user_id: new mongoose.Types.ObjectId(userId) },
      ],
      $or: [
        { device_id: deviceId },
        { device_identifier: deviceId },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean()

    return sendSuccess(
      res,
      {
        deviceId,
        downloads: downloads.map((d) => ({
          downloadId: d._id,
          videoTitle: d.videoTitle || "Video",
          status: d.download_status,
          createdAt: d.createdAt,
        })),
      },
      "Device downloads retrieved"
    )
  } catch (err) {
    return sendError(res, err)
  }
}
