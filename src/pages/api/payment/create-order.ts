import type { NextApiRequest, NextApiResponse } from "next"
import crypto from "crypto"

interface PlanPricing {
  name: string
  monthly: number
  quarterly: number
  yearly: number
}

const PLAN_PRICING: Record<string, PlanPricing> = {
  free: { name: "Free", monthly: 0, quarterly: 0, yearly: 0 },
  bronze: { name: "Bronze", monthly: 199, quarterly: 537, yearly: 1910 },
  silver: { name: "Silver", monthly: 499, quarterly: 1347, yearly: 4790 },
  gold: { name: "Gold", monthly: 999, quarterly: 2697, yearly: 9590 },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` })
  }

  // If external backend is configured (e.g. Render/Railway), try forwarding first
  const externalServer = process.env.NEXT_PUBLIC_SERVER_URL || process.env.BACKEND_URL
  if (externalServer && !externalServer.includes("localhost:5001") && !externalServer.includes("127.0.0.1:5001")) {
    try {
      const response = await fetch(`${externalServer.replace(/\/$/, "")}/api/payment/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        },
        body: JSON.stringify(req.body),
      })
      const data = await response.json()
      return res.status(response.status).json(data)
    } catch (forwardErr) {
      console.warn("[NextApi] Forwarding to external server failed, processing natively:", forwardErr)
    }
  }

  try {
    const { planId, planKey, validityType = "monthly", actionType = "new_subscription" } = req.body || {}
    const rawKey = String(planKey || planId || "free").toLowerCase()
    const planSlug = PLAN_PRICING[rawKey] ? rawKey : "silver"
    const cycle: "monthly" | "quarterly" | "yearly" =
      validityType === "yearly" ? "yearly" : validityType === "quarterly" ? "quarterly" : "monthly"

    const planConfig = PLAN_PRICING[planSlug] || PLAN_PRICING.silver
    const amountRupees = planConfig[cycle] ?? planConfig.monthly
    const amountPaise = Math.round(amountRupees * 100)

    const internalTransactionId = `PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`
    const orderId = `order_${crypto.randomBytes(10).toString("hex")}`
    const receipt = `rcpt_${internalTransactionId}`
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "rzp_test_mockkey12345678"

    return res.status(201).json({
      success: true,
      data: {
        transactionId: `txn_${Date.now()}`,
        internalTransactionId,
        paymentAttemptId: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex"),
        orderId,
        amount: amountPaise,
        currency: "INR",
        keyId,
        receipt,
        plan: {
          id: planId || null,
          slug: planSlug,
          name: planConfig.name,
          validityType: cycle,
          displayPrice: `₹${amountRupees}`,
        },
        actionType,
      },
      message: "Payment order created successfully",
    })
  } catch (err: any) {
    console.error("[NextApi] Create order error:", err)
    return res.status(500).json({
      success: false,
      code: "ORDER_CREATION_FAILED",
      message: err.message || "Unable to create payment order",
    })
  }
}
