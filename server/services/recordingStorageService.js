import fs from "fs"
import path from "path"
import crypto from "crypto"
import { recordingConfig, authConfig } from "../config/index.js"
import { ApiError } from "../utils/apiError.js"
import { logger } from "../utils/logger.js"

class RecordingStorageService {
  constructor() {
    this.recordingsDir = path.resolve(recordingConfig.recordingsDir)
    this.ensureDirectory()
  }

  /**
   * Ensures the private storage directory exists.
   */
  ensureDirectory() {
    if (!fs.existsSync(this.recordingsDir)) {
      fs.mkdirSync(this.recordingsDir, { recursive: true })
    }
  }

  /**
   * Generates a safe, unguessable filename without exposing PII.
   */
  generateFilename(roomId, extension = "webm") {
    const cleanRoomId = String(roomId).replace(/[^a-zA-Z0-9_-]/g, "")
    const randomHex = crypto.randomBytes(8).toString("hex")
    const cleanExt = extension.replace(/^\./, "").replace(/[^a-zA-Z0-9]/g, "")
    return `meeting-${cleanRoomId}-${Date.now()}-${randomHex}.${cleanExt || "webm"}`
  }

  /**
   * Validates that a file path resides safely within the private recordings directory.
   */
  validatePath(filePath) {
    const resolvedPath = path.resolve(filePath)
    if (!resolvedPath.startsWith(this.recordingsDir)) {
      logger.warn("PATH_TRAVERSAL_ATTEMPT", {
        path: filePath,
        resolvedPath,
      })
      throw ApiError.forbidden("FORBIDDEN", "Invalid storage path")
    }
    return resolvedPath
  }

  /**
   * Generates a short-lived HMAC-SHA256 signed access token for streaming or downloading.
   */
  generateSignedAccessToken(recordingId, userId, action = "stream", expiresInSeconds = 3600) {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds
    const payload = `${recordingId}:${userId || "anonymous"}:${action}:${exp}`
    const signature = crypto
      .createHmac("sha256", authConfig.jwtSecret)
      .update(payload)
      .digest("hex")

    // Token format: base64(payload).signature
    const base64Payload = Buffer.from(payload).toString("base64url")
    return `${base64Payload}.${signature}`
  }

  /**
   * Verifies a signed access token and checks expiry.
   */
  verifySignedAccessToken(token, expectedRecordingId, expectedAction = null) {
    if (!token || typeof token !== "string") {
      throw ApiError.unauthorized("INVALID_ACCESS_TOKEN", "Access token is missing or invalid")
    }

    const parts = token.split(".")
    if (parts.length !== 2) {
      throw ApiError.unauthorized("INVALID_ACCESS_TOKEN", "Malformed access token")
    }

    const [base64Payload, signature] = parts
    let payload = ""
    try {
      payload = Buffer.from(base64Payload, "base64url").toString("utf8")
    } catch {
      throw ApiError.unauthorized("INVALID_ACCESS_TOKEN", "Failed to decode access token")
    }

    const expectedSignature = crypto
      .createHmac("sha256", authConfig.jwtSecret)
      .update(payload)
      .digest("hex")

    const sigBuffer = Buffer.from(signature)
    const expectedSigBuffer = Buffer.from(expectedSignature)

    if (
      sigBuffer.length !== expectedSigBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
    ) {
      throw ApiError.unauthorized("INVALID_ACCESS_TOKEN", "Access token signature is invalid")
    }

    const [recordingId, userId, action, expStr] = payload.split(":")
    const exp = parseInt(expStr, 10)

    if (Number.isNaN(exp) || Math.floor(Date.now() / 1000) > exp) {
      throw ApiError.unauthorized("TOKEN_EXPIRED", "Recording access token has expired")
    }

    if (expectedRecordingId && String(recordingId) !== String(expectedRecordingId)) {
      throw ApiError.forbidden("FORBIDDEN", "Token was not issued for this recording")
    }

    if (expectedAction && action !== expectedAction) {
      throw ApiError.forbidden("FORBIDDEN", `Token is not authorized for ${expectedAction}`)
    }

    return { recordingId, userId, action, exp }
  }

  /**
   * Streams a video file with HTTP 206 Partial Content (Range request) support.
   */
  streamFile(req, res, filePath, mimeType = "video/webm") {
    const safePath = this.validatePath(filePath)

    if (!fs.existsSync(safePath)) {
      throw ApiError.notFound("FILE_NOT_FOUND", "Recording file not found on storage")
    }

    const stat = fs.statSync(safePath)
    const fileSize = stat.size
    const range = req.headers.range

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-")
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1

      if (start >= fileSize || end >= fileSize || start > end) {
        res.writeHead(416, {
          "Content-Range": `bytes */${fileSize}`,
        })
        return res.end()
      }

      const chunkSize = end - start + 1
      const stream = fs.createReadStream(safePath, { start, end })

      const headers = {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": mimeType,
      }

      res.writeHead(206, headers)
      stream.pipe(res)
    } else {
      const headers = {
        "Content-Length": fileSize,
        "Content-Type": mimeType,
        "Accept-Ranges": "bytes",
      }

      res.writeHead(200, headers)
      fs.createReadStream(safePath).pipe(res)
    }
  }

  /**
   * Sends a recording as a secure download with Content-Disposition headers.
   */
  downloadFile(res, filePath, downloadFilename = "recording.webm") {
    const safePath = this.validatePath(filePath)

    if (!fs.existsSync(safePath)) {
      throw ApiError.notFound("FILE_NOT_FOUND", "Recording file not found on storage")
    }

    return res.download(safePath, downloadFilename)
  }

  /**
   * Deletes a recording file from storage.
   */
  async deleteFile(filePath) {
    if (!filePath) return
    const safePath = this.validatePath(filePath)

    if (fs.existsSync(safePath)) {
      await fs.promises.unlink(safePath)
    }
  }
}

export const recordingStorageService = new RecordingStorageService()
export default recordingStorageService
