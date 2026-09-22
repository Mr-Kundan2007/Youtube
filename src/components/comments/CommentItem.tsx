import React, { useState, useEffect, useCallback } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  ThumbsUp,
  ThumbsDown,
  MapPin,
  ChevronDown,
  ChevronUp,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  AlertCircle,
  History,
  Languages,
  Flag,
} from "lucide-react"
import { useAuth } from "@/lib/AuthContext"
import { formatRelativeTime, useIsMounted } from "@/lib/formatDate"
import {
  commentService,
  CommentItemData,
  PaginationMetadata,
  SUPPORTED_TRANSLATION_LANGUAGES,
  parseRateLimitError,
} from "@/services/commentService"
import { CommentReplyComposer } from "./CommentReplyComposer"
import { MentionRenderer } from "./MentionRenderer"
import { CommentHistoryDialog } from "./CommentHistoryDialog"
import { CaptchaModal } from "./CaptchaModal"
import { CommentReportModal } from "./CommentReportModal"

const MAX_DEPTH = 3
const EDIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes edit window

interface CommentItemProps {
  comment: CommentItemData
  depth?: number
  onReplyClick?: (comment: CommentItemData) => void
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  depth = 1,
  onReplyClick,
}) => {
  const isMounted = useIsMounted()
  const { user }: any = useAuth()

  // Lifecycle states (Phase 6 Edit, Delete, Versioning)
  const initialDeleted = Boolean(comment.isDeleted || comment.text === "[Comment deleted]")
  const initialEdited = !initialDeleted && Boolean(comment.isEdited)
  const initialText = initialDeleted ? "[Comment deleted]" : (comment.text || comment.commentbody || "")

  const [isDeletedState, setIsDeletedState] = useState(initialDeleted)
  const [isEditedState, setIsEditedState] = useState(initialEdited)
  const [currentTextState, setCurrentTextState] = useState(initialText)
  const [currentVersion, setCurrentVersion] = useState(comment.version || 1)

  // Edit mode states
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(initialText)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete and history dialog states
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)

  // Translation states (Phase 7 Multilingual Translation)
  const userPreferredLang = (user?.preferredLanguage || user?.preferred_language || "en").toLowerCase()
  const [selectedTargetLang, setSelectedTargetLang] = useState<string>(userPreferredLang)
  const [isTranslating, setIsTranslating] = useState<boolean>(false)
  const [translatedText, setTranslatedText] = useState<string | null>(null)
  const [translationSourceLang, setTranslationSourceLang] = useState<string | null>(null)
  const [isShowingTranslation, setIsShowingTranslation] = useState<boolean>(false)
  const [translationError, setTranslationError] = useState<string | null>(null)
  const [sameLanguageNotice, setSameLanguageNotice] = useState<boolean>(false)

  // Report modal state (Phase 10)
  const [showReportModal, setShowReportModal] = useState<boolean>(false)

  // Rate limiting & CAPTCHA state (Phase 9)
  const [isCaptchaOpen, setIsCaptchaOpen] = useState(false)
  const [captchaAction, setCaptchaAction] = useState<"edit" | "translate">("edit")
  const [editCountdown, setEditCountdown] = useState<number>(0)

  // Ticking countdown timer for rate-limited edits
  useEffect(() => {
    if (editCountdown <= 0) return
    const timer = setInterval(() => {
      setEditCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [editCountdown])

  // Reaction states (Phase 5)
  const initialReaction = comment.userReaction || null
  const initialLikes =
    typeof comment.likeCount === "number"
      ? comment.likeCount
      : typeof comment.likes === "number"
      ? comment.likes
      : 0
  const initialDislikes = typeof comment.dislikeCount === "number" ? comment.dislikeCount : 0

  const [userReaction, setUserReaction] = useState<"like" | "dislike" | null>(initialReaction)
  const [likeCount, setLikeCount] = useState<number>(initialLikes)
  const [dislikeCount, setDislikeCount] = useState<number>(initialDislikes)
  const [isReacting, setIsReacting] = useState<boolean>(false)

  // Reply threading state (Phase 4)
  const [isReplying, setIsReplying] = useState(false)
  const [repliesExpanded, setRepliesExpanded] = useState(false)
  const [replies, setReplies] = useState<CommentItemData[]>([])
  const [repliesLoading, setRepliesLoading] = useState(false)
  const [repliesLoaded, setRepliesLoaded] = useState(false)
  const [loadingMoreReplies, setLoadingMoreReplies] = useState(false)
  const [replyPagination, setReplyPagination] = useState<PaginationMetadata>({
    page: 1,
    limit: 10,
    totalReplies: 0,
    totalPages: 1,
    hasMore: false,
  })
  const [currentReplyCount, setCurrentReplyCount] = useState(
    typeof comment.replyCount === "number" ? comment.replyCount : 0
  )

  // Author & ownership determination
  const currentUserId = user?._id || user?.id || user?.userId
  const commentAuthorId = comment.user?.id || comment.userId || comment.userid
  const isOwner = Boolean(
    currentUserId && commentAuthorId && String(currentUserId) === String(commentAuthorId)
  )

  const authorName =
    comment.user?.username ||
    comment.author ||
    comment.usercommented ||
    "User"

  const avatarUrl =
    comment.user?.profilePicture ||
    comment.avatarUrl ||
    ""

  const avatarInitial = (comment.avatarText || authorName[0] || "U").toUpperCase()
  const location = comment.user?.location || null

  const createdAtDate = comment.createdAt ? new Date(comment.createdAt) : new Date()
  const timeAgoText = isMounted
    ? formatRelativeTime(createdAtDate, "Just now")
    : "Recently"

  const fullDateTitle = isMounted ? createdAtDate.toLocaleString() : ""

  // Edit window calculation
  const isWithinEditWindow =
    !isDeletedState &&
    isOwner &&
    Date.now() - createdAtDate.getTime() < EDIT_WINDOW_MS

  // Reaction handler with optimistic updates
  const handleReaction = async (reactionType: "like" | "dislike") => {
    const commentId = String(comment.id || comment._id)
    if (!commentId || isDeletedState || isReacting) return

    const prevReaction = userReaction
    const prevLikes = likeCount
    const prevDislikes = dislikeCount

    let nextReaction: "like" | "dislike" | null = null
    let nextLikes = prevLikes
    let nextDislikes = prevDislikes

    if (reactionType === "like") {
      if (prevReaction === "like") {
        nextReaction = null
        nextLikes = Math.max(0, prevLikes - 1)
      } else if (prevReaction === "dislike") {
        nextReaction = "like"
        nextDislikes = Math.max(0, prevDislikes - 1)
        nextLikes = prevLikes + 1
      } else {
        nextReaction = "like"
        nextLikes = prevLikes + 1
      }
    } else {
      if (prevReaction === "dislike") {
        nextReaction = null
        nextDislikes = Math.max(0, prevDislikes - 1)
      } else if (prevReaction === "like") {
        nextReaction = "dislike"
        nextLikes = Math.max(0, prevLikes - 1)
        nextDislikes = prevDislikes + 1
      } else {
        nextReaction = "dislike"
        nextDislikes = prevDislikes + 1
      }
    }

    setUserReaction(nextReaction)
    setLikeCount(nextLikes)
    setDislikeCount(nextDislikes)
    setIsReacting(true)

    try {
      const res = await commentService.reactToComment(commentId, reactionType)
      if (res) {
        setUserReaction(res.userReaction)
        if (typeof res.likeCount === "number") setLikeCount(res.likeCount)
        if (typeof res.dislikeCount === "number") setDislikeCount(res.dislikeCount)
      }
    } catch {
      setUserReaction(prevReaction)
      setLikeCount(prevLikes)
      setDislikeCount(prevDislikes)
    } finally {
      setIsReacting(false)
    }
  }

  // Save edit handler
  const handleSaveEdit = async (captchaToken?: string) => {
    const commentId = String(comment.id || comment._id)
    const trimmed = editText.trim()
    if (!trimmed || isSavingEdit || editCountdown > 0 || !commentId) return

    if (trimmed.length > 2000) {
      setEditError("Comment exceeds maximum allowed length of 2,000 characters")
      return
    }

    // No-op edit check
    if (trimmed === currentTextState.trim()) {
      setIsEditing(false)
      setEditError(null)
      return
    }

    setIsSavingEdit(true)
    setEditError(null)

    try {
      const updated = await commentService.editComment(commentId, trimmed, currentVersion, {
        captchaToken,
      })
      setCurrentTextState(trimmed)
      setIsEditedState(true)
      if (updated?.version) {
        setCurrentVersion(updated.version)
      } else {
        setCurrentVersion((prev) => prev + 1)
      }
      setIsEditing(false)
      setEditCountdown(0)
      // Reset translation state as comment content and version updated
      setTranslatedText(null)
      setIsShowingTranslation(false)
      setTranslationSourceLang(null)
      setTranslationError(null)
      setSameLanguageNotice(false)
    } catch (err: any) {
      const rateLimitInfo = parseRateLimitError(err)
      if (rateLimitInfo) {
        setEditError(rateLimitInfo.message)
        if (rateLimitInfo.retryAfter > 0) {
          setEditCountdown(rateLimitInfo.retryAfter)
        }
        if (rateLimitInfo.captchaRequired) {
          setCaptchaAction("edit")
          setIsCaptchaOpen(true)
        }
      } else {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          "Unable to update comment. Please try again."
        setEditError(message)
      }
    } finally {
      setIsSavingEdit(false)
    }
  }

  // Translation handlers (Phase 7 & Phase 9)
  const handleTranslate = async (overrideTargetLang?: string, captchaToken?: string) => {
    const commentId = String(comment.id || comment._id)
    if (!commentId || isTranslating) return

    const target = (overrideTargetLang || selectedTargetLang || userPreferredLang || "en").toLowerCase()
    setIsTranslating(true)
    setTranslationError(null)
    setSameLanguageNotice(false)

    try {
      const res = await commentService.translateComment(commentId, target, { captchaToken })
      if (res.sameLanguage) {
        setSameLanguageNotice(true)
        setIsShowingTranslation(false)
        setTranslatedText(null)
      } else {
        setTranslatedText(res.translatedText)
        setTranslationSourceLang(res.sourceLanguage)
        setIsShowingTranslation(true)
      }
    } catch (err: any) {
      const rateLimitInfo = parseRateLimitError(err)
      if (rateLimitInfo) {
        setTranslationError(rateLimitInfo.message)
        if (rateLimitInfo.captchaRequired) {
          setCaptchaAction("translate")
          setIsCaptchaOpen(true)
        }
      } else {
        setTranslationError(
          err?.response?.data?.message || "Unable to translate this comment. Please try again."
        )
      }
    } finally {
      setIsTranslating(false)
    }
  }

  const handleCaptchaVerify = async (token: string) => {
    setIsCaptchaOpen(false)
    if (captchaAction === "edit") {
      await handleSaveEdit(token)
    } else if (captchaAction === "translate") {
      await handleTranslate(undefined, token)
    }
  }

  const handleToggleTranslation = () => {
    if (!translatedText) {
      handleTranslate()
    } else {
      setIsShowingTranslation(!isShowingTranslation)
    }
  }

  const handleCancelEdit = () => {
    setEditText(currentTextState)
    setEditError(null)
    setIsEditing(false)
  }

  // Soft delete confirm handler
  const handleConfirmDelete = async () => {
    const commentId = String(comment.id || comment._id)
    if (!commentId || isDeleting) return

    setIsDeleting(true)
    try {
      await commentService.deleteComment(commentId)
      setIsDeletedState(true)
      setShowDeleteDialog(false)
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to delete comment.")
    } finally {
      setIsDeleting(false)
    }
  }

  // Fetch replies when thread is expanded
  const fetchReplies = useCallback(
    async (pageToLoad = 1) => {
      const commentId = String(comment.id || comment._id)
      if (!commentId) return

      if (pageToLoad === 1) {
        setRepliesLoading(true)
      } else {
        setLoadingMoreReplies(true)
      }

      try {
        const res = await commentService.getReplies(commentId, {
          page: pageToLoad,
          limit: 10,
        })

        if (pageToLoad === 1) {
          setReplies(res.replies)
        } else {
          setReplies((prev) => {
            const existingIds = new Set(prev.map((r) => String(r.id || r._id)))
            const unique = res.replies.filter((r) => !existingIds.has(String(r.id || r._id)))
            return [...prev, ...unique]
          })
        }

        setReplyPagination(res.pagination)
        setRepliesLoaded(true)
        if (res.pagination.totalReplies !== undefined) {
          setCurrentReplyCount(Math.max(currentReplyCount, res.pagination.totalReplies))
        }
      } catch (err) {
        console.error("Failed to load replies:", err)
      } finally {
        setRepliesLoading(false)
        setLoadingMoreReplies(false)
      }
    },
    [comment.id, comment._id, currentReplyCount]
  )

  const handleToggleReplies = () => {
    if (!repliesExpanded && !repliesLoaded) {
      fetchReplies(1)
    }
    setRepliesExpanded(!repliesExpanded)
  }

  const handleLoadMoreReplies = () => {
    if (replyPagination.hasMore && !loadingMoreReplies) {
      fetchReplies(replyPagination.page + 1)
    }
  }

  const handleReplyCreated = (newReply: CommentItemData) => {
    setReplies((prev) => [...prev, newReply])
    setCurrentReplyCount((prev) => prev + 1)
    setRepliesExpanded(true)
    setRepliesLoaded(true)
    setIsReplying(false)
  }

  const canReply = !isDeletedState && depth < MAX_DEPTH

  return (
    <article
      className="group flex gap-3 text-sm py-1 relative"
      data-testid={`comment-item-${comment.id || comment._id}`}
      aria-label={`Comment by ${authorName}`}
    >
      {/* Author Avatar */}
      <Avatar className="h-9 w-9 shrink-0 mt-0.5">
        {avatarUrl && !isDeletedState ? (
          <AvatarImage src={avatarUrl} alt={authorName} />
        ) : null}
        <AvatarFallback className="bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-semibold">
          {isDeletedState ? "•" : avatarInitial}
        </AvatarFallback>
      </Avatar>

      {/* Main Comment Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Header: Author Name, Location Badge, Timestamp, Edited Tag, Action Menu */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-[200px]">
              {isDeletedState ? "Deleted user" : authorName}
            </span>

            {/* Public Location Badge */}
            {location && !isDeletedState && (
              <span
                className="inline-flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/60 px-1.5 py-0.5 rounded-full"
                title={`Posted from ${location}`}
              >
                <MapPin className="h-2.5 w-2.5" />
                <span>{location}</span>
              </span>
            )}

            {/* Timestamp */}
            <time
              dateTime={createdAtDate.toISOString()}
              title={fullDateTitle}
              className="text-neutral-500 dark:text-neutral-400 text-[11px]"
              suppressHydrationWarning
            >
              {timeAgoText}
            </time>

            {/* Edited State Indicator (Clickable to open revision history) */}
            {isEditedState && !isDeletedState && (
              <button
                type="button"
                onClick={() => setShowHistoryDialog(true)}
                className="text-[11px] text-neutral-400 dark:text-neutral-500 font-normal italic hover:underline hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer inline-flex items-center gap-0.5"
                title="Click to view edit history"
              >
                <span>(edited)</span>
              </button>
            )}
          </div>

          {/* Action Menu (Visible for comment options) */}
          {!isDeletedState && (
            <div className="shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    aria-label="Comment options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-32 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl rounded-xl p-1 text-xs z-50"
                >
                  {isOwner && isWithinEditWindow && (
                    <DropdownMenuItem
                      onClick={() => {
                        setEditText(currentTextState)
                        setIsEditing(true)
                        setEditError(null)
                      }}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium"
                    >
                      <Pencil className="h-3.5 w-3.5 text-neutral-500" />
                      <span>Edit</span>
                    </DropdownMenuItem>
                  )}
                  {isOwner && (
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 font-medium"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  )}
                  {!isOwner && (
                    <DropdownMenuItem
                      onClick={() => setShowReportModal(true)}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium"
                    >
                      <Flag className="h-3.5 w-3.5 text-neutral-500" />
                      <span>Report</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Comment Body or Inline Editor */}
        {isEditing ? (
          <div className="space-y-2 pt-1">
            <Textarea
              value={editText}
              onChange={(e) => {
                setEditText(e.target.value)
                if (editError) setEditError(null)
              }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault()
                  handleSaveEdit()
                } else if (e.key === "Escape") {
                  e.preventDefault()
                  handleCancelEdit()
                }
              }}
              rows={2}
              maxLength={2050}
              className="w-full text-xs sm:text-sm p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent focus-visible:ring-1 focus-visible:ring-blue-500 resize-none shadow-none"
              autoFocus
            />

            {editError && (
              <div role="alert" aria-live="assertive" className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{editCountdown > 0 ? `${editError} (${editCountdown}s remaining)` : editError}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span
                className={`text-[11px] font-mono ${
                  editText.length > 2000
                    ? "text-red-600 font-semibold"
                    : "text-neutral-400 dark:text-neutral-500"
                }`}
              >
                {editText.length} / 2,000
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isSavingEdit}
                  className="h-7 text-xs rounded-full px-3 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSaveEdit()}
                  disabled={isSavingEdit || editCountdown > 0 || !editText.trim() || editText.length > 2000}
                  className="h-7 text-xs rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3.5 font-semibold cursor-pointer shadow-sm"
                >
                  {isSavingEdit && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  <span>{editCountdown > 0 ? `Wait ${editCountdown}s` : "Save"}</span>
                </Button>
              </div>
            </div>
          </div>
        ) : isDeletedState ? (
          <p className="text-xs text-neutral-400 dark:text-neutral-500 italic py-0.5 select-none">
            [Comment deleted]
          </p>
        ) : (
          <div className="space-y-1">
            {/* Comment text or Translated text */}
            <div className="text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed break-words whitespace-pre-wrap">
              {isShowingTranslation && translatedText ? (
                <MentionRenderer text={translatedText} />
              ) : (
                <MentionRenderer text={currentTextState} />
              )}
            </div>

            {/* Translation Source Language / Attribution indicator */}
            {isShowingTranslation && translationSourceLang && (
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 dark:text-neutral-500 pt-0.5 select-none">
                <Languages className="h-3 w-3 text-blue-500" />
                <span>
                  Translated from {translationSourceLang.toUpperCase()}
                  {selectedTargetLang ? ` to ${selectedTargetLang.toUpperCase()}` : ""}
                </span>
              </div>
            )}

            {/* Translation Error Notice */}
            {translationError && (
              <div className="flex items-center gap-1.5 text-[11px] text-red-500 pt-0.5">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{translationError}</span>
                <button
                  type="button"
                  onClick={() => handleTranslate()}
                  className="ml-1 text-blue-500 underline hover:text-blue-600 cursor-pointer font-medium"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Same Language Notice */}
            {sameLanguageNotice && (
              <div className="text-[11px] text-neutral-400 italic pt-0.5">
                This comment is already in your selected language.
              </div>
            )}
          </div>
        )}

        {/* Action Controls (Likes, Dislikes, Reply, Translate) */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
          {!isDeletedState && !isEditing && (
            <>
              {/* Like button */}
              <button
                type="button"
                onClick={() => handleReaction("like")}
                aria-label={userReaction === "like" ? "Unlike comment" : "Like comment"}
                disabled={isReacting}
                className={`flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${
                  userReaction === "like" ? "text-blue-600 dark:text-blue-400 font-medium" : ""
                }`}
              >
                <ThumbsUp
                  className={`h-3.5 w-3.5 ${userReaction === "like" ? "fill-current" : ""}`}
                />
                {likeCount > 0 && <span className="text-xs">{likeCount}</span>}
              </button>

              {/* Dislike button */}
              <button
                type="button"
                onClick={() => handleReaction("dislike")}
                aria-label={userReaction === "dislike" ? "Remove dislike" : "Dislike comment"}
                disabled={isReacting}
                className={`flex items-center gap-1.5 p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${
                  userReaction === "dislike" ? "text-blue-600 dark:text-blue-400 font-medium" : ""
                }`}
              >
                <ThumbsDown
                  className={`h-3.5 w-3.5 ${userReaction === "dislike" ? "fill-current" : ""}`}
                />
              </button>

              {/* Reply toggle button (Phase 4) */}
              {canReply && (
                <button
                  type="button"
                  onClick={() => {
                    setIsReplying(!isReplying)
                    onReplyClick?.(comment)
                  }}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer ml-1"
                >
                  Reply
                </button>
              )}

              {/* Translate button & language selector (Phase 7) */}
              <div className="flex items-center gap-0.5 ml-1">
                <button
                  type="button"
                  onClick={handleToggleTranslation}
                  disabled={isTranslating}
                  aria-label={
                    isShowingTranslation
                      ? "Show original comment"
                      : `Translate comment to ${selectedTargetLang.toUpperCase()}`
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isTranslating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                      <span>Translating...</span>
                    </>
                  ) : isShowingTranslation ? (
                    <>
                      <Languages className="h-3.5 w-3.5 text-blue-500" />
                      <span>Show original</span>
                    </>
                  ) : (
                    <>
                      <Languages className="h-3.5 w-3.5" />
                      <span>
                        Translate to{" "}
                        {SUPPORTED_TRANSLATION_LANGUAGES.find((l) => l.code === selectedTargetLang)?.name.split(" ")[0] ||
                          selectedTargetLang.toUpperCase()}
                      </span>
                    </>
                  )}
                </button>

                {/* Target Language Dropdown Selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Select translation target language"
                      className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-44 max-h-56 overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl rounded-xl p-1 text-xs z-50"
                  >
                    {SUPPORTED_TRANSLATION_LANGUAGES.map((lang) => (
                      <DropdownMenuItem
                        key={lang.code}
                        onClick={() => {
                          setSelectedTargetLang(lang.code)
                          handleTranslate(lang.code)
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs ${
                          selectedTargetLang === lang.code ? "font-semibold text-blue-600 dark:text-blue-400" : ""
                        }`}
                      >
                        <span>{lang.name}</span>
                        {selectedTargetLang === lang.code && <span className="text-[10px]">✓</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>

        {/* Inline Reply Composer */}
        {isReplying && canReply && (
          <CommentReplyComposer
            parentCommentId={String(comment.id || comment._id)}
            targetAuthorName={authorName}
            onReplyCreated={handleReplyCreated}
            onCancel={() => setIsReplying(false)}
          />
        )}

        {/* Reply Thread Toggle Header */}
        {currentReplyCount > 0 && (
          <div className="pt-0.5">
            <button
              type="button"
              onClick={handleToggleReplies}
              aria-expanded={repliesExpanded}
              className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-2.5 py-1 -ml-2 rounded-full transition-colors cursor-pointer"
            >
              {repliesExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              <span>
                {repliesExpanded
                  ? "Hide replies"
                  : `${currentReplyCount} ${
                      currentReplyCount === 1 ? "reply" : "replies"
                    }`}
              </span>
            </button>
          </div>
        )}

        {/* Threaded Nested Replies Container */}
        {repliesExpanded && (
          <div
            className="ml-2 sm:ml-4 pl-3 sm:pl-4 border-l-2 border-neutral-200 dark:border-neutral-800 space-y-3 mt-2 pt-1"
            data-testid={`replies-container-${comment.id || comment._id}`}
          >
            {repliesLoading ? (
              <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Loading replies...</span>
              </div>
            ) : (
              <>
                {replies.map((reply) => (
                  <CommentItem
                    key={reply.id || reply._id || `reply-${reply.createdAt}`}
                    comment={reply}
                    depth={depth + 1}
                  />
                ))}

                {replyPagination.hasMore && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleLoadMoreReplies}
                      disabled={loadingMoreReplies}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white py-1 cursor-pointer disabled:opacity-50"
                    >
                      {loadingMoreReplies ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                      <span>Show more replies</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl p-5 text-neutral-900 dark:text-neutral-100">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-base font-semibold">Delete comment?</DialogTitle>
            <DialogDescription className="text-xs text-neutral-500 dark:text-neutral-400">
              This action will remove your comment from the conversation. Existing replies will remain intact.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
              className="h-8 rounded-full px-3.5 text-xs font-medium cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="h-8 rounded-full bg-red-600 hover:bg-red-700 text-white px-4 text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Delete</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Revision History Dialog */}
      <CommentHistoryDialog
        commentId={String(comment.id || comment._id)}
        isOpen={showHistoryDialog}
        onClose={() => setShowHistoryDialog(false)}
        currentText={currentTextState}
      />

      {/* Adaptive CAPTCHA Dialog (Phase 9) */}
      <CaptchaModal
        isOpen={isCaptchaOpen}
        onClose={() => setIsCaptchaOpen(false)}
        onVerify={handleCaptchaVerify}
        actionName={captchaAction === "edit" ? "save comment edit" : "translate comment"}
      />

      {/* Comment Report Modal (Phase 10) */}
      <CommentReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        commentId={String(comment.id || comment._id)}
        commentText={currentTextState}
        commentAuthor={authorName}
      />
    </article>
  )
}

export default CommentItem
