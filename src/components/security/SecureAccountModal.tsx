import React, { useState } from "react"
import { Lock, ShieldAlert, X, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SecureAccountModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}

export const SecureAccountModal: React.FC<SecureAccountModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState("Unrecognized activity or potential compromise")

  if (!isOpen) return null

  const handleConfirm = async () => {
    try {
      setLoading(true)
      await onConfirm(reason)
      onClose()
    } catch (err) {
      console.error("Lockdown confirmation failed:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="secure-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-md p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl">
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-11 h-11 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0 border border-red-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 id="secure-modal-title" className="text-lg font-bold text-[var(--foreground)]">
              Secure My Account
            </h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Emergency account protection and session lockdown
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-5 text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">The following actions will be executed immediately:</p>
            <ul className="list-disc list-inside space-y-0.5 opacity-90">
              <li>All other connected devices and sessions will be signed out.</li>
              <li>Unverified device trust will be suspended.</li>
              <li>Account protection level will be elevated to PROTECTED.</li>
              <li>Your current browser session will remain active.</li>
            </ul>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1.5">
            Reason for Security Action
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[var(--muted)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder="e.g. Unrecognized activity on another device"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
            className="text-xs font-semibold rounded-xl"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={loading}
            className="text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{loading ? "Securing Account..." : "Confirm & Secure Account"}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
