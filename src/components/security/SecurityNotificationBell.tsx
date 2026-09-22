import React from "react"
import { Bell, ShieldAlert } from "lucide-react"

interface SecurityNotificationBellProps {
  count: number
  hasCritical?: boolean
  onClick?: () => void
}

export const SecurityNotificationBell: React.FC<SecurityNotificationBellProps> = ({
  count,
  hasCritical = false,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      aria-label={`Security notifications: ${count} unread`}
      className="relative p-2 rounded-xl text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
    >
      {hasCritical ? (
        <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
      ) : (
        <Bell className="w-5 h-5" />
      )}

      {count > 0 && (
        <span
          className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-extrabold rounded-full flex items-center justify-center text-white shadow-sm ${
            hasCritical ? "bg-red-600 animate-bounce" : "bg-blue-600"
          }`}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  )
}
