import React from "react"
import { MessageSquare, Loader2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CommentItem } from "./CommentItem"
import { CommentItemData } from "@/services/commentService"

interface CommentListProps {
  comments: CommentItemData[]
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
  onReplyClick?: (comment: CommentItemData) => void
}

export const CommentList: React.FC<CommentListProps> = ({
  comments,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onReplyClick,
}) => {
  if (comments.length === 0) {
    return (
      <div
        className="text-center py-10 px-4 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 my-4"
        data-testid="comments-empty-state"
      >
        <div className="mx-auto w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 dark:text-neutral-500 mb-3">
          <MessageSquare className="h-6 w-6" />
        </div>
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
          No comments yet
        </h4>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
          Be the first to share what you think about this video!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-2" data-testid="comments-list">
      {/* Stream of comments */}
      {comments.map((comment) => (
        <CommentItem
          key={comment.id || comment._id || `comment-${comment.createdAt}`}
          comment={comment}
          onReplyClick={onReplyClick}
        />
      ))}

      {/* Pagination: Load More */}
      {hasMore && (
        <div className="pt-4 pb-2 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="rounded-full px-5 py-2 text-xs font-semibold border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 cursor-pointer shadow-xs transition-all"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Loading more...</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <span>Load more comments</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

export default CommentList
