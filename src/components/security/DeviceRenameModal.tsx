import React, { useState } from "react"
import { TrustedDevice } from "@/services/securityService"
import { X, Smartphone, Laptop, Edit3 } from "lucide-react"

interface DeviceRenameModalProps {
  device: TrustedDevice
  isOpen: boolean
  onClose: () => void
  onSave: (deviceId: string, newName: string) => Promise<void>
}

export const DeviceRenameModal: React.FC<DeviceRenameModalProps> = ({
  device,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(device.customName || device.deviceName || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Device name cannot be empty")
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onSave(device.id || (device as any)._id, trimmed)
      onClose()
    } catch (err: any) {
      setError(err?.message || "Failed to update device name")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--foreground)]">Rename Device</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Give this device a recognizable name</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 text-xs rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
              Device Name (Max 50 characters)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 50))}
              placeholder="e.g. My MacBook Pro, Work Desktop"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={50}
              autoFocus
              required
            />
            <span className="text-[10px] text-[var(--muted-foreground)] mt-1 block text-right">
              {name.length} / 50
            </span>
          </div>

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
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Name"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default DeviceRenameModal
