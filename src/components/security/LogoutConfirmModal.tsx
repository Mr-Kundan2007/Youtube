import React from "react"
import { LogOut, X, AlertTriangle, ShieldAlert } from "lucide-react"

export type LogoutActionType = "individual" | "others" | "all"

interface LogoutConfirmModalProps {
  isOpen: boolean
  actionType: LogoutActionType
  deviceName?: string
  loading: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  actionType,
  deviceName,
  loading,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null

  const getModalDetails = () => {
    switch (actionType) {
      case "others":
        return {
          title: "Logout All Other Devices?",
          message:
            "This will terminate all other active sessions connected to your account. Your current session will remain signed in.",
          confirmText: "Logout Other Devices",
          icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
        }
      case "all":
        return {
          title: "Logout All Devices?",
          message:
            "This will immediately terminate ALL active sessions across every device, including this one. You will need to sign in again everywhere.",
          confirmText: "Logout Everything",
          icon: <ShieldAlert className="w-5 h-5 text-red-500" />,
        }
      case "individual":
      default:
        return {
          title: "Terminate Device Session?",
          message: `Are you sure you want to sign out ${deviceName || "this device"}? This device will need to complete authentication again to access your account.`,
          confirmText: "Logout Device",
          icon: <LogOut className="w-5 h-5 text-red-500" />,
        }
    }
  }

  const { title, message, confirmText, icon } = getModalDetails()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--muted)] flex items-center justify-center">
              {icon}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Security Action Confirmation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">{message}</p>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? "Signing out..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LogoutConfirmModal
