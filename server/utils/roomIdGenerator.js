import crypto from "crypto"

/**
 * Generates an unpredictable, non-sequential, URL-safe room ID.
 * Format: 3 lowercase letters - 4 lowercase letters - 3 lowercase letters (e.g., "xyt-wmkq-zvp").
 * Entropy: 26^10 ~ 1.41e14 possible combinations.
 */
const CHARS = "abcdefghijklmnopqrstuvwxyz"

const getRandomLetters = (length) => {
  const bytes = crypto.randomBytes(length)
  let result = ""
  for (let i = 0; i < length; i++) {
    result += CHARS[bytes[i] % CHARS.length]
  }
  return result
}

export const generateRoomId = () => {
  const p1 = getRandomLetters(3)
  const p2 = getRandomLetters(4)
  const p3 = getRandomLetters(3)
  return `${p1}-${p2}-${p3}`
}

/**
 * Validates whether a provided string matches the expected Room ID pattern.
 */
export const isValidRoomId = (roomId) => {
  if (typeof roomId !== "string") return false
  const clean = roomId.trim().toLowerCase()
  return /^[a-z0-9]{3,4}-[a-z0-9]{4}-[a-z0-9]{3,4}$/.test(clean) || /^[a-zA-Z0-9_-]{8,32}$/.test(clean)
}
