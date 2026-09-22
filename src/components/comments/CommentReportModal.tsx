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
import { Textarea } from "@/components/ui/textarea"
import { Flag, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import {
  commentModerationService,
  REPORT_REASONS,
} from "@/services/commentModerationService"
import { parseRateLimitError } from "@/services/commentService"
import { CaptchaModal } from "./CaptchaModal"

interface CommentReportModalProps {
  isOpen: boolean
  onClose: () => void
  commentId: string
  commentText?: string
  commentAuthor?: string
}

const MAX_DESC_CHARS = 500

export const CommentReportModal: React.FC<CommentReportModalProps> = ({
  isOpen,
  onClose,
  commentId,
  commentText,
  commentAuthor,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>("spam")
  const [description, setDescription] = useState<string>("")
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [submitted, setSubmitted] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number>(0)
  const [isCaptchaOpen, setIsCaptchaOpen] = useState<boolean>(false)

  const handleOpenChange = (open: boolean) => {
    if (!open && !submitting) {
      if (submitted) {
        // Reset state after closing successful submission
        setSubmitted(false)
        setDescription("")
        setSelectedReason("spam")
      }
      setErrorMessage(null)
      onClose()
    }
  }

  const handleSubmit = async (e?: React.FormEvent, captchaToken?: string) => {
    if (e) e.preventDefault()
    if (!commentId || submitting || countdown > 0) return

    setSubmitting(true)
    setErrorMessage(null)

    try {
      await commentModerationService.reportComment(commentId, {
        reason: selectedReason,
        description: description.trim(),
        captchaToken,
      })
      setSubmitted(true)
    } catch (err: any) {
      console.error("Failed to submit report:", err)
      const rateLimitInfo = parseRateLimitError(err)
      if (rateLimitInfo) {
        setErrorMessage(rateLimitInfo.message)
        if (rateLimitInfo.retryAfter > 0) {
          setCountdown(rateLimitInfo.retryAfter)
        }
        if (rateLimitInfo.captchaRequired) {
          setIsCaptchaOpen(true)
        }
      } else {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to submit report. Please try again."
        setErrorMessage(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleCaptchaVerify = async (token: string) => {
    setIsCaptchaOpen(false)
    await handleSubmit(undefined, token)
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg bg-neutral-900 border-neutral-800 text-white rounded-2xl shadow-2xl p-6">
          <DialogHeader className="space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-1">
              <Flag className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-center text-neutral-100">
              Report Comment
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-neutral-400">
              {commentAuthor
                ? `Reporting comment by @${commentAuthor}. Reports are reviewed by human moderators.`
                : "Help maintain a healthy community. Reports are reviewed by human moderators."}
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-neutral-100">
                Report Submitted
              </h3>
              <p className="text-xs text-neutral-400 max-w-xs">
                Thanks. Your report has been submitted for review. Our moderation team will inspect this content.
              </p>
              <Button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="mt-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs rounded-full px-6"
              >
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              {errorMessage && (
                <div
                  className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Comment preview snippet */}
              {commentText && (
                <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-950/60 text-xs text-neutral-300 italic line-clamp-2">
                  &ldquo;{commentText}&rdquo;
                </div>
              )}

              {/* Reason Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-300">
                  Why are you reporting this comment?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {REPORT_REASONS.map((r) => {
                    const isSelected = selectedReason === r.value
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setSelectedReason(r.value)}
                        className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "border-red-500 bg-red-500/10 text-white"
                            : "border-neutral-800 hover:border-neutral-700 bg-neutral-800/40 text-neutral-300"
                        }`}
                      >
                        <div className="text-xs font-semibold">{r.label}</div>
                        <div className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1">
                          {r.description}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Optional details */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-xs font-semibold text-neutral-300">
                    Additional details <span className="text-neutral-500 font-normal">(optional)</span>
                  </label>
                  <span
                    className={`font-mono text-[10px] ${
                      description.length > MAX_DESC_CHARS
                        ? "text-red-400"
                        : "text-neutral-500"
                    }`}
                  >
                    {description.length} / {MAX_DESC_CHARS}
                  </span>
                </div>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC_CHARS))}
                  placeholder="Provide any relevant context to help moderators evaluate this report..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-xl border border-neutral-700/80 bg-neutral-950 focus-visible:ring-1 focus-visible:ring-red-500 resize-none"
                />
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  disabled={submitting}
                  className="text-neutral-400 hover:text-white text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || countdown > 0}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium text-xs rounded-lg px-4 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Submitting...
                    </>
                  ) : countdown > 0 ? (
                    `Wait ${countdown}s`
                  ) : (
                    "Submit Report"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Adaptive CAPTCHA verification modal if required */}
      <CaptchaModal
        isOpen={isCaptchaOpen}
        onClose={() => setIsCaptchaOpen(false)}
        onVerify={handleCaptchaVerify}
        actionName="submit report"
      />
    </>
  )
}

export default CommentReportModal
