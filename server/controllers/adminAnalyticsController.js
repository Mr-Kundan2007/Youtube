import adminAnalyticsService from "../services/adminAnalyticsService.js"
import { sendSuccess, sendError } from "../utils/apiResponse.js"

/**
 * Handles GET /api/admin/analytics/videos/top
 */
export const getTopVideosHandler = async (req, res) => {
  try {
    const { limit, range, startDate, endDate } = req.query
    const topVideos = await adminAnalyticsService.getTopVideos({
      limit,
      range,
      startDate,
      endDate,
    })
    return sendSuccess(res, { topVideos }, "Top downloaded videos retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/admin/analytics/videos/:videoId/performance
 */
export const getVideoPerformanceHandler = async (req, res) => {
  try {
    const { videoId } = req.params
    const { range } = req.query
    const performance = await adminAnalyticsService.getVideoPerformance(videoId, { range })
    return sendSuccess(res, performance, "Video download performance retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/admin/analytics/trends
 */
export const getDownloadTrendsHandler = async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query
    const trends = await adminAnalyticsService.getDownloadTrends({ range, startDate, endDate })
    return sendSuccess(res, { trends }, "Download trends retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/admin/analytics/hourly
 */
export const getHourlyTrendsHandler = async (req, res) => {
  try {
    const { range } = req.query
    const hourly = await adminAnalyticsService.getHourlyTrends({ range })
    return sendSuccess(res, hourly, "Hourly download trends retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/admin/analytics/subscriptions
 */
export const getSubscriptionAnalyticsHandler = async (req, res) => {
  try {
    const subAnalytics = await adminAnalyticsService.getSubscriptionAnalytics()
    return sendSuccess(res, subAnalytics, "Subscription analytics retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/admin/analytics/devices
 */
export const getDeviceAnalyticsHandler = async (req, res) => {
  try {
    const deviceAnalytics = await adminAnalyticsService.getDeviceAnalytics()
    return sendSuccess(res, deviceAnalytics, "Device analytics retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/admin/analytics/failures
 */
export const getFailureAnalyticsHandler = async (req, res) => {
  try {
    const { range } = req.query
    const failureAnalytics = await adminAnalyticsService.getFailureAnalytics({ range })
    return sendSuccess(res, failureAnalytics, "Failure analytics retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

export default {
  getTopVideosHandler,
  getVideoPerformanceHandler,
  getDownloadTrendsHandler,
  getHourlyTrendsHandler,
  getSubscriptionAnalyticsHandler,
  getDeviceAnalyticsHandler,
  getFailureAnalyticsHandler,
}
