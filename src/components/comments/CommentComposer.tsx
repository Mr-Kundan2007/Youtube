import React, { useState, useRef, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, LogIn, AlertCircle } from "lucide-react"
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

interface CommentComposerProps {
  contentId: string
  onCommentCreated: (newComment: CommentItemData) => void
  placeholder?: string
}

export const CommentComposer: React.FC<CommentComposerProps> = ({
  contentId,
  onCommentCreated,
  placeholder = "Add a comment...",
}) => {
  const { user, loginWithGoogle }: any = useAuth()
  const [text, setText] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number>(0)
  const [isCaptchaOpen, setIsCaptchaOpen] = useState<boolean>(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Mention autocomplete state (Phase 5)
  const [mentionQuery, setMentionQuery] = useState("")
  const [isMentionOpen, setIsMentionOpen] = useState(false)
  const [mentionStartIndex, setMentionStartIndex] = useState<number>(-1)

  const charCount = text.length
  const trimmed = text.trim()
  const isOverLimit = charCount > MAX_CHARS
  const isValid = trimmed.length > 0 && !isOverLimit

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

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 240)}px`
    }
  }, [text])

  const handleSubmit = async (e?: React.FormEvent, captchaToken?: string) => {
    if (e) e.preventDefault()
    if (!isValid || submitting || countdown > 0 || !user) return

    setSubmitting(true)
    setErrorMessage(null)

    try {
      const created = await commentService.createComment(contentId, trimmed, {
        captchaToken,
      })
      onCommentCreated(created)
      setText("")
      setIsFocused(false)
      setCountdown(0)
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
    } catch (err: any) {
      console.error("Failed to post comment:", err)
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
          "Failed to post comment. Please try again."
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
    }
  }

  const handleCancel = () => {
    setText("")
    setErrorMessage(null)
    setIsFocused(false)
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const userAvatar = user?.image || ""
  const userName = user?.channelname || user?.name || "You"
  const userInitial = (userName[0] || "U").toUpperCase()

  return (
    <div className="flex gap-3 pt-2" data-testid="comment-composer">
      {/* User Avatar */}
      <Avatar className="h-10 w-10 shrink-0">
        {userAvatar ? <AvatarImage src={userAvatar} alt={userName} /> : null}
        <AvatarFallback className="bg-gradient-to-tr from-red-600 to-amber-600 text-xs font-semibold text-white">
          {user ? userInitial : <LogIn className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      {/* Input / Sign-in Prompt Area */}
      <div className="flex-1 min-w-0">
        {!user ? (
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Sign in to join the conversation
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Share your thoughts and connect with creators and viewers worldwide.
              </p>
            </div>
            <Button
              type="button"
              onClick={loginWithGoogle}
              className="h-10 sm:h-9 w-full sm:w-auto px-5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2">
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
                onFocus={() => setIsFocused(true)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={1}
                className="w-full min-h-[42px] resize-none border-0 border-b border-neutral-300 dark:border-neutral-700 rounded-none bg-transparent px-0 py-2 text-sm text-neutral-900 dark:text-neutral-100 shadow-none focus-visible:border-neutral-900 dark:focus-visible:border-neutral-100 focus-visible:ring-0 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 transition-colors"
                maxLength={MAX_CHARS + 50} // Allow slight overshoot to trigger visual error state
              />
            </div>

            {/* Error Message banner */}
            {errorMessage && (
              <div role="alert" aria-live="assertive" className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 pt-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{countdown > 0 ? `${errorMessage} (${countdown}s remaining)` : errorMessage}</span>
              </div>
            )}

            {/* Active Controls: Counter + Cancel + Submit */}
            {(isFocused || text.length > 0) && (
              <div className="flex items-center justify-between pt-1 gap-2">
                {/* Character Counter */}
                <div
                  className={`text-xs font-mono transition-colors ${
                    isOverLimit
                      ? "text-red-600 font-semibold dark:text-red-400"
                      : charCount > 1800
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-neutral-400 dark:text-neutral-500"
                  }`}
                  aria-live="polite"
                >
                  {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    disabled={submitting}
                    className="h-8 rounded-full px-3.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!isValid || submitting || countdown > 0}
                    className="h-8 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 px-4 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{countdown > 0 ? `Wait ${countdown}s` : "Comment"}</span>
                  </Button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>

      <CaptchaModal
        isOpen={isCaptchaOpen}
        onClose={() => setIsCaptchaOpen(false)}
        onVerify={handleCaptchaVerify}
        actionName="post comment"
      />
    </div>
  )
}

export default CommentComposer
