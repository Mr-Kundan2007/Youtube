import React, { useState, useEffect, useCallback } from "react"
import { ArrowDownWideNarrow, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CommentComposer } from "./CommentComposer"
import { CommentList } from "./CommentList"
import { CommentLoadingState } from "./CommentLoadingState"
import {
  commentService,
  CommentItemData,
  PaginationMetadata,
} from "@/services/commentService"

interface CommentsSectionProps {
  contentId?: string
  videoId?: string
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({
  contentId: propContentId,
  videoId: propVideoId,
}) => {
  const contentId = propContentId || propVideoId || ""

  const [comments, setComments] = useState<CommentItemData[]>([])
  const [pagination, setPagination] = useState<PaginationMetadata>({
    page: 1,
    limit: 20,
    totalComments: 0,
    totalPages: 1,
    hasMore: false,
  })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<"newest" | "top" | "oldest" | "relevant">("newest")

  const sortLabels: Record<"newest" | "top" | "oldest" | "relevant", string> = {
    newest: "Newest first",
    top: "Top comments",
    oldest: "Oldest first",
    relevant: "Most relevant",
  }

  // Fetch initial comments or re-fetch on sort change
  const loadComments = useCallback(
    async (pageToLoad = 1, isInitial = false) => {
      if (!contentId) {
        setLoading(false)
        return
      }

      if (isInitial) {
        setLoading(true)
        setError(null)
      } else {
        setLoadingMore(true)
      }

      try {
        const response = await commentService.getComments(contentId, {
          page: pageToLoad,
          limit: 20,
          sortBy: sortOrder,
          sort: sortOrder,
        })

        if (pageToLoad === 1) {
          setComments(response.comments)
        } else {
          // Deduplicate incoming comments by id
          setComments((prev) => {
            const existingIds = new Set(prev.map((c) => String(c.id || c._id)))
            const filteredNew = response.comments.filter(
              (c) => !existingIds.has(String(c.id || c._id))
            )
            return [...prev, ...filteredNew]
          })
        }

        setPagination(response.pagination)
      } catch (err: any) {
        console.error("Failed to load comments:", err)
        if (pageToLoad === 1) {
          setError("Failed to load comments. Please check your connection.")
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [contentId, sortOrder]
  )

  useEffect(() => {
    loadComments(1, true)
  }, [loadComments])

  // Handle new comment submission (optimistic prepend)
  const handleCommentCreated = (newComment: CommentItemData) => {
    setComments((prev) => [newComment, ...prev])
    setPagination((prev) => ({
      ...prev,
      totalComments: (prev.totalComments || 0) + 1,
    }))
  }

  // Handle pagination load more
  const handleLoadMore = () => {
    if (pagination.hasMore && !loadingMore) {
      loadComments(pagination.page + 1, false)
    }
  }

  const commentCountDisplay =
    (pagination.totalComments ?? 0) > 0
      ? (pagination.totalComments ?? 0)
      : comments.length

  return (
    <section
      className="mt-6 space-y-5"
      aria-label="Comments section"
      data-testid="comments-section"
    >
      {/* Header: Comment Count & Sort Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <span>{commentCountDisplay.toLocaleString()}</span>
            <span>{commentCountDisplay === 1 ? "Comment" : "Comments"}</span>
          </h3>

          {/* Sort By Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                aria-label="Sort comments"
              >
                <ArrowDownWideNarrow className="h-4 w-4" />
                <span>Sort by: {sortLabels[sortOrder]}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem
                onClick={() => setSortOrder("newest")}
                className={`cursor-pointer text-xs ${
                  sortOrder === "newest" ? "font-bold text-blue-600 dark:text-blue-400" : ""
                }`}
              >
                Newest first
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortOrder("top")}
                className={`cursor-pointer text-xs ${
                  sortOrder === "top" ? "font-bold text-blue-600 dark:text-blue-400" : ""
                }`}
              >
                Top comments
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortOrder("oldest")}
                className={`cursor-pointer text-xs ${
                  sortOrder === "oldest" ? "font-bold text-blue-600 dark:text-blue-400" : ""
                }`}
              >
                Oldest first
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortOrder("relevant")}
                className={`cursor-pointer text-xs ${
                  sortOrder === "relevant" ? "font-bold text-blue-600 dark:text-blue-400" : ""
                }`}
              >
                Most relevant
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Comment Composer */}
      {contentId && (
        <CommentComposer
          contentId={contentId}
          onCommentCreated={handleCommentCreated}
        />
      )}

      {/* Main Comment Feed / Loading / Error states */}
      {loading ? (
        <CommentLoadingState count={4} />
      ) : error ? (
        <div className="py-6 px-4 rounded-xl border border-red-200 dark:border-red-950 bg-red-50/50 dark:bg-red-950/20 text-center space-y-3">
          <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-medium">
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadComments(1, true)}
            className="rounded-full text-xs flex items-center gap-1.5 mx-auto cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Try again</span>
          </Button>
        </div>
      ) : (
        <CommentList
          comments={comments}
          hasMore={pagination.hasMore}
          isLoadingMore={loadingMore}
          onLoadMore={handleLoadMore}
        />
      )}
    </section>
  )
}

export default CommentsSection
