import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ShieldCheck, Loader2, CheckCircle2, AlertCircle } from "lucide-react"

interface CaptchaModalProps {
  isOpen: boolean
  onClose: () => void
  onVerify: (token: string) => Promise<void> | void
  actionName?: string
}

export const CaptchaModal: React.FC<CaptchaModalProps> = ({
  isOpen,
  onClose,
  onVerify,
  actionName = "continue",
}) => {
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSimulatedVerify = async () => {
    setVerifying(true)
    setError(null)

    try {
      // Small intentional delay to simulate challenge resolution
      await new Promise((resolve) => setTimeout(resolve, 600))
      const token = `mock-captcha-valid-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      setVerified(true)
      await onVerify(token)
      onClose()
    } catch (err: any) {
      setError(err?.message || "Verification failed. Please try again.")
      setVerified(false)
    } finally {
      setVerifying(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && !verifying) {
      setError(null)
      setVerified(false)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md bg-neutral-900 border-neutral-800 text-white rounded-2xl shadow-2xl p-6">
        <DialogHeader className="space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-1">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-bold text-center text-neutral-100">
            Security Verification Required
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-neutral-400">
            Unusual posting frequency detected. Please verify that you are human to {actionName}. Your draft has been preserved.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {error && (
            <div
              className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Verification Box */}
          <div className="p-4 rounded-xl border border-neutral-700/60 bg-neutral-800/50 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSimulatedVerify}
                disabled={verifying || verified}
                aria-label="Click to verify you are human"
                className={`w-7 h-7 rounded-md border-2 transition-all flex items-center justify-center cursor-pointer ${
                  verified
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                    : verifying
                    ? "border-neutral-500 bg-neutral-800"
                    : "border-neutral-500 hover:border-red-500 hover:bg-red-500/10 bg-neutral-800"
                }`}
              >
                {verifying ? (
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
                ) : verified ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : null}
              </button>
              <div className="text-sm font-medium text-neutral-200">
                {verified
                  ? "Verification complete"
                  : verifying
                  ? "Verifying..."
                  : "I am human"}
              </div>
            </div>

            <div className="flex flex-col items-end text-[10px] text-neutral-500 select-none">
              <div className="font-semibold text-neutral-400 tracking-wider">SECURE</div>
              <div>Protection Layer</div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={verifying}
            className="text-neutral-400 hover:text-white text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSimulatedVerify}
            disabled={verifying || verified}
            className="bg-red-600 hover:bg-red-700 text-white font-medium text-xs rounded-lg px-4"
          >
            {verifying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Verifying...
              </>
            ) : verified ? (
              "Verified"
            ) : (
              "Complete Verification"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CaptchaModal
