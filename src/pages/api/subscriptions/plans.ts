import type { NextApiRequest, NextApiResponse } from "next"
import { DEFAULT_STATIC_PLANS } from "@/services/subscriptionService"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` })
  }

  // If external backend is configured, try forwarding first
  const externalServer = process.env.NEXT_PUBLIC_SERVER_URL || process.env.BACKEND_URL
  if (externalServer && !externalServer.includes("localhost:5001") && !externalServer.includes("127.0.0.1:5001")) {
    try {
      const response = await fetch(`${externalServer.replace(/\/$/, "")}/api/subscriptions/plans`)
      const data = await response.json()
      return res.status(response.status).json(data)
    } catch {}
  }

  return res.status(200).json({
    success: true,
    data: {
      plans: DEFAULT_STATIC_PLANS,
      billingCycles: {
        monthly: {
          key: "monthly",
          label: "Monthly",
          durationMonths: 1,
          durationDays: 30,
          discountPercent: 0,
          badge: null,
          savingsText: null,
        },
        quarterly: {
          key: "quarterly",
          label: "Quarterly",
          durationMonths: 3,
          durationDays: 90,
          discountPercent: 10,
          badge: "Save 10%",
          savingsText: "Save 10%",
        },
        yearly: {
          key: "yearly",
          label: "Yearly",
          durationMonths: 12,
          durationDays: 365,
          discountPercent: 20,
          badge: "Save 20%",
          savingsText: "Save 20%",
        },
      },
    },
    message: "Active subscription plans retrieved successfully",
  })
}
