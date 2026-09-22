import React from "react"
import Link from "next/link"

interface MentionRendererProps {
  text: string
  className?: string
}

// Unicode-aware regex matching @username while excluding email addresses (e.g., user@domain.com)
const MENTION_TOKEN_REGEX = /(?:^|[^\w@])(@[a-zA-Z0-9_\u0900-\u097F\u0400-\u04FF\u4E00-\u9FFF]{2,30})/g

// Safe external URL regex matching http://, https://, or www.
const SAFE_URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"'`()]+/gi

// Dangerous script schemes that must NEVER be rendered as clickable links
const UNSAFE_SCHEMES = ["javascript:", "data:", "vbscript:", "file:", "blob:"]

interface Token {
  type: "mention" | "url" | "text"
  content: string
  url?: string
  username?: string
  index: number
}

/**
 * Enhanced Mention and Safe Link Content Renderer
 *
 * Renders @mentions as internal channel links and safe http(s) URLs as protected external links.
 * Explicitly neutralizes dangerous schemes (javascript:, data:, vbscript:) by rendering them strictly
 * as non-clickable, JSX-escaped plain text without dangerouslySetInnerHTML.
 */
export const MentionRenderer: React.FC<MentionRendererProps> = ({ text, className = "" }) => {
  if (!text) return null

  // Collect structured tokens (mentions and URLs) with their offsets
  const tokens: Token[] = []

  // 1. Scan mentions
  const mentionRegex = new RegExp(MENTION_TOKEN_REGEX)
  let mMatch: RegExpExecArray | null
  while ((mMatch = mentionRegex.exec(text)) !== null) {
    const fullMatch = mMatch[0]
    const mentionToken = mMatch[1]
    const matchIndex = mMatch.index + (fullMatch.length - mentionToken.length)
    tokens.push({
      type: "mention",
      content: mentionToken,
      username: mentionToken.slice(1),
      index: matchIndex,
    })
  }

  // 2. Scan safe URLs
  const urlRegex = new RegExp(SAFE_URL_REGEX)
  let uMatch: RegExpExecArray | null
  while ((uMatch = urlRegex.exec(text)) !== null) {
    const rawUrl = uMatch[0]
    const matchIndex = uMatch.index

    // Check if overlaps with any existing mention token
    const overlaps = tokens.some(
      (t) => matchIndex >= t.index && matchIndex < t.index + t.content.length
    )
    if (!overlaps) {
      const lower = rawUrl.toLowerCase()
      // Verify scheme safety: cannot contain unsafe schemes
      const isUnsafe = UNSAFE_SCHEMES.some((s) => lower.startsWith(s) || lower.includes(s))
      if (!isUnsafe) {
        const href = lower.startsWith("http") ? rawUrl : `https://${rawUrl}`
        tokens.push({
          type: "url",
          content: rawUrl,
          url: href,
          index: matchIndex,
        })
      }
    }
  }

  // Sort tokens by their appearance in text
  tokens.sort((a, b) => a.index - b.index)

  // 3. Build JSX element list interspersed with safe text nodes
  const elements: React.ReactNode[] = []
  let lastIndex = 0

  tokens.forEach((token, i) => {
    // Push preceding text segment
    if (token.index > lastIndex) {
      elements.push(text.slice(lastIndex, token.index))
    }

    if (token.type === "mention" && token.username) {
      elements.push(
        <Link
          key={`m-${i}-${token.username}`}
          href={`/channel/${encodeURIComponent(token.username)}`}
          className="text-blue-600 dark:text-blue-400 hover:underline font-medium inline-flex items-center cursor-pointer"
          onClick={(e) => e.stopPropagation()}
          title={`View channel for @${token.username}`}
        >
          @{token.username}
        </Link>
      )
    } else if (token.type === "url" && token.url) {
      elements.push(
        <a
          key={`u-${i}-${token.url}`}
          href={token.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-blue-600 dark:text-blue-400 hover:underline break-all inline-flex items-center cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          {token.content}
        </a>
      )
    }

    lastIndex = token.index + token.content.length
  })

  // Push remaining text
  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex))
  }

  return <span className={className}>{elements}</span>
}

export default MentionRenderer
