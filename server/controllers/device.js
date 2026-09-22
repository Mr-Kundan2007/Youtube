import deviceService from "../services/deviceService.js"
import downloadEntitlementService from "../services/downloadEntitlementService.js"
import { downloadConfig } from "../config/index.js"
import { sendSuccess, sendError } from "../utils/apiResponse.js"
import { ApiError } from "../utils/apiError.js"

/**
 * Controller handling user device management endpoints:
 * GET /api/devices, POST /api/devices/register, GET /api/devices/:deviceId,
 * PATCH /api/devices/:deviceId, DELETE /api/devices/:deviceId.
 */

/**
 * Lists all devices registered to the authenticated user with plan limits.
 * GET /api/devices
 */
export const getUserDevicesHandler = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Authentication required")
    }

    const entitlement = await downloadEntitlementService.getDownloadEntitlement(userId)
    const planKey = entitlement?.data?.planKey || "free"
    const planConfig = downloadConfig.plans[planKey] || downloadConfig.plans.free

    const result = await deviceService.getUserDevices(userId, planConfig)

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Explicitly registers a new device for the user.
 * POST /api/devices/register
 */
export const registerDeviceHandler = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Authentication required")
    }

    const identified = deviceService.identifyDevice(req)
    const targetDeviceId = req.body.deviceId || identified.deviceId

    if (!targetDeviceId) {
      throw ApiError.badRequest("DEVICE_ID_REQUIRED", "Device identifier is required")
    }

    const entitlement = await downloadEntitlementService.getDownloadEntitlement(userId)
    const planKey = entitlement?.data?.planKey || "free"
    const planConfig = downloadConfig.plans[planKey] || downloadConfig.plans.free

    const result = await deviceService.findOrCreateDevice({
      userId,
      deviceId: targetDeviceId,
      metadata: {
        ...identified,
        deviceName: req.body.deviceName || identified.deviceName,
        deviceType: req.body.deviceType || identified.deviceType,
      },
      planConfig,
    })

    if (result.isBlocked) {
      throw ApiError.forbidden("DEVICE_BLOCKED", "This device has been blocked.")
    }

    if (result.isRevoked) {
      throw ApiError.forbidden("DEVICE_REVOKED", "This device has been revoked.")
    }

    if (result.limitReached) {
      throw new ApiError(
        403,
        "DEVICE_LIMIT_REACHED",
        "You have reached the maximum number of registered devices allowed for your plan.",
        {
          maxAllowed: result.maxAllowed,
          activeCount: result.activeCount,
          plan: planKey,
        }
      )
    }

    return res.status(result.isNew ? 201 : 200).json({
      success: true,
      message: result.isNew ? "Device registered successfully" : "Existing device recognized",
      data: {
        device: {
          id: result.device._id,
          deviceId: result.device.device_identifier,
          name: result.device.device_name,
          type: result.device.device_type,
          browser: result.device.browser,
          operatingSystem: result.device.operating_system,
          status: result.device.status,
          firstSeenAt: result.device.first_seen_at,
          lastSeenAt: result.device.last_seen_at,
        },
        isNew: result.isNew,
      },
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Retrieves details of a specific device.
 * GET /api/devices/:deviceId
 */
export const getDeviceByIdHandler = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Authentication required")
    }

    const device = await deviceService.getDeviceById(userId, req.params.deviceId)

    return res.status(200).json({
      success: true,
      data: {
        device,
      },
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Updates a device (e.g. rename).
 * PATCH /api/devices/:deviceId
 */
export const updateDeviceHandler = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Authentication required")
    }

    const updated = await deviceService.updateDevice(userId, req.params.deviceId, req.body)

    return res.status(200).json({
      success: true,
      message: "Device updated successfully",
      data: {
        device: updated,
      },
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Revokes a device.
 * DELETE /api/devices/:deviceId or POST /api/devices/:deviceId/revoke
 */
export const revokeDeviceHandler = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Authentication required")
    }

    const result = await deviceService.revokeDevice(userId, req.params.deviceId)

    return res.status(200).json({
      success: true,
      message: "Device revoked successfully",
      data: result,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

export default {
  getUserDevicesHandler,
  registerDeviceHandler,
  getDeviceByIdHandler,
  updateDeviceHandler,
  revokeDeviceHandler,
}
