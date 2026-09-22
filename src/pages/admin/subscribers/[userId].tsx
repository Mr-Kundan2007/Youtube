import React, { useState, useEffect } from "react"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import {
  User,
  ArrowLeft,
  Calendar,
  CreditCard,
  Crown,
  History,
  Receipt,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  ArrowDownCircle,
  Plus,
  Clock,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/AuthContext"
import AdminSubscriptionNav from "@/components/admin/AdminSubscriptionNav"
import {
  adminSubscriptionService,
  SubscriberProfileDetail,
} from "@/services/adminSubscriptionService"

export default function AdminSubscriberDetailPage() {
  const router = useRouter()
  const { userId } = router.query
  const { user: authUser, loading: authLoading }: any = useAuth()

  const [profile, setProfile] = useState<SubscriberProfileDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Action modal
  const [actionType, setActionType] = useState<"extend" | "suspend" | "restore" | "moveToFree" | null>(null)
  const [actionReason, setActionReason] = useState("")
  const [extendDays, setExtendDays] = useState(30)
  const [submittingAction, setSubmittingAction] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const isAdmin = authUser?.role === "admin" || authUser?.result?.role === "admin"

  const fetchProfile = async () => {
    if (!userId || typeof userId !== "string") return
    setLoading(true)
    setError(null)
    try {
      const data = await adminSubscriptionService.getSubscriberProfile(userId)
      setProfile(data)
    } catch (err: any) {
      console.error("Failed to load subscriber profile:", err)
      setError(err.response?.data?.message || err.message || "Failed to load subscriber profile")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && isAdmin && userId) {
      fetchProfile()
    }
  }, [authLoading, isAdmin, userId])

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || typeof userId !== "string" || !actionType) return

    if (!actionReason || actionReason.trim().length < 5) {
      setActionMsg({
        type: "error",
        text: "Please provide a reason of at least 5 characters for auditing.",
      })
      return
    }

    setSubmittingAction(true)
    setActionMsg(null)
    try {
      if (actionType === "extend") {
        await adminSubscriptionService.extendSubscriptionValidity(userId, Number(extendDays), actionReason)
      } else if (actionType === "suspend") {
        await adminSubscriptionService.suspendSubscription(userId, actionReason)
      } else if (actionType === "restore") {
        await adminSubscriptionService.restoreSubscription(userId, actionReason)
      } else if (actionType === "moveToFree") {
        await adminSubscriptionService.moveToFreeTier(userId, actionReason)
      }

      setActionMsg({ type: "success", text: `Action completed successfully.` })
      setTimeout(() => {
        setActionType(null)
        setActionReason("")
        setActionMsg(null)
        fetchProfile()
      }, 1500)
    } catch (err: any) {
      console.error("Action failed:", err)
      setActionMsg({
        type: "error",
        text: err.response?.data?.message || err.message || "Action failed to execute.",
      })
    } finally {
      setSubmittingAction(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-bold text-neutral-900 mb-2">Access Denied</h1>
        <p className="text-sm text-neutral-500 mb-4">Admin credentials required.</p>
        <Link href="/"><Button variant="outline">Home</Button></Link>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
        <h1 className="text-lg font-bold text-neutral-900 mb-1">Subscriber Not Found</h1>
        <p className="text-xs text-neutral-500 mb-4">{error || "Could not retrieve user details"}</p>
        <Link href="/admin/subscribers"><Button variant="outline" size="sm">Back to Subscribers</Button></Link>
      </div>
    )
  }

  const { user: subscriber, subscription, history = [], transactions = [], invoices = [], auditLogs = [] } = profile
  const isPaid = subscription.plan && subscription.plan.toLowerCase() !== "free"

  return (
    <>
      <Head>
        <title>{subscriber.name} — Subscriber Detail — Admin Suite</title>
      </Head>

      <div className="min-h-screen bg-neutral-50/60 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <AdminSubscriptionNav
          title={`Subscriber: ${subscriber.name}`}
          description={`Comprehensive 360-degree lifecycle view, payment transactions, invoices, and audit modifications.`}
          actionSlot={
            <Link href="/admin/subscribers">
              <Button variant="outline" size="sm" className="rounded-xl text-xs font-medium border-neutral-200">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Back to Directory
              </Button>
            </Link>
          }
        />

        {/* TOP PROFILE & CURRENT SUBSCRIPTION CARD */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Profile */}
          <div className="p-6 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-neutral-900 text-white flex items-center justify-center font-black text-lg uppercase">
                {subscriber.name?.[0] || "U"}
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900">{subscriber.name}</h2>
                <p className="text-xs text-neutral-500 truncate max-w-[200px]">{subscriber.email}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-500">User ID:</span>
                <span className="font-mono text-neutral-800 text-[11px] select-all">{subscriber.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Joined On:</span>
                <span className="text-neutral-800">
                  {subscriber.joinedOn ? new Date(subscriber.joinedOn).toLocaleDateString() : "Unknown"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Total Transactions:</span>
                <span className="font-bold text-neutral-900">{transactions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Invoices Issued:</span>
                <span className="font-bold text-neutral-900">{invoices.length}</span>
              </div>
            </div>
          </div>

          {/* Current Subscription Status */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
              <div>
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Active Subscription Tier
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl font-black text-neutral-900 uppercase tracking-tight flex items-center gap-1.5">
                    <Crown className="w-5 h-5 text-amber-500" />
                    {subscription.plan} Plan
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                      subscription.status === "active"
                        ? "bg-emerald-100 text-emerald-800"
                        : subscription.status === "suspended"
                        ? "bg-red-100 text-red-800"
                        : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {subscription.status}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActionType("extend")}
                  className="rounded-xl text-xs text-emerald-700 hover:bg-emerald-50 border-emerald-200 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Extend Validity
                </Button>

                {subscription.status === "suspended" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActionType("restore")}
                    className="rounded-xl text-xs text-blue-700 hover:bg-blue-50 border-blue-200 cursor-pointer"
                  >
                    <PlayCircle className="w-3.5 h-3.5 mr-1" />
                    Restore
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActionType("suspend")}
                    className="rounded-xl text-xs text-red-700 hover:bg-red-50 border-red-200 cursor-pointer"
                  >
                    <PauseCircle className="w-3.5 h-3.5 mr-1" />
                    Suspend
                  </Button>
                )}

                {isPaid && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActionType("moveToFree")}
                    className="rounded-xl text-xs text-neutral-600 hover:bg-neutral-100 cursor-pointer"
                  >
                    <ArrowDownCircle className="w-3.5 h-3.5 mr-1" />
                    Move to Free
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
              <div>
                <div className="text-neutral-400 text-[11px]">Billing Cycle</div>
                <div className="font-semibold text-neutral-800 capitalize">
                  {subscription.billingCycle || "Monthly"}
                </div>
              </div>
              <div>
                <div className="text-neutral-400 text-[11px]">Start Date</div>
                <div className="font-semibold text-neutral-800">
                  {subscription.startDate ? new Date(subscription.startDate).toLocaleDateString() : "—"}
                </div>
              </div>
              <div>
                <div className="text-neutral-400 text-[11px]">Expiry / Renews</div>
                <div className="font-semibold text-neutral-800">
                  {subscription.expiresAt || subscription.endDate
                    ? new Date(subscription.expiresAt || subscription.endDate!).toLocaleDateString()
                    : "Lifetime / None"}
                </div>
              </div>
              <div>
                <div className="text-neutral-400 text-[11px]">Auto Renew</div>
                <div className="font-semibold text-neutral-800">
                  {subscription.autoRenew ? "Enabled" : "Disabled"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LIFECYCLE HISTORY & AUDIT LOGS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Subscription History */}
          <div className="p-6 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <History className="w-4 h-4 text-neutral-500" />
              Subscription Lifecycle Events
            </h3>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {history.length === 0 ? (
                <div className="text-xs text-neutral-400">No subscription events recorded yet.</div>
              ) : (
                history.map((h) => (
                  <div key={h._id} className="p-3 rounded-xl bg-neutral-50 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-neutral-800">
                      <span className="capitalize">{h.action?.replace(/_/g, " ")}</span>
                      <span className="text-neutral-400 text-[10px]">
                        {new Date(h.performedAt).toLocaleString()}
                      </span>
                    </div>
                    {h.reason && <p className="text-neutral-500">{h.reason}</p>}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Admin Audit Logs */}
          <div className="p-6 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-neutral-500" />
              Admin Overrides & Audit Log
            </h3>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {auditLogs.length === 0 ? (
                <div className="text-xs text-neutral-400">No administrative changes made to this user yet.</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log._id} className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/60 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-amber-900">
                      <span className="uppercase">{log.action?.replace(/_/g, " ")}</span>
                      <span className="text-neutral-400 text-[10px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-neutral-600 font-medium">Reason: {log.reason}</p>
                    {log.adminId?.name && (
                      <div className="text-[10px] text-neutral-400">
                        Admin: {log.adminId.name} ({log.adminId.email})
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* TRANSACTIONS & INVOICES */}
        <div className="p-6 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-neutral-500" />
            Payment Transactions & Invoices
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-100 text-neutral-500 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Transaction ID</th>
                  <th className="py-2.5 px-3">Plan</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-neutral-400">
                      No payment transactions found for this user.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx._id} className="hover:bg-neutral-50/50">
                      <td className="py-2.5 px-3 font-mono text-neutral-800">{tx.transactionId}</td>
                      <td className="py-2.5 px-3 font-bold uppercase">{tx.planKey}</td>
                      <td className="py-2.5 px-3 font-bold text-neutral-900">₹{tx.amount}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            tx.status === "success" || tx.status === "successful"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-neutral-500 capitalize">{tx.paymentMethod}</td>
                      <td className="py-2.5 px-3 text-neutral-500">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ACTION MODAL */}
        {actionType && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-bold text-neutral-900 capitalize">
                  {actionType === "extend" && "Extend Subscription Validity"}
                  {actionType === "suspend" && "Suspend User Subscription"}
                  {actionType === "restore" && "Restore Subscription"}
                  {actionType === "moveToFree" && "Downgrade to Free Tier"}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setActionType(null)
                    setActionMsg(null)
                  }}
                  className="text-neutral-400 hover:text-neutral-600 font-bold"
                >
                  ✕
                </button>
              </div>

              {actionMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium ${
                    actionMsg.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  {actionMsg.text}
                </div>
              )}

              <form onSubmit={handleExecuteAction} className="space-y-4 text-xs">
                {actionType === "extend" && (
                  <div className="space-y-1">
                    <label className="font-semibold text-neutral-700">Days to Extend:</label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={extendDays}
                      onChange={(e) => setExtendDays(Number(e.target.value))}
                      className="rounded-xl text-xs"
                      required
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700">
                    Administrative Reason <span className="text-red-500">*</span> (Mandatory for Audit Trail)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide a clear justification (e.g. VIP extension, fraud investigation)..."
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 p-2 text-xs focus:ring-1 focus:ring-neutral-900 outline-none"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setActionType(null)
                      setActionMsg(null)
                    }}
                    className="rounded-xl text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submittingAction}
                    className={`rounded-xl text-xs text-white ${
                      actionType === "suspend"
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-neutral-900 hover:bg-neutral-800"
                    }`}
                  >
                    {submittingAction ? "Executing..." : "Confirm"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
