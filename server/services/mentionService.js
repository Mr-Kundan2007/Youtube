import mongoose from "mongoose"
import User from "../Modals/Auth.js"

// Regex that matches @username while excluding email addresses (e.g. user@example.com)
// Supports Latin alphanumeric, underscores, and international scripts (Hindi/Devanagari, Cyrillic, CJK)
const MENTION_REGEX = /(?:^|[^\w@])@([a-zA-Z0-9_\u0900-\u097F\u0400-\u04FF\u4E00-\u9FFF]{2,30})/g

/**
 * Extracts unique mentioned usernames from comment or reply text.
 * Strictly excludes email addresses and duplicates.
 */
export const parseMentions = (text) => {
  if (!text || typeof text !== "string") return []

  const mentions = new Set()
  let match

  // Reset regex state
  MENTION_REGEX.lastIndex = 0

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    const username = match[1]?.trim()
    if (username && username.length >= 2) {
      mentions.add(username.toLowerCase())
    }
  }

  return Array.from(mentions)
}

/**
 * Searches users for mention autocomplete suggestions.
 * Returns only safe, public profile information and strictly caps results.
 */
export const searchUsersForMention = async (query = "", limit = 8) => {
  const safeLimit = Math.min(20, Math.max(1, parseInt(limit, 10) || 8))
  const cleanQuery = String(query || "").trim().replace(/^@/, "")

  if (!cleanQuery) {
    // Return most recently active/created public channels if query is empty
    try {
      const defaultUsers = await User.find({ status: { $ne: "blocked" } })
        .select("name channelname image")
        .limit(safeLimit)
        .lean()

      return defaultUsers.map((u) => ({
        id: String(u._id),
        username: u.channelname || u.name || "User",
        displayName: u.name || u.channelname || "User",
        profilePicture: u.image || "",
      }))
    } catch {
      return []
    }
  }

  // Escape special regex characters to prevent regex injection (ReDoS)
  const escapedQuery = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const searchPattern = new RegExp(`^${escapedQuery}|\\b${escapedQuery}`, "i")

  try {
    const matchingUsers = await User.find({
      $and: [
        { status: { $ne: "blocked" } },
        {
          $or: [
            { channelname: { $regex: searchPattern } },
            { name: { $regex: searchPattern } },
          ],
        },
      ],
    })
      .select("name channelname image")
      .limit(safeLimit)
      .lean()

    return matchingUsers.map((u) => ({
      id: String(u._id),
      username: u.channelname || u.name || "User",
      displayName: u.name || u.channelname || "User",
      profilePicture: u.image || "",
    }))
  } catch (err) {
    console.warn("Mention user search failed:", err.message)
    return []
  }
}

export default {
  parseMentions,
  searchUsersForMention,
}
