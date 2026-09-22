import React from "react"
import Link from "next/link"
import { MoreVertical, X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useHistory } from "@/context/HistoryContext"
import { formatRelativeTime, useIsMounted } from "@/lib/formatDate"

export default function HistoryContent() {
  const { history, removeFromHistory, clearHistory } = useHistory()
  const isMounted = useIsMounted()

  return (
    <div className="max-w-5xl p-4 sm:p-8 mx-auto w-full">
      {/* Page Title, Count & Clear Option */}
      <div className="mb-6 flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">
            Watch History
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {history.length} {history.length === 1 ? "video" : "videos"}
          </p>
        </div>

        {history.length > 0 && (
          <Button
            variant="ghost"
            onClick={clearHistory}
            className="flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)] hover:text-red-600 hover:bg-[var(--muted)] rounded-full px-4 py-2 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            <span>Clear all watch history</span>
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="py-16 text-center text-[var(--muted-foreground)]">
          <p className="text-base font-medium text-[var(--foreground)]">No watch history available.</p>
          <p className="text-sm mt-1">Videos you watch on the home page will appear here.</p>
          <Button asChild className="rounded-full bg-red-600 text-white hover:bg-red-700 px-6 cursor-pointer mt-4">
            <Link href="/">
              Browse Videos
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item) => {
            const videoId = item.video._id || item.video.id || "1"
            const createdAtText = isMounted
              ? formatRelativeTime(item.video.createdAt, "recently")
              : "recently"
            const watchedOnText = isMounted
              ? `Watched ${formatRelativeTime(item.watchedon, "recently")}`
              : "Watched recently"

            return (
              <div
                key={item._id}
                className="group flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left justify-between gap-4 rounded-xl p-3 hover:bg-[var(--muted)] transition-colors max-w-[440px] sm:max-w-none mx-auto w-full border border-[var(--border)] sm:border-transparent"
              >
                {/* Left: Thumbnail and Details */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 flex-1 min-w-0 w-full">
                  <Link
                    href={`/watch/${videoId}`}
                    className="relative w-full max-w-[380px] sm:w-60 aspect-video rounded-xl overflow-hidden bg-[var(--muted)] shrink-0 cursor-pointer shadow-sm"
                  >
                    <img
                      src={item.video.thumbnailUrl || "/video/snowglobe.jpg"}
                      alt={item.video.videotitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </Link>

                  <div className="flex-1 min-w-0 py-1 w-full">
                    <Link href={`/watch/${videoId}`}>
                      <h3 className="text-base font-semibold text-[var(--foreground)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug cursor-pointer">
                        {item.video.videotitle}
                      </h3>
                    </Link>

                    <p className="text-xs text-[var(--muted-foreground)] mt-1.5 font-medium">
                      {item.video.videochanel}
                    </p>

                    <p
                      className="text-xs text-[var(--muted-foreground)] mt-0.5"
                      suppressHydrationWarning
                    >
                      {item.video.views.toLocaleString()} views • {createdAtText}
                    </p>

                    <p
                      className="text-[11px] text-[var(--muted-foreground)]/80 mt-1 font-mono"
                      suppressHydrationWarning
                    >
                      {watchedOnText}
                    </p>
                  </div>
                </div>

                {/* Right: Actions Dropdown */}
                <div className="self-center sm:self-start shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted-hover)]"
                        aria-label="More options"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-[var(--card)] text-[var(--card-foreground)] border-[var(--border)]">
                      <DropdownMenuItem
                        onClick={() => removeFromHistory(item._id)}
                        className="cursor-pointer text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        <span>Remove from watch history</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { HistoryContent }
