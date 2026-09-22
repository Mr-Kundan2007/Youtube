import { downloadEntitlementService, EntitlementErrorCodes } from "../services/downloadEntitlementService.js"

/**
 * Controller for retrieving download entitlements.
 * GET /api/downloads/entitlement
 */
export const getDownloadEntitlement = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id

    if (!userId) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Authentication required to access download entitlements",
      })
    }

    const result = await downloadEntitlementService.getDownloadEntitlement(userId)

    if (!result.success) {
      if (result.code === EntitlementErrorCodes.ACCOUNT_BLOCKED) {
        return res.status(403).json(result)
      }
      if (result.code === EntitlementErrorCodes.USER_NOT_FOUND) {
        return res.status(404).json(result)
      }
      if (result.code === EntitlementErrorCodes.SUBSCRIPTION_EXPIRED) {
        return res.status(403).json(result)
      }
      return res.status(400).json(result)
    }

    return res.status(200).json(result)
  } catch (err) {
    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: err.message || "Failed to resolve download entitlement",
    })
  }
}

export default {
  getDownloadEntitlement,
}
