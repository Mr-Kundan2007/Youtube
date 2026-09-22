import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import {
  Bell,
  CheckCheck,
  Sparkles,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  CreditCard,
  Layers,
  ArrowRight,
} from "lucide-react"
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  AppNotification,
} from "@/services/subscriptionService"
import { useAuth } from "@/lib/AuthContext"

export const NotificationBellDropdown: React.FC = () => {
  const { user } = (useAuth() as any) || {}
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  const fetchNotifications = async () => {
    if (!user) return
    try {
      const list = await getUserNotifications()
      setNotifications(list)
    } catch (err) {
      // silently ignore
    }
  }

  useEffect(() => {
    fetchNotifications()

    // Refresh when subscription status changes
    const handler = () => {
      fetchNotifications()
    }
    window.addEventListener("subscription_updated", handler)
    return () => window.removeEventListener("subscription_updated", handler)
  }, [user])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch (err) {
      // ignore
    }
  }

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.read) {
      await markNotificationRead(notif._id)
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, read: true } : n))
      )
    }
    setIsOpen(false)
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "SUBSCRIPTION_ACTIVATED":
      case "SUBSCRIPTION_RENEWED":
      case "PLAN_UPGRADED":
        return <Sparkles className="w-4 h-4 text-emerald-400" />
      case "PAYMENT_SUCCESSFUL":
        return <CreditCard className="w-4 h-4 text-emerald-400" />
      case "SUBSCRIPTION_EXPIRING":
      case "EXPIRY_REMINDER":
      case "SUBSCRIPTION_EXPIRING_TODAY":
        return <Clock className="w-4 h-4 text-amber-400" />
      case "CANCELLATION_SCHEDULED":
      case "SUBSCRIPTION_CANCELLED":
        return <AlertTriangle className="w-4 h-4 text-amber-400" />
      case "SUBSCRIPTION_EXPIRED":
      case "DOWNGRADED_TO_FREE":
        return <XCircle className="w-4 h-4 text-rose-400" />
      case "CANCELLATION_RESTORED":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      default:
        return <Bell className="w-4 h-4 text-neutral-400" />
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) fetchNotifications()
        }}
        className="relative p-2 rounded-full hover:bg-neutral-100 text-neutral-800 transition cursor-pointer"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl z-50 overflow-hidden text-neutral-200 animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="p-3.5 px-4 border-b border-neutral-800/80 flex items-center justify-between bg-neutral-950/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-mono text-[10px] font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-neutral-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-neutral-800/50">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                <Bell className="w-6 h-6 mx-auto mb-2 text-neutral-600" />
                <span>No notifications yet.</span>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 hover:bg-neutral-800/40 transition cursor-pointer flex items-start gap-3 ${
                    !n.read ? "bg-neutral-800/20" : "opacity-80"
                  }`}
                >
                  <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-800 shrink-0 mt-0.5">
                    {getNotificationIcon(n.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className={`text-xs truncate ${!n.read ? "font-bold text-white" : "font-medium text-neutral-300"}`}>
                        {n.title}
                      </h4>
                      <span className="text-[10px] text-neutral-400 shrink-0">
                        {new Date(n.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                      </span>
                    </div>

                    <p className="text-[11px] text-neutral-400 leading-snug line-clamp-2">
                      {n.message}
                    </p>

                    {n.actionUrl && (
                      <Link
                        href={n.actionUrl}
                        onClick={() => setIsOpen(false)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-300 mt-1.5"
                      >
                        <span>View Details</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>

                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 px-4 bg-neutral-950/80 border-t border-neutral-800/80 text-center">
            <Link
              href="/subscription/dashboard"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-bold text-neutral-400 hover:text-white transition"
            >
              Go to Subscription Dashboard →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBellDropdown
