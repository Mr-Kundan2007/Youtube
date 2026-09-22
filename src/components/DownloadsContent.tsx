import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import {
  Download,
  Play,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  HardDrive,
  Calendar,
  Layers,
  ChevronRight,
  ShieldCheck,
  Search,
  Filter,
  ArrowUpRight,
  Loader2,
  Zap,
  Smartphone,
  Monitor,
  Laptop,
  Bell,
  Settings,
  HelpCircle,
  Shield,
  Trash2,
  Edit3,
  X,
  FileSpreadsheet,
  Check,
  RefreshCw,
  Send,
  Flag,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/AuthContext"
import axiosInstance from "@/lib/axiosinstance"

interface DownloadItem {
  _id: string
  id?: string
  videoId: string
  videoTitle: string
  thumbnailUrl: string
  subscription_plan: string
  download_status: string
  file_size: number
  quota_before_download: number
  quota_after_download: number
  createdAt: string
  download_completed_at?: string
  failure_reason?: string
  userFriendlyFailureReason?: string
  isRetryable?: boolean
  retryCount?: number
}

interface QuotaData {
  plan: string
  planKey: string
  quotaLimit: number
  quotaUsed: number
  quotaRemaining: number
  quotaType: string
  resetAt: string
  isSubscriptionActive: boolean
  isSubscriptionExpired: boolean
  subscriptionExpiresAt: string | null
}

interface DeviceItem {
  id?: string
  deviceId: string
  name: string
  deviceName?: string
  type: string
  deviceType?: string
  browser: string
  operatingSystem: string
  status: string
  isCurrentDevice?: boolean
  lastActivityAt?: string
  lastSeenAt?: string
  registeredAt?: string
  firstSeenAt?: string
}

interface NotificationItem {
  _id: string
  id?: string
  type: string
  title: string
  message: string
  isRead: boolean
  read: boolean
  createdAt: string
}

interface SupportTicketItem {
  _id: string
  id?: string
  ticketNumber: string
  issueType: string
  subject?: string
  status: string
  priority: string
  messages: Array<{
    senderType: string
    message: string
    createdAt: string
  }>
  createdAt: string
}

interface PreferenceData {
  preferredQuality: string
  autoRetryOnFailure: boolean
  notifyOnCompletion: boolean
  notifyOnQuotaThreshold: boolean
  askDownloadConfirmation: boolean
}

export default function DownloadsContent() {
  const router = useRouter()
  const { user, openAuthModal }: any = useAuth()

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<
    "overview" | "active" | "history" | "devices" | "notifications" | "preferences" | "support" | "security"
  >("overview")

  // Core data states
  const [downloads, setDownloads] = useState<DownloadItem[]>([])
  const [activeDownloads, setActiveDownloads] = useState<DownloadItem[]>([])
  const [quota, setQuota] = useState<QuotaData | null>(null)
  const [devices, setDevices] = useState<DeviceItem[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [tickets, setTickets] = useState<SupportTicketItem[]>([])
  const [preferences, setPreferences] = useState<PreferenceData>({
    preferredQuality: "1080p",
    autoRetryOnFailure: true,
    notifyOnCompletion: true,
    notifyOnQuotaThreshold: true,
    askDownloadConfirmation: false,
  })
  const [securityData, setSecurityData] = useState<any>(null)

  // Loading & UI states
  const [loading, setLoading] = useState(true)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Modals & form states
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null)
  const [plans, setPlans] = useState<any[]>([])

  // Device rename modal state
  const [editingDevice, setEditingDevice] = useState<DeviceItem | null>(null)
  const [newDeviceName, setNewDeviceName] = useState("")

  // Support ticket form state
  const [ticketIssueType, setTicketIssueType] = useState("DOWNLOAD_FAILED")
  const [ticketDescription, setTicketDescription] = useState("")
  const [ticketDownloadId, setTicketDownloadId] = useState("")
  const [submittingTicket, setSubmittingTicket] = useState(false)

  // Suspicious report modal state
  const [reportingDownload, setReportingDownload] = useState<DownloadItem | null>(null)
  const [reportReason, setReportReason] = useState("")
  const [submittingReport, setSubmittingReport] = useState(false)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }

  // Initial data loading
  const fetchAllData = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      const [quotaRes, downloadsRes, activeRes, devicesRes, notifRes, prefRes, secRes, ticketRes] =
        await Promise.all([
          axiosInstance.get("/api/downloads/quota").catch(() => null),
          axiosInstance.get("/api/downloads?limit=50").catch(() => null),
          axiosInstance.get("/api/downloads/active").catch(() => null),
          axiosInstance.get("/api/devices").catch(() => null),
          axiosInstance.get("/api/notifications?limit=20").catch(() => null),
          axiosInstance.get("/api/downloads/preferences").catch(() => null),
          axiosInstance.get("/api/downloads/security").catch(() => null),
          axiosInstance.get("/api/support/tickets").catch(() => null),
        ])

      if (quotaRes?.data?.data) {
        setQuota(quotaRes.data.data)
      } else if (quotaRes?.data) {
        setQuota(quotaRes.data)
      }

      if (downloadsRes?.data?.data?.downloads) {
        setDownloads(downloadsRes.data.data.downloads)
      } else if (Array.isArray(downloadsRes?.data?.downloads)) {
        setDownloads(downloadsRes.data.downloads)
      }

      if (activeRes?.data?.data?.activeDownloads) {
        setActiveDownloads(activeRes.data.data.activeDownloads)
      }

      if (devicesRes?.data?.data?.devices) {
        setDevices(devicesRes.data.data.devices)
      }

      if (notifRes?.data?.data?.notifications) {
        setNotifications(notifRes.data.data.notifications)
      }

      if (prefRes?.data?.data) {
        setPreferences(prefRes.data.data)
      }

      if (secRes?.data?.data) {
        setSecurityData(secRes.data.data)
      }

      if (ticketRes?.data?.data?.tickets) {
        setTickets(ticketRes.data.data.tickets)
      }
    } catch (err) {
      console.error("Error loading user download center data:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [user])

  // Upgrade Plan Dialog
  const openUpgradeDialog = async () => {
    setUpgradeModalOpen(true)
    if (plans.length === 0) {
      try {
        const { data } = await axiosInstance.get("/api/subscription/plans")
        if (data?.data?.plans) {
          setPlans(data.data.plans)
        }
      } catch (err) {
        console.warn("Could not fetch plans list:", err)
      }
    }
  }

  const handleUpgradePlan = async (planKey: string) => {
    setUpgradeLoading(planKey)
    try {
      await axiosInstance.post("/api/subscription/upgrade", { plan: planKey })
      showToast(`Successfully switched to ${planKey.toUpperCase()} plan!`)
      setUpgradeModalOpen(false)
      fetchAllData()
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || "Failed to update plan.")
    } finally {
      setUpgradeLoading(null)
    }
  }

  // Retry Download
  const handleRetryDownload = async (item: DownloadItem) => {
    setRetryingId(item._id)
    try {
      let deviceId = typeof window !== "undefined" ? localStorage.getItem("deviceId") : null
      if (!deviceId && typeof window !== "undefined") {
        deviceId = "dev_" + Math.random().toString(36).substring(2, 11)
        localStorage.setItem("deviceId", deviceId)
      }

      const { data } = await axiosInstance.post(`/api/downloads/${item._id}/retry`, {
        deviceId,
      })

      const token = data?.downloadToken || data?.data?.downloadToken
      if (token) {
        const backendBase =
          process.env.NEXT_PUBLIC_SERVER_URL ||
          process.env.NEXT_PUBLIC_API_URL ||
          "http://localhost:5001"
        const downloadEndpoint = `${backendBase}/api/download/${token}`

        const a = document.createElement("a")
        a.href = downloadEndpoint
        a.download = `${item.videoTitle || "video"}.mp4`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        showToast("Download resumed successfully!")
        fetchAllData()
      }
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || "Retry authorization failed.")
    } finally {
      setRetryingId(null)
    }
  }

  // Cancel in-flight download
  const handleCancelDownload = async (downloadId: string) => {
    setCancellingId(downloadId)
    try {
      await axiosInstance.post(`/api/downloads/${downloadId}/cancel`)
      showToast("Download cancelled and quota reserved has been restored.")
      fetchAllData()
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || "Failed to cancel download.")
    } finally {
      setCancellingId(null)
    }
  }

  // Export CSV history
  const handleExportCSV = async () => {
    try {
      const response = await axiosInstance.get("/api/downloads/export", {
        responseType: "blob",
      })
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `download_history_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showToast("Download history exported successfully as CSV!")
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || "Failed to export CSV.")
    }
  }

  // Rename Device
  const handleRenameDevice = async () => {
    if (!editingDevice || !newDeviceName.trim()) return
    try {
      const targetId = editingDevice.deviceId || editingDevice.id
      await axiosInstance.patch(`/api/devices/${targetId}`, {
        deviceName: newDeviceName.trim(),
      })
      showToast("Device renamed successfully.")
      setEditingDevice(null)
      fetchAllData()
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || "Failed to rename device.")
    }
  }

  // Revoke Device
  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm("Are you sure you want to remove this device? Active download tokens on it will be invalidated.")) {
      return
    }
    try {
      await axiosInstance.delete(`/api/devices/${deviceId}`)
      showToast("Device removed from your account.")
      fetchAllData()
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || "Failed to revoke device.")
    }
  }

  // Notifications: Mark Single Read
  const handleMarkNotificationRead = async (id: string) => {
    try {
      await axiosInstance.patch(`/api/notifications/${id}/read`)
      setNotifications((prev) =>
        prev.map((n) => (n._id === id || n.id === id ? { ...n, isRead: true, read: true } : n))
      )
    } catch (err) {
      console.warn("Failed to mark notification read", err)
    }
  }

  // Notifications: Mark All Read
  const handleMarkAllNotificationsRead = async () => {
    try {
      await axiosInstance.patch("/api/notifications/read-all")
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, read: true })))
      showToast("All notifications marked as read.")
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || "Failed to update notifications.")
    }
  }

  // Notifications: Delete Notification
  const handleDeleteNotification = async (id: string) => {
    try {
      await axiosInstance.delete(`/api/notifications/${id}`)
      setNotifications((prev) => prev.filter((n) => n._id !== id && n.id !== id))
      showToast("Notification deleted.")
    } catch (err: any) {
      showToast("Failed to delete notification.")
    }
  }

  // Save Preferences
  const handleSavePreferences = async (newPrefs: PreferenceData) => {
    try {
      await axiosInstance.put("/api/downloads/preferences", newPrefs)
      setPreferences(newPrefs)
      showToast("Download preferences updated successfully!")
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || "Failed to save preferences.")
    }
  }

  // Submit Support Ticket
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ticketDescription.trim()) {
      showToast("Please provide a description of the issue.")
      return
    }
    setSubmittingTicket(true)
    try {
      const payload: any = {
        issueType: ticketIssueType,
        description: ticketDescription.trim(),
      }
      if (ticketDownloadId) {
        payload.downloadId = ticketDownloadId
      }
      const { data } = await axiosInstance.post("/api/support/download", payload)
      showToast(`Support ticket ${data?.data?.ticketNumber || "submitted"} created successfully!`)
      setTicketDescription("")
      setTicketDownloadId("")
      fetchAllData()
      setActiveTab("support")
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || "Failed to submit ticket.")
    } finally {
      setSubmittingTicket(false)
    }
  }

  // Report Suspicious Download
  const handleReportSuspicious = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reportingDownload) return
    setSubmittingReport(true)
    try {
      await axiosInstance.post("/api/downloads/report-suspicious", {
        downloadId: reportingDownload._id,
        reason: reportReason.trim() || "User reported unfamiliar download activity",
      })
      showToast("Report submitted to security team for priority investigation.")
      setReportingDownload(null)
      setReportReason("")
      fetchAllData()
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || "Failed to submit report.")
    } finally {
      setSubmittingReport(false)
    }
  }

  // Filtered downloads for History tab
  const filteredDownloads = downloads.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.videoTitle?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus =
      statusFilter === "all" || item.download_status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Quota percentage calculation
  const totalLimit = quota?.quotaLimit || 1
  const usedCount = quota?.quotaUsed || 0
  const remainingCount =
    quota?.quotaRemaining !== undefined
      ? quota.quotaRemaining
      : Math.max(0, totalLimit - usedCount)
  const percentUsed = Math.min(100, Math.round((usedCount / totalLimit) * 100))
  const isQuotaWarning = percentUsed >= 80

  const unreadNotifCount = notifications.filter((n) => !n.isRead && !n.read).length

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4 text-neutral-600">
          <Download className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900 mb-2">
          Keep Track of Your Downloads
        </h2>
        <p className="text-neutral-500 max-w-md mb-6 text-sm">
          Sign in to check your download quota, view offline history, configure devices, and manage self-service support.
        </p>
        <Button
          onClick={openAuthModal}
          className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-full px-6 py-2.5 font-medium cursor-pointer"
        >
          Sign In
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white text-sm px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 80% QUOTA USAGE WARNING BANNER */}
      {isQuotaWarning && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-4 text-amber-900">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold">
                {percentUsed >= 100
                  ? "Download Quota Exhausted"
                  : "Approaching Download Limit (80%+ Utilized)"}
              </h4>
              <p className="text-xs text-amber-800/80">
                You have used {usedCount} of {totalLimit} downloads ({percentUsed}%).
                {percentUsed >= 100
                  ? " Downloads are paused until quota reset or plan upgrade."
                  : ` Only ${remainingCount} download${remainingCount === 1 ? "" : "s"} remaining.`}
              </p>
            </div>
          </div>
          <Button
            onClick={openUpgradeDialog}
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-full shrink-0"
          >
            Upgrade Plan
          </Button>
        </div>
      )}

      {/* DASHBOARD HERO BANNER */}
      <div className="bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between text-center md:text-left gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                User Download Center
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  quota?.planKey === "platinum"
                    ? "bg-purple-400/20 text-purple-300 border border-purple-400/30"
                    : quota?.planKey === "gold"
                    ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                    : quota?.planKey === "silver"
                    ? "bg-blue-400/20 text-blue-300 border border-blue-400/30"
                    : "bg-white/10 text-neutral-300 border border-white/20"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {quota?.plan || "Free"} Plan
              </span>
            </div>
            <p className="text-neutral-400 text-xs sm:text-sm max-w-xl mx-auto md:mx-0">
              Centralized self-service portal for offline downloads, multi-device management, quota meters, and priority customer support.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 w-full sm:w-auto">
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              className="border-white/20 text-white bg-white/5 hover:bg-white/10 rounded-full font-medium text-xs px-4 py-2 flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </Button>
            <Button
              onClick={openUpgradeDialog}
              className="bg-white hover:bg-neutral-100 text-neutral-900 rounded-full font-semibold text-xs px-4 py-2 shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Upgrade Plan</span>
            </Button>
          </div>
        </div>

        {/* QUOTA METERS */}
        <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-center sm:text-left">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
                Quota Usage
              </span>
              <span className="text-sm font-semibold text-white">
                {usedCount} / {totalLimit}
              </span>
            </div>
            <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  percentUsed >= 100
                    ? "bg-red-500"
                    : percentUsed >= 80
                    ? "bg-amber-400"
                    : "bg-emerald-400"
                }`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
              Remaining
            </span>
            <div className="flex items-baseline justify-center sm:justify-start gap-1.5">
              <span className="text-2xl font-bold text-white">{remainingCount}</span>
              <span className="text-xs text-neutral-400">
                downloads {quota?.quotaType === "monthly" ? "this month" : "today"}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
              Active In-Flight
            </span>
            <div className="flex items-baseline justify-center sm:justify-start gap-1.5">
              <span className="text-2xl font-bold text-white">{activeDownloads.length}</span>
              <span className="text-xs text-neutral-400">downloading</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
              Next Quota Reset
            </span>
            <div className="text-sm font-semibold text-white flex items-center justify-center sm:justify-start gap-1.5">
              <Clock className="w-4 h-4 text-neutral-400" />
              <span>
                {quota?.resetAt ? new Date(quota.resetAt).toLocaleDateString() : "Tonight"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="border-b border-neutral-200 overflow-x-auto">
        <nav className="flex space-x-6 min-w-max pb-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === "overview"
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Layers className="w-4 h-4" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab("active")}
            className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === "active"
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Download className="w-4 h-4" />
            Active Downloads
            {activeDownloads.length > 0 && (
              <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {activeDownloads.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === "history"
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Clock className="w-4 h-4" />
            History ({downloads.length})
          </button>
          <button
            onClick={() => setActiveTab("devices")}
            className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === "devices"
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Monitor className="w-4 h-4" />
            Registered Devices ({devices.length})
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === "notifications"
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Bell className="w-4 h-4" />
            Notifications
            {unreadNotifCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {unreadNotifCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("preferences")}
            className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === "preferences"
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Settings className="w-4 h-4" />
            Preferences
          </button>
          <button
            onClick={() => setActiveTab("support")}
            className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === "support"
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Support ({tickets.length})
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === "security"
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Shield className="w-4 h-4" />
            Security
          </button>
        </nav>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-200/80">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase text-neutral-500">Total Downloads</span>
                <Download className="w-4 h-4 text-neutral-400" />
              </div>
              <div className="text-3xl font-extrabold text-neutral-900">{downloads.length}</div>
              <p className="text-xs text-neutral-500 mt-1">All recorded download requests</p>
            </div>

            <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-200/80">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase text-neutral-500">Completed</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-extrabold text-neutral-900">
                {downloads.filter((d) => d.download_status === "completed").length}
              </div>
              <p className="text-xs text-neutral-500 mt-1">Ready for offline viewing</p>
            </div>

            <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-200/80">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase text-neutral-500">Registered Devices</span>
                <Monitor className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-3xl font-extrabold text-neutral-900">{devices.length}</div>
              <p className="text-xs text-neutral-500 mt-1">Synchronized active devices</p>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-neutral-900">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => setActiveTab("active")}
                className="flex items-center gap-3 p-4 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-left transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-neutral-900">Active Queue</h4>
                  <p className="text-xs text-neutral-500">{activeDownloads.length} in progress</p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab("devices")}
                className="flex items-center gap-3 p-4 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-left transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-neutral-900">Manage Devices</h4>
                  <p className="text-xs text-neutral-500">{devices.length} devices</p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab("support")}
                className="flex items-center gap-3 p-4 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-left transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-neutral-900">Download Support</h4>
                  <p className="text-xs text-neutral-500">Report an issue</p>
                </div>
              </button>

              <button
                onClick={handleExportCSV}
                className="flex items-center gap-3 p-4 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-left transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-neutral-900">Export History</h4>
                  <p className="text-xs text-neutral-500">CSV data file</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE DOWNLOADS */}
      {activeTab === "active" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-neutral-900">Active In-Flight Downloads</h3>
            <Button
              onClick={fetchAllData}
              variant="outline"
              size="sm"
              className="text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>

          {activeDownloads.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-neutral-200 rounded-2xl">
              <Download className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-500 font-medium">No downloads currently in progress</p>
              <p className="text-xs text-neutral-400 mt-1">
                When you initiate a download from any video, it will stream here in real time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeDownloads.map((item) => (
                <div
                  key={item._id}
                  className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-neutral-900 truncate">
                        {item.videoTitle || "Untitled Video"}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">
                          {item.download_status}
                        </span>
                        <span>•</span>
                        <span>Started {new Date(item.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <Button
                      onClick={() => handleCancelDownload(item._id)}
                      disabled={cancellingId === item._id}
                      variant="destructive"
                      size="sm"
                      className="rounded-full text-xs"
                    >
                      {cancellingId === item._id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <X className="w-3.5 h-3.5 mr-1" />
                      )}
                      Cancel Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DOWNLOAD HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {/* Controls bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search downloaded videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs rounded-full border-neutral-200"
              />
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-neutral-200 rounded-full px-3 py-1.5 bg-white text-neutral-700 outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <Button
                onClick={handleExportCSV}
                variant="outline"
                size="sm"
                className="text-xs rounded-full flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Export CSV
              </Button>
            </div>
          </div>

          {filteredDownloads.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-neutral-200 rounded-2xl">
              <Clock className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-500 font-medium">No downloads found</p>
              <p className="text-xs text-neutral-400 mt-1">
                Try searching with a different keyword or filter.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDownloads.map((item) => (
                <div
                  key={item._id}
                  className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:border-neutral-300 transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-16 h-12 rounded-lg bg-neutral-100 overflow-hidden shrink-0 relative flex items-center justify-center">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.videoTitle}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Play className="w-5 h-5 text-neutral-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-neutral-900 truncate">
                        {item.videoTitle || "Video Download"}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${
                            item.download_status === "completed"
                              ? "bg-emerald-50 text-emerald-700"
                              : item.download_status === "failed"
                              ? "bg-red-50 text-red-700"
                              : "bg-neutral-100 text-neutral-700"
                          }`}
                        >
                          {item.download_status}
                        </span>
                        <span>•</span>
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        {item.file_size ? (
                          <>
                            <span>•</span>
                            <span>{(item.file_size / (1024 * 1024)).toFixed(1)} MB</span>
                          </>
                        ) : null}
                        {item.userFriendlyFailureReason && (
                          <>
                            <span>•</span>
                            <span className="text-red-500 font-medium">
                              {item.userFriendlyFailureReason}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                    {/* Retry button for failed downloads */}
                    {item.download_status === "failed" && (
                      <Button
                        onClick={() => handleRetryDownload(item)}
                        disabled={retryingId === item._id}
                        size="sm"
                        className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-full text-xs flex items-center gap-1.5"
                      >
                        {retryingId === item._id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        Retry Download
                      </Button>
                    )}

                    {/* Report button */}
                    <Button
                      onClick={() => setReportingDownload(item)}
                      variant="ghost"
                      size="sm"
                      className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] dark:hover:text-white text-xs rounded-full cursor-pointer"
                    >
                      <Flag className="w-3.5 h-3.5 mr-1" />
                      Report
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: REGISTERED DEVICES */}
      {activeTab === "devices" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-neutral-900">Your Registered Devices</h3>
              <p className="text-xs text-neutral-500">
                Offline downloads are tied to registered devices according to your plan quota limits.
              </p>
            </div>
          </div>

          {devices.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-neutral-200 rounded-2xl">
              <Monitor className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-500 font-medium">No registered devices</p>
              <p className="text-xs text-neutral-400 mt-1">
                Your browser or device is registered automatically when you initiate a download.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {devices.map((d) => {
                const deviceId = d.deviceId || d.id || ""
                const deviceName = d.deviceName || d.name || "Web Device"
                const isMobile = (d.type || d.deviceType) === "mobile"
                const isTablet = (d.type || d.deviceType) === "tablet"

                return (
                  <div
                    key={deviceId}
                    className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-4 relative"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-700 shrink-0">
                          {isMobile ? (
                            <Smartphone className="w-5 h-5" />
                          ) : isTablet ? (
                            <Laptop className="w-5 h-5" />
                          ) : (
                            <Monitor className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-neutral-900">{deviceName}</h4>
                            {d.isCurrentDevice && (
                              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-500">
                            {d.browser} • {d.operatingSystem}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                          d.status === "active" || d.status === "authorized"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>

                    <div className="text-xs text-neutral-400 flex items-center justify-between border-t border-neutral-100 pt-3">
                      <span>Last active: {d.lastActivityAt || d.lastSeenAt ? new Date(d.lastActivityAt || d.lastSeenAt!).toLocaleDateString() : "Recent"}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingDevice(d)
                            setNewDeviceName(deviceName)
                          }}
                          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] dark:hover:text-white flex items-center gap-1 font-medium cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Rename
                        </button>
                        <button
                          onClick={() => handleRevokeDevice(deviceId)}
                          className="text-red-500 hover:text-red-700 flex items-center gap-1 font-medium cursor-pointer ml-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: NOTIFICATIONS */}
      {activeTab === "notifications" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-neutral-900">Download Alerts & Notifications</h3>
            {unreadNotifCount > 0 && (
              <Button
                onClick={handleMarkAllNotificationsRead}
                variant="outline"
                size="sm"
                className="text-xs rounded-full"
              >
                Mark all as read
              </Button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-neutral-200 rounded-2xl">
              <Bell className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-500 font-medium">No notifications</p>
              <p className="text-xs text-neutral-400 mt-1">
                You will receive alerts when downloads complete or when quotas approach limits.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => {
                const notifId = n._id || n.id || ""
                const isUnread = !n.isRead && !n.read

                return (
                  <div
                    key={notifId}
                    className={`border rounded-2xl p-4 flex items-start justify-between gap-4 transition-colors ${
                      isUnread
                        ? "bg-blue-50/40 border-blue-200/80"
                        : "bg-white border-neutral-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-700 shrink-0 mt-0.5">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-neutral-900">{n.title}</h4>
                        <p className="text-xs text-neutral-600 mt-0.5">{n.message}</p>
                        <span className="text-[10px] text-neutral-400 block mt-1.5">
                          {new Date(n.createdAt).toLocaleDateString()} at{" "}
                          {new Date(n.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isUnread && (
                        <Button
                          onClick={() => handleMarkNotificationRead(notifId)}
                          variant="ghost"
                          size="sm"
                          className="text-xs text-blue-600 hover:text-blue-700 h-8 px-2"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Read
                        </Button>
                      )}
                      <Button
                        onClick={() => handleDeleteNotification(notifId)}
                        variant="ghost"
                        size="sm"
                        className="text-neutral-400 hover:text-red-600 h-8 px-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: PREFERENCES */}
      {activeTab === "preferences" && (
        <div className="max-w-2xl bg-white border border-neutral-200 rounded-3xl p-6 sm:p-8 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Download Preferences</h3>
            <p className="text-xs text-neutral-500">
              Customize your default offline video resolutions and notification behavior.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-600 block mb-2">
                Preferred Download Quality
              </label>
              <select
                value={preferences.preferredQuality}
                onChange={(e) =>
                  handleSavePreferences({ ...preferences, preferredQuality: e.target.value })
                }
                className="w-full text-sm border border-neutral-200 rounded-xl px-4 py-2.5 bg-neutral-50 text-neutral-800 outline-none"
              >
                <option value="480p">480p (Standard Definition - Fast)</option>
                <option value="720p">720p (High Definition)</option>
                <option value="1080p">1080p (Full HD - Recommended)</option>
                <option value="4k">4K (Ultra HD - Platinum only)</option>
                <option value="best">Auto / Highest Allowed</option>
              </select>
            </div>

            <div className="space-y-4 border-t border-neutral-100 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-sm font-semibold text-neutral-900">Automatic Retry on Disconnect</h5>
                  <p className="text-xs text-neutral-500">Automatically attempt to resume downloads if network drops.</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.autoRetryOnFailure}
                  onChange={(e) =>
                    handleSavePreferences({ ...preferences, autoRetryOnFailure: e.target.checked })
                  }
                  className="w-4 h-4 accent-neutral-900 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-sm font-semibold text-neutral-900">Download Completion Notifications</h5>
                  <p className="text-xs text-neutral-500">Receive in-app alerts when large downloads finish streaming.</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notifyOnCompletion}
                  onChange={(e) =>
                    handleSavePreferences({ ...preferences, notifyOnCompletion: e.target.checked })
                  }
                  className="w-4 h-4 accent-neutral-900 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-sm font-semibold text-neutral-900">Quota Threshold Warning (80%)</h5>
                  <p className="text-xs text-neutral-500">Alert me when 80% or more of quota is utilized.</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notifyOnQuotaThreshold}
                  onChange={(e) =>
                    handleSavePreferences({ ...preferences, notifyOnQuotaThreshold: e.target.checked })
                  }
                  className="w-4 h-4 accent-neutral-900 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: SUPPORT & TICKETS */}
      {activeTab === "support" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* New ticket form */}
          <div className="lg:col-span-6 bg-white border border-neutral-200 rounded-3xl p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-neutral-900">Submit Problem Report</h3>
              <p className="text-xs text-neutral-500">
                Have an issue with offline playback, interrupted streaming, or quota discrepancy?
              </p>
            </div>

            <form onSubmit={handleSubmitTicket} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-600 block mb-1.5">
                  Issue Type
                </label>
                <select
                  value={ticketIssueType}
                  onChange={(e) => setTicketIssueType(e.target.value)}
                  className="w-full text-xs border border-neutral-200 rounded-xl px-3 py-2 bg-white text-neutral-800 outline-none"
                >
                  <option value="DOWNLOAD_FAILED">Download Failed / Stalled</option>
                  <option value="DOWNLOAD_INTERRUPTED">Download Interrupted</option>
                  <option value="DOWNLOAD_CORRUPTED">File Corrupted / Cannot Play</option>
                  <option value="SLOW_DOWNLOAD">Slow Download Speed</option>
                  <option value="QUOTA_ISSUE">Quota / Subscription Discrepancy</option>
                  <option value="OTHER">Other Problem</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-600 block mb-1.5">
                  Related Download (Optional)
                </label>
                <select
                  value={ticketDownloadId}
                  onChange={(e) => setTicketDownloadId(e.target.value)}
                  className="w-full text-xs border border-neutral-200 rounded-xl px-3 py-2 bg-white text-neutral-800 outline-none truncate"
                >
                  <option value="">General Issue (No specific download)</option>
                  {downloads.slice(0, 15).map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.videoTitle || "Video"} ({new Date(d.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-600 block mb-1.5">
                  Detailed Description
                </label>
                <Textarea
                  rows={4}
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  placeholder="Describe what happened, what device you were using, and any error message displayed..."
                  className="text-xs rounded-xl border-neutral-200"
                />
              </div>

              <Button
                type="submit"
                disabled={submittingTicket}
                className="w-full bg-neutral-900 hover:bg-neutral-800 text-white rounded-full text-xs font-semibold py-2.5"
              >
                {submittingTicket ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                Submit Problem Report
              </Button>
            </form>
          </div>

          {/* Past tickets */}
          <div className="lg:col-span-6 space-y-4">
            <h3 className="text-base font-bold text-neutral-900">Your Support Tickets</h3>
            {tickets.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-neutral-200 rounded-2xl">
                <HelpCircle className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                <p className="text-sm text-neutral-500 font-medium">No open tickets</p>
                <p className="text-xs text-neutral-400 mt-1">Submitted reports will show here with live updates.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => (
                  <div key={t._id || t.id} className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-900">Ticket #{t.ticketNumber}</span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          t.status === "RESOLVED" || t.status === "CLOSED"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600">{t.messages?.[0]?.message || "Report under review"}</p>
                    <div className="text-[10px] text-neutral-400 flex items-center justify-between border-t border-neutral-100 pt-2">
                      <span>Type: {t.issueType}</span>
                      <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 8: SECURITY */}
      {activeTab === "security" && (
        <div className="space-y-6 max-w-3xl">
          <div className="bg-neutral-900 text-white rounded-3xl p-6 space-y-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <h3 className="text-lg font-bold">Download Security Status</h3>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Your account is protected by single-use cryptographic download tokens, device binding, and real-time fraud monitoring. If you notice any downloads you did not initiate, report them immediately to revoke unauthorized access.
            </p>
          </div>

          <div className="bg-white border border-neutral-200 rounded-3xl p-6 space-y-4">
            <h4 className="text-sm font-bold text-neutral-900">Security Best Practices</h4>
            <ul className="text-xs text-neutral-600 space-y-2 list-disc pl-4">
              <li>Regularly revoke unused or public devices from your Registered Devices tab.</li>
              <li>Never share signed video download links; they are bound to your user token.</li>
              <li>Report unfamiliar downloads immediately to reset token credentials.</li>
            </ul>
          </div>
        </div>
      )}

      {/* DEVICE RENAME MODAL */}
      {editingDevice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h4 className="text-base font-bold text-neutral-900">Rename Device</h4>
            <Input
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              placeholder="e.g. Work Laptop, Bedroom iPad"
              className="text-xs rounded-xl"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingDevice(null)}
                className="text-xs rounded-full"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRenameDevice}
                className="bg-neutral-900 text-white text-xs rounded-full"
              >
                Save Name
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* REPORT SUSPICIOUS DOWNLOAD MODAL */}
      {reportingDownload && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-red-600">
              <Flag className="w-5 h-5" />
              <h4 className="text-base font-bold text-neutral-900">Report Unfamiliar Download</h4>
            </div>
            <p className="text-xs text-neutral-600">
              Report &quot;{reportingDownload.videoTitle || "this video"}&quot; if you did not initiate this download or suspect unauthorized account access.
            </p>
            <Textarea
              rows={3}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Brief explanation (e.g. I was away, unrecognized device)..."
              className="text-xs rounded-xl"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReportingDownload(null)}
                className="text-xs rounded-full"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={submittingReport}
                onClick={handleReportSuspicious}
                className="bg-red-600 hover:bg-red-700 text-white text-xs rounded-full"
              >
                {submittingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Submit Security Report"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* UPGRADE PLAN MODAL */}
      {upgradeModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-neutral-900">Upgrade Subscription</h3>
                <p className="text-xs text-neutral-500">Select a tier to increase your download quotas and multi-device limits.</p>
              </div>
              <button
                onClick={() => setUpgradeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[var(--muted)] flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { key: "silver", name: "Silver", limit: "15 / day", devices: "2 devices", price: "$4.99/mo" },
                { key: "gold", name: "Gold", limit: "50 / day", devices: "5 devices", price: "$9.99/mo" },
                { key: "platinum", name: "Platinum", limit: "Unlimited", devices: "10 devices", price: "$19.99/mo" },
              ].map((p) => (
                <div
                  key={p.key}
                  className={`border rounded-2xl p-4 flex flex-col justify-between space-y-4 ${
                    quota?.planKey === p.key
                      ? "border-neutral-900 bg-neutral-50"
                      : "border-neutral-200"
                  }`}
                >
                  <div>
                    <h5 className="font-bold text-sm text-neutral-900">{p.name}</h5>
                    <div className="text-lg font-extrabold text-neutral-900 mt-1">{p.price}</div>
                    <ul className="text-xs text-neutral-600 mt-3 space-y-1.5">
                      <li>• {p.limit} downloads</li>
                      <li>• {p.devices}</li>
                      <li>• High-speed streaming</li>
                    </ul>
                  </div>

                  <Button
                    onClick={() => handleUpgradePlan(p.key)}
                    disabled={upgradeLoading === p.key || quota?.planKey === p.key}
                    size="sm"
                    className="w-full rounded-full text-xs font-semibold bg-neutral-900 text-white"
                  >
                    {upgradeLoading === p.key ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : quota?.planKey === p.key ? (
                      "Current Plan"
                    ) : (
                      "Select Tier"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
