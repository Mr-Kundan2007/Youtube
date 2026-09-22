import React, { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, History, Clock } from "lucide-react"
import { commentService, CommentHistoryRecord } from "@/services/commentService"
import { MentionRenderer } from "./MentionRenderer"
import { formatRelativeTime } from "@/lib/formatDate"

interface CommentHistoryDialogProps {
  commentId: string
  isOpen: boolean
  onClose: () => void
  currentText?: string
}

export const CommentHistoryDialog: React.FC<CommentHistoryDialogProps> = ({
  commentId,
  isOpen,
  onClose,
  currentText = "",
}) => {
  const [history, setHistory] = useState<CommentHistoryRecord[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !commentId) return

    let isSubscribed = true
    setLoading(true)

    commentService
      .getCommentHistory(commentId)
      .then((records) => {
        if (isSubscribed) {
          setHistory(records)
        }
      })
      .catch((err) => {
        console.error("Failed to load comment history:", err)
      })
      .finally(() => {
        if (isSubscribed) {
          setLoading(false)
        }
      })

    return () => {
      isSubscribed = false
    }
  }, [commentId, isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl p-6 text-neutral-900 dark:text-neutral-100">
        <DialogHeader className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <History className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-semibold">
              Comment Edit History
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-neutral-500 dark:text-neutral-400">
            View previous revisions and edits made to this comment.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 max-h-[360px] overflow-y-auto space-y-3 pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-neutral-400">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-xs">Loading revision history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="py-6 text-center text-xs text-neutral-500 dark:text-neutral-400 space-y-2">
              <p>No previous edit records available.</p>
              {currentText && (
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl text-left border border-neutral-200 dark:border-neutral-800">
                  <span className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block mb-1">
                    Current Comment
                  </span>
                  <p className="text-xs text-neutral-800 dark:text-neutral-200">
                    <MentionRenderer text={currentText} />
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Render revisions in reverse chronological order */}
              {[...history].reverse().map((record, index) => {
                const isLatest = index === 0
                const dateObj = record.editedAt ? new Date(record.editedAt) : new Date()

                return (
                  <div
                    key={record.id || index}
                    className={`p-3.5 rounded-xl border text-xs transition-colors ${
                      isLatest
                        ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50"
                        : "bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-neutral-900 dark:text-neutral-100">
                        <span>Version {record.version || record.newVersion || index + 1}</span>
                        {isLatest && (
                          <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded-full font-medium">
                            Latest Edit
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                        <Clock className="h-3 w-3" />
                        <span>{formatRelativeTime(dateObj, "Recently")}</span>
                      </div>
                    </div>

                    <div className="text-neutral-800 dark:text-neutral-200 leading-relaxed break-words whitespace-pre-wrap">
                      <MentionRenderer text={record.newText || record.previousText} />
                    </div>

                    {record.previousText && record.previousText !== record.newText && (
                      <details className="mt-2 pt-1 border-t border-neutral-200 dark:border-neutral-700/60 text-[11px] text-neutral-500 dark:text-neutral-400">
                        <summary className="cursor-pointer hover:underline text-neutral-600 dark:text-neutral-300">
                          View previous text
                        </summary>
                        <p className="mt-1 p-2 rounded bg-neutral-100 dark:bg-neutral-900/60 line-through text-neutral-400 dark:text-neutral-500 italic">
                          {record.previousText}
                        </p>
                      </details>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="rounded-full text-xs font-medium px-4 h-8 cursor-pointer"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CommentHistoryDialog
