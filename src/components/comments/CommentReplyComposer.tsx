import React, { useState, useRef, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, LogIn, AlertCircle, CornerDownRight } from "lucide-react"
import { useAuth } from "@/lib/AuthContext"
import {
  commentService,
  CommentItemData,
  UserMentionCandidate,
  parseRateLimitError,
} from "@/services/commentService"
import { MentionAutocomplete } from "./MentionAutocomplete"
import { CaptchaModal } from "./CaptchaModal"

const MAX_CHARS = 2000

interface CommentReplyComposerProps {
  parentCommentId: string
  targetAuthorName?: string
  onReplyCreated: (newReply: CommentItemData) => void
  onCancel: () => void
  autoFocus?: boolean
}

export const CommentReplyComposer: React.FC<CommentReplyComposerProps> = ({
  parentCommentId,
  targetAuthorName,
  onReplyCreated,
  onCancel,
  autoFocus = true,
}) => {
  const { user, openAuthModal }: any = useAuth()
  const [text, setText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number>(0)
  const [isCaptchaOpen, setIsCaptchaOpen] = useState<boolean>(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Ticking countdown timer for rate limiting
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  // Mention autocomplete state (Phase 5)
  const [mentionQuery, setMentionQuery] = useState("")
  const [isMentionOpen, setIsMentionOpen] = useState(false)
  const [mentionStartIndex, setMentionStartIndex] = useState<number>(-1)

  const charCount = text.length
  const trimmed = text.trim()
  const isOverLimit = charCount > MAX_CHARS
  const isValid = trimmed.length > 0 && !isOverLimit

  // Detect mention trigger on text input
  const checkMentionTrigger = (currentText: string, cursorPos: number) => {
    const textBeforeCursor = currentText.slice(0, cursorPos)
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_\u0900-\u097F\u0400-\u04FF\u4E00-\u9FFF]*)$/)
    if (match) {
      const query = match[1]
      const atIndex = textBeforeCursor.lastIndexOf("@")
      setMentionQuery(query)
      setMentionStartIndex(atIndex)
      setIsMentionOpen(true)
    } else {
      setIsMentionOpen(false)
    }
  }

  const handleSelectMentionUser = (candidate: UserMentionCandidate) => {
    if (mentionStartIndex < 0 || !textareaRef.current) return

    const cursorPos = textareaRef.current.selectionStart || text.length
    const before = text.slice(0, mentionStartIndex)
    const after = text.slice(cursorPos)
    const mentionText = `@${candidate.username} `
    const newText = before + mentionText + after

    setText(newText)
    setIsMentionOpen(false)

    const newCursorPos = before.length + mentionText.length
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`
    }
  }, [text])

  const handleSubmit = async (e?: React.FormEvent, captchaToken?: string) => {
    if (e) e.preventDefault()
    if (!isValid || submitting || countdown > 0 || !user) return

    setSubmitting(true)
    setErrorMessage(null)

    try {
      const created = await commentService.createReply(parentCommentId, trimmed, {
        captchaToken,
      })
      onReplyCreated(created)
      setText("")
      setCountdown(0)
    } catch (err: any) {
      console.error("Failed to post reply:", err)
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
          err?.response?.data?.error ||
          "Failed to post reply. Please try again."
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault()
      if (isValid && !submitting) {
        handleSubmit()
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      onCancel()
    }
  }

  const userAvatar = user?.image || ""
  const userName = user?.channelname || user?.name || "You"
  const userInitial = (userName[0] || "U").toUpperCase()

  return (
    <div
      className="mt-2 pt-2 pb-1 space-y-2"
      data-testid={`reply-composer-${parentCommentId}`}
      aria-label={`Reply to ${targetAuthorName}`}
    >
      {/* Target indicator banner */}
      <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        <CornerDownRight className="h-3 w-3 shrink-0 text-neutral-400" />
        <span>Replying to</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
          @{targetAuthorName}
        </span>
      </div>

      {!user ? (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-3 flex items-center justify-between gap-3 text-xs">
          <span className="text-neutral-600 dark:text-neutral-400">
            Please sign in to write a reply.
          </span>
          <Button
            type="button"
            size="sm"
            onClick={openAuthModal}
            className="h-7 px-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <LogIn className="h-3 w-3" />
            <span>Sign In</span>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2.5">
          <Avatar className="h-7 w-7 shrink-0 mt-0.5">
            {userAvatar ? <AvatarImage src={userAvatar} alt={userName} /> : null}
            <AvatarFallback className="bg-gradient-to-tr from-red-600 to-amber-600 text-[10px] font-semibold text-white">
              {userInitial}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="relative">
              <MentionAutocomplete
                query={mentionQuery}
                isOpen={isMentionOpen}
                onSelectUser={handleSelectMentionUser}
                onClose={() => setIsMentionOpen(false)}
              />
              <Textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => {
                  const val = e.target.value
                  setText(val)
                  checkMentionTrigger(val, e.target.selectionStart || val.length)
                  if (errorMessage) setErrorMessage(null)
                }}
                onKeyUp={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  checkMentionTrigger(target.value, target.selectionStart || target.value.length)
                }}
                onClick={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  checkMentionTrigger(target.value, target.selectionStart || target.value.length)
                }}
                onKeyDown={handleKeyDown}
                placeholder="Add a reply..."
                rows={1}
                className="w-full min-h-[38px] resize-none border-0 border-b border-neutral-300 dark:border-neutral-700 rounded-none bg-transparent px-0 py-1.5 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 shadow-none focus-visible:border-neutral-900 dark:focus-visible:border-neutral-100 focus-visible:ring-0 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 transition-colors"
                maxLength={MAX_CHARS + 50}
              />
            </div>

            {errorMessage && (
              <div role="alert" aria-live="assertive" className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{countdown > 0 ? `${errorMessage} (${countdown}s remaining)` : errorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1 gap-2">
              <div
                className={`text-[11px] font-mono ${
                  isOverLimit
                    ? "text-red-600 font-semibold dark:text-red-400"
                    : charCount > 1800
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-neutral-400 dark:text-neutral-500"
                }`}
              >
                {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  disabled={submitting}
                  className="h-7 rounded-full px-3 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!isValid || submitting || countdown > 0}
                  className="h-7 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 px-3.5 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>{countdown > 0 ? `Wait ${countdown}s` : "Reply"}</span>
                </Button>
              </div>
            </div>
          </div>
        </form>
      )}

      <CaptchaModal
        isOpen={isCaptchaOpen}
        onClose={() => setIsCaptchaOpen(false)}
        onVerify={handleCaptchaVerify}
        actionName="post reply"
      />
    </div>
  )
}

export default CommentReplyComposer
