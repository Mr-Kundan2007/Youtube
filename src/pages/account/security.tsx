import React, { useState, useEffect, useCallback } from "react"
import Head from "next/head"
import { useRouter } from "next/router"
import {
  ShieldCheck,
  Shield,
  Laptop,
  History,
  Activity,
  ArrowLeft,
  RefreshCw,
  Lock,
  Clock,
  Radio,
  Bell,
  AlertTriangle,
} from "lucide-react"
import {
  securityService,
  TrustedDevice,
  LoginHistoryItem,
  SecurityActivityItem,
} from "@/services/securityService"
import { sessionService, UserSession } from "@/services/sessionService"
import {
  securityAlertService,
  SecurityAlert,
} from "@/services/securityAlertService"
import { SessionList } from "@/components/security/SessionList"
import { TrustedDeviceCard } from "@/components/security/TrustedDeviceCard"
import { DeviceRenameModal } from "@/components/security/DeviceRenameModal"
import { LoginHistoryList } from "@/components/security/LoginHistoryList"
import { SecurityActivityList } from "@/components/security/SecurityActivityList"
import { CriticalAlertBanner } from "@/components/security/CriticalAlertBanner"
import { AccountProtectionStatusBanner } from "@/components/security/AccountProtectionStatusBanner"
import { SecurityAlertList } from "@/components/security/SecurityAlertList"
import { SecureAccountModal } from "@/components/security/SecureAccountModal"
import { SecurityNotificationBell } from "@/components/security/SecurityNotificationBell"
import { useAuth } from "@/lib/AuthContext"
import { Button } from "@/components/ui/button"

export default function AccountSecurityPage() {
  const router = useRouter()
  const { user, logout }: any = useAuth()

  const [activeTab, setActiveTab] = useState<"alerts" | "sessions" | "devices" | "history" | "activity">("alerts")

  // Security Alerts & Account Protection State (Phase 10)
  const [alerts, setAlerts] = useState<SecurityAlert[]>([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [alertsTotal, setAlertsTotal] = useState(0)
  const [alertsPage, setAlertsPage] = useState(1)
  const [alertsTotalPages, setAlertsTotalPages] = useState(1)
  const [alertsFilterStatus, setAlertsFilterStatus] = useState("")
  const [unreadAlertCount, setUnreadAlertCount] = useState(0)
  const [hasActionRequired, setHasActionRequired] = useState(false)
  const [hasCritical, setHasCritical] = useState(false)
  const [protectionStatus, setProtectionStatus] = useState<
    "NORMAL" | "MONITORING" | "PROTECTED" | "TEMPORARILY_RESTRICTED" | "SECURITY_REVIEW"
  >("NORMAL")
  const [protectionMessage, setProtectionMessage] = useState("")
  const [secureModalOpen, setSecureModalOpen] = useState(false)

  // Active Sessions State (Phase 9)
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessionMaxLimit, setSessionMaxLimit] = useState(10)

  // Trusted Devices State (Phase 8)
  const [devices, setDevices] = useState<TrustedDevice[]>([])
  const [devicesLoading, setDevicesLoading] = useState(true)
  const [deviceMaxLimit, setDeviceMaxLimit] = useState(10)
  const [durationDays, setDurationDays] = useState(30)
  const [editingDevice, setEditingDevice] = useState<TrustedDevice | null>(null)

  // Login History State
  const [history, setHistory] = useState<LoginHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyStatusFilter, setHistoryStatusFilter] = useState("")
  const [historyDeviceFilter, setHistoryDeviceFilter] = useState("")

  // Security Activity State
  const [activities, setActivities] = useState<SecurityActivityItem[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityPage, setActivityPage] = useState(1)
  const [activityTotalPages, setActivityTotalPages] = useState(1)
  const [activityTotal, setActivityTotal] = useState(0)
  const [activitySeverityFilter, setActivitySeverityFilter] = useState("")

  // Notification feedback
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null)

  const showFeedback = (message: string, type: "success" | "error" = "success") => {
    setFeedback({ message, type })
    setTimeout(() => setFeedback(null), 4000)
  }

  // Load Security Alerts (Phase 10)
  const loadAlerts = useCallback(async () => {
    try {
      setAlertsLoading(true)
      const res = await securityAlertService.getAlerts({
        page: alertsPage,
        limit: 15,
        status: alertsFilterStatus || undefined,
        unreadOnly: alertsFilterStatus === "UNREAD",
      })
      if (res?.success) {
        setAlerts(res.alerts || [])
        setAlertsTotal(res.total || 0)
        setAlertsTotalPages(res.totalPages || 1)
      }
    } catch (err: any) {
      console.error("Failed to load security alerts:", err)
    } finally {
      setAlertsLoading(false)
    }
  }, [alertsPage, alertsFilterStatus])

  const loadAlertsTelemetry = useCallback(async () => {
    try {
      const [countRes, statusRes] = await Promise.all([
        securityAlertService.getUnreadCount(),
        securityAlertService.getProtectionStatus(),
      ])
      if (countRes?.success) {
        setUnreadAlertCount(countRes.count || 0)
        setHasActionRequired(Boolean(countRes.hasActionRequired))
        setHasCritical(Boolean(countRes.hasCritical))
      }
      if (statusRes?.success) {
        setProtectionStatus(statusRes.status || "NORMAL")
        setProtectionMessage(statusRes.message || "")
      }
    } catch (err) {
      console.warn("Could not fetch alerts telemetry:", err)
    }
  }, [])

  // Phase 10 Alert Action Handlers
  const handleConfirmAlert = async (alertId: string) => {
    try {
      const res = await securityAlertService.confirmAlert(alertId)
      showFeedback(res.message || "Activity confirmed successfully.")
      loadAlerts()
      loadAlertsTelemetry()
    } catch (err: any) {
      showFeedback(err?.message || "Failed to confirm alert", "error")
    }
  }

  const handleReportSuspiciousAlert = async (alertId: string) => {
    try {
      const res = await securityAlertService.reportSuspicious(alertId)
      showFeedback(res.message || "Account secured and suspicious sessions signed out.")
      loadAlerts()
      loadAlertsTelemetry()
      loadSessions()
    } catch (err: any) {
      showFeedback(err?.message || "Failed to report activity", "error")
    }
  }

  const handleMarkAlertRead = async (alertId: string) => {
    try {
      await securityAlertService.markAsRead(alertId)
      loadAlerts()
      loadAlertsTelemetry()
    } catch (err: any) {
      showFeedback(err?.message || "Failed to mark as read", "error")
    }
  }

  const handleMarkAllAlertsRead = async () => {
    try {
      await securityAlertService.markAllAsRead()
      showFeedback("All alerts marked as read.")
      loadAlerts()
      loadAlertsTelemetry()
    } catch (err: any) {
      showFeedback(err?.message || "Failed to mark all as read", "error")
    }
  }

  const handleSecureAccount = async (reason: string) => {
    try {
      const res = await securityAlertService.secureAccount(reason)
      showFeedback(res.message || "Account protection activated and remote sessions terminated.")
      loadAlerts()
      loadAlertsTelemetry()
      loadSessions()
    } catch (err: any) {
      showFeedback(err?.message || "Failed to secure account", "error")
      throw err
    }
  }

  // Load Active Sessions (Phase 9)
  const loadSessions = useCallback(async () => {
    try {
      setSessionsLoading(true)
      const res = await sessionService.getActiveSessions()
      if (res?.success) {
        setSessions(res.sessions || [])
        if (res.maxLimit) setSessionMaxLimit(res.maxLimit)
      }
    } catch (err: any) {
      console.error("Failed to load active sessions:", err)
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  // Load Trusted Devices (Phase 8)
  const loadDevices = useCallback(async () => {
    try {
      setDevicesLoading(true)
      const res = await securityService.getTrustedDevices()
      if (res?.success) {
        setDevices(res.devices || [])
        if (res.maxLimit) setDeviceMaxLimit(res.maxLimit)
        if (res.durationDays) setDurationDays(res.durationDays)
      }
    } catch (err: any) {
      console.error("Failed to load trusted devices:", err)
    } finally {
      setDevicesLoading(false)
    }
  }, [])

  // Load Login History
  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true)
      const res = await securityService.getLoginHistory({
        page: historyPage,
        limit: 15,
        status: historyStatusFilter || undefined,
        deviceType: historyDeviceFilter || undefined,
      })
      if (res?.success) {
        setHistory(res.history || [])
        setHistoryTotal(res.total || 0)
        setHistoryTotalPages(res.totalPages || 1)
      }
    } catch (err: any) {
      console.error("Failed to load login history:", err)
    } finally {
      setHistoryLoading(false)
    }
  }, [historyPage, historyStatusFilter, historyDeviceFilter])

  // Load Security Activity
  const loadActivity = useCallback(async () => {
    try {
      setActivityLoading(true)
      const res = await securityService.getSecurityActivity({
        page: activityPage,
        limit: 15,
        severity: activitySeverityFilter || undefined,
      })
      if (res?.success) {
        setActivities(res.activities || [])
        setActivityTotal(res.total || 0)
        setActivityTotalPages(res.totalPages || 1)
      }
    } catch (err: any) {
      console.error("Failed to load security activity:", err)
    } finally {
      setActivityLoading(false)
    }
  }, [activityPage, activitySeverityFilter])

  useEffect(() => {
    loadAlerts()
    loadAlertsTelemetry()
    loadSessions()
    loadDevices()
  }, [loadAlerts, loadAlertsTelemetry, loadSessions, loadDevices])

  useEffect(() => {
    if (activeTab === "alerts") loadAlerts()
    if (activeTab === "sessions") loadSessions()
    if (activeTab === "devices") loadDevices()
    if (activeTab === "history") loadHistory()
    if (activeTab === "activity") loadActivity()
  }, [activeTab, loadAlerts, loadSessions, loadDevices, loadHistory, loadActivity])

  // Session Handlers (Phase 9)
  const handleTerminateSession = async (sessionId: string) => {
    try {
      const isCurrent = sessions.find((s) => (s.sessionId === sessionId || s.id === sessionId))?.isCurrentSession
      await sessionService.terminateSession(sessionId)

      if (isCurrent) {
        showFeedback("Current session terminated. Signing out...")
        await logout?.()
        router.push("/")
        return
      }

      showFeedback("Device session terminated successfully.")
      loadSessions()
    } catch (err: any) {
      showFeedback(err?.message || "Failed to terminate session", "error")
    }
  }

  const handleLogoutOthers = async () => {
    try {
      const res = await sessionService.logoutOthers()
      showFeedback(`Successfully logged out ${res.terminatedCount || "all other"} device(s).`)
      loadSessions()
    } catch (err: any) {
      showFeedback(err?.message || "Failed to logout other devices", "error")
    }
  }

  const handleLogoutAll = async () => {
    try {
      await sessionService.logoutAll()
      showFeedback("All sessions terminated. Redirecting to home...")
      await logout?.()
      router.push("/")
    } catch (err: any) {
      showFeedback(err?.message || "Failed to logout all sessions", "error")
    }
  }

  // Trusted Device Handlers (Phase 8)
  const handleRenameDevice = async (deviceId: string, newName: string) => {
    try {
      await securityService.renameTrustedDevice(deviceId, newName)
      showFeedback(`Device renamed to "${newName}"`)
      loadDevices()
    } catch (err: any) {
      showFeedback(err?.message || "Failed to rename device", "error")
      throw err
    }
  }

  const handleRevokeDevice = async (deviceId: string) => {
    try {
      await securityService.revokeTrustedDevice(deviceId)
      showFeedback("Device trust revoked. Next login will require verification.")
      loadDevices()
    } catch (err: any) {
      showFeedback(err?.message || "Failed to revoke device trust", "error")
    }
  }

  return (
    <>
      <Head>
        <title>Account Security & Connected Sessions - YouTube</title>
        <meta
          name="description"
          content="Manage your active connected sessions, trusted devices, login audit trail, and account security activity."
        />
      </Head>

      <div className="w-full min-h-screen bg-[var(--background)] text-[var(--foreground)] p-3 sm:p-6 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Top Bar Navigation */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/settings")}
                className="rounded-full hover:bg-[var(--muted)]"
                aria-label="Back to settings"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Account Security</h1>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Monitor active sessions, manage trusted devices, and review security logs
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (activeTab === "alerts") loadAlerts()
                if (activeTab === "sessions") loadSessions()
                if (activeTab === "devices") loadDevices()
                if (activeTab === "history") loadHistory()
                if (activeTab === "activity") loadActivity()
              }}
              className="rounded-lg flex items-center gap-1.5 text-xs w-full sm:w-auto justify-center"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>

          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-semibold animate-in fade-in flex items-center gap-2 ${
                feedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Critical Security Alert Banner (Phase 10) */}
          <CriticalAlertBanner
            alerts={alerts}
            onSecureAccount={() => setSecureModalOpen(true)}
            onReviewAlert={() => setActiveTab("alerts")}
          />

          {/* Account Protection Status Banner (Phase 10) */}
          <AccountProtectionStatusBanner
            status={protectionStatus}
            message={protectionMessage}
            onSecureAccount={() => setSecureModalOpen(true)}
          />

          {/* Top Security Overview Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">Active Sessions</p>
                <p className="text-lg font-bold text-[var(--foreground)]">
                  {sessions.length}{" "}
                  <span className="text-xs font-normal text-[var(--muted-foreground)]">/ {sessionMaxLimit} allowed</span>
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <Laptop className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">Trusted Devices</p>
                <p className="text-lg font-bold text-[var(--foreground)]">
                  {devices.filter((d) => d.status === "ACTIVE").length}{" "}
                  <span className="text-xs font-normal text-[var(--muted-foreground)]">/ {deviceMaxLimit} trusted</span>
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">Protection Level</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 capitalize">
                  {protectionStatus.toLowerCase().replace(/_/g, " ")}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">Trust Window</p>
                <p className="text-lg font-bold text-[var(--foreground)]">
                  {durationDays} Days{" "}
                  <span className="text-xs font-normal text-[var(--muted-foreground)]">validity</span>
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2 overflow-x-auto whitespace-nowrap no-scrollbar">
            <button
              onClick={() => setActiveTab("alerts")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
                activeTab === "alerts"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Security Alerts</span>
              {unreadAlertCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    hasCritical
                      ? "bg-red-500 text-white animate-pulse"
                      : "bg-blue-500 text-white"
                  }`}
                >
                  {unreadAlertCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("sessions")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
                activeTab === "sessions"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Active Sessions</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                {sessions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("devices")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
                activeTab === "devices"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              <Laptop className="w-4 h-4" />
              <span>Trusted Devices</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                {devices.filter((d) => d.status === "ACTIVE").length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
                activeTab === "history"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              <History className="w-4 h-4" />
              <span>Login History</span>
            </button>

            <button
              onClick={() => setActiveTab("activity")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
                activeTab === "activity"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Security Activity</span>
            </button>
          </div>

          {/* Tab 1: Security Alerts (Phase 10) */}
          {activeTab === "alerts" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-[var(--foreground)]">Security Alert Center</h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Review suspicious sign-in attempts, new environment notifications, and take action to secure your account.
                </p>
              </div>

              <SecurityAlertList
                alerts={alerts}
                total={alertsTotal}
                page={alertsPage}
                totalPages={alertsTotalPages}
                loading={alertsLoading}
                onPageChange={(p) => setAlertsPage(p)}
                onRefresh={loadAlerts}
                onMarkRead={handleMarkAlertRead}
                onMarkAllRead={handleMarkAllAlertsRead}
                onConfirm={handleConfirmAlert}
                onReportSuspicious={handleReportSuspiciousAlert}
                filterStatus={alertsFilterStatus}
                onFilterChange={(s) => {
                  setAlertsFilterStatus(s)
                  setAlertsPage(1)
                }}
              />
            </div>
          )}

          {/* Tab 2: Active Sessions (Phase 9) */}
          {activeTab === "sessions" && (
            <SessionList
              sessions={sessions}
              loading={sessionsLoading}
              maxLimit={sessionMaxLimit}
              onTerminate={handleTerminateSession}
              onLogoutOthers={handleLogoutOthers}
              onLogoutAll={handleLogoutAll}
            />
          )}

          {/* Tab 2: Trusted Devices (Phase 8) */}
          {activeTab === "devices" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[var(--foreground)]">Active Trusted Devices</h2>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Trusted devices bypass one-time password challenges for {durationDays} days. Note that trusted
                    devices remain recognized even after you log out of a session.
                  </p>
                </div>
              </div>

              {devicesLoading ? (
                <div className="p-8 text-center text-xs text-[var(--muted-foreground)] rounded-xl border border-[var(--border)]">
                  Loading trusted devices...
                </div>
              ) : devices.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-[var(--border)] bg-[var(--card)]">
                  <ShieldCheck className="w-10 h-10 text-[var(--muted-foreground)] mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-semibold text-[var(--foreground)]">No Trusted Devices Registered</p>
                  <p className="text-xs text-[var(--muted-foreground)] max-w-sm mx-auto mt-1">
                    When you sign in and complete verification on a new device or browser, it will appear here as a
                    trusted device for {durationDays} days.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {devices.map((device) => (
                    <TrustedDeviceCard
                      key={device.id || (device as any)._id}
                      device={device}
                      onRename={(dev) => setEditingDevice(dev)}
                      onRevoke={handleRevokeDevice}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Login History */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-[var(--foreground)]">Login Audit Trail</h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Track sign-in attempts to your account, including device information, approximate locations, and
                  verification outcomes.
                </p>
              </div>

              <LoginHistoryList
                history={history}
                loading={historyLoading}
                page={historyPage}
                totalPages={historyTotalPages}
                totalCount={historyTotal}
                statusFilter={historyStatusFilter}
                deviceFilter={historyDeviceFilter}
                onStatusChange={(s) => {
                  setHistoryStatusFilter(s)
                  setHistoryPage(1)
                }}
                onDeviceChange={(d) => {
                  setHistoryDeviceFilter(d)
                  setHistoryPage(1)
                }}
                onPageChange={(p) => setHistoryPage(p)}
              />
            </div>
          )}

          {/* Tab 4: Security Activity */}
          {activeTab === "activity" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-[var(--foreground)]">Account Security Stream</h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Chronological record of authentication challenges, session terminations, trusted device updates,
                  and security events.
                </p>
              </div>

              <SecurityActivityList
                activities={activities}
                loading={activityLoading}
                page={activityPage}
                totalPages={activityTotalPages}
                totalCount={activityTotal}
                severityFilter={activitySeverityFilter}
                onSeverityChange={(s) => {
                  setActivitySeverityFilter(s)
                  setActivityPage(1)
                }}
                onPageChange={(p) => setActivityPage(p)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Rename Modal */}
      {editingDevice && (
        <DeviceRenameModal
          device={editingDevice}
          isOpen={Boolean(editingDevice)}
          onClose={() => setEditingDevice(null)}
          onSave={handleRenameDevice}
        />
      )}

      {/* Secure Account Lockdown Modal (Phase 10) */}
      <SecureAccountModal
        isOpen={secureModalOpen}
        onClose={() => setSecureModalOpen(false)}
        onConfirm={handleSecureAccount}
      />
    </>
  )
}
