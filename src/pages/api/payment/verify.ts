import type { NextApiRequest, NextApiResponse } from "next"
import crypto from "crypto"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` })
  }

  // If external backend is configured, forward first
  const externalServer = process.env.NEXT_PUBLIC_SERVER_URL || process.env.BACKEND_URL
  if (externalServer && !externalServer.includes("localhost:5001") && !externalServer.includes("127.0.0.1:5001")) {
    try {
      const response = await fetch(`${externalServer.replace(/\/$/, "")}/api/payment/verify`, {
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
      console.warn("[NextApi] Forwarding payment verify failed, verifying natively:", forwardErr)
    }
  }

  try {
    const {
      transactionId,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      planKey = "silver",
      planName = "Silver",
      validityType = "monthly",
      amount = 499,
    } = req.body || {}

    const secret = process.env.RAZORPAY_KEY_SECRET || ""

    let verified = false
    if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      const expectedSignature = crypto
        .createHmac("sha256", secret.trim())
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex")
      verified = expectedSignature === razorpay_signature
    } else if (secret.includes("mock_")) {
      verified = true
    }

    if (!verified && !secret.includes("mock_")) {
      return res.status(400).json({
        success: false,
        code: "SIGNATURE_VERIFICATION_FAILED",
        message: "Payment signature verification failed. Your payment was not verified by Razorpay.",
      })
    }

    const now = new Date()
    const daysToAdd = validityType === "yearly" ? 365 : validityType === "quarterly" ? 90 : 30
    const expiry = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
    const invoiceNum = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`
    const finalPlanKey = String(planKey).toLowerCase()
    const finalPlanName = planName || finalPlanKey.charAt(0).toUpperCase() + finalPlanKey.slice(1)

    return res.status(200).json({
      success: true,
      data: {
        verified,
        plan: finalPlanKey,
        planName: finalPlanName,
        expiresAt: expiry.toISOString(),
        startDate: now.toISOString(),
        invoiceNumber: invoiceNum,
        transactionId: transactionId || `txn_${Date.now()}`,
        subscription: {
          plan: finalPlanKey,
          status: "active",
          startDate: now.toISOString(),
          expiryDate: expiry.toISOString(),
        },
        invoice: {
          invoiceNumber: invoiceNum,
          amount: Number(amount) || 499,
          currency: "INR",
        },
      },
      message: "Payment signature verified and subscription activated",
    })
  } catch (err: any) {
    console.error("[NextApi] Payment verification error:", err)
    return res.status(500).json({
      success: false,
      code: "VERIFICATION_FAILED",
      message: err.message || "Payment verification failed",
    })
  }
}
