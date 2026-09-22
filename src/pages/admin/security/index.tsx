import React, { useState, useEffect } from "react"
import Head from "next/head"
import Link from "next/link"
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Activity,
  Lock,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Layers,
  ChevronRight,
  Server,
  Zap,
  Terminal,
  Shield,
  FileText,
  AlertOctagon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/AuthContext"
import AdminSubscriptionNav from "@/components/admin/AdminSubscriptionNav"
import {
  adminSecurityService,
  SecuritySummary,
  SecurityEventItem,
  SecuritySeverity,
  SecurityEventStatus,
} from "@/services/adminSecurityService"

export default function AdminSecurityPage() {
  const { user, loading: authLoading }: any = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Summary & Stats
  const [summary, setSummary] = useState<SecuritySummary | null>(null)

  // Tab State
  const [activeTab, setActiveTab] = useState<"events" | "queue" | "jobs" | "checklist">("events")

  // Events & Filtering State
  const [events, setEvents] = useState<SecurityEventItem[]>([])
  const [totalEvents, setTotalEvents] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [severityFilter, setSeverityFilter] = useState<SecuritySeverity | "">("")
  const [statusFilter, setStatusFilter] = useState<SecurityEventStatus | "">("")
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("")

  // Detail Modal & Review State
  const [selectedEvent, setSelectedEvent] = useState<SecurityEventItem | null>(null)
  const [reviewStatus, setReviewStatus] = useState<"REVIEWED" | "RESOLVED" | "IGNORED">("RESOLVED")
  const [adminNotes, setAdminNotes] = useState("")
  const [submittingReview, setSubmittingReview] = useState(false)

  // Job Actions
  const [cleaningLocks, setCleaningLocks] = useState(false)
  const [runningScan, setRunningScan] = useState(false)

  const isAdmin = user?.role === "admin" || user?.result?.role === "admin"

  const loadData = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const [sumData, eventsData] = await Promise.all([
        adminSecurityService.getSummary(),
        adminSecurityService.getEvents({
          page,
          limit: 15,
          severity: severityFilter,
          status: statusFilter,
          eventType: eventTypeFilter,
        }),
      ])

      setSummary(sumData)
      setEvents(eventsData.events || [])
      setTotalEvents(eventsData.pagination?.total || 0)
      setTotalPages(eventsData.pagination?.totalPages || 1)
    } catch (err: any) {
      console.error("Failed to load security management data:", err)
      setError(err.response?.data?.message || err.message || "Failed to load security data")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!authLoading && isAdmin) {
      loadData()
    }
  }, [authLoading, isAdmin, page, severityFilter, statusFilter, eventTypeFilter])

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEvent) return
    if (!adminNotes.trim()) {
      setError("Admin notes are required to document security resolutions.")
      return
    }

    setSubmittingReview(true)
    setError(null)
    try {
      await adminSecurityService.reviewEvent(selectedEvent._id, {
        status: reviewStatus,
        adminNotes: adminNotes.trim(),
      })
      setSuccessMsg(`Event marked as ${reviewStatus} successfully.`)
      setSelectedEvent(null)
      setAdminNotes("")
      // Reload updated data
      loadData(true)
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to update review status")
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleCleanLocks = async () => {
    setCleaningLocks(true)
    setError(null)
    try {
      const res = await adminSecurityService.cleanStaleLocks(30)
      setSuccessMsg(`Cleared ${res.clearedCount} stale worker lock(s).`)
      loadData(true)
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to clear stale locks")
    } finally {
      setCleaningLocks(false)
    }
  }

  const handleRunAnomalyScan = async () => {
    setRunningScan(true)
    setError(null)
    try {
      await adminSecurityService.runAnomalyScan()
      setSuccessMsg("Anomaly scan executed. Telemetry updated.")
      loadData(true)
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to run anomaly scan")
    } finally {
      setRunningScan(false)
    }
  }

  if (authLoading || (loading && !summary)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50/50">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-neutral-400 animate-spin" />
          <p className="text-sm font-medium text-neutral-500">Loading Security & Fraud Center...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50/50 p-4">
        <div className="max-w-md w-full p-6 bg-white border border-neutral-200 rounded-2xl shadow-sm text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Administrative Privileges Required</h2>
          <p className="text-xs text-neutral-500 mb-5">
            You do not possess the required administrator authorization to view subscription security audits,
            fraud queues, and telemetry logs.
          </p>
          <Link href="/">
            <Button className="rounded-xl w-full">Return to Platform Home</Button>
          </Link>
        </div>
      </div>
    )
  }

  const getSeverityBadge = (sev: SecuritySeverity) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-red-100 text-red-800 border-red-200"
      case "HIGH":
        return "bg-amber-100 text-amber-800 border-amber-200"
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "LOW":
      default:
        return "bg-blue-100 text-blue-800 border-blue-200"
    }
  }

  const getStatusBadge = (st: SecurityEventStatus) => {
    switch (st) {
      case "OPEN":
        return "bg-red-50 text-red-700 border-red-200"
      case "REVIEWED":
        return "bg-blue-50 text-blue-700 border-blue-200"
      case "RESOLVED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200"
      case "IGNORED":
        return "bg-neutral-100 text-neutral-600 border-neutral-200"
    }
  }

  const openQueueEvents = events.filter(
    (e) => e.status === "OPEN" && (e.severity === "CRITICAL" || e.severity === "HIGH" || e.riskScore >= 50)
  )

  return (
    <div className="min-h-screen bg-neutral-50/50">
      <Head>
        <title>Security & Fraud Center - Admin Suite</title>
      </Head>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminSubscriptionNav
          title="Security & Fraud Prevention"
          description="Real-time security telemetry, state machine enforcement, fraud risk assessment, background job monitoring, and compliance verification."
          actionSlot={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData(true)}
                disabled={refreshing}
                className="rounded-xl text-xs font-medium cursor-pointer border-neutral-200 hover:bg-neutral-100"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          }
        />

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <p className="text-xs font-medium text-red-800">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-600 hover:text-red-900 font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-xs font-medium text-emerald-800">{successMsg}</p>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-xs text-emerald-600 hover:text-emerald-900 font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. TOP STATS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {/* Card 1: Today's Events */}
          <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Events Today</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-neutral-900">{summary?.totalEventsToday || 0}</div>
            <div className="mt-2 text-[11px] text-neutral-400 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live telemetry stream active
            </div>
          </div>

          {/* Card 2: Open High/Critical Reviews */}
          <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Action Required</span>
              <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <AlertOctagon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-red-600">{summary?.openCriticalReviews || 0}</div>
            <div className="mt-2 text-[11px] text-neutral-400">Flagged high/critical incidents</div>
          </div>

          {/* Card 3: Payment Anomalies */}
          <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Payment Anomalies</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-neutral-900">{summary?.paymentAnomaliesToday || 0}</div>
            <div className="mt-2 text-[11px] text-neutral-400">Replays, invalid signatures, price tampering</div>
          </div>

          {/* Card 4: Rate Limit Breaches */}
          <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Rate Limit Drops</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-neutral-900">{summary?.rateLimitTriggersToday || 0}</div>
            <div className="mt-2 text-[11px] text-neutral-400">429 sliding-window throttles</div>
          </div>

          {/* Card 5: Job Worker Health */}
          <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Job Workers</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-neutral-900">
                {summary?.jobs?.healthyCount || 0} / {summary?.jobs?.totalJobs || 0}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  summary?.jobs?.overallStatus === "HEALTHY"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}
              >
                {summary?.jobs?.overallStatus || "IDLE"}
              </span>
            </div>
            <div className="mt-2 text-[11px] text-neutral-400">Lifecycle sweeps & retries</div>
          </div>
        </div>

        {/* 2. TAB CONTROLS */}
        <div className="flex items-center gap-2 border-b border-neutral-200/80 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab("events")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "events"
                ? "bg-neutral-900 text-white shadow-xs"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Security Event Stream</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-neutral-800 text-neutral-200 ml-1">
              {totalEvents}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("queue")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "queue"
                ? "bg-neutral-900 text-white shadow-xs"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Fraud Review Queue</span>
            {summary?.openCriticalReviews ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-600 text-white font-bold ml-1">
                {summary.openCriticalReviews}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setActiveTab("jobs")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "jobs"
                ? "bg-neutral-900 text-white shadow-xs"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Worker Telemetry</span>
          </button>

          <button
            onClick={() => setActiveTab("checklist")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "checklist"
                ? "bg-neutral-900 text-white shadow-xs"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Security Compliance</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: SECURITY EVENT STREAM */}
        {/* ========================================================================= */}
        {activeTab === "events" && (
          <div className="space-y-4">
            {/* Filter controls */}
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-4 shadow-xs flex flex-wrap items-center gap-3 justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-neutral-500 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Filters:
                </span>

                {/* Severity select */}
                <select
                  value={severityFilter}
                  onChange={(e) => {
                    setSeverityFilter(e.target.value as any)
                    setPage(1)
                  }}
                  className="text-xs border border-neutral-200 rounded-xl px-2.5 py-1.5 bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                >
                  <option value="">All Severities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>

                {/* Status select */}
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as any)
                    setPage(1)
                  }}
                  className="text-xs border border-neutral-200 rounded-xl px-2.5 py-1.5 bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                >
                  <option value="">All Statuses</option>
                  <option value="OPEN">Open</option>
                  <option value="REVIEWED">Reviewed</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="IGNORED">Ignored</option>
                </select>

                {/* Event Type select */}
                <select
                  value={eventTypeFilter}
                  onChange={(e) => {
                    setEventTypeFilter(e.target.value)
                    setPage(1)
                  }}
                  className="text-xs border border-neutral-200 rounded-xl px-2.5 py-1.5 bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                >
                  <option value="">All Event Types</option>
                  <option value="INVALID_SIGNATURE">Invalid Signature</option>
                  <option value="PAYMENT_REPLAY_ATTEMPT">Payment Replay Attempt</option>
                  <option value="INVALID_PAYMENT_AMOUNT">Invalid Amount</option>
                  <option value="RATE_LIMIT_TRIGGERED">Rate Limit Triggered</option>
                  <option value="UNAUTHORIZED_ADMIN_ACCESS">Unauthorized Admin Access</option>
                  <option value="API_ABUSE_DETECTED">API Abuse Detected</option>
                  <option value="WEBHOOK_INVALID_SIGNATURE">Webhook Invalid Sig</option>
                  <option value="JOB_FAILURE_ALERT">Job Failure Alert</option>
                </select>

                {(severityFilter || statusFilter || eventTypeFilter) && (
                  <button
                    onClick={() => {
                      setSeverityFilter("")
                      setStatusFilter("")
                      setEventTypeFilter("")
                      setPage(1)
                    }}
                    className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] dark:hover:text-white underline ml-2 cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="text-xs text-neutral-400">Showing page {page} of {totalPages}</div>
            </div>

            {/* Events Table */}
            <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/50 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Event Type</th>
                      <th className="py-3.5 px-4">Severity</th>
                      <th className="py-3.5 px-4">Risk Score</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Origin / IP</th>
                      <th className="py-3.5 px-4">Timestamp</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-xs text-neutral-700">
                    {events.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-neutral-400">
                          <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                          <p className="font-medium">No security events found matching current criteria</p>
                          <p className="text-[11px]">Your subscription and payment infrastructure is fully secure.</p>
                        </td>
                      </tr>
                    ) : (
                      events.map((ev) => (
                        <tr key={ev._id} className="hover:bg-neutral-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-medium text-neutral-900">
                            {ev.eventType}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getSeverityBadge(
                                ev.severity
                              )}`}
                            >
                              {ev.severity}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor:
                                    ev.riskScore >= 80
                                      ? "#dc2626"
                                      : ev.riskScore >= 50
                                      ? "#d97706"
                                      : ev.riskScore >= 20
                                      ? "#eab308"
                                      : "#10b981",
                                }}
                              />
                              <span>{ev.riskScore} / 100</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(
                                ev.status
                              )}`}
                            >
                              {ev.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-neutral-500">
                            {ev.ipHash ? `${ev.ipHash.slice(0, 10)}...` : "Internal / System"}
                          </td>
                          <td className="py-3.5 px-4 text-neutral-500 text-[11px]">
                            {new Date(ev.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedEvent(ev)
                                setAdminNotes(ev.adminNotes || "")
                                setReviewStatus(ev.status === "OPEN" ? "RESOLVED" : ev.status)
                              }}
                              className="h-7 text-xs rounded-lg cursor-pointer hover:bg-neutral-100"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1 text-neutral-600" />
                              Inspect
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination bar */}
              {totalPages > 1 && (
                <div className="p-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-8 rounded-xl cursor-pointer"
                  >
                    Previous
                  </Button>
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 rounded-xl cursor-pointer"
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: FRAUD REVIEW QUEUE */}
        {/* ========================================================================= */}
        {activeTab === "queue" && (
          <div className="space-y-4">
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-500" />
                    Pending High & Critical Fraud Reviews
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Incidents with risk score ≥ 50 requiring mandatory administrative verification and resolution.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-800 border border-red-200">
                  {openQueueEvents.length} Pending Actions
                </span>
              </div>

              {openQueueEvents.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-neutral-200 rounded-2xl">
                  <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-neutral-900">Fraud Queue Clear</h3>
                  <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
                    All suspicious payment attempts, tampered amounts, and cryptographic signature failures have been
                    reviewed and resolved.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {openQueueEvents.map((item) => (
                    <div
                      key={item._id}
                      className="border border-red-200/80 bg-red-50/20 rounded-2xl p-4 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs font-bold text-neutral-900">{item.eventType}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${getSeverityBadge(
                              item.severity
                            )}`}
                          >
                            {item.severity} (Score: {item.riskScore})
                          </span>
                        </div>

                        <p className="text-xs text-neutral-600 mb-3">
                          {item.safeMetadata?.alertMessage ||
                            item.safeMetadata?.reason ||
                            "Suspicious activity flagged by automated security state machine."}
                        </p>

                        <div className="bg-white/80 border border-neutral-200 rounded-xl p-3 text-[11px] space-y-1 mb-4 font-mono text-neutral-600">
                          {item.orderId && <div>Order: {item.orderId}</div>}
                          {item.ipHash && <div>IP Hash: {item.ipHash}</div>}
                          {item.requestId && <div>Request ID: {item.requestId}</div>}
                          <div>Detected: {new Date(item.createdAt).toLocaleString()}</div>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedEvent(item)
                          setAdminNotes("")
                          setReviewStatus("RESOLVED")
                        }}
                        className="w-full rounded-xl text-xs font-semibold cursor-pointer bg-neutral-900 hover:bg-neutral-800 text-white"
                      >
                        Resolve & Add Admin Notes
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: WORKER TELEMETRY */}
        {/* ========================================================================= */}
        {activeTab === "jobs" && (
          <div className="space-y-6">
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                    <Server className="w-5 h-5 text-indigo-500" />
                    Distributed Background Job Workers
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Live execution states, lock timeouts, and consecutive failure counts from the MongoDB JobLock cluster.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={runningScan}
                    onClick={handleRunAnomalyScan}
                    className="rounded-xl text-xs font-medium cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 mr-1 text-amber-500" />
                    {runningScan ? "Scanning..." : "Scan Anomalies"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cleaningLocks}
                    onClick={handleCleanLocks}
                    className="rounded-xl text-xs font-medium cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 mr-1 text-red-500" />
                    {cleaningLocks ? "Clearing..." : "Clean Stale Locks"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {summary?.jobs?.jobs?.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-neutral-400">
                    No active job workers currently registered in database.
                  </div>
                ) : (
                  summary?.jobs?.jobs?.map((job) => (
                    <div
                      key={job.jobName}
                      className="border border-neutral-200 rounded-2xl p-4 bg-neutral-50/50 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs font-bold text-neutral-900">{job.jobName}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              job.health === "HEALTHY"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : job.health === "DEGRADED"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-red-50 text-red-700 border-red-200"
                            }`}
                          >
                            {job.health}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-[11px] text-neutral-600 mt-3">
                          <div className="flex justify-between">
                            <span className="text-neutral-400">Lock Status:</span>
                            <span className="font-medium font-mono">
                              {job.isLocked ? "LOCKED (Busy)" : "UNLOCKED (Idle)"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-400">Consecutive Failures:</span>
                            <span
                              className={`font-bold ${
                                job.consecutiveFailures > 0 ? "text-red-600" : "text-neutral-700"
                              }`}
                            >
                              {job.consecutiveFailures}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-400">Last Status:</span>
                            <span className="font-mono font-medium">{job.lastStatus}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-400">Last Completed:</span>
                            <span>{job.lastCompletedAt ? new Date(job.lastCompletedAt).toLocaleTimeString() : "N/A"}</span>
                          </div>
                          {job.lastError && (
                            <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[10px] font-mono">
                              {job.lastError}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: COMPLIANCE CHECKLIST */}
        {/* ========================================================================= */}
        {activeTab === "checklist" && (
          <div className="space-y-4">
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-neutral-900">Production Subscription Security Controls</h2>
                  <p className="text-xs text-neutral-500">
                    Enforced enterprise security policies safeguarding recurring billing, state transitions, and subscriber data.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {[
                  {
                    title: "Cryptographic Signature Validation",
                    desc: "Razorpay HMAC-SHA256 signatures are calculated and verified server-side with constant-time equality.",
                    status: "Enforced",
                  },
                  {
                    title: "Authoritative Price Computation",
                    desc: "Frontend pricing cannot be manipulated. Billing amounts are recalculated authoritatively from plan configurations.",
                    status: "Enforced",
                  },
                  {
                    title: "Payment State Machine Guard",
                    desc: "Strict state transition matrix prevents jumps from failed states directly into active subscriptions.",
                    status: "Enforced",
                  },
                  {
                    title: "Replay Attack Prevention",
                    desc: "Payment IDs and completed orders cannot be reused across accounts or duplicate attempts.",
                    status: "Enforced",
                  },
                  {
                    title: "Webhook Idempotency Protection",
                    desc: "Atomic IdempotencyKey locks prevent duplicate subscriber credits during webhook retry storms.",
                    status: "Enforced",
                  },
                  {
                    title: "Hierarchical Rate Limiting",
                    desc: "Sliding-window memory limits protect Auth (10/15m), Payment (10/min), and Admin (30/min) endpoints.",
                    status: "Enforced",
                  },
                  {
                    title: "Zero Secret Leakage in Logs",
                    desc: "Deep sanitizeMetadata utility automatically redacts credentials, passwords, auth tokens, and raw keys.",
                    status: "Enforced",
                  },
                  {
                    title: "Hardened Security Headers",
                    desc: "nosniff, SAMEORIGIN, strict-origin, no-store cache busting, and X-Request-Id correlation headers active.",
                    status: "Enforced",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="border border-neutral-200 rounded-2xl p-4 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-neutral-900">{item.title}</h3>
                        <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                          {item.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DETAIL & RESOLUTION MODAL */}
        {/* ========================================================================= */}
        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white rounded-3xl border border-neutral-200 max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-bold text-neutral-900">Security Event Inspection</h3>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-neutral-400 hover:text-neutral-700 font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-neutral-100">
                  <span className="text-neutral-400 font-medium">Event Type:</span>
                  <span className="font-mono font-bold text-neutral-900">{selectedEvent.eventType}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-100">
                  <span className="text-neutral-400 font-medium">Severity:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getSeverityBadge(
                      selectedEvent.severity
                    )}`}
                  >
                    {selectedEvent.severity}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-100">
                  <span className="text-neutral-400 font-medium">Risk Score:</span>
                  <span className="font-bold text-neutral-900">{selectedEvent.riskScore} / 100</span>
                </div>
                {selectedEvent.orderId && (
                  <div className="flex justify-between py-1 border-b border-neutral-100">
                    <span className="text-neutral-400 font-medium">Order ID:</span>
                    <span className="font-mono text-neutral-800">{selectedEvent.orderId}</span>
                  </div>
                )}
                {selectedEvent.requestId && (
                  <div className="flex justify-between py-1 border-b border-neutral-100">
                    <span className="text-neutral-400 font-medium">Request Correlation ID:</span>
                    <span className="font-mono text-neutral-800">{selectedEvent.requestId}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-neutral-100">
                  <span className="text-neutral-400 font-medium">Detected At:</span>
                  <span className="text-neutral-700">{new Date(selectedEvent.createdAt).toLocaleString()}</span>
                </div>

                {/* Sanitized Metadata Display */}
                <div>
                  <span className="text-neutral-400 font-medium block mb-1">Sanitized Telemetry Metadata:</span>
                  <pre className="p-3 bg-neutral-900 text-neutral-200 rounded-xl font-mono text-[11px] overflow-x-auto max-h-40">
                    {JSON.stringify(selectedEvent.safeMetadata || {}, null, 2)}
                  </pre>
                </div>

                {/* Review Form */}
                <form onSubmit={handleReviewSubmit} className="pt-3 border-t space-y-3">
                  <h4 className="font-bold text-neutral-900">Admin Review & Resolution</h4>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Status Action</label>
                    <div className="flex items-center gap-2">
                      {(["RESOLVED", "REVIEWED", "IGNORED"] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setReviewStatus(st)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border ${
                            reviewStatus === st
                              ? "bg-neutral-900 text-white border-neutral-900"
                              : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Resolution Notes <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Document reason, customer contact outcome, or remediation action taken..."
                      className="w-full text-xs p-2.5 border border-neutral-200 rounded-xl bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedEvent(null)}
                      className="rounded-xl text-xs cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={submittingReview}
                      className="rounded-xl text-xs font-semibold cursor-pointer bg-neutral-900 text-white hover:bg-neutral-800"
                    >
                      {submittingReview ? "Saving..." : "Save Resolution"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
