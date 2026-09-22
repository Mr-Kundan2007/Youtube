import React, { useEffect, useState, useRef, useCallback } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, User } from "lucide-react"
import { commentService, UserMentionCandidate } from "@/services/commentService"

interface MentionAutocompleteProps {
  query: string
  isOpen: boolean
  onSelectUser: (user: UserMentionCandidate) => void
  onClose: () => void
}

export const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  query,
  isOpen,
  onSelectUser,
  onClose,
}) => {
  const [candidates, setCandidates] = useState<UserMentionCandidate[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)

  // Fetch candidates when query changes
  useEffect(() => {
    if (!isOpen) {
      setCandidates([])
      setSelectedIndex(0)
      return
    }

    let isSubscribed = true
    setLoading(true)

    const timer = setTimeout(async () => {
      try {
        const results = await commentService.searchUsersForMention(query, 6)
        if (isSubscribed) {
          setCandidates(results)
          setSelectedIndex(0)
        }
      } catch (err) {
        if (isSubscribed) {
          setCandidates([])
        }
      } finally {
        if (isSubscribed) {
          setLoading(false)
        }
      }
    }, 150) // 150ms debounce

    return () => {
      isSubscribed = false
      clearTimeout(timer)
    }
  }, [query, isOpen])

  // Keyboard navigation handler passed down from textarea or attached locally
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || candidates.length === 0) return

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % candidates.length)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + candidates.length) % candidates.length)
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (candidates[selectedIndex]) {
          e.preventDefault()
          onSelectUser(candidates[selectedIndex])
        }
      } else if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    },
    [isOpen, candidates, selectedIndex, onSelectUser, onClose]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  if (!isOpen) return null

  return (
    <div
      className="absolute bottom-full left-0 mb-1.5 w-72 max-h-56 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100"
      role="region"
      aria-label="Mention user suggestions"
    >
      <div className="px-3 py-1.5 border-b border-neutral-100 dark:border-neutral-800/60 bg-neutral-50/70 dark:bg-neutral-800/40 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
        <span>Suggested users</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />}
      </div>

      <ul
        ref={listRef}
        role="listbox"
        className="max-h-48 overflow-y-auto py-1 divide-y divide-neutral-50 dark:divide-neutral-800/30"
      >
        {loading && candidates.length === 0 && (
          <li className="px-3 py-3 text-xs text-neutral-400 text-center flex items-center justify-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Searching...</span>
          </li>
        )}

        {!loading && candidates.length === 0 && (
          <li className="px-3 py-3 text-xs text-neutral-400 dark:text-neutral-500 text-center">
            No users found matching &quot;@{query}&quot;
          </li>
        )}

        {candidates.map((user, idx) => {
          const isSelected = idx === selectedIndex
          const initial = (user.displayName || user.username || "U")[0]?.toUpperCase() || "U"

          return (
            <li
              key={user.id || user._id || idx}
              role="option"
              aria-selected={isSelected}
              onMouseEnter={() => setSelectedIndex(idx)}
              onClick={() => onSelectUser(user)}
              className={`px-3 py-2 flex items-center gap-2.5 cursor-pointer transition-colors ${
                isSelected
                  ? "bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-neutral-800 dark:text-neutral-200"
              }`}
            >
              <Avatar className="h-7 w-7 shrink-0">
                {user.profilePicture ? (
                  <AvatarImage src={user.profilePicture} alt={user.displayName} />
                ) : null}
                <AvatarFallback className="bg-neutral-200 dark:bg-neutral-700 text-xs font-semibold">
                  {initial}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate leading-tight">
                  {user.displayName}
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  @{user.username}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default MentionAutocomplete
