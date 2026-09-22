import React from "react"
import { useRouter } from "next/router"
import { CommentsSection } from "./comments/CommentsSection"
import type { CommentItemData } from "@/services/commentService"

// Re-export legacy interface for backward compatibility
export interface CommentItem {
  id: string | number
  _id?: string
  videoid?: string
  videoId?: string
  userid?: string
  userId?: string
  author: string
  usercommented?: string
  avatarText: string
  avatarUrl?: string
  text: string
  commentbody?: string
  createdAt: string | Date
  likes: number
}

export type { CommentItemData }

interface CommentsProps {
  videoId?: string
  contentId?: string
}

export default function Comments({ videoId: propVideoId, contentId: propContentId }: CommentsProps) {
  const router = useRouter()
  const routeVideoId = typeof router.query.id === "string" ? router.query.id : ""
  const effectiveId = propContentId || propVideoId || routeVideoId || ""

  return <CommentsSection contentId={effectiveId} videoId={effectiveId} />
}

export { Comments }
