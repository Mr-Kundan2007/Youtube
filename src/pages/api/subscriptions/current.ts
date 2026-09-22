import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` })
  }

  // If external backend is configured (Render/Railway), try forwarding first
  const externalServer = process.env.NEXT_PUBLIC_SERVER_URL || process.env.BACKEND_URL
  if (externalServer && !externalServer.includes("localhost:5001") && !externalServer.includes("127.0.0.1:5001")) {
    try {
      const response = await fetch(`${externalServer.replace(/\/$/, "")}/api/subscriptions/current`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        },
      })
      if (response.ok) {
        const data = await response.json()
        return res.status(response.status).json(data)
      }
    } catch (forwardErr) {
      console.warn("[NextApi] Forwarding /api/subscriptions/current failed, serving native:", forwardErr)
    }
  }

  // Return native default current subscription details
  const today = new Date().toISOString().slice(0, 10)
  const defaultPayload = {
    subscriptionId: "sub_free_current",
    userId: "user_current",
    status: "active",
    isActive: true,
    isExpired: false,
    startDate: new Date().toISOString(),
    expiryDate: null,
    remainingDays: null,
    nextRenewalDate: null,
    autoRenew: false,
    cancelAtPeriodEnd: false,
    cancelScheduled: false,
    currentPlan: {
      id: "static-plan-free",
      name: "Free",
      slug: "free",
      description: "Standard video streaming with basic community features",
      price: 0,
      currency: "INR",
      validityType: "lifetime",
    },
    plan: {
      name: "Free",
      slug: "free",
    },
    features: {
      premiumVideoAccess: false,
      premiumCourses: false,
      priorityContent: false,
      adFree: false,
      offlineDownloads: true,
      fastStreaming: false,
      exclusiveContent: false,
    },
    enabledFeatures: {
      premiumVideoAccess: false,
      premiumCourses: false,
      priorityContent: false,
      adFree: false,
      offlineDownloads: true,
      fastStreaming: false,
      exclusiveContent: false,
    },
    limits: {
      streamingQuality: "720p",
      dailyWatchTime: null,
      dailyUsageLimit: null,
      dailyDownloadLimit: 1,
      maxDownloadQuality: "720p",
      maxDevices: 1,
      maxConcurrentStreams: 1,
    },
    usageLimits: {
      streamingQuality: "720p",
      dailyWatchTime: null,
      dailyUsageLimit: null,
      dailyDownloadLimit: 1,
      maxDownloadQuality: "720p",
      maxDevices: 1,
      maxConcurrentStreams: 1,
    },
    usage: {
      date: today,
      watchTimeSeconds: 0,
      watchTimeMinutes: 0,
      downloadCount: 0,
      streamCount: 0,
    },
    remainingUsage: {
      watchTimeMinutes: null,
      dailyDownloadsRemaining: 1,
    },
  }

  return res.status(200).json({
    success: true,
    data: defaultPayload,
    message: "Current subscription retrieved successfully",
  })
}
