import React, { useState, useEffect, useCallback } from "react"
import Head from "next/head"
import {
  ShieldAlert,
  Flag,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  Check,
  X,
  MessageSquare,
  Languages,
  History,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  AlertCircle,
  FileText,
  User as UserIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useAuth } from "@/lib/AuthContext"
import AdminSubscriptionNav from "@/components/admin/AdminSubscriptionNav"
import {
  commentModerationService,
  CommentReportItem,
  ModerationSummary,
  ReportDetailDossier,
  REPORT_REASONS,
} from "@/services/commentModerationService"
import { commentService } from "@/services/commentService"

export default function CommentModerationPage() {
  const { user, loading: authLoading }: any = useAuth()

  // State
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ModerationSummary | null>(null)
  const [reports, setReports] = useState<CommentReportItem[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    totalReports: 0,
    totalPages: 1,
    hasMore: false,
  })

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("active")
  const [reasonFilter, setReasonFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [debouncedSearch, setDebouncedSearch] = useState<string>("")

  // Detail Dossier Modal
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [dossierLoading, setDossierLoading] = useState<boolean>(false)
  const [dossier, setDossier] = useState<ReportDetailDossier | null>(null)
  const [moderatorNotes, setModeratorNotes] = useState<string>("")
  const [activeTab, setActiveTab] = useState<"details" | "thread" | "history" | "safety">("details")

  // Translation in moderation
  const [translating, setTranslating] = useState<boolean>(false)
  const [translatedText, setTranslatedText] = useState<string | null>(null)

  // Action Confirmation Dialog
  const [actionConfirm, setActionConfirm] = useState<{
    isOpen: boolean
    action: "hide" | "restore" | "delete" | "dismiss_report" | "resolve"
    title: string
    description: string
    danger?: boolean
  } | null>(null)
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false)

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 400)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // Check auth
  const isAuthorized =
    user?.role === "admin" ||
    user?.role === "moderator" ||
    user?.result?.role === "admin" ||
    user?.result?.role === "moderator"

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const data = await commentModerationService.getModerationSummary()
      setSummary(data)
    } catch (err: any) {
      console.warn("Failed to load moderation summary:", err)
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  const loadReports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await commentModerationService.getModerationReports({
        status: statusFilter,
        reason: reasonFilter,
        priority: priorityFilter,
        search: debouncedSearch,
        page: pagination.page,
        limit: pagination.limit,
      })
      setReports(data.reports || [])
      setPagination(data.pagination || pagination)
    } catch (err: any) {
      console.error("Failed to load moderation reports:", err)
      setError(err?.response?.data?.message || err?.message || "Failed to load reports")
    } finally {
      setLoading(false)
    }
  }, [statusFilter, reasonFilter, priorityFilter, debouncedSearch, pagination.page, pagination.limit])

  useEffect(() => {
    if (isAuthorized) {
      loadSummary()
    }
  }, [isAuthorized, loadSummary])

  useEffect(() => {
    if (isAuthorized) {
      loadReports()
    }
  }, [isAuthorized, loadReports])

  // Open Dossier
  const handleOpenDossier = async (reportId: string) => {
    setSelectedReportId(reportId)
    setDossierLoading(true)
    setTranslatedText(null)
    setActiveTab("details")
    try {
      const details = await commentModerationService.getReportDetails(reportId)
      setDossier(details)
      setModeratorNotes(details.report?.moderatorNotes || "")
    } catch (err: any) {
      console.error("Failed to fetch report details:", err)
    } finally {
      setDossierLoading(false)
    }
  }

  // Handle on-demand translation inside moderation dashboard (Phase 7 integration)
  const handleTranslateComment = async () => {
    if (!dossier?.comment?.id || translating) return
    setTranslating(true)
    try {
      const res = await commentService.translateComment(dossier.comment.id, "en")
      setTranslatedText(res.translatedText)
    } catch (err: any) {
      console.warn("Moderator translation error:", err)
    } finally {
      setTranslating(false)
    }
  }

  // Action execution
  const handleConfirmAction = async () => {
    if (!actionConfirm || !dossier?.comment?.id) return
    setActionSubmitting(true)

    try {
      await commentModerationService.executeModerationAction({
        reportId: selectedReportId || undefined,
        commentId: dossier.comment.id,
        action: actionConfirm.action,
        reason: actionConfirm.title,
        notes: moderatorNotes.trim(),
        expectedVersion: dossier.comment.version,
      })

      setActionConfirm(null)
      setSelectedReportId(null)
      setDossier(null)
      loadSummary()
      loadReports()
    } catch (err: any) {
      alert(err?.response?.data?.message || "Action failed")
    } finally {
      setActionSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold">Access Restricted</h1>
        <p className="text-neutral-400 text-sm mt-2 text-center max-w-md">
          You must be logged in as an Administrator or Moderator to access the Comment Moderation Dashboard.
        </p>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Comment Moderation Dashboard | Admin</title>
      </Head>

      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
        {/* Navigation Bar */}
        <AdminSubscriptionNav
          title="Comment Moderation"
          description="Review reports, evaluate safety signals, inspect thread context, and enforce community standards."
        />

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400">Pending Review</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold mt-2 text-neutral-100">
                {summaryLoading ? "--" : summary?.totalPending ?? 0}
              </div>
              <div className="text-[10px] text-amber-500/90 mt-1">Requires human review</div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400">Under Review</span>
                <ShieldAlert className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold mt-2 text-neutral-100">
                {summaryLoading ? "--" : summary?.underReview ?? 0}
              </div>
              <div className="text-[10px] text-blue-400/90 mt-1">Assigned to moderators</div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400">High Priority</span>
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <div className="text-2xl font-bold mt-2 text-neutral-100">
                {summaryLoading ? "--" : summary?.highPriority ?? 0}
              </div>
              <div className="text-[10px] text-red-400/90 mt-1">Multi-report & severity</div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400">Resolved Today</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold mt-2 text-neutral-100">
                {summaryLoading ? "--" : summary?.resolvedToday ?? 0}
              </div>
              <div className="text-[10px] text-emerald-400/90 mt-1">Actioned or dismissed</div>
            </div>
          </div>

          {/* Search, Status Tabs & Filters */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-4">
            {/* Status Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {[
                  { id: "active", label: "Active Queue" },
                  { id: "pending", label: "Pending" },
                  { id: "under_review", label: "Under Review" },
                  { id: "resolved", label: "Resolved" },
                  { id: "dismissed", label: "Dismissed" },
                  { id: "all", label: "All Reports" },
                ].map((tab) => {
                  const isActive = statusFilter === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setStatusFilter(tab.id)
                        setPagination((p) => ({ ...p, page: 1 }))
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                        isActive
                          ? "bg-neutral-100 text-neutral-900 font-semibold"
                          : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                      }`}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  loadSummary()
                  loadReports()
                }}
                className="h-8 text-xs text-neutral-400 hover:text-white cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative sm:col-span-2">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search reported text or description..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Reason filter */}
              <div>
                <select
                  value={reasonFilter}
                  onChange={(e) => {
                    setReasonFilter(e.target.value)
                    setPagination((p) => ({ ...p, page: 1 }))
                  }}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value="all">All Reasons</option>
                  {REPORT_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority filter */}
              <div>
                <select
                  value={priorityFilter}
                  onChange={(e) => {
                    setPriorityFilter(e.target.value)
                    setPagination((p) => ({ ...p, page: 1 }))
                  }}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value="all">All Priorities</option>
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>
            </div>
          </div>

          {/* Reports Queue Table / Card List */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            {error && (
              <div className="p-4 bg-red-500/10 border-b border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="p-12 text-center text-neutral-400 text-xs flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                <span>Loading moderation reports...</span>
              </div>
            ) : reports.length === 0 ? (
              <div className="p-12 text-center text-neutral-400 text-xs flex flex-col items-center justify-center gap-2">
                <ShieldCheck className="w-10 h-10 text-emerald-500/60" />
                <p className="text-sm font-semibold text-neutral-200 mt-1">Queue is clear</p>
                <p className="text-neutral-500 max-w-sm">
                  No comment reports match the current filters. All active reports have been reviewed.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-800/80">
                {reports.map((report) => {
                  const isHighPriority = report.priority === "high"
                  const isPending = report.status === "pending"
                  const isResolved = report.status === "resolved"
                  const isDismissed = report.status === "dismissed"

                  return (
                    <div
                      key={report.id}
                      className="p-4 hover:bg-neutral-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Priority badge */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                              isHighPriority
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : report.priority === "medium"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : "bg-neutral-800 text-neutral-400"
                            }`}
                          >
                            {report.priority}
                          </span>

                          {/* Reason badge */}
                          <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-[11px] font-medium text-neutral-300">
                            {report.reason.replace(/_/g, " ")}
                          </span>

                          {/* Multi-report counter */}
                          {report.reportCount > 1 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-red-600/20 text-red-400 text-[10px] font-bold border border-red-500/30">
                              {report.reportCount} reports
                            </span>
                          )}

                          {/* Status */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              isPending
                                ? "text-amber-400 bg-amber-500/10"
                                : isResolved
                                ? "text-emerald-400 bg-emerald-500/10"
                                : isDismissed
                                ? "text-neutral-500 bg-neutral-800"
                                : "text-blue-400 bg-blue-500/10"
                            }`}
                          >
                            {report.status.replace(/_/g, " ")}
                          </span>

                          <span className="text-[10px] text-neutral-500">
                            {new Date(report.createdAt).toLocaleDateString()} at{" "}
                            {new Date(report.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {/* Comment Preview */}
                        <div className="text-xs text-neutral-200 font-medium line-clamp-2 italic">
                          &ldquo;{report.commentPreview}&rdquo;
                        </div>

                        {/* Meta info */}
                        <div className="text-[11px] text-neutral-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>
                            Author: <strong className="text-neutral-300">@{report.commentAuthor}</strong>
                          </span>
                          <span>&bull;</span>
                          <span>
                            Reporter: <strong className="text-neutral-300">@{report.reporterName}</strong>
                          </span>
                          {report.description && (
                            <>
                              <span>&bull;</span>
                              <span className="text-neutral-400 line-clamp-1">
                                Note: &ldquo;{report.description}&rdquo;
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Review Action */}
                      <div className="shrink-0 flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleOpenDossier(report.id)}
                          className="h-8 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs px-3.5 font-medium cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          Review
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {reports.length > 0 && (
              <div className="p-4 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
                <div>
                  Showing {reports.length} of {pagination.totalReports} reports
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                    className="h-7 px-2.5 text-xs text-neutral-300 hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Previous
                  </Button>
                  <span>
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!pagination.hasMore}
                    onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                    className="h-7 px-2.5 text-xs text-neutral-300 hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Comprehensive Report Dossier Modal */}
      <Dialog
        open={Boolean(selectedReportId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedReportId(null)
            setDossier(null)
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-neutral-950 border-neutral-800 text-neutral-100 rounded-2xl shadow-2xl p-6 space-y-4">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                MODERATION DOSSIER &bull; ID: {selectedReportId?.slice(0, 10)}...
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                  dossier?.report.priority === "high"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-neutral-800 text-neutral-400"
                }`}
              >
                {dossier?.report.priority} priority
              </span>
            </div>
            <DialogTitle className="text-lg font-bold text-neutral-100 pt-1">
              Reported Content Review
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              Reason: <strong className="text-white capitalize">{dossier?.report.reason.replace(/_/g, " ")}</strong> &bull; Reported by @{dossier?.report.reportedBy}
            </DialogDescription>
          </DialogHeader>

          {dossierLoading || !dossier ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-neutral-400">
              <Loader2 className="w-6 h-6 animate-spin text-red-500" />
              <span>Gathering thread context & telemetry...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Reported Comment Card */}
              <div className="p-4 rounded-2xl border border-neutral-800 bg-neutral-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-semibold text-neutral-300">
                      {(dossier.comment?.authorName || "U")[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-neutral-200">
                        @{dossier.comment?.authorName || "Author"}
                      </div>
                      <div className="text-[10px] text-neutral-500">
                        {dossier.comment?.authorEmail} &bull; Status: <strong className="text-neutral-300">{dossier.comment?.status}</strong>
                      </div>
                    </div>
                  </div>

                  {/* On-Demand Translation Button (Phase 7) */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleTranslateComment}
                    disabled={translating}
                    className="h-7 text-xs text-neutral-400 hover:text-white cursor-pointer"
                  >
                    {translating ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Languages className="w-3 h-3 mr-1" />
                    )}
                    {translatedText ? "Translated" : "Translate"}
                  </Button>
                </div>

                {/* Original Text */}
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 text-xs text-neutral-100 font-sans leading-relaxed select-text">
                  {dossier.comment?.text || "[Comment removed or unavailable]"}
                </div>

                {/* Translated Text if available */}
                {translatedText && (
                  <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/30 text-xs text-blue-200 font-sans leading-relaxed">
                    <div className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider mb-1">
                      English Translation:
                    </div>
                    {translatedText}
                  </div>
                )}

                {/* Reporter's Details */}
                {dossier.report.description && (
                  <div className="text-xs text-neutral-400 bg-neutral-950/40 p-2.5 rounded-xl border border-neutral-800/50">
                    <span className="font-semibold text-neutral-300">Reporter Note:</span> &ldquo;{dossier.report.description}&rdquo;
                  </div>
                )}
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 text-xs">
                {[
                  { id: "details", label: "Overview & Signals" },
                  { id: "thread", label: `Thread Context (${dossier.threadContext.repliesCount})` },
                  { id: "history", label: `Edits (${dossier.editHistory.length})` },
                  { id: "safety", label: `Safety Events (${dossier.safetySignals.eventCount})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id as any)}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      activeTab === t.id
                        ? "bg-neutral-800 text-white font-semibold"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              {activeTab === "details" && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl border border-neutral-800/80 bg-neutral-900/40 space-y-1">
                    <div className="text-neutral-400 font-medium">Security Telemetry (Phase 9)</div>
                    <div className="text-[11px] text-neutral-300">
                      Risk Score: <strong>{dossier.telemetry.riskScore}</strong> &bull; Violations:{" "}
                      <strong>{dossier.telemetry.violationCount}</strong>
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      CAPTCHA Enforced: {dossier.telemetry.captchaRequired ? "Yes" : "No"}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-neutral-800/80 bg-neutral-900/40 space-y-1">
                    <div className="text-neutral-400 font-medium">Other Reports</div>
                    <div className="text-[11px] text-neutral-300">
                      {dossier.otherReports.length} additional reports filed on this comment
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "thread" && (
                <div className="space-y-2 text-xs">
                  {dossier.threadContext.parentComment && (
                    <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-1">
                      <div className="text-[10px] text-neutral-500 uppercase font-semibold">
                        Parent Comment (@{dossier.threadContext.parentComment.authorName})
                      </div>
                      <div className="text-neutral-300 italic">
                        &ldquo;{dossier.threadContext.parentComment.text}&rdquo;
                      </div>
                    </div>
                  )}

                  <div className="text-neutral-400 font-medium pt-1">Surrounding Replies:</div>
                  {dossier.threadContext.sampleReplies.length === 0 ? (
                    <div className="text-neutral-500 text-[11px]">No replies attached.</div>
                  ) : (
                    dossier.threadContext.sampleReplies.map((r) => (
                      <div
                        key={r.id}
                        className="p-2.5 rounded-lg border border-neutral-800/60 bg-neutral-900/20 text-[11px]"
                      >
                        <strong className="text-neutral-300">@{r.authorName}:</strong> {r.text}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "history" && (
                <div className="space-y-2 text-xs">
                  {dossier.editHistory.length === 0 ? (
                    <div className="text-neutral-500 text-[11px]">No revision history (Version 1).</div>
                  ) : (
                    dossier.editHistory.map((h) => (
                      <div
                        key={h.version}
                        className="p-3 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-1"
                      >
                        <div className="text-[10px] text-neutral-400 font-semibold">
                          Version {h.version} &bull; {new Date(h.editedAt).toLocaleString()}
                        </div>
                        <div className="text-neutral-300">&ldquo;{h.newText}&rdquo;</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "safety" && (
                <div className="space-y-2 text-xs">
                  {dossier.safetySignals.events.length === 0 ? (
                    <div className="text-neutral-500 text-[11px]">No automated safety flags detected.</div>
                  ) : (
                    dossier.safetySignals.events.map((e, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl border border-neutral-800 bg-neutral-900/40 flex items-center justify-between text-[11px]"
                      >
                        <span className="text-red-400 font-semibold uppercase">{e.eventType}</span>
                        <span className="text-neutral-300">{e.reason}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Internal Moderator Notes */}
              <div className="space-y-1 pt-2">
                <label className="text-xs font-semibold text-neutral-300">
                  Private Moderator Notes <span className="text-neutral-500 font-normal">(internal only)</span>
                </label>
                <Textarea
                  value={moderatorNotes}
                  onChange={(e) => setModeratorNotes(e.target.value)}
                  placeholder="Document reasoning, policy reference, or incident context..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-xl border border-neutral-800 bg-neutral-900/80 focus-visible:ring-1 focus-visible:ring-red-500 resize-none"
                />
              </div>

              {/* Action Buttons */}
              <DialogFooter className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-neutral-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSelectedReportId(null)}
                  className="text-neutral-400 hover:text-white text-xs cursor-pointer"
                >
                  Close
                </Button>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Dismiss */}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setActionConfirm({
                        isOpen: true,
                        action: "dismiss_report",
                        title: "Dismiss Report",
                        description: "Dismiss this report as invalid or non-violating. The comment will remain visible.",
                      })
                    }
                    className="text-neutral-400 hover:text-white text-xs cursor-pointer"
                  >
                    Dismiss Report
                  </Button>

                  {/* Hide or Restore */}
                  {dossier.comment?.status === "hidden" ? (
                    <Button
                      type="button"
                      onClick={() =>
                        setActionConfirm({
                          isOpen: true,
                          action: "restore",
                          title: "Restore Comment",
                          description: "Restore this comment to visible status for all community members.",
                        })
                      }
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Restore
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() =>
                        setActionConfirm({
                          isOpen: true,
                          action: "hide",
                          title: "Hide Comment",
                          description: "Hide this comment from normal viewers while retaining it for audit and moderation records.",
                          danger: true,
                        })
                      }
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-xl cursor-pointer"
                    >
                      <EyeOff className="w-3.5 h-3.5 mr-1" />
                      Hide Comment
                    </Button>
                  )}

                  {/* Soft Delete */}
                  <Button
                    type="button"
                    onClick={() =>
                      setActionConfirm({
                        isOpen: true,
                        action: "delete",
                        title: "Soft Delete Comment",
                        description: "Soft delete this comment according to platform policy. Edit history and replies hierarchy remain intact.",
                        danger: true,
                      })
                    }
                    className="bg-red-600 hover:bg-red-700 text-white text-xs rounded-xl cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Delete Comment
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Modal */}
      {actionConfirm && (
        <Dialog
          open={actionConfirm.isOpen}
          onOpenChange={(open) => {
            if (!open) setActionConfirm(null)
          }}
        >
          <DialogContent className="max-w-md bg-neutral-900 border-neutral-800 text-white rounded-2xl p-6">
            <DialogHeader className="space-y-2">
              <div
                className={`mx-auto w-10 h-10 rounded-full flex items-center justify-center mb-1 ${
                  actionConfirm.danger
                    ? "bg-red-500/10 text-red-500 border border-red-500/20"
                    : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                }`}
              >
                {actionConfirm.danger ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <DialogTitle className="text-center text-lg font-bold">
                {actionConfirm.title}?
              </DialogTitle>
              <DialogDescription className="text-center text-xs text-neutral-400">
                {actionConfirm.description}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex flex-row justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setActionConfirm(null)}
                disabled={actionSubmitting}
                className="text-neutral-400 hover:text-white text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmAction}
                disabled={actionSubmitting}
                className={`text-xs rounded-xl font-semibold px-4 ${
                  actionConfirm.danger
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {actionSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Executing...
                  </>
                ) : (
                  "Confirm Action"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
