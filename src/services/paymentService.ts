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
}

export interface VerifyPaymentResponse {
  verified: boolean
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

/**
 * Creates a secure payment order via backend API.
 * The backend calculates the final price and validates eligibility.
 */
export const createPaymentOrder = async (params: CreateOrderParams): Promise<PaymentOrderData> => {
  const planKey = (params.planKey || params.planId || "").toLowerCase()
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
        validityType: params.validityType || params.billingCycle || "monthly",
        displayPrice: "₹0",
      },
      actionType: params.actionType || "new_subscription",
    }
  }

  const payload = {
    planId: params.planId,
    planKey: params.planKey,
    validityType: params.validityType || params.billingCycle || "monthly",
    actionType: params.actionType,
  }

  const res = await fetch("/api/payment/create-order", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })

  const json = await res.json().catch(() => null)

  if (!res.ok || !json || !json.success) {
    const errorCode = json?.error?.code || json?.code || "ORDER_CREATION_FAILED"
    const errorMessage =
      json?.error?.message ||
      json?.message ||
      "Unable to create the payment order. Please check your connection and try again."

    if (
      errorMessage.toLowerCase().includes("free plan") ||
      errorCode === "INVALID_PLAN" ||
      planKey === "free"
    ) {
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
          validityType: params.validityType || params.billingCycle || "monthly",
          displayPrice: "₹0",
        },
        actionType: params.actionType || "new_subscription",
      }
    }

    // Check for auth / session expiration
    const isSessionExpired =
      res.status === 401 ||
      errorCode === "TOKEN_EXPIRED" ||
      errorCode === "INVALID_TOKEN" ||
      errorMessage.toLowerCase().includes("session expired") ||
      errorMessage.toLowerCase().includes("log in again")

    if (isSessionExpired) {
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("token")
          localStorage.removeItem("Profile")
          localStorage.removeItem("profile")
          window.dispatchEvent(new CustomEvent("auth_session_expired"))
        } catch (e) {}
      }
    }

    const error = new Error(errorMessage) as any
    error.code = errorCode
    error.isAuthError = isSessionExpired
    throw error
  }

  return json.data
}

/**
 * Sends Razorpay signature and transaction identifiers to backend for server-side
 * cryptographic HMAC verification and authoritative subscription activation.
 */
export const verifyPayment = async (
  payload: VerifyPaymentPayload
): Promise<VerifyPaymentResponse> => {
  const res = await fetch("/api/payment/verify", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })

  const json = await res.json().catch(() => null)
  if (!res.ok || !json || !json.success) {
    const error = new Error(
      json?.error?.message || json?.message || "Payment verification failed. Your subscription has not been activated."
    ) as any
    error.code = json?.error?.code || json?.code || "PAYMENT_VERIFICATION_FAILED"
    throw error
  }

  return json.data
}

/**
 * Checks transaction status on the backend.
 */
export const getPaymentStatus = async (transactionId: string): Promise<PaymentStatusData> => {
  const res = await fetch(`/api/payment/${encodeURIComponent(transactionId)}/status`, {
    headers: getAuthHeaders(),
  })

  const json = await res.json().catch(() => null)
  if (!res.ok || !json || !json.success) {
    throw new Error(json?.error?.message || json?.message || "Failed to retrieve transaction status")
  }

  return json.data
}

/**
 * Notifies the backend that a payment checkout window was dismissed or cancelled by the user.
 */
export const cancelPaymentAttempt = async (
  transactionId: string,
  reason: string = "User dismissed checkout modal"
): Promise<{ success: boolean; status: string }> => {
  const res = await fetch("/api/payment/cancel", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ transactionId, reason }),
  })

  const json = await res.json().catch(() => null)
  if (!res.ok || !json || !json.success) {
    return { success: false, status: "pending" }
  }

  return json.data
}

/**
 * Records a payment failure on the backend.
 */
export const recordPaymentFailure = async (
  transactionId: string,
  failureCode: string,
  failureReason: string
): Promise<{ success: boolean; status: string }> => {
  const res = await fetch("/api/payment/failure", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ transactionId, failureCode, failureReason }),
  })

  const json = await res.json().catch(() => null)
  if (!res.ok || !json || !json.success) {
    return { success: false, status: "failed" }
  }

  return json.data
}

/**
 * Safely loads the Razorpay checkout script on demand.
 */
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      return resolve(false)
    }

    if ((window as any).Razorpay) {
      return resolve(true)
    }

    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => {
      console.error("Failed to load Razorpay Checkout script.")
      resolve(false)
    }

    document.body.appendChild(script)
  })
}

/**
 * Initializes and opens Razorpay Test Mode checkout using safe order data.
 */
export const openRazorpayCheckout = async (
  orderData: PaymentOrderData,
  userDetails: CheckoutUserDetails = {},
  callbacks: CheckoutCallbacks
): Promise<void> => {
  const isLoaded = await loadRazorpayScript()
  if (!isLoaded) {
    throw new Error("Unable to load payment service. Please check your internet connection and try again.")
  }

  if (typeof (window as any).Razorpay === "undefined") {
    throw new Error("Razorpay SDK is unavailable.")
  }

  const options = {
    key: orderData.keyId,
    amount: orderData.amount, // in paise
    currency: orderData.currency || "INR",
    name: "Video & Learning Platform",
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
      color: "#e11d48", // rose-600 to match platform branding
    },
    handler: function (response: any) {
      // NOTE: DO NOT activate subscription here. Hand over to callback.
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
        if (callbacks.onDismiss) {
          callbacks.onDismiss()
        }
      },
      backdropclose: false,
      escape: true,
      handleback: true,
      confirm_close: true,
    },
  }

  const rzp = new (window as any).Razorpay(options)

  rzp.on("payment.failed", function (response: any) {
    if (callbacks.onFailure) {
      callbacks.onFailure({
        code: response?.error?.code,
        description: response?.error?.description,
        reason: response?.error?.reason,
      })
    }
  })

  rzp.open()
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
