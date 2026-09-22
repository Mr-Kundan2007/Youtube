import React, { useState } from "react"
import { useRouter } from "next/router"
import {
  X,
  ShieldCheck,
  Sparkles,
  Crown,
  Zap,
  ArrowRight,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Loader2,
  XCircle,
  RotateCcw,
  Play,
  LayoutDashboard,
  LogIn,
  CreditCard,
} from "lucide-react"
import {
  SubscriptionPlan,
  BillingCycleKey,
  formatPrice,
  getPlanCyclePricing,
  changeSubscriptionPlan,
  PlanChangeResponse,
} from "@/services/subscriptionService"
import {
  createPaymentOrder,
  openRazorpayCheckout,
  cancelPaymentAttempt,
  recordPaymentFailure,
  verifyPayment,
  getPaymentStatus,
  PaymentOrderData,
  RazorpaySuccessResponse,
  VerifyPaymentResponse,
} from "@/services/paymentService"

interface PurchaseConfirmationModalProps {
  plan: SubscriptionPlan | null
  isOpen: boolean
  onClose: () => void
  selectedCycle: BillingCycleKey
  onCycleChange: (cycle: BillingCycleKey) => void
  currentPlanSlug?: string
  userEmail?: string
  userName?: string
  onProceedToPayment?: (checkoutData: {
    planId: string
    planSlug: string
    billingCycle: BillingCycleKey
    amount: number
    actionType: "upgrade" | "downgrade" | "renew" | "new_subscription"
    transactionId?: string
    orderId?: string
  }) => void
}

type ModalPaymentState =
  | "review"
  | "creating_order"
  | "opening_payment"
  | "verifying"
  | "payment_success"
  | "verification_failed"
  | "activation_pending"
  | "failed"
  | "cancelled"
  | "downgrading"
  | "downgrade_success"
  | "already_active"
  | "session_expired"

export const PurchaseConfirmationModal: React.FC<PurchaseConfirmationModalProps> = ({
  plan,
  isOpen,
  onClose,
  selectedCycle,
  onCycleChange,
  currentPlanSlug = "free",
  userEmail = "",
  userName = "",
  onProceedToPayment,
}) => {
  const router = useRouter()
  const [paymentState, setPaymentState] = useState<ModalPaymentState>("review")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [currentOrder, setCurrentOrder] = useState<PaymentOrderData | null>(null)
  const [successInfo, setSuccessInfo] = useState<RazorpaySuccessResponse | null>(null)
  const [verifiedData, setVerifiedData] = useState<VerifyPaymentResponse | null>(null)
  const [downgradeInfo, setDowngradeInfo] = useState<PlanChangeResponse | null>(null)

  if (!isOpen || !plan) return null

  const planSlug = (plan.slug || (plan as any).key || (plan as any).name || "").toLowerCase()
  const currentSlug = (currentPlanSlug || "free").toLowerCase()
  const pricing = getPlanCyclePricing(plan, selectedCycle)
  const isFreePlan =
    planSlug === "free" ||
    (plan.price !== undefined && plan.price <= 0) ||
    (pricing && pricing.price <= 0) ||
    (plan.name && plan.name.toLowerCase() === "free")
  const isCurrentPlan = currentSlug === planSlug

  // Calculate projected renewal date
  const now = new Date()
  const daysToAdd =
    pricing.durationDays ||
    (selectedCycle === "yearly" ? 365 : selectedCycle === "quarterly" ? 90 : 30)
  const projectedExpiry = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
  const expiryFormatted = projectedExpiry.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  // Action type calculation
  const planRank = plan.rank || (planSlug === "gold" ? 4 : planSlug === "silver" ? 3 : planSlug === "bronze" ? 2 : 1)
  const currentRank =
    currentSlug === "gold"
      ? 4
      : currentSlug === "silver"
      ? 3
      : currentSlug === "bronze"
      ? 2
      : 1

  let actionType: "upgrade" | "downgrade" | "renew" | "new_subscription" = "new_subscription"
  if (isCurrentPlan) {
    actionType = "renew"
  } else if (currentSlug === "free" && !isFreePlan) {
    actionType = "new_subscription"
  } else if (planRank > currentRank) {
    actionType = "upgrade"
  } else if (planRank === currentRank) {
    actionType = "renew"
  } else {
    actionType = "downgrade"
  }

  const isDowngrade = actionType === "downgrade" || planRank < currentRank

  // Handle Close / Dismiss
  const handleModalClose = async () => {
    if (
      currentOrder &&
      (paymentState === "creating_order" ||
        paymentState === "opening_payment" ||
        paymentState === "review")
    ) {
      await cancelPaymentAttempt(
        currentOrder.transactionId,
        "Modal closed during checkout preparation"
      ).catch(() => {})
    }
    setPaymentState("review")
    setErrorMessage(null)
    setCurrentOrder(null)
    setSuccessInfo(null)
    setVerifiedData(null)
    setDowngradeInfo(null)
    onClose()
  }

  // Handle Free Activation or Plan Downgrade without Payment
  const handlePlanChangeWithoutPayment = async () => {
    setErrorMessage(null)

    if (isCurrentPlan) {
      setPaymentState("already_active")
      return
    }

    setPaymentState("downgrading")
    try {
      const result = await changeSubscriptionPlan(plan.slug)
      setDowngradeInfo(result)
      setPaymentState("downgrade_success")

      // Notify rest of the app to refresh user subscription cache
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("subscription_updated"))
      }
    } catch (err: any) {
      console.error("Plan change error:", err)
      const errLower = (err.message || "").toLowerCase()
      if (errLower.includes("already on this") || errLower.includes("same_plan")) {
        setPaymentState("already_active")
      } else {
        setErrorMessage(err.message || "Failed to update subscription plan. Please try again.")
        setPaymentState("failed")
      }
    }
  }

  // Handle Checkout Execution
  const handleStartPayment = async () => {
    // CRITICAL GUARD: Free plan or Downgrades do not require payment orders
    if (isFreePlan || isDowngrade || pricing.price <= 0) {
      await handlePlanChangeWithoutPayment()
      return
    }

    // Pre-check authentication: verify user has an active token or user profile
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token") ||
          localStorage.getItem("Profile") ||
          localStorage.getItem("profile") ||
          localStorage.getItem("user")
        : null

    if (!token && !userEmail && !userName) {
      setPaymentState("session_expired")
      return
    }

    setErrorMessage(null)
    setPaymentState("creating_order")

    try {
      // 1. Request secure payment order from backend
      const order = await createPaymentOrder({
        planId: plan._id || (plan as any).id,
        planKey: plan.slug,
        validityType: selectedCycle,
        actionType,
      })

      setCurrentOrder(order)
      setPaymentState("opening_payment")

      // Notify parent if listener provided
      onProceedToPayment?.({
        planId: plan._id || (plan as any).id,
        planSlug: plan.slug,
        billingCycle: selectedCycle,
        amount: pricing.price,
        actionType,
        transactionId: order.transactionId,
        orderId: order.orderId,
      })

      // 2. Open official Razorpay checkout modal
      await openRazorpayCheckout(
        order,
        {
          name: userName,
          email: userEmail,
        },
        {
          onSuccess: async (resp) => {
            setSuccessInfo(resp)
            setPaymentState("verifying")

            try {
              const verifyRes = await verifyPayment({
                transactionId: order.transactionId,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_signature: resp.razorpay_signature,
                planKey: plan.slug,
                planName: plan.name,
                validityType: selectedCycle,
                amount: pricing.price,
              })

              setVerifiedData(verifyRes)
              setPaymentState("payment_success")

              // Save to localStorage immediately so client UI refreshes
              if (typeof window !== "undefined") {
                const subObj = {
                  plan: plan.slug,
                  currentPlan: {
                    name: plan.name,
                    slug: plan.slug,
                    validityType: selectedCycle,
                    price: pricing.price,
                  },
                  status: "active",
                  expiryDate: verifyRes.expiresAt,
                  remainingDays:
                    selectedCycle === "yearly" ? 365 : selectedCycle === "quarterly" ? 90 : 30,
                }
                localStorage.setItem("active_subscription", JSON.stringify(subObj))
                window.dispatchEvent(new CustomEvent("subscription_updated"))
              }
            } catch (vErr: any) {
              console.warn("Payment verification failure:", vErr?.message || vErr)
              if (vErr.code === "SUBSCRIPTION_ACTIVATION_FAILED") {
                setPaymentState("activation_pending")
              } else {
                setErrorMessage(
                  vErr.message ||
                    "Payment signature verification failed. Your subscription has not been activated."
                )
                setPaymentState("verification_failed")
              }
            }
          },
          onDismiss: async () => {
            await cancelPaymentAttempt(
              order.transactionId,
              "User dismissed Razorpay checkout window"
            ).catch(() => {})
            setPaymentState("cancelled")
          },
          onFailure: async (err) => {
            await recordPaymentFailure(
              order.transactionId,
              err.code || "PAYMENT_FAILED",
              err.description || err.reason || "Payment was declined"
            ).catch(() => {})
            setErrorMessage(err.description || err.reason || "Payment was declined by gateway.")
            setPaymentState("failed")
          },
        }
      )
    } catch (err: any) {
      console.warn("Order creation or checkout notice:", err?.message || err)
      const errLower = (err.message || "").toLowerCase()
      if (
        err.isAuthError ||
        err.code === "TOKEN_EXPIRED" ||
        err.code === "INVALID_TOKEN" ||
        errLower.includes("session expired") ||
        errLower.includes("log in") ||
        errLower.includes("unauthorized")
      ) {
        setPaymentState("session_expired")
        return
      }
      setErrorMessage(
        err.message || "Unable to initiate payment. Please check your connection and try again."
      )
      setPaymentState("failed")
    }
  }

  // Handle Recovery Check for Activation Pending
  const handleCheckStatus = async () => {
    if (!currentOrder) return
    try {
      const statusData = await getPaymentStatus(currentOrder.transactionId)
      if (statusData.status === "success" || statusData.status === "successful") {
        setPaymentState("payment_success")
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("subscription_updated"))
        }
      } else if (statusData.status === "verification_failed" || statusData.status === "failed") {
        setPaymentState("verification_failed")
      }
    } catch (sErr: any) {
      console.warn("Status check notice:", sErr.message)
    }
  }

  // Plan Key Features List
  const getPlanBenefits = () => {
    if (planSlug === "gold") {
      return [
        "4K Ultra HD Streaming Quality",
        "50 Offline Downloads per day",
        "100% Ad-Free Viewing Experience",
        "Access to All Premium & Exclusive Courses",
        "Priority Servers & VIP Support",
        "Up to 5 Concurrent Devices",
      ]
    }
    if (planSlug === "silver") {
      return [
        "1080p Full HD Streaming Quality",
        "15 Offline Downloads per day",
        "Ad-Free Viewing Experience",
        "Access to All Premium Courses",
        "Fast CDN Video Streaming",
        "Up to 2 Concurrent Devices",
      ]
    }
    if (planSlug === "bronze") {
      return [
        "720p HD Streaming Quality",
        "5 Offline Downloads per day",
        "Standard Streaming Speed",
        "6 Hours Daily Watch Time",
        "Single Device Streaming",
      ]
    }
    return [
      "Standard 720p Video Streaming",
      "1 Daily Offline Download",
      "Access to All Public Videos",
      "2 Hours Daily Watch Time",
      "Single Device Streaming",
    ]
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-700 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Close button */}
        <button
          type="button"
          onClick={handleModalClose}
          aria-label="Close"
          disabled={paymentState === "creating_order" || paymentState === "verifying" || paymentState === "downgrading"}
          className="absolute top-5 right-5 p-2 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition cursor-pointer disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* STATE: CREATING ORDER */}
        {paymentState === "creating_order" && (
          <div className="text-center py-12 space-y-5">
            <div className="relative w-16 h-16 mx-auto">
              <Loader2 className="w-16 h-16 text-red-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-red-400" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Preparing Secure Payment...</h3>
              <p className="text-sm text-neutral-400 max-w-xs mx-auto">
                Setting up your official Razorpay order for {plan.name} ({selectedCycle}).
              </p>
            </div>
          </div>
        )}

        {/* STATE: OPENING PAYMENT / GATEWAY ACTIVE */}
        {paymentState === "opening_payment" && (
          <div className="text-center py-8 space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center text-white mx-auto shadow-xl shadow-red-600/30 animate-pulse">
              <CreditCard className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-white">Razorpay Checkout Active</h3>
              <p className="text-xs sm:text-sm text-neutral-300 max-w-sm mx-auto leading-relaxed">
                Please complete your transaction in the Razorpay checkout window (UPI QR, Cards, or NetBanking).
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 text-xs text-neutral-400 max-w-sm mx-auto space-y-1.5 text-left">
              <div className="flex justify-between">
                <span>Plan:</span>
                <span className="font-semibold text-white uppercase">{plan.name} ({selectedCycle})</span>
              </div>
              <div className="flex justify-between">
                <span>Amount:</span>
                <span className="font-bold text-emerald-400">{formatPrice(pricing.price, plan.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Order Reference:</span>
                <span className="font-mono text-neutral-300">{currentOrder?.orderId || "Creating..."}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 max-w-sm mx-auto">
              <button
                type="button"
                onClick={handleStartPayment}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Re-open Razorpay</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentState("review")}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold cursor-pointer"
              >
                Cancel Payment
              </button>
            </div>
          </div>
        )}

        {/* STATE: DOWNGRADING (IN PROGRESS) */}
        {paymentState === "downgrading" && (
          <div className="text-center py-12 space-y-5">
            <div className="relative w-16 h-16 mx-auto">
              <Loader2 className="w-16 h-16 text-amber-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-amber-400" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Scheduling Plan Transition...</h3>
              <p className="text-sm text-neutral-400 max-w-xs mx-auto">
                Updating your account settings to transition to {plan.name}.
              </p>
            </div>
          </div>
        )}

        {/* STATE: DOWNGRADE SUCCESS */}
        {paymentState === "downgrade_success" && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider">
                Downgrade Scheduled 🎉
              </span>
              <h3 className="text-2xl font-black text-white">
                Transition to {plan.name} Confirmed
              </h3>
            </div>
            <p className="text-sm text-neutral-300 leading-relaxed max-w-sm mx-auto">
              Your change has been scheduled. You will continue to enjoy your full <strong>{currentPlanSlug.toUpperCase()}</strong> privileges until your billing period concludes on{" "}
              <strong>
                {downgradeInfo?.effectiveDate
                  ? new Date(downgradeInfo.effectiveDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : expiryFormatted}
              </strong>.
            </p>

            <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-2 text-xs text-left max-w-sm mx-auto">
              <div className="flex justify-between text-neutral-400">
                <span>Current Tier:</span>
                <span className="font-semibold text-white uppercase">{currentPlanSlug} (Active)</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Scheduled Tier:</span>
                <span className="font-semibold text-amber-400 uppercase">{plan.name}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Effective Date:</span>
                <span className="text-white font-medium">
                  {downgradeInfo?.effectiveDate
                    ? new Date(downgradeInfo.effectiveDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : expiryFormatted}
                </span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Charges:</span>
                <span className="text-emerald-400 font-bold uppercase">₹0 (No Payment)</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => {
                  handleModalClose()
                  router.push("/subscription")
                }}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Go to Dashboard</span>
              </button>
              <button
                type="button"
                onClick={handleModalClose}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-semibold transition cursor-pointer"
              >
                Back to Plans
              </button>
            </div>
          </div>
        )}

        {/* STATE: ALREADY ACTIVE */}
        {paymentState === "already_active" && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider">
                Active Membership
              </span>
              <h3 className="text-2xl font-black text-white">
                You're Already on {plan.name}
              </h3>
            </div>
            <p className="text-sm text-neutral-300 leading-relaxed max-w-sm mx-auto">
              Your {plan.name} membership is already active on this account. All features and quotas are available to you right now. No payment is required.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  handleModalClose()
                  router.push("/explore")
                }}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>Start Watching</span>
              </button>
              <button
                type="button"
                onClick={handleModalClose}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-semibold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* STATE: VERIFYING (SERVER-SIDE HMAC VERIFICATION IN PROGRESS) */}
        {paymentState === "verifying" && (
          <div className="text-center py-12 space-y-5">
            <div className="relative w-16 h-16 mx-auto">
              <Loader2 className="w-16 h-16 text-emerald-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Verifying Your Payment...</h3>
              <p className="text-sm text-neutral-400 max-w-sm mx-auto">
                Please wait while our server securely verifies the cryptographic signature with
                Razorpay and activates your {plan.name} membership.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Server-Side HMAC SHA256 Verification</span>
            </div>
          </div>
        )}

        {/* STATE: PAYMENT SUCCESS & ACTIVATION CONFIRMED */}
        {paymentState === "payment_success" && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider">
                Payment Verified & Activated 🎉
              </span>
              <h3 className="text-2xl font-black text-white">
                Your {plan.name} Subscription is Active!
              </h3>
            </div>
            <p className="text-sm text-neutral-300 leading-relaxed max-w-sm mx-auto">
              Thank you! Your payment of{" "}
              <strong>{formatPrice(pricing.price, plan.currency)}</strong> was verified successfully.
              All premium features are now unlocked.
            </p>

            {/* Receipt Summary Box */}
            <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-2 text-xs text-left max-w-sm mx-auto">
              <div className="flex justify-between text-neutral-400">
                <span>Plan:</span>
                <span className="font-semibold text-white uppercase">{plan.name} ({selectedCycle})</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Transaction ID:</span>
                <span className="font-mono text-neutral-300">
                  {verifiedData?.transactionId || currentOrder?.transactionId || "N/A"}
                </span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Invoice Number:</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {verifiedData?.invoiceNumber || "INV-Generated"}
                </span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Active Until:</span>
                <span className="text-white font-medium">
                  {verifiedData?.expiresAt
                    ? new Date(verifiedData.expiresAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : expiryFormatted}
                </span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Status:</span>
                <span className="text-emerald-400 font-bold uppercase">Active & Verified</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => {
                  handleModalClose()
                  router.push("/subscription")
                }}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Go to Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleModalClose()
                  router.push("/explore")
                }}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Play className="w-4 h-4 text-red-500" />
                <span>Start Watching</span>
              </button>
            </div>
          </div>
        )}

        {/* STATE: VERIFICATION FAILED */}
        {paymentState === "verification_failed" && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto shadow-lg">
              <XCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">Payment Verification Failed</h3>
              <p className="text-sm text-neutral-300 max-w-sm mx-auto">
                {errorMessage ||
                  "We could not verify this payment. Your subscription has not been activated."}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/20 text-rose-300 text-xs max-w-sm mx-auto text-left">
              If your card was charged, do not worry: our server preserves your payment attempt ID (
              <span className="font-mono text-white">{currentOrder?.transactionId || "N/A"}</span>
              ). Please contact support with this reference.
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
              <button
                type="button"
                onClick={handleStartPayment}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
              <button
                type="button"
                onClick={handleModalClose}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-semibold transition cursor-pointer"
              >
                Back to Plans
              </button>
            </div>
          </div>
        )}

        {/* STATE: ACTIVATION PENDING */}
        {paymentState === "activation_pending" && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-lg">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">Payment Confirmed — Activation Pending</h3>
              <p className="text-sm text-neutral-300 max-w-sm mx-auto">
                Your payment was verified, but your subscription is still being finalized by the
                system.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
              <button
                type="button"
                onClick={handleCheckStatus}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Check Status</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleModalClose()
                  router.push("/subscription")
                }}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-semibold transition cursor-pointer"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* STATE: CANCELLED (DISMISSED) */}
        {paymentState === "cancelled" && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-lg">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">Payment Cancelled</h3>
              <p className="text-sm text-neutral-400 max-w-sm mx-auto">
                No payment was completed. Your subscription has not changed.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
              <button
                type="button"
                onClick={isFreePlan || isDowngrade ? handlePlanChangeWithoutPayment : handleStartPayment}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
              <button
                type="button"
                onClick={handleModalClose}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-semibold transition cursor-pointer"
              >
                Back to Plans
              </button>
            </div>
          </div>
        )}

        {/* STATE: FAILED */}
        {paymentState === "failed" && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto shadow-lg">
              <XCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">
                {isFreePlan || isDowngrade ? "Plan Update Notice" : "Payment Failed"}
              </h3>
              <p className="text-sm text-neutral-300 max-w-sm mx-auto">
                {errorMessage?.includes("free plan")
                  ? "The Free membership does not require a payment order. Please click below to confirm your free plan switch."
                  : errorMessage || "Your request could not be completed. Please try again."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
              <button
                type="button"
                onClick={isFreePlan || isDowngrade ? handlePlanChangeWithoutPayment : handleStartPayment}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isFreePlan || isDowngrade ? "Confirm Plan Switch" : "Try Again"}</span>
              </button>
              <button
                type="button"
                onClick={handleModalClose}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-semibold transition cursor-pointer"
              >
                Back to Plans
              </button>
            </div>
          </div>
        )}

        {/* STATE: SESSION EXPIRED */}
        {paymentState === "session_expired" && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-lg">
              <LogIn className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <span className="text-xs uppercase font-bold text-amber-400 tracking-wider">
                Authentication Required
              </span>
              <h3 className="text-xl font-bold text-white">Session Expired</h3>
              <p className="text-sm text-neutral-300 max-w-sm mx-auto">
                Your login session has expired. Please log in again to continue your subscription to the{" "}
                <strong>{plan.name}</strong> plan.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  handleModalClose()
                  const returnUrl = `/subscriptions?plan=${plan.slug}&validity=${selectedCycle}`
                  router.push(`/auth/login?redirect=${encodeURIComponent(returnUrl)}`)
                }}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Log In to Continue</span>
              </button>
              <button
                type="button"
                onClick={handleModalClose}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* STATE: REVIEW (SUMMARY & BILLING SELECTION / DOWNGRADE CONFIRMATION) */}
        {paymentState === "review" && (
          <>
            {isCurrentPlan ? (
              /* ALREADY CURRENT PLAN VIEW */
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider">
                    Current Plan Active
                  </span>
                  <h3 id="confirmation-modal-title" className="text-2xl font-black text-white">
                    You're Already on {plan.name}
                  </h3>
                </div>
                <p className="text-sm text-neutral-300 leading-relaxed max-w-sm mx-auto">
                  Your account is currently active with {plan.name} membership privileges. No payment, billing cycle, or renewal is required.
                </p>

                {/* Plan Benefits Checklist */}
                <div className="p-3.5 rounded-2xl bg-neutral-950/60 border border-neutral-800 space-y-1.5 text-left">
                  <span className="text-[11px] uppercase font-bold text-neutral-400 tracking-wider block mb-1">
                    Your Included Benefits
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-neutral-300">
                    {getPlanBenefits().map((benefit, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-3">
                  <button
                    type="button"
                    onClick={handleStartPayment}
                    className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Renew / Extend Plan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleModalClose()
                      router.push("/explore")
                    }}
                    className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Play className="w-4 h-4 text-red-500" />
                    <span>Start Watching</span>
                  </button>
                </div>
              </div>
            ) : isDowngrade || isFreePlan ? (
              /* DOWNGRADE OR FREE PLAN CONFIRMATION (NO PAYMENT REQUIRED) */
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-600 flex items-center justify-center text-white shadow-lg shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-bold text-amber-400 tracking-wider">
                      {isFreePlan ? "Switch to Free Membership" : `Downgrade to ${plan.name}`}
                    </span>
                    <h3 id="confirmation-modal-title" className="text-xl sm:text-2xl font-black text-white">
                      {plan.name} Membership
                    </h3>
                  </div>
                </div>

                {/* Notice Banner */}
                <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 mb-4 leading-relaxed flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Downgrades take effect automatically at the conclusion of your current billing period (
                    <strong>{expiryFormatted}</strong>). You retain all your active <strong>{currentPlanSlug.toUpperCase()}</strong> benefits until then. <strong>No payment is required today.</strong>
                  </span>
                </div>

                {/* Plan Benefits Checklist */}
                <div className="mb-4 p-3.5 rounded-2xl bg-neutral-950/60 border border-neutral-800 space-y-1.5">
                  <span className="text-[11px] uppercase font-bold text-neutral-400 tracking-wider block mb-1">
                    Features Included in {plan.name}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-neutral-300">
                    {getPlanBenefits().map((benefit, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary Box */}
                <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-2 mb-4 text-xs">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span>Current Plan:</span>
                    <span className="font-bold text-white uppercase">{currentPlanSlug} (Active)</span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-400">
                    <span>Target Plan:</span>
                    <span className="font-bold text-amber-400 uppercase">{plan.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-400">
                    <span>Transition Date:</span>
                    <span className="font-medium text-neutral-200 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                      {expiryFormatted}
                    </span>
                  </div>
                  <div className="pt-2.5 border-t border-neutral-800 flex items-center justify-between text-sm">
                    <span className="font-bold text-white">Amount Due Today:</span>
                    <span className="text-xl font-extrabold text-emerald-400">₹0 (Free)</span>
                  </div>
                </div>

                {/* Error Message if any */}
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs mb-4 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handlePlanChangeWithoutPayment}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-sm font-bold shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <span>{isFreePlan ? "Confirm Downgrade to Free" : `Schedule Downgrade to ${plan.name}`}</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              /* PAID UPGRADE / RENEWAL VIEW (RAZORPAY TEST MODE) */
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center text-white shadow-lg shrink-0">
                    {planSlug === "gold" ? (
                      <Crown className="w-6 h-6" />
                    ) : planSlug === "silver" ? (
                      <Sparkles className="w-6 h-6" />
                    ) : planSlug === "bronze" ? (
                      <Zap className="w-6 h-6" />
                    ) : (
                      <ShieldCheck className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-bold text-red-400 tracking-wider">
                      Review & Confirm Plan
                    </span>
                    <h3 id="confirmation-modal-title" className="text-xl sm:text-2xl font-black text-white">
                      {plan.name} Membership
                    </h3>
                  </div>
                </div>

                {/* Cycle Selector within modal */}
                <div className="mb-4">
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                    Billing Cycle
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["monthly", "quarterly", "yearly"] as BillingCycleKey[]).map((cycle) => {
                      const isSel = selectedCycle === cycle
                      const cPrice = getPlanCyclePricing(plan, cycle)
                      return (
                        <button
                          key={cycle}
                          type="button"
                          onClick={() => onCycleChange(cycle)}
                          className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                            isSel
                              ? "bg-red-600 text-white border-red-500 font-bold shadow-md shadow-red-600/30"
                              : "bg-neutral-950/60 text-neutral-300 border-neutral-800 hover:bg-neutral-800/50"
                          }`}
                        >
                          <div className="text-xs capitalize">{cycle}</div>
                          <div className="text-[11px] mt-0.5 opacity-90">
                            {formatPrice(cPrice.price, plan.currency)}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Plan Benefits Checklist */}
                <div className="mb-4 p-3.5 rounded-2xl bg-neutral-950/60 border border-neutral-800 space-y-1.5">
                  <span className="text-[11px] uppercase font-bold text-neutral-400 tracking-wider block mb-1">
                    Included Benefits
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-neutral-300">
                    {getPlanBenefits().map((benefit, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order Summary Box */}
                <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-2 mb-4 text-xs">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span>Selected Plan:</span>
                    <span className="font-bold text-white uppercase">{plan.name} ({planSlug})</span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-400">
                    <span>Billing Period:</span>
                    <span className="font-semibold text-neutral-200 capitalize">
                      {selectedCycle} ({daysToAdd} days)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-400">
                    <span>Action:</span>
                    <span className="font-semibold text-rose-400 capitalize">{actionType.replace("_", " ")}</span>
                  </div>
                  {pricing.discountPercent > 0 && (
                    <div className="flex items-center justify-between text-emerald-400">
                      <span>Special Discount:</span>
                      <span className="font-bold">
                        -{pricing.discountPercent}% ({formatPrice(pricing.savings, plan.currency)} saved)
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-neutral-400">
                    <span>Validity Preview:</span>
                    <span className="font-medium text-neutral-300 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                      Active until {expiryFormatted}
                    </span>
                  </div>

                  <div className="pt-2.5 border-t border-neutral-800 flex items-center justify-between text-sm">
                    <span className="font-bold text-white">Total Payable:</span>
                    <span className="text-xl font-extrabold text-white">
                      {formatPrice(pricing.price, plan.currency)}
                    </span>
                  </div>
                </div>

                {/* Error Message if any */}
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs mb-4 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Razorpay Gateway Badge Notice */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-400 text-xs mb-5 leading-relaxed">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <span>
                    <strong>Razorpay Secure Checkout:</strong> 256-bit encrypted gateway with server-side HMAC-SHA256 signature verification. Supports UPI QR, Cards, and NetBanking.
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleStartPayment}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <span>Proceed to Payment</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default PurchaseConfirmationModal
