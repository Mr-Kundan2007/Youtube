import React from "react"

interface CommentLoadingStateProps {
  count?: number
}

export const CommentLoadingState: React.FC<CommentLoadingStateProps> = ({ count = 3 }) => {
  return (
    <div className="space-y-4 py-2" data-testid="comment-loading-state" aria-busy="true" aria-label="Loading comments">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex gap-3 animate-pulse">
          {/* Avatar Skeleton */}
          <div className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-800 shrink-0" />

          {/* Text Skeleton */}
          <div className="flex-1 space-y-2 py-1">
            <div className="flex items-center gap-3">
              <div className="h-3 w-28 rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-2.5 w-16 rounded bg-neutral-200/70 dark:bg-neutral-800/70" />
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="h-3 w-5/6 rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-3 w-3/5 rounded bg-neutral-200 dark:bg-neutral-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default CommentLoadingState
