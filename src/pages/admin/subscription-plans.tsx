import React, { useState, useEffect } from "react"
import Head from "next/head"
import Link from "next/link"
import {
  Layers,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Crown,
  Users,
  DollarSign,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Shield,
  Sliders,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/AuthContext"
import AdminSubscriptionNav from "@/components/admin/AdminSubscriptionNav"
import {
  adminSubscriptionService,
  SubscriptionPlanItem,
} from "@/services/adminSubscriptionService"

export default function AdminSubscriptionPlansPage() {
  const { user, loading: authLoading }: any = useAuth()
  const [plans, setPlans] = useState<SubscriptionPlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanItem | null>(null)
  const [updateReason, setUpdateReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Toggle modal state
  const [togglingPlan, setTogglingPlan] = useState<SubscriptionPlanItem | null>(null)
  const [toggleReason, setToggleReason] = useState("")

  const isAdmin = user?.role === "admin" || user?.result?.role === "admin"

  const fetchPlans = async () => {
    setLoading(true)
    try {
      const data = await adminSubscriptionService.getPlans()
      setPlans(data)
    } catch (err: any) {
      console.error("Failed to load plans:", err)
      setFeedback({
        type: "error",
        message: err.response?.data?.message || err.message || "Failed to load plans.",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchPlans()
    }
  }, [authLoading, isAdmin])

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPlan) return

    if (!updateReason || updateReason.trim().length < 3) {
      setFeedback({ type: "error", message: "A valid administrative reason (min 3 chars) is required." })
      return
    }

    setSubmitting(true)
    setFeedback(null)
    try {
      await adminSubscriptionService.updatePlan(
        editingPlan._id,
        {
          price: Number(editingPlan.price),
          description: editingPlan.description,
          features: editingPlan.features,
          limits: editingPlan.limits,
          isPopular: editingPlan.isPopular,
        },
        updateReason
      )

      setFeedback({ type: "success", message: `Plan '${editingPlan.name}' updated successfully.` })
      setTimeout(() => {
        setEditingPlan(null)
        setUpdateReason("")
        setFeedback(null)
        fetchPlans()
      }, 1200)
    } catch (err: any) {
      console.error("Failed to update plan:", err)
      setFeedback({
        type: "error",
        message: err.response?.data?.message || err.message || "Plan update failed.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!togglingPlan) return

    if (!toggleReason || toggleReason.trim().length < 3) {
      setFeedback({ type: "error", message: "A reason is required to toggle plan status." })
      return
    }

    setSubmitting(true)
    setFeedback(null)
    try {
      await adminSubscriptionService.togglePlanStatus(
        togglingPlan._id,
        !togglingPlan.isActive,
        toggleReason
      )

      setFeedback({
        type: "success",
        message: `Plan '${togglingPlan.name}' is now ${!togglingPlan.isActive ? "Active" : "Inactive"}.`,
      })
      setTimeout(() => {
        setTogglingPlan(null)
        setToggleReason("")
        setFeedback(null)
        fetchPlans()
      }, 1200)
    } catch (err: any) {
      console.error("Failed to toggle plan status:", err)
      setFeedback({
        type: "error",
        message: err.response?.data?.message || err.message || "Toggle failed.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
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
        <p className="text-sm text-neutral-500 mb-4">Admin credentials required to view plan management.</p>
        <Link href="/"><Button variant="outline">Home</Button></Link>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Subscription Plan Management — Admin Suite</title>
      </Head>

      <div className="min-h-screen bg-neutral-50/60 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <AdminSubscriptionNav
          title="Subscription Plan Configurations"
          description="Adjust tier pricing, streaming qualities, daily download limits, and feature flags with full administrative version control."
          actionSlot={
            <Button
              onClick={fetchPlans}
              variant="outline"
              size="sm"
              className="rounded-xl bg-white hover:bg-neutral-100 text-xs font-medium cursor-pointer border-neutral-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          }
        />

        {feedback && (
          <div
            className={`p-4 rounded-2xl text-xs font-medium flex items-center gap-2 ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{feedback.message}</span>
          </div>
        )}

        {/* PLAN CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {loading ? (
            <div className="col-span-full py-12 text-center text-xs text-neutral-400">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
              Loading subscription plans...
            </div>
          ) : (
            plans.map((plan) => {
              const isGold = plan.slug === "gold"
              const isSilver = plan.slug === "silver"
              const isBronze = plan.slug === "bronze"
              const isFree = plan.slug === "free"

              return (
                <div
                  key={plan._id}
                  className={`rounded-2xl bg-white border p-5 shadow-xs space-y-4 flex flex-col justify-between relative transition-all ${
                    !plan.isActive
                      ? "opacity-60 border-neutral-200"
                      : isGold
                      ? "border-amber-300 ring-1 ring-amber-300/50"
                      : isSilver
                      ? "border-slate-300 ring-1 ring-slate-300/50"
                      : "border-neutral-200/90"
                  }`}
                >
                  {plan.isPopular && (
                    <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-neutral-900 text-white shadow-xs">
                      Popular
                    </span>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Crown
                          className={`w-4 h-4 ${
                            isGold
                              ? "text-amber-500"
                              : isSilver
                              ? "text-slate-500"
                              : isBronze
                              ? "text-amber-700"
                              : "text-neutral-400"
                          }`}
                        />
                        <h3 className="font-bold text-neutral-900 text-base">{plan.name}</h3>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          plan.isActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        {plan.isActive ? "Active" : "Disabled"}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-neutral-900">
                        ₹{plan.price}
                      </span>
                      <span className="text-neutral-400 text-xs font-normal">
                        / {plan.validityType || "month"}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-500 line-clamp-2 min-h-[32px]">
                      {plan.description || "Platform access tier"}
                    </p>

                    {/* Stats */}
                    <div className="p-3 rounded-xl bg-neutral-50 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Active Subscribers:</span>
                        <span className="font-bold text-neutral-900">
                          {plan.stats?.activeSubscribers || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Total Revenue:</span>
                        <span className="font-bold text-emerald-700">
                          ₹{(plan.stats?.totalRevenue || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Limits & Features Summary */}
                    <div className="space-y-1 text-[11px] text-neutral-600 pt-1">
                      <div className="flex justify-between">
                        <span>Streaming:</span>
                        <span className="font-semibold">{plan.limits?.streamingQuality || "720p"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Downloads / Day:</span>
                        <span className="font-semibold">{plan.limits?.dailyDownloadLimit || 1}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Max Devices:</span>
                        <span className="font-semibold">{plan.limits?.maxDevices || 1}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Concurrent Streams:</span>
                        <span className="font-semibold">{plan.limits?.maxConcurrentStreams || 1}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ad-Free Viewing:</span>
                        <span className="font-semibold">
                          {plan.features?.adFree ? "Yes" : "No"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-neutral-100 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingPlan(plan)}
                      className="flex-1 rounded-xl text-xs cursor-pointer hover:bg-neutral-100"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Configure
                    </Button>

                    {!isFree && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTogglingPlan(plan)}
                        className={`rounded-xl text-xs px-2.5 cursor-pointer ${
                          plan.isActive
                            ? "text-red-700 hover:bg-red-50 border-red-200"
                            : "text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                        }`}
                        title={plan.isActive ? "Deactivate Plan" : "Activate Plan"}
                      >
                        {plan.isActive ? (
                          <ToggleRight className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <ToggleLeft className="w-4 h-4 text-neutral-400" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* EDIT CONFIGURATION MODAL */}
        {editingPlan && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4" />
                  Configure Plan: {editingPlan.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="text-neutral-400 hover:text-neutral-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateSubmit} className="space-y-4 text-xs">
                {/* Price & Description */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-neutral-700">Price (INR):</label>
                    <Input
                      type="number"
                      min={0}
                      value={editingPlan.price}
                      onChange={(e) =>
                        setEditingPlan({ ...editingPlan, price: Number(e.target.value) })
                      }
                      className="rounded-xl text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-neutral-700">Display Order:</label>
                    <Input
                      type="number"
                      value={editingPlan.displayOrder || 1}
                      onChange={(e) =>
                        setEditingPlan({ ...editingPlan, displayOrder: Number(e.target.value) })
                      }
                      className="rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700">Description:</label>
                  <Input
                    type="text"
                    value={editingPlan.description || ""}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, description: e.target.value })
                    }
                    className="rounded-xl text-xs"
                  />
                </div>

                {/* Quotas & Limits */}
                <div className="p-3 bg-neutral-50 rounded-xl space-y-3">
                  <h4 className="font-bold text-neutral-800 uppercase text-[11px] tracking-wider">
                    Limits & Quotas
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-neutral-600 block mb-1">Max Streaming Quality:</label>
                      <select
                        value={editingPlan.limits?.streamingQuality || "720p"}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            limits: { ...editingPlan.limits, streamingQuality: e.target.value },
                          })
                        }
                        className="w-full p-2 border border-neutral-200 rounded-lg text-xs"
                      >
                        <option value="720p">720p (HD)</option>
                        <option value="1080p">1080p (Full HD)</option>
                        <option value="1440p">1440p (2K)</option>
                        <option value="4k">4K (UHD)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-neutral-600 block mb-1">Daily Download Limit:</label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={editingPlan.limits?.dailyDownloadLimit || 1}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            limits: {
                              ...editingPlan.limits,
                              dailyDownloadLimit: Number(e.target.value),
                            },
                          })
                        }
                        className="rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-neutral-600 block mb-1">Max Devices:</label>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={editingPlan.limits?.maxDevices || 1}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            limits: { ...editingPlan.limits, maxDevices: Number(e.target.value) },
                          })
                        }
                        className="rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-neutral-600 block mb-1">Concurrent Streams:</label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={editingPlan.limits?.maxConcurrentStreams || 1}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            limits: {
                              ...editingPlan.limits,
                              maxConcurrentStreams: Number(e.target.value),
                            },
                          })
                        }
                        className="rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Feature Toggles */}
                <div className="p-3 bg-neutral-50 rounded-xl space-y-2">
                  <h4 className="font-bold text-neutral-800 uppercase text-[11px] tracking-wider">
                    Feature Access Flags
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "adFree", label: "Ad-Free Viewing" },
                      { key: "premiumVideoAccess", label: "Premium Videos" },
                      { key: "premiumCourses", label: "Premium Courses" },
                      { key: "fastStreaming", label: "Priority Fast Streaming" },
                      { key: "offlineDownloads", label: "Offline Downloads" },
                      { key: "exclusiveContent", label: "VIP Exclusive Content" },
                    ].map((f) => (
                      <label
                        key={f.key}
                        className="flex items-center gap-2 cursor-pointer select-none text-neutral-700"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean((editingPlan.features as any)?.[f.key])}
                          onChange={(e) =>
                            setEditingPlan({
                              ...editingPlan,
                              features: {
                                ...editingPlan.features,
                                [f.key]: e.target.checked,
                              },
                            })
                          }
                          className="rounded border-neutral-300"
                        />
                        <span>{f.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Popular Badge */}
                <label className="flex items-center gap-2 cursor-pointer select-none text-neutral-800 font-semibold pt-1">
                  <input
                    type="checkbox"
                    checked={editingPlan.isPopular}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, isPopular: e.target.checked })
                    }
                    className="rounded border-neutral-300"
                  />
                  <span>Mark as "Most Popular" Plan</span>
                </label>

                {/* Mandatory Audit Reason */}
                <div className="space-y-1 pt-2 border-t">
                  <label className="font-semibold text-neutral-700">
                    Administrative Reason <span className="text-red-500">*</span> (Logged in Audit Log)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="E.g. Seasonal pricing revision, bandwidth optimization adjustment..."
                    value={updateReason}
                    onChange={(e) => setUpdateReason(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 p-2 text-xs focus:ring-1 focus:ring-neutral-900 outline-none"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingPlan(null)}
                    className="rounded-xl text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl text-xs bg-neutral-900 hover:bg-neutral-800 text-white"
                  >
                    {submitting ? "Saving..." : "Save Plan Changes"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TOGGLE STATUS MODAL */}
        {togglingPlan && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-bold text-neutral-900">
                  {togglingPlan.isActive ? "Deactivate Plan Tier" : "Activate Plan Tier"}
                </h3>
                <button
                  type="button"
                  onClick={() => setTogglingPlan(null)}
                  className="text-neutral-400 hover:text-neutral-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-neutral-600">
                Are you sure you want to {togglingPlan.isActive ? "deactivate" : "activate"}{" "}
                <span className="font-bold text-neutral-900">{togglingPlan.name}</span>? Existing
                subscribers on this plan will maintain access until expiry.
              </p>

              <form onSubmit={handleToggleConfirm} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700">
                    Administrative Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Reason for changing plan status..."
                    value={toggleReason}
                    onChange={(e) => setToggleReason(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 p-2 text-xs focus:ring-1 focus:ring-neutral-900 outline-none"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setTogglingPlan(null)}
                    className="rounded-xl text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className={`rounded-xl text-xs text-white ${
                      togglingPlan.isActive
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    {submitting ? "Updating..." : "Confirm Status Change"}
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
