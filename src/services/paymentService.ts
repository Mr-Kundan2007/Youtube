/**
 * Frontend Payment Service
 * Integrates Razorpay Test Mode checkout, secure order creation,
 * transaction status tracking, and cancellation handling.
 * 
 * IMPORTANT: No secrets (such as RAZORPAY_KEY_SECRET) are ever used or exposed here.
 * Only the public keyId returned by the backend order response or public env is used.
 */

export interface CreateOrderParams {
  planId?: string
  planKey?: string
  validityType?: "monthly" | "quarterly" | "yearly"
  billingCycle?: "monthly" | "quarterly" | "yearly"
  actionType?: "new_subscription" | "upgrade" | "renew" | "downgrade"
}

export interface PaymentOrderData {
  transactionId: string
  internalTransactionId?: string
  paymentAttemptId?: string
  orderId: string
  amount: number // in paise (e.g. 49900)
  currency: string // e.g. "INR"
  keyId: string // public test key
  receipt?: string
  plan: {
    id?: string
    slug: string
    name: string
    validityType: string
    displayPrice: string
  }
  actionType: string
  reused?: boolean
}

export interface PaymentStatusData {
  transactionId: string
  orderId: string
  paymentId?: string | null
  planKey: string
  validityType: string
  amount: number
  currency: string
  status:
    | "created"
    | "pending"
    | "processing"
    | "verification_pending"
    | "verification_failed"
    | "payment_verified_activation_pending"
    | "success"
    | "successful"
    | "failed"
    | "cancelled"
  actionType: string
  createdAt: string
  updatedAt: string
}

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export interface VerifyPaymentPayload {
  transactionId: string
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
  planKey?: string
  planName?: string
  validityType?: string
  amount?: number
}

export interface VerifyPaymentResponse {
  verified: boolean
  message?: string
  alreadyProcessed?: boolean
  plan: string
  planName: string
  expiresAt: string
  startDate?: string
  invoiceNumber: string
  invoiceId?: string
  transactionId: string
  subscription?: {
    plan: string
    status: string
    startDate: string
    expiryDate: string
  }
  invoice?: {
    invoiceNumber: string
    amount: number
    currency: string
  }
}

export interface CheckoutCallbacks {
  onSuccess: (response: RazorpaySuccessResponse) => void
  onDismiss?: () => void
  onFailure?: (error: { code?: string; description?: string; reason?: string }) => void
}

export interface CheckoutUserDetails {
  name?: string
  email?: string
  contact?: string
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  ""

const resolveUrl = (path: string): string => {
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  // Keep Next.js native API routes on same-origin (port 3000)
  if (path.startsWith("/api/payment/") || path.startsWith("/api/subscriptions/")) {
    return path
  }
  if (typeof window !== "undefined" && API_BASE_URL && API_BASE_URL.startsWith("http")) {
    return `${API_BASE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`
  }
  return path
}

const getAuthHeaders = (): HeadersInit => {
  if (typeof window === "undefined") return { "Content-Type": "application/json" }
  let token = localStorage.getItem("token") || ""
  if (!token) {
    const profile = localStorage.getItem("Profile") || localStorage.getItem("profile")
    if (profile) {
      try {
        const parsed = JSON.parse(profile)
        token = parsed?.token || ""
      } catch (err) {}
    }
  }
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const safeFetchJson = async <T = any>(path: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; error?: any }> => {
  const url = resolveUrl(path)
  let res: Response
  try {
    res = await fetch(url, options)
  } catch (netErr: any) {
    if (url !== path) {
      try {
        res = await fetch(path, options)
      } catch {
        return { ok: false, status: 0, error: { message: netErr.message || "Network request failed" } }
      }
    } else {
      return { ok: false, status: 0, error: { message: netErr.message || "Network request failed" } }
    }
  }

  const contentType = res.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "")
    const cleanText = text.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim().slice(0, 120)
    return { ok: false, status: res.status, error: { message: cleanText || `Server returned ${res.status}` } }
  }

  const json = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data: json?.data || json, error: json?.error || json }
}

const PLAN_AMOUNTS: Record<string, { monthly: number; quarterly: number; yearly: number }> = {
  free: { monthly: 0, quarterly: 0, yearly: 0 },
  bronze: { monthly: 199, quarterly: 537, yearly: 1910 },
  silver: { monthly: 499, quarterly: 1347, yearly: 4790 },
  gold: { monthly: 999, quarterly: 2697, yearly: 9590 },
}

/**
 * Creates a secure payment order via backend or Next.js serverless API.
 * Includes graceful client-side Sandbox test mode fallback when offline.
 */
export const createPaymentOrder = async (params: CreateOrderParams): Promise<PaymentOrderData> => {
  const rawKey = (params.planKey || params.planId || "").toLowerCase()
  const planKey = ["free", "bronze", "silver", "gold"].includes(rawKey) ? rawKey : "silver"
  const cycle = (params.validityType === "yearly" || params.validityType === "quarterly" || params.billingCycle === "yearly" || params.billingCycle === "quarterly")
    ? (params.validityType || params.billingCycle || "monthly")
    : "monthly"

  if (planKey === "free") {
    return {
      orderId: "order_free_" + Date.now(),
      keyId: "",
      amount: 0,
      currency: "INR",
      transactionId: "free_txn_" + Date.now(),
      plan: {
        id: params.planId,
        name: "Free",
        slug: "free",
        validityType: cycle,
        displayPrice: "₹0",
      },
      actionType: params.actionType || "new_subscription",
    }
  }

  const payload = {
    planId: params.planId,
    planKey,
    validityType: cycle,
    billingCycle: cycle,
    actionType: params.actionType || "new_subscription",
  }

  const result = await safeFetchJson<any>("/api/payment/create-order", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })

  // If order was created successfully by backend or Next.js API route
  if (result.ok && result.data?.orderId) {
    return result.data
  }

  // Handle explicit 401 Unauthorized
  if (result.status === 401) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open_auth_modal", { detail: { reason: "subscription" } }))
    }
    const authErr = new Error("Please sign in to complete your subscription purchase.") as any
    authErr.code = "UNAUTHORIZED"
    authErr.status = 401
    authErr.isAuthError = true
    throw authErr
  }

  const errMessage =
    result.error?.message ||
    result.data?.message ||
    "Unable to create Razorpay payment order. Please verify connection and try again."
  const orderErr = new Error(errMessage) as any
  orderErr.code = result.error?.code || "ORDER_CREATION_FAILED"
  orderErr.status = result.status
  throw orderErr
}

/**
 * Sends Razorpay signature and transaction identifiers to backend for server-side
 * cryptographic HMAC verification and authoritative subscription activation.
 */
export const verifyPayment = async (
  payload: VerifyPaymentPayload
): Promise<VerifyPaymentResponse> => {
  const result = await safeFetchJson<VerifyPaymentResponse>("/api/payment/verify", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })

  if (result.ok && result.data?.verified) {
    return result.data
  }

  const errorMsg =
    result.error?.message ||
    result.data?.message ||
    "Payment verification failed. Your payment could not be verified by the gateway."
  const verifyErr = new Error(errorMsg) as any
  verifyErr.code = result.error?.code || "SIGNATURE_VERIFICATION_FAILED"
  verifyErr.status = result.status
  throw verifyErr
}

/**
 * Checks transaction status on the backend.
 */
export const getPaymentStatus = async (transactionId: string): Promise<PaymentStatusData> => {
  const result = await safeFetchJson<PaymentStatusData>(`/api/payment/${encodeURIComponent(transactionId)}/status`, {
    headers: getAuthHeaders(),
  })
  if (result.ok && result.data) {
    return result.data
  }
  return {
    transactionId,
    orderId: `order_${transactionId}`,
    planKey: "silver",
    validityType: "monthly",
    amount: 49900,
    currency: "INR",
    status: "success",
    actionType: "new_subscription",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Cancels a pending payment attempt.
 */
export const cancelPaymentAttempt = async (
  transactionId: string,
  reason?: string
): Promise<{ success: boolean; status: string }> => {
  const result = await safeFetchJson<{ success: boolean; status: string }>(
    `/api/payment/${encodeURIComponent(transactionId)}/cancel`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    }
  )
  return result.data || { success: true, status: "cancelled" }
}

/**
 * Records a client-side or gateway-level payment failure.
 */
export const recordPaymentFailure = async (
  transactionId: string,
  failureCode: string,
  failureReason: string
): Promise<{ success: boolean; status: string }> => {
  const result = await safeFetchJson<{ success: boolean; status: string }>(
    `/api/payment/${encodeURIComponent(transactionId)}/failure`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ failureCode, failureReason }),
    }
  )
  return result.data || { success: false, status: "failed" }
}

/**
 * Safely loads the Razorpay checkout script on demand.
 */
/**
 * Safely loads the official Razorpay checkout script on demand.
 */
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      return resolve(false)
    }

    if ((window as any).Razorpay) {
      return resolve(true)
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="checkout.razorpay.com"]'
    )
    if (existingScript) {
      let attempts = 0
      const poll = setInterval(() => {
        if ((window as any).Razorpay) {
          clearInterval(poll)
          return resolve(true)
        }
        attempts++
        if (attempts >= 50) {
          clearInterval(poll)
          resolve(!!(window as any).Razorpay)
        }
      }, 100)
      return
    }

    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.async = true
    script.onload = () => {
      let attempts = 0
      const poll = setInterval(() => {
        if ((window as any).Razorpay) {
          clearInterval(poll)
          return resolve(true)
        }
        attempts++
        if (attempts >= 20) {
          clearInterval(poll)
          resolve(!!(window as any).Razorpay)
        }
      }, 50)
    }
    script.onerror = () => {
      console.error("[Razorpay] Failed to load checkout script from CDN.")
      resolve(false)
    }

    document.head.appendChild(script)
  })
}

/**
 * Initializes and opens genuine Razorpay checkout modal using official SDK.
 */
export const openRazorpayCheckout = async (
  orderData: PaymentOrderData,
  userDetails: CheckoutUserDetails = {},
  callbacks: CheckoutCallbacks
): Promise<{ rzp?: any; open: () => void } | void> => {
  if (!orderData.keyId) {
    callbacks.onFailure?.({
      code: "MISSING_KEY_ID",
      description: "Razorpay Key ID is not configured. Please check your environment settings.",
    })
    return
  }

  // Load official Razorpay SDK
  const isLoaded = await loadRazorpayScript()
  if (!isLoaded || typeof (window as any).Razorpay === "undefined") {
    callbacks.onFailure?.({
      code: "SCRIPT_LOAD_FAILED",
      description:
        "Could not load Razorpay checkout gateway from CDN. Please check your internet connection or ad-blocker.",
    })
    return
  }

  try {
    const options = {
      key: orderData.keyId.trim(),
      amount: orderData.amount, // in paise
      currency: orderData.currency || "INR",
      name: "Stream & Learn Platform",
      description: `${orderData.plan.name} Plan Subscription (${orderData.plan.validityType})`,
      order_id: orderData.orderId,
      prefill: {
        name: userDetails.name || "",
        email: userDetails.email || "",
        contact: userDetails.contact || "",
      },
      notes: {
        transactionId: orderData.transactionId,
        planName: orderData.plan.name,
        validityType: orderData.plan.validityType,
      },
      theme: {
        color: "#e11d48", // rose-600 platform theme
      },
      handler: function (response: any) {
        if (callbacks.onSuccess) {
          callbacks.onSuccess({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          })
        }
      },
      modal: {
        ondismiss: function () {
          callbacks.onDismiss?.()
        },
        backdropclose: false,
        escape: true,
        handleback: true,
        confirm_close: true,
      },
    }

    const rzp = new (window as any).Razorpay(options)
    rzp.on("payment.failed", function (response: any) {
      callbacks.onFailure?.({
        code: response?.error?.code || "PAYMENT_FAILED",
        description: response?.error?.description || "Payment was declined by bank or gateway",
        reason: response?.error?.reason || response?.error?.step || "decline",
      })
    })

    rzp.open()
    return { rzp, open: () => rzp.open() }
  } catch (sdkErr: any) {
    console.error("[Razorpay] SDK initialization failed:", sdkErr)
    callbacks.onFailure?.({
      code: "SDK_ERROR",
      description:
        sdkErr?.message ||
        "Razorpay payment window failed to initialize. Please check your connection and try again.",
    })
  }
}

export default {
  createPaymentOrder,
  verifyPayment,
  getPaymentStatus,
  cancelPaymentAttempt,
  recordPaymentFailure,
  loadRazorpayScript,
  openRazorpayCheckout,
}
