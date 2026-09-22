import React, { useState, useEffect } from "react"
import Head from "next/head"
import Link from "next/link"
import {
  Download,
  BarChart3,
  Users,
  ShieldCheck,
  AlertTriangle,
  Clock,
  HardDrive,
  Calendar,
  Layers,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Monitor,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileVideo,
  FileSpreadsheet,
  Plus,
  Sliders,
  Eye,
  Activity,
  FileText,
  Lock,
  ArrowUpRight,
  UserCheck,
  Ban,
  Radio,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/AuthContext"
import axiosInstance from "@/lib/axiosinstance"

interface AdminStats {
  totalDownloads: number
  downloadsToday: number
  downloadsThisMonth: number
  successfulDownloads: number
  failedDownloads: number
  quotaLimitBlocks: number
  subscriptionExpiryBlocks: number
  bandwidthToday?: number
  activeDownloads?: number
  cached?: boolean
  downloadsByPlan: {
    free: number
    bronze: number
    silver: number
    gold: number
  }
  topDownloadedVideos: Array<{
    videoId: string
    title: string
    downloads: number
  }>
}

interface DownloadRow {
  _id: string
  userId: {
    _id?: string
    name?: string
    email?: string
  } | string
  videoId: string
  videoTitle: string
  subscription_plan: string
  download_status: string
  file_size: number
  quota_before_download: number
  quota_after_download: number
  ip_address: string
  device_id: string
  browser: string
  operating_system: string
  failure_reason?: string
  admin_notes?: string
  createdAt: string
}

type TabType = "overview" | "downloads" | "users" | "analytics" | "operations" | "reports" | "audit"

export default function AdminDownloadsPage() {
  const { user }: any = useAuth()
  const [currentTab, setCurrentTab] = useState<TabType>("overview")
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Downloads tab state
  const [downloads, setDownloads] = useState<DownloadRow[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState("")
  const [planFilter, setPlanFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedRecord, setSelectedRecord] = useState<DownloadRow | null>(null)
  const [adminNoteInput, setAdminNoteInput] = useState("")
  const [noteSubmitting, setNoteSubmitting] = useState(false)

  // Users tab state
  const [userSearchId, setUserSearchId] = useState("")
  const [userProfile, setUserProfile] = useState<any>(null)
  const [userLoading, setUserLoading] = useState(false)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [adjustType, setAdjustType] = useState("ADD_CREDIT")
  const [adjustAmount, setAdjustAmount] = useState(5)
  const [adjustReason, setAdjustReason] = useState("")
  const [adjustNotes, setAdjustNotes] = useState("")
  const [adjustHistory, setAdjustHistory] = useState<any[]>([])
  const [adjustSubmitting, setAdjustSubmitting] = useState(false)

  // Analytics tab state
  const [topVideos, setTopVideos] = useState<any[]>([])
  const [hourlyData, setHourlyData] = useState<any[]>([])
  const [failureData, setFailureData] = useState<any>(null)
  const [deviceData, setDeviceData] = useState<any>(null)

  // Operations tab state
  const [opsSummary, setOpsSummary] = useState<any>(null)
  const [activeDownloadsList, setActiveDownloadsList] = useState<any[]>([])
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // Reports tab state
  const [selectedReportType, setSelectedReportType] = useState("DAILY_SUMMARY")
  const [reportPreview, setReportPreview] = useState<any>(null)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportJobResult, setExportJobResult] = useState<any>(null)

  // Audit tab state
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 MB"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  // Initial stats fetch
  const fetchOverviewStats = async () => {
    try {
      const res = await axiosInstance.get("/api/admin/dashboard/summary")
      if (res.data?.data) {
        setStats(res.data.data)
      } else if (res.data) {
        setStats(res.data)
      }
    } catch (err) {
      console.error("Failed to load overview statistics:", err)
    }
  }

  // Fetch downloads
  const fetchDownloads = async () => {
    setLoading(true)
    try {
      const res = await axiosInstance.get("/api/admin/downloads", {
        params: {
          page,
          limit: 15,
          plan: planFilter,
          status: statusFilter,
          search: search.trim() || undefined,
        },
      })
      if (res.data?.data?.downloads) {
        setDownloads(res.data.data.downloads)
        setTotalPages(res.data.data.pagination?.totalPages || 1)
        setTotalCount(res.data.data.pagination?.total || 0)
      }
    } catch (err) {
      console.error("Failed to load downloads list:", err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch Analytics tab data
  const fetchAnalyticsData = async () => {
    try {
      const [topRes, hourlyRes, failureRes, deviceRes] = await Promise.all([
        axiosInstance.get("/api/admin/analytics/videos/top?limit=10").catch(() => null),
        axiosInstance.get("/api/admin/analytics/hourly").catch(() => null),
        axiosInstance.get("/api/admin/analytics/failures").catch(() => null),
        axiosInstance.get("/api/admin/analytics/devices").catch(() => null),
      ])
      if (topRes?.data?.data) setTopVideos(topRes.data.data)
      if (hourlyRes?.data?.data) setHourlyData(hourlyRes.data.data)
      if (failureRes?.data?.data) setFailureData(failureRes.data.data)
      if (deviceRes?.data?.data) setDeviceData(deviceRes.data.data)
    } catch (err) {
      console.error("Failed to load analytics data:", err)
    }
  }

  // Fetch Operations tab data
  const fetchOperationsData = async () => {
    try {
      const [summaryRes, activeRes] = await Promise.all([
        axiosInstance.get("/api/admin/operations/summary").catch(() => null),
        axiosInstance.get("/api/admin/operations/active-downloads").catch(() => null),
      ])
      if (summaryRes?.data?.data) setOpsSummary(summaryRes.data.data)
      if (activeRes?.data?.data) setActiveDownloadsList(activeRes.data.data)
    } catch (err) {
      console.error("Failed to load operations data:", err)
    }
  }

  // Fetch Audit Logs tab data
  const fetchAuditLogs = async () => {
    setAuditLoading(true)
    try {
      const res = await axiosInstance.get("/api/admin/audit-logs", { params: { limit: 25 } })
      if (res.data?.data?.logs) {
        setAuditLogs(res.data.data.logs)
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err)
    } finally {
      setAuditLoading(false)
    }
  }

  useEffect(() => {
    fetchOverviewStats()
  }, [])

  useEffect(() => {
    if (currentTab === "downloads") {
      fetchDownloads()
    } else if (currentTab === "analytics") {
      fetchAnalyticsData()
    } else if (currentTab === "operations") {
      fetchOperationsData()
    } else if (currentTab === "audit") {
      fetchAuditLogs()
    }
  }, [currentTab, page, planFilter, statusFilter])

  // Handle note addition to download
  const handleAddDownloadNote = async () => {
    if (!selectedRecord || !adminNoteInput.trim()) return
    setNoteSubmitting(true)
    try {
      await axiosInstance.post(`/api/admin/downloads/${selectedRecord._id}/notes`, {
        note: adminNoteInput.trim(),
      })
      setSelectedRecord((prev) => (prev ? { ...prev, admin_notes: adminNoteInput.trim() } : null))
      setAdminNoteInput("")
      fetchDownloads()
    } catch (err) {
      console.error("Failed to add note:", err)
    } finally {
      setNoteSubmitting(false)
    }
  }

  // Handle User profile lookup
  const handleLookupUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!userSearchId.trim()) return
    setUserLoading(true)
    try {
      const [profileRes, historyRes] = await Promise.all([
        axiosInstance.get(`/api/admin/users/${userSearchId.trim()}/downloads`),
        axiosInstance.get(`/api/admin/users/${userSearchId.trim()}/quota/history`).catch(() => null),
      ])
      if (profileRes.data?.data) {
        setUserProfile(profileRes.data.data)
      }
      if (historyRes?.data?.data) {
        setAdjustHistory(historyRes.data.data)
      }
    } catch (err) {
      console.error("User lookup failed:", err)
      alert("User not found or lookup failed.")
    } finally {
      setUserLoading(false)
    }
  }

  // Handle manual quota adjustment
  const handleQuotaAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userProfile?.user?._id) return
    setAdjustSubmitting(true)
    try {
      await axiosInstance.post(`/api/admin/users/${userProfile.user._id}/quota/adjust`, {
        adjustmentType: adjustType,
        amount: Number(adjustAmount),
        reason: adjustReason || "Manual administrative adjustment",
        notes: adjustNotes || undefined,
      })
      alert("Quota adjusted successfully!")
      setAdjustModalOpen(false)
      setAdjustReason("")
      setAdjustNotes("")
      handleLookupUser()
    } catch (err: any) {
      console.error("Quota adjustment failed:", err)
      alert(err.response?.data?.message || "Failed to adjust quota.")
    } finally {
      setAdjustSubmitting(false)
    }
  }

  // Handle cancel active download
  const handleCancelDownload = async (downloadId: string) => {
    if (!confirm("Are you sure you want to cancel and abort this active download?")) return
    setCancellingId(downloadId)
    try {
      await axiosInstance.post(`/api/admin/operations/downloads/${downloadId}/cancel`, {
        reason: "Cancelled by Administrator via Dashboard",
      })
      fetchOperationsData()
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to cancel active download.")
    } finally {
      setCancellingId(null)
    }
  }

  // Handle Report preview fetch
  const handleLoadReportPreview = async () => {
    try {
      const res = await axiosInstance.get(`/api/admin/reports/${selectedReportType}`)
      if (res.data?.data) {
        setReportPreview(res.data.data)
      }
    } catch (err) {
      console.error("Failed to load report data:", err)
    }
  }

  // Handle Report CSV export
  const handleTriggerExport = async () => {
    setExportLoading(true)
    try {
      const res = await axiosInstance.post("/api/admin/reports/export", {
        reportType: selectedReportType,
        format: "csv",
      })
      if (res.data?.data) {
        setExportJobResult(res.data.data)
      }
    } catch (err) {
      console.error("Failed to start report export:", err)
      alert("Failed to initiate export job.")
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Admin Download Management & Analytics Dashboard</title>
      </Head>
      <div className="min-h-screen bg-neutral-50/60 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200/60 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                    Admin Download Central
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-red-100 text-red-700 border border-red-200">
                    Admin Control
                  </span>
                </div>
                <p className="text-neutral-500 text-xs mt-0.5">
                  Complete telemetry, fraud mitigation, quota overrides, and compliance operations.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => {
                fetchOverviewStats()
                if (currentTab === "downloads") fetchDownloads()
                if (currentTab === "analytics") fetchAnalyticsData()
                if (currentTab === "operations") fetchOperationsData()
                if (currentTab === "audit") fetchAuditLogs()
              }}
              variant="outline"
              size="sm"
              className="rounded-xl bg-white hover:bg-neutral-100 text-xs font-medium cursor-pointer shadow-2xs border-neutral-200"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
            <Link href="/downloads">
              <Button
                size="sm"
                className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-medium cursor-pointer shadow-2xs"
              >
                <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                User Downloads
              </Button>
            </Link>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-neutral-200/80">
          {[
            { key: "overview", label: "Overview & KPIs", icon: BarChart3 },
            { key: "downloads", label: "Downloads Audit", icon: Download },
            { key: "users", label: "User Management & Quotas", icon: Users },
            { key: "analytics", label: "Video & Plan Analytics", icon: TrendingUp },
            { key: "operations", label: "Active Operations", icon: Activity },
            { key: "reports", label: "Reports & CSV Export", icon: FileSpreadsheet },
            { key: "audit", label: "Security & Audit Logs", icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon
            const active = currentTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setCurrentTab(tab.key as TabType)
                  setPage(1)
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* TAB 1: OVERVIEW */}
        {currentTab === "overview" && (
          <div className="space-y-6">
            {/* METRICS GRID */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Downloads */}
              <div className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-neutral-500">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                    Total Downloads
                  </span>
                  <HardDrive className="w-4 h-4 text-neutral-400" />
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-neutral-900">
                    {stats?.totalDownloads || 0}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500 border-t border-neutral-100 pt-2">
                  <span>Today: {stats?.downloadsToday || 0}</span>
                  <span>Month: {stats?.downloadsThisMonth || 0}</span>
                </div>
              </div>

              {/* Completed */}
              <div className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-neutral-500">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                    Successful
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-emerald-600">
                    {stats?.successfulDownloads || 0}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-neutral-500 border-t border-neutral-100 pt-2">
                  Completed file streams verified
                </div>
              </div>

              {/* Quota Limit Blocks */}
              <div className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-neutral-500">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                    Quota Blocks
                  </span>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-amber-600">
                    {stats?.quotaLimitBlocks || 0}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-neutral-500 border-t border-neutral-100 pt-2">
                  Daily/monthly quota guard rejections
                </div>
              </div>

              {/* Expired Subscription Blocks */}
              <div className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-neutral-500">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                    Expired Blocks
                  </span>
                  <Lock className="w-4 h-4 text-red-500" />
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-red-600">
                    {stats?.subscriptionExpiryBlocks || 0}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-neutral-500 border-t border-neutral-100 pt-2">
                  Invalid or lapsed plan access blocks
                </div>
              </div>
            </div>

            {/* PLAN DISTRIBUTION CARDS */}
            {stats?.downloadsByPlan && (
              <div className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-neutral-600" />
                    <span>Downloads by Subscription Tier</span>
                  </h3>
                  {stats.cached && (
                    <span className="text-[10px] bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full font-mono">
                      Cached (30s TTL)
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Free Tier", key: "free", badge: "bg-neutral-100 text-neutral-800" },
                    { label: "Bronze Tier", key: "bronze", badge: "bg-amber-50 text-amber-900 border border-amber-200" },
                    { label: "Silver Tier", key: "silver", badge: "bg-slate-100 text-slate-800 border border-slate-200" },
                    { label: "Gold Tier", key: "gold", badge: "bg-yellow-50 text-yellow-900 border border-yellow-200" },
                  ].map((p) => {
                    const count = (stats.downloadsByPlan as any)[p.key] || 0
                    return (
                      <div key={p.key} className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/60">
                        <span className="text-xs font-semibold text-neutral-600 block">
                          {p.label}
                        </span>
                        <div className="flex items-baseline justify-between mt-2">
                          <span className="text-2xl font-black text-neutral-900">
                            {count}
                          </span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${p.badge}`}>
                            {p.key}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* TOP DOWNLOADED VIDEOS QUICK PREVIEW */}
            {stats?.topDownloadedVideos && stats.topDownloadedVideos.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-2xs">
                <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
                  <FileVideo className="w-4 h-4 text-neutral-600" />
                  <span>Top Downloaded Video Content</span>
                </h3>
                <div className="divide-y divide-neutral-100">
                  {stats.topDownloadedVideos.map((v, i) => (
                    <div key={v.videoId || i} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-neutral-400 font-bold w-4">{i + 1}</span>
                        <span className="font-semibold text-neutral-800">{v.title || "Video"}</span>
                      </div>
                      <span className="font-bold px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-800">
                        {v.downloads} downloads
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DOWNLOADS AUDIT LIST */}
        {currentTab === "downloads" && (
          <div className="space-y-4">
            {/* FILTERS */}
            <div className="bg-white rounded-2xl p-4 border border-neutral-200/80 space-y-3 shadow-2xs">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setPage(1)
                  fetchDownloads()
                }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter by title, client IP, device ID, or user..."
                    className="pl-9 h-10 rounded-xl bg-neutral-50 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={planFilter}
                    onChange={(e) => {
                      setPlanFilter(e.target.value)
                      setPage(1)
                    }}
                    className="h-10 px-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-700 focus:outline-none"
                  >
                    <option value="all">All Plans</option>
                    <option value="free">Free</option>
                    <option value="bronze">Bronze</option>
                    <option value="silver">Silver</option>
                    <option value="gold">Gold</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value)
                      setPage(1)
                    }}
                    className="h-10 px-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-700 focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="authorized">Authorized</option>
                    <option value="started">Started</option>
                    <option value="completed">Completed</option>
                    <option value="blocked">Blocked</option>
                    <option value="interrupted">Interrupted</option>
                  </select>

                  <Button type="submit" size="sm" className="h-10 px-4 rounded-xl bg-neutral-900 text-white text-xs cursor-pointer">
                    Filter
                  </Button>
                </div>
              </form>
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden shadow-2xs">
              <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="font-bold text-xs sm:text-sm text-neutral-900">
                  Authoritative Download Records ({totalCount})
                </h3>
                <span className="text-xs text-neutral-500">Page {page} of {totalPages}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-200">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Video</th>
                      <th className="py-3 px-4">Plan</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">IP / Device</th>
                      <th className="py-3 px-4">Size</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-neutral-400">
                          Loading records...
                        </td>
                      </tr>
                    ) : downloads.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-neutral-400">
                          No download records match the criteria.
                        </td>
                      </tr>
                    ) : (
                      downloads.map((row) => {
                        const userEmail =
                          typeof row.userId === "object" && row.userId !== null
                            ? row.userId.email || row.userId.name || "User"
                            : "User"

                        return (
                          <tr
                            key={row._id}
                            className="hover:bg-neutral-50/80 transition-colors"
                          >
                            <td className="py-3 px-4 font-medium text-neutral-800">
                              {userEmail}
                            </td>
                            <td className="py-3 px-4 max-w-xs truncate font-medium text-neutral-900">
                              {row.videoTitle || "Video"}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-block px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 font-semibold uppercase text-[10px]">
                                {row.subscription_plan}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${
                                  row.download_status === "completed"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : row.download_status === "blocked"
                                    ? "bg-red-50 text-red-700"
                                    : row.download_status === "interrupted"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-blue-50 text-blue-700"
                                }`}
                              >
                                {row.download_status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-neutral-600 font-mono text-[11px]">
                              {row.ip_address || "127.0.0.1"}
                            </td>
                            <td className="py-3 px-4 text-neutral-600">
                              {formatBytes(row.file_size)}
                            </td>
                            <td className="py-3 px-4 text-neutral-500 whitespace-nowrap">
                              {new Date(row.createdAt).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                onClick={() => setSelectedRecord(row)}
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 rounded-lg text-[11px] cursor-pointer"
                              >
                                Inspect
                              </Button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}
              <div className="p-4 border-t border-neutral-100 flex items-center justify-between">
                <Button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  variant="outline"
                  size="sm"
                  className="text-xs rounded-xl"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <span className="text-xs text-neutral-500">
                  Page {page} of {totalPages}
                </span>
                <Button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  variant="outline"
                  size="sm"
                  className="text-xs rounded-xl"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: USER MANAGEMENT & QUOTAS */}
        {currentTab === "users" && (
          <div className="space-y-6">
            {/* USER LOOKUP FORM */}
            <div className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-2xs">
              <h3 className="text-sm font-bold text-neutral-900 mb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-neutral-700" />
                <span>Lookup User Download & Quota Profile</span>
              </h3>
              <p className="text-xs text-neutral-500 mb-4">
                Enter a MongoDB User ID to view download quotas, lifetime statistics, and perform manual adjustments.
              </p>
              <form onSubmit={handleLookupUser} className="flex gap-3">
                <Input
                  value={userSearchId}
                  onChange={(e) => setUserSearchId(e.target.value)}
                  placeholder="Enter User ID (e.g. 64b8a21f7c...)"
                  className="flex-1 rounded-xl text-xs"
                />
                <Button
                  type="submit"
                  disabled={userLoading}
                  className="bg-neutral-900 text-white rounded-xl text-xs px-5 cursor-pointer"
                >
                  {userLoading ? "Loading..." : "Search User"}
                </Button>
              </form>
            </div>

            {/* USER DETAILS CARD */}
            {userProfile && (
              <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-2xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-100 gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      User Profile
                    </span>
                    <h2 className="text-lg font-bold text-neutral-900">
                      {userProfile.user?.name || "User"} ({userProfile.user?.email})
                    </h2>
                    <span className="font-mono text-xs text-neutral-500">
                      ID: {userProfile.user?._id}
                    </span>
                  </div>

                  <Button
                    onClick={() => setAdjustModalOpen(true)}
                    className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold px-4 cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5 mr-1.5" />
                    Adjust User Quota
                  </Button>
                </div>

                {/* QUOTA STATS */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                    <span className="text-xs text-neutral-500 block">Subscription Tier</span>
                    <span className="text-base font-bold text-neutral-900 uppercase mt-1 block">
                      {userProfile.quota?.plan || "free"}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                    <span className="text-xs text-neutral-500 block">Daily Quota Usage</span>
                    <span className="text-base font-bold text-neutral-900 mt-1 block">
                      {userProfile.quota?.dailyUsed || 0} / {userProfile.quota?.dailyQuota ?? "∞"}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                    <span className="text-xs text-neutral-500 block">Daily Remaining</span>
                    <span className="text-base font-bold text-emerald-600 mt-1 block">
                      {userProfile.quota?.dailyRemaining ?? "Unlimited"}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                    <span className="text-xs text-neutral-500 block">Lifetime Completed</span>
                    <span className="text-base font-bold text-neutral-900 mt-1 block">
                      {userProfile.stats?.successfulDownloads ?? userProfile.stats?.completedDownloads ?? 0}
                    </span>
                  </div>
                </div>

                {/* ADJUSTMENT HISTORY */}
                {adjustHistory.length > 0 && (
                  <div className="pt-4 border-t border-neutral-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600 mb-3">
                      Administrative Quota Adjustments Log
                    </h4>
                    <div className="divide-y divide-neutral-100 text-xs">
                      {adjustHistory.map((adj) => (
                        <div key={adj._id} className="py-2.5 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-neutral-800 uppercase text-[11px] mr-2">
                              {adj.adjustmentType}:
                            </span>
                            <span className="text-neutral-600 font-medium">
                              {adj.amount > 0 ? `+${adj.amount}` : adj.amount} credits ({adj.reason})
                            </span>
                          </div>
                          <span className="text-neutral-400 text-[11px]">
                            {new Date(adj.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ANALYTICS */}
        {currentTab === "analytics" && (
          <div className="space-y-6">
            {/* TOP 10 VIDEOS */}
            <div className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-2xs">
              <h3 className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <FileVideo className="w-4 h-4 text-neutral-700" />
                <span>Top Downloaded Videos (Analytics)</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-200">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Title</th>
                      <th className="py-2.5 px-3">Video ID</th>
                      <th className="py-2.5 px-3">Total Downloads</th>
                      <th className="py-2.5 px-3">Bandwidth Transferred</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {topVideos.map((v, i) => (
                      <tr key={v.videoId || i} className="hover:bg-neutral-50">
                        <td className="py-2.5 px-3 font-bold text-neutral-400">{i + 1}</td>
                        <td className="py-2.5 px-3 font-medium text-neutral-900">{v.title || "Video"}</td>
                        <td className="py-2.5 px-3 font-mono text-neutral-500 text-[11px]">{v.videoId}</td>
                        <td className="py-2.5 px-3 font-bold text-neutral-900">{v.count || v.downloads}</td>
                        <td className="py-2.5 px-3 text-neutral-600">{formatBytes(v.totalBytes || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* FAILURE ANALYSIS */}
            {failureData && (
              <div className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-2xs">
                <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span>Download Failure Diagnostics</span>
                </h3>
                <p className="text-xs text-neutral-500 mb-4">
                  Aggregated reasons why download requests were blocked or failed.
                </p>
                <div className="space-y-2">
                  {failureData.breakdown?.map((fb: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100 text-xs">
                      <span className="font-semibold text-neutral-800">{fb.reason}</span>
                      <span className="font-bold text-red-600">{fb.count} incidents</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ACTIVE OPERATIONS */}
        {currentTab === "operations" && (
          <div className="space-y-6">
            {/* OPS OVERVIEW CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-2xs">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Active Concurrency
                </span>
                <div className="text-2xl font-black text-neutral-900 mt-2">
                  {opsSummary?.activeDownloads || 0} In-Flight
                </div>
                <span className="text-[11px] text-neutral-500 mt-1 block">Live video stream sessions</span>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-2xs">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Stuck Downloads
                </span>
                <div className="text-2xl font-black text-amber-600 mt-2">
                  {opsSummary?.stuckDownloads || 0} Stuck
                </div>
                <span className="text-[11px] text-neutral-500 mt-1 block">Downloads active &gt; 30 minutes</span>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-2xs">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  System Health
                </span>
                <div className="text-2xl font-black text-emerald-600 mt-2">
                  {opsSummary?.queueHealth || "HEALTHY"}
                </div>
                <span className="text-[11px] text-neutral-500 mt-1 block">Storage & queue responsiveness</span>
              </div>
            </div>

            {/* ACTIVE DOWNLOADS LIST */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-bold text-neutral-900">
                  Currently Active Video Streams
                </h3>
                <Button
                  onClick={fetchOperationsData}
                  size="sm"
                  variant="outline"
                  className="rounded-lg text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-200">
                    <tr>
                      <th className="py-2.5 px-3">Session ID</th>
                      <th className="py-2.5 px-3">Video Title</th>
                      <th className="py-2.5 px-3">Started</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {activeDownloadsList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-neutral-400">
                          No downloads currently running in background.
                        </td>
                      </tr>
                    ) : (
                      activeDownloadsList.map((row) => (
                        <tr key={row._id} className="hover:bg-neutral-50">
                          <td className="py-2.5 px-3 font-mono text-[11px]">{row._id}</td>
                          <td className="py-2.5 px-3 font-medium text-neutral-800">{row.videoTitle}</td>
                          <td className="py-2.5 px-3 text-neutral-500">
                            {new Date(row.startedAt || row.createdAt).toLocaleTimeString()}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                              Active
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Button
                              onClick={() => handleCancelDownload(row._id)}
                              disabled={cancellingId === row._id}
                              size="sm"
                              variant="destructive"
                              className="h-7 px-2.5 text-[10px] rounded-lg cursor-pointer"
                            >
                              {cancellingId === row._id ? "Cancelling..." : "Cancel"}
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: REPORTS & EXPORT */}
        {currentTab === "reports" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Export Administrative & Compliance Reports</span>
              </h3>
              <p className="text-xs text-neutral-500">
                Generate and download comprehensive audit records formatted in standard RFC4180 CSV with single-use authorization tokens.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <select
                  value={selectedReportType}
                  onChange={(e) => setSelectedReportType(e.target.value)}
                  className="h-10 px-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-800 focus:outline-none"
                >
                  <option value="DAILY_SUMMARY">Daily Summary Report</option>
                  <option value="VIDEO_PERFORMANCE">Video Performance Report</option>
                  <option value="USER_ACTIVITY">User Download Activity Report</option>
                  <option value="FAILURE_ANALYSIS">Failure & Security Blocks Report</option>
                  <option value="SECURITY_AUDIT">Security Audit Report</option>
                </select>

                <Button
                  onClick={handleLoadReportPreview}
                  variant="outline"
                  className="rounded-xl text-xs h-10 px-4 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  Preview Data
                </Button>

                <Button
                  onClick={handleTriggerExport}
                  disabled={exportLoading}
                  className="rounded-xl text-xs h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  {exportLoading ? "Generating CSV..." : "Export as CSV"}
                </Button>
              </div>

              {/* EXPORT RESULT ALERT */}
              {exportJobResult && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold block">CSV Export Ready:</span>
                    <span>Job ID: {exportJobResult.jobId}</span>
                  </div>
                  <a
                    href={exportJobResult.downloadUrl || `/api/admin/reports/exports/${exportJobResult.jobId}/download?token=${exportJobResult.token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-emerald-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 hover:bg-emerald-800"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download CSV
                  </a>
                </div>
              )}
            </div>

            {/* REPORT PREVIEW */}
            {reportPreview && (
              <div className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                    Report Preview: {reportPreview.reportType}
                  </h4>
                  <span className="text-[11px] text-neutral-400">
                    {reportPreview.rowCount || 0} total records
                  </span>
                </div>
                <div className="max-h-80 overflow-y-auto border border-neutral-100 rounded-xl">
                  <pre className="p-3 text-[11px] text-neutral-700 font-mono">
                    {JSON.stringify(reportPreview.data?.slice(0, 10), null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 7: AUDIT LOGS */}
        {currentTab === "audit" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-bold text-neutral-900">
                  Administrative System & Security Audit Stream
                </h3>
                <Button
                  onClick={fetchAuditLogs}
                  disabled={auditLoading}
                  size="sm"
                  variant="outline"
                  className="rounded-lg text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Refresh Logs
                </Button>
              </div>

              <div className="divide-y divide-neutral-100 text-xs">
                {auditLoading ? (
                  <div className="p-8 text-center text-neutral-400">Loading audit stream...</div>
                ) : auditLogs.length === 0 ? (
                  <div className="p-8 text-center text-neutral-400">No recent audit records found.</div>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log._id} className="p-4 hover:bg-neutral-50 transition-colors flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md font-mono font-bold text-[10px] bg-neutral-100 text-neutral-800">
                            {log.event_type || log.event || "ADMIN_ACTION"}
                          </span>
                          <span className="text-neutral-500 font-mono text-[11px]">
                            {log.ip_address || "127.0.0.1"}
                          </span>
                        </div>
                        <p className="text-neutral-700 font-medium">
                          {log.details ? JSON.stringify(log.details) : "No extra metadata"}
                        </p>
                      </div>
                      <span className="text-neutral-400 text-[11px] whitespace-nowrap">
                        {new Date(log.createdAt || log.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* DETAILS & NOTES MODAL */}
        {selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl relative space-y-4">
              <div className="flex items-center justify-between pb-3 border-b">
                <h3 className="font-bold text-base text-neutral-900">
                  Download Audit Details
                </h3>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-neutral-400 block">Record ID:</span>
                  <span className="font-mono text-neutral-800">{selectedRecord._id}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block">Video Title:</span>
                  <span className="font-semibold text-neutral-900">{selectedRecord.videoTitle}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block">Status:</span>
                  <span className="font-bold uppercase text-neutral-900">{selectedRecord.download_status}</span>
                </div>
                {selectedRecord.failure_reason && (
                  <div className="p-2.5 rounded-lg bg-red-50 text-red-900">
                    <span className="font-semibold block">Rejection / Failure Reason:</span>
                    <span>{selectedRecord.failure_reason}</span>
                  </div>
                )}
                <div>
                  <span className="text-neutral-400 block">Client IP & Device:</span>
                  <span className="font-mono text-neutral-800">
                    {selectedRecord.ip_address} · {selectedRecord.device_id}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400 block">Quota Before / After:</span>
                  <span className="text-neutral-800">
                    Before: {selectedRecord.quota_before_download} → After: {selectedRecord.quota_after_download}
                  </span>
                </div>
                {selectedRecord.admin_notes && (
                  <div className="p-2.5 rounded-lg bg-amber-50 text-amber-900">
                    <span className="font-semibold block">Admin Notes:</span>
                    <span>{selectedRecord.admin_notes}</span>
                  </div>
                )}

                {/* ADD NOTE FORM */}
                <div className="pt-2">
                  <span className="text-neutral-500 block mb-1 font-semibold">Add Internal Note:</span>
                  <div className="flex gap-2">
                    <Input
                      value={adminNoteInput}
                      onChange={(e) => setAdminNoteInput(e.target.value)}
                      placeholder="Add compliance or investigation note..."
                      className="text-xs rounded-xl"
                    />
                    <Button
                      onClick={handleAddDownloadNote}
                      disabled={noteSubmitting}
                      size="sm"
                      className="bg-neutral-900 text-white rounded-xl text-xs px-3"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end">
                <Button
                  onClick={() => setSelectedRecord(null)}
                  size="sm"
                  className="rounded-full bg-neutral-900 text-white text-xs px-4"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* QUOTA ADJUSTMENT MODAL */}
        {adjustModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-4">
              <div className="flex items-center justify-between pb-3 border-b">
                <h3 className="font-bold text-base text-neutral-900">
                  Adjust Quota for {userProfile?.user?.name || "User"}
                </h3>
                <button
                  onClick={() => setAdjustModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleQuotaAdjustSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="text-neutral-600 block mb-1 font-semibold">Adjustment Type</label>
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-800"
                  >
                    <option value="ADD_CREDIT">ADD_CREDIT (Bonus Downloads)</option>
                    <option value="REMOVE_CREDIT">REMOVE_CREDIT (Deduct Downloads)</option>
                    <option value="TEMPORARY_LIMIT">TEMPORARY_LIMIT (Daily Cap Override)</option>
                    <option value="CUSTOM_RESTRICTION">CUSTOM_RESTRICTION (Administrative Limit)</option>
                  </select>
                </div>

                <div>
                  <label className="text-neutral-600 block mb-1 font-semibold">Amount / Credits</label>
                  <Input
                    type="number"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(Number(e.target.value))}
                    className="rounded-xl text-xs"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="text-neutral-600 block mb-1 font-semibold">Reason for Adjustment</label>
                  <Input
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="e.g. VIP goodwill bonus, support resolution..."
                    className="rounded-xl text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="text-neutral-600 block mb-1 font-semibold">Admin Notes (Optional)</label>
                  <Input
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder="Internal case ticket or reference #..."
                    className="rounded-xl text-xs"
                  />
                </div>

                <div className="pt-3 border-t flex justify-end gap-2">
                  <Button
                    type="button"
                    onClick={() => setAdjustModalOpen(false)}
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={adjustSubmitting}
                    size="sm"
                    className="bg-neutral-900 text-white rounded-xl text-xs px-4"
                  >
                    {adjustSubmitting ? "Applying..." : "Apply Adjustment"}
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
