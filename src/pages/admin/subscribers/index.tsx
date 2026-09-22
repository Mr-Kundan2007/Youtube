import React, { useState, useEffect } from "react"
import Head from "next/head"
import Link from "next/link"
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Calendar,
  AlertCircle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Plus,
  PauseCircle,
  PlayCircle,
  ArrowDownCircle,
  Crown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/AuthContext"
import AdminSubscriptionNav from "@/components/admin/AdminSubscriptionNav"
import {
  adminSubscriptionService,
  SubscriberListItem,
} from "@/services/adminSubscriptionService"

export default function AdminSubscribersPage() {
  const { user, loading: authLoading }: any = useAuth()
  const [subscribers, setSubscribers] = useState<SubscriberListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [planFilter, setPlanFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [expiringFilter, setExpiringFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Action Modal State
  const [selectedUser, setSelectedUser] = useState<SubscriberListItem | null>(null)
  const [actionType, setActionType] = useState<"extend" | "suspend" | "restore" | "moveToFree" | null>(null)
  const [actionReason, setActionReason] = useState("")
  const [extendDays, setExtendDays] = useState(30)
  const [submittingAction, setSubmittingAction] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const isAdmin = user?.role === "admin" || user?.result?.role === "admin"

  const fetchSubscribers = async () => {
    setLoading(true)
    try {
      const res = await adminSubscriptionService.getSubscribers({
        page,
        limit: 15,
        search: search.trim() || undefined,
        plan: planFilter !== "all" ? planFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        expiringWithinDays: expiringFilter !== "all" ? expiringFilter : undefined,
      })
      if (res) {
        setSubscribers(res.subscribers || [])
        setTotalPages(res.pagination?.totalPages || 1)
        setTotalCount(res.pagination?.total || 0)
      }
    } catch (err) {
      console.error("Failed to fetch subscribers:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchSubscribers()
    }
  }, [authLoading, isAdmin, page, planFilter, statusFilter, expiringFilter])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchSubscribers()
  }

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || !actionType) return

    if (!actionReason || actionReason.trim().length < 5) {
      setActionMessage({
        type: "error",
        text: "Please provide a descriptive reason of at least 5 characters for auditing.",
      })
      return
    }

    setSubmittingAction(true)
    setActionMessage(null)
    try {
      if (actionType === "extend") {
        await adminSubscriptionService.extendSubscriptionValidity(
          selectedUser.userId,
          Number(extendDays),
          actionReason
        )
      } else if (actionType === "suspend") {
        await adminSubscriptionService.suspendSubscription(selectedUser.userId, actionReason)
      } else if (actionType === "restore") {
        await adminSubscriptionService.restoreSubscription(selectedUser.userId, actionReason)
      } else if (actionType === "moveToFree") {
        await adminSubscriptionService.moveToFreeTier(selectedUser.userId, actionReason)
      }

      setActionMessage({
        type: "success",
        text: `Action '${actionType}' completed successfully!`,
      })
      setTimeout(() => {
        setActionType(null)
        setSelectedUser(null)
        setActionReason("")
        setActionMessage(null)
        fetchSubscribers()
      }, 1500)
    } catch (err: any) {
      console.error("Action execution failed:", err)
      setActionMessage({
        type: "error",
        text: err.response?.data?.message || err.message || "Action failed to execute.",
      })
    } finally {
      setSubmittingAction(false)
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
        <p className="text-sm text-neutral-500 mb-4">Admin credentials required to view subscriber directory.</p>
        <Link href="/"><Button variant="outline">Back to Safety</Button></Link>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Subscriber Directory & Management — Admin Suite</title>
      </Head>

      <div className="min-h-screen bg-neutral-50/60 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <AdminSubscriptionNav
          title="Subscriber Directory & Platform Management"
          description="Lookup user profiles, inspect subscription lifecycles, and perform administrative overrides with mandatory audit logging."
          actionSlot={
            <Button
              onClick={() => {
                setPage(1)
                fetchSubscribers()
              }}
              variant="outline"
              size="sm"
              className="rounded-xl bg-white hover:bg-neutral-100 text-xs font-medium cursor-pointer border-neutral-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          }
        />

        {/* SEARCH & FILTER CONTROLS */}
        <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <Input
                type="text"
                placeholder="Search by name, email, or user ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-xl text-xs bg-neutral-50/50 border-neutral-200 w-full"
              />
            </div>
            <Button type="submit" size="sm" className="rounded-xl text-xs cursor-pointer">
              Search
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-neutral-100 text-xs">
            <span className="text-neutral-400 flex items-center gap-1 font-medium">
              <Filter className="w-3.5 h-3.5" /> Filters:
            </span>

            {/* Plan filter */}
            <select
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value)
                setPage(1)
              }}
              className="px-2.5 py-1 rounded-lg border border-neutral-200 bg-white text-xs font-medium cursor-pointer"
            >
              <option value="all">All Plans</option>
              <option value="free">Free</option>
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="px-2.5 py-1 rounded-lg border border-neutral-200 bg-white text-xs font-medium cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
              <option value="suspended">Suspended</option>
            </select>

            {/* Expiring Soon */}
            <select
              value={expiringFilter}
              onChange={(e) => {
                setExpiringFilter(e.target.value)
                setPage(1)
              }}
              className="px-2.5 py-1 rounded-lg border border-neutral-200 bg-white text-xs font-medium cursor-pointer"
            >
              <option value="all">Any Expiration</option>
              <option value="1">Expiring in 24 Hours</option>
              <option value="3">Expiring in 3 Days</option>
              <option value="7">Expiring in 7 Days</option>
            </select>

            <div className="ml-auto text-neutral-500 font-medium">
              Found {totalCount} subscriber{totalCount === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        {/* SUBSCRIBERS TABLE */}
        <div className="rounded-2xl bg-white border border-neutral-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200/80 bg-neutral-50/70 text-neutral-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Tier Plan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Expires / Renews</th>
                  <th className="py-3 px-4">Days Left</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-400">
                      <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                      Loading subscribers...
                    </td>
                  </tr>
                ) : subscribers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-400">
                      No subscribers match the current search or filters.
                    </td>
                  </tr>
                ) : (
                  subscribers.map((sub) => {
                    const isGold = sub.plan?.toLowerCase() === "gold"
                    const isSilver = sub.plan?.toLowerCase() === "silver"
                    const isBronze = sub.plan?.toLowerCase() === "bronze"
                    const isActive = sub.status === "active"

                    return (
                      <tr key={sub.userId} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center font-bold text-neutral-700 text-[11px] shrink-0 uppercase">
                              {sub.name?.[0] || "U"}
                            </div>
                            <div>
                              <div className="font-bold text-neutral-900">{sub.name}</div>
                              <div className="text-[11px] text-neutral-500 truncate max-w-[180px]">
                                {sub.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              isGold
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : isSilver
                                ? "bg-slate-100 text-slate-700 border border-slate-200"
                                : isBronze
                                ? "bg-amber-50 text-amber-900 border border-amber-200"
                                : "bg-neutral-100 text-neutral-700 border border-neutral-200"
                            }`}
                          >
                            {(isGold || isSilver || isBronze) && <Crown className="w-3 h-3" />}
                            {sub.plan}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                              isActive
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : sub.status === "suspended"
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                            }`}
                          >
                            {isActive ? (
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            ) : (
                              <AlertCircle className="w-2.5 h-2.5" />
                            )}
                            {sub.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-neutral-600">
                          {sub.expiresAt || sub.endDate ? (
                            new Date(sub.expiresAt || sub.endDate!).toLocaleDateString()
                          ) : (
                            <span className="text-neutral-400">Never / Free</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {sub.daysRemaining !== null && sub.daysRemaining !== undefined ? (
                            <span
                              className={`font-semibold ${
                                sub.isExpiringSoon ? "text-amber-600 font-bold" : "text-neutral-700"
                              }`}
                            >
                              {sub.daysRemaining} days
                              {sub.isExpiringSoon && " (Soon!)"}
                            </span>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Profile detail */}
                            <Link href={`/admin/subscribers/${sub.userId}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px] rounded-lg cursor-pointer hover:bg-neutral-100"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                Details
                              </Button>
                            </Link>

                            {/* Quick Action buttons */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedUser(sub)
                                setActionType("extend")
                              }}
                              className="h-7 px-2 text-[11px] rounded-lg cursor-pointer hover:bg-emerald-50 text-emerald-700 border-emerald-200"
                              title="Extend Validity"
                            >
                              <Plus className="w-3 h-3" />
                            </Button>

                            {sub.status === "suspended" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedUser(sub)
                                  setActionType("restore")
                                }}
                                className="h-7 px-2 text-[11px] rounded-lg cursor-pointer hover:bg-blue-50 text-blue-700 border-blue-200"
                                title="Restore Subscription"
                              >
                                <PlayCircle className="w-3 h-3" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedUser(sub)
                                  setActionType("suspend")
                                }}
                                className="h-7 px-2 text-[11px] rounded-lg cursor-pointer hover:bg-red-50 text-red-700 border-red-200"
                                title="Suspend Subscription"
                              >
                                <PauseCircle className="w-3 h-3" />
                              </Button>
                            )}

                            {sub.plan?.toLowerCase() !== "free" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedUser(sub)
                                  setActionType("moveToFree")
                                }}
                                className="h-7 px-2 text-[11px] rounded-lg cursor-pointer hover:bg-neutral-100 text-neutral-600"
                                title="Move to Free Tier"
                              >
                                <ArrowDownCircle className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="flex items-center justify-between p-4 border-t border-neutral-100 text-xs text-neutral-500">
            <div>
              Page {page} of {totalPages} ({totalCount} total)
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 px-2.5 rounded-lg cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 px-2.5 rounded-lg cursor-pointer"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>

        {/* ACTION MODAL */}
        {actionType && selectedUser && (
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
                    setSelectedUser(null)
                    setActionMessage(null)
                  }}
                  className="text-neutral-400 hover:text-neutral-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-neutral-600 space-y-1 bg-neutral-50 p-3 rounded-xl">
                <div>
                  <span className="font-semibold">User:</span> {selectedUser.name} ({selectedUser.email})
                </div>
                <div>
                  <span className="font-semibold">Current Plan:</span> {selectedUser.plan.toUpperCase()} (
                  {selectedUser.status})
                </div>
              </div>

              {actionMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium ${
                    actionMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  {actionMessage.text}
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
                    placeholder="Provide a clear justification (e.g. Customer support goodwill, chargeback fraud investigation, billing adjustment)..."
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
                      setSelectedUser(null)
                      setActionMessage(null)
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
                    {submittingAction ? "Executing..." : "Confirm Action"}
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
