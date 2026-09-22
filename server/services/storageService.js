import fs from "fs"
import path from "path"
import crypto from "crypto"
import { fileURLToPath } from "url"
import { downloadConfig, authConfig } from "../config/index.js"
import { ApiError } from "../utils/apiError.js"
import { logger } from "../utils/logger.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Storage Service Provider Abstraction.
 * Handles secure local/private storage resolution, path traversal prevention,
 * HMAC-SHA256 signed temporary URLs, file availability validation, and streaming streams.
 */
export class StorageService {
  constructor() {
    this.projectRoot = path.resolve(__dirname, "../..")
    this.privateStorageDir = path.resolve(
      process.cwd(),
      downloadConfig?.privateStorageDir || "storage/private/videos"
    )
    this.uploadsDir = path.resolve(process.cwd(), "uploads")
    this.publicDir = path.resolve(process.cwd(), "public")
    this.signingSecret = downloadConfig?.tokenSecret || authConfig?.jwtSecret || "youtube_secure_download_secret_key"

    this.ensureDirectories()
  }

  /**
   * Ensure private and upload directories exist.
   */
  ensureDirectories() {
    try {
      if (!fs.existsSync(this.privateStorageDir)) {
        fs.mkdirSync(this.privateStorageDir, { recursive: true })
      }
      if (!fs.existsSync(this.uploadsDir)) {
        fs.mkdirSync(this.uploadsDir, { recursive: true })
      }
    } catch (err) {
      logger.warn("Failed to create storage directories", { error: err.message })
    }
  }

  /**
   * Return storage provider type ("local" or "cloud").
   */
  getStorageType() {
    return "local"
  }

  /**
   * Detect MIME type from file extension.
   */
  detectMimeType(filePath) {
    if (!filePath) return "video/mp4"
    const ext = path.extname(filePath).toLowerCase()
    switch (ext) {
      case ".mp4":
        return "video/mp4"
      case ".webm":
        return "video/webm"
      case ".mkv":
        return "video/x-matroska"
      case ".mov":
        return "video/quicktime"
      case ".avi":
        return "video/x-msvideo"
      case ".flv":
        return "video/x-flv"
      case ".m3u8":
        return "application/x-mpegURL"
      case ".ts":
        return "video/MP2T"
      default:
        return "video/mp4"
    }
  }

  /**
   * Validate that a path does not escape allowed directories (path traversal protection).
   */
  isSafePath(filePath) {
    if (!filePath || typeof filePath !== "string") return false
    const resolved = path.resolve(filePath)

    // Allowed base roots
    const allowedRoots = [
      this.privateStorageDir,
      this.uploadsDir,
      this.publicDir,
      this.projectRoot,
      process.cwd(),
    ]

    return allowedRoots.some((allowed) => resolved.startsWith(allowed))
  }

  /**
   * Safely resolves the absolute filepath for a video.
   * Checks private storage, uploads, public, and sample fallbacks.
   */
  resolveFilePath(video) {
    if (!video) return null

    const candidates = []

    // 1. Direct filepath in video document
    if (video.filepath) {
      candidates.push(path.resolve(process.cwd(), video.filepath))
      candidates.push(path.resolve(this.privateStorageDir, path.basename(video.filepath)))
      candidates.push(path.resolve(this.uploadsDir, path.basename(video.filepath)))
      candidates.push(path.resolve(__dirname, "..", video.filepath))
    }

    // 2. videofilepath or videoUrl
    const urlPath = video.videofilepath || video.videoUrl || ""
    if (urlPath) {
      const clean = urlPath.startsWith("/") ? urlPath.slice(1) : urlPath
      candidates.push(path.resolve(process.cwd(), clean))
      candidates.push(path.resolve(this.privateStorageDir, path.basename(clean)))
      candidates.push(path.resolve(this.uploadsDir, path.basename(clean)))
      candidates.push(path.resolve(this.publicDir, clean))
    }

    // 3. filename
    if (video.filename) {
      candidates.push(path.resolve(this.privateStorageDir, video.filename))
      candidates.push(path.resolve(this.uploadsDir, video.filename))
    }

    const hasSpecifiedPath = Boolean(
      video.filepath || video.videofilepath || video.videoUrl || video.filename
    )

    // 4. Default mock/sample fallback ONLY if no path was specified
    if (!hasSpecifiedPath) {
      candidates.push(path.resolve(process.cwd(), "public/video/vdo.mp4"))
      candidates.push(path.resolve(__dirname, "../../public/video/vdo.mp4"))
    }

    for (const candidate of candidates) {
      if (this.isSafePath(candidate) && fs.existsSync(candidate)) {
        try {
          const stat = fs.statSync(candidate)
          if (stat.isFile()) {
            return candidate
          }
        } catch {
          // Ignore stat errors
        }
      }
    }

    return null
  }

  /**
   * Validates video file availability and retrieves size & metadata.
   */
  validateFile(video) {
    if (!video) {
      return {
        isAvailable: false,
        exists: false,
        filePath: null,
        size: 0,
        mimeType: "video/mp4",
      }
    }

    const filePath = this.resolveFilePath(video)
    if (!filePath || !fs.existsSync(filePath)) {
      return {
        isAvailable: false,
        exists: false,
        filePath: null,
        size: 0,
        mimeType: video.filetype || "video/mp4",
      }
    }

    try {
      const stat = fs.statSync(filePath)
      return {
        isAvailable: true,
        exists: true,
        filePath,
        size: stat.size,
        mimeType: video.filetype || this.detectMimeType(filePath),
      }
    } catch {
      return {
        isAvailable: false,
        exists: false,
        filePath: null,
        size: 0,
        mimeType: video.filetype || "video/mp4",
      }
    }
  }

  /**
   * Generates a short-lived HMAC-SHA256 signed access URL for streaming or downloading.
   */
  generateSignedUrl({ downloadId, videoId, userId, action = "stream", expiresInSeconds = null }) {
    if (!downloadId) throw new Error("downloadId is required to generate signed URL")
    if (!videoId) throw new Error("videoId is required to generate signed URL")

    const ttl = Number(expiresInSeconds) || downloadConfig?.signedUrlTtlSeconds || 300
    const exp = Math.floor(Date.now() / 1000) + ttl
    const cleanUserId = userId ? String(userId) : "anonymous"
    const payload = `${downloadId}:${videoId}:${cleanUserId}:${action}:${exp}`

    const signature = crypto
      .createHmac("sha256", this.signingSecret)
      .update(payload)
      .digest("hex")

    const base64Payload = Buffer.from(payload).toString("base64url")
    const signedToken = `${base64Payload}.${signature}`

    return {
      signedToken,
      signedUrl: `/api/downloads/stream?token=${signedToken}`,
      expiresAt: new Date(exp * 1000),
      expiresInSeconds: ttl,
    }
  }

  /**
   * Verifies an HMAC-SHA256 signed access URL token.
   */
  verifySignedUrl(token, expectedAction = null) {
    if (!token || typeof token !== "string") {
      throw ApiError.unauthorized("INVALID_SIGNED_URL", "Signed access token is missing or invalid")
    }

    const parts = token.split(".")
    if (parts.length !== 2) {
      throw ApiError.unauthorized("INVALID_SIGNED_URL", "Malformed signed access token")
    }

    const [base64Payload, signature] = parts
    let payload = ""
    try {
      payload = Buffer.from(base64Payload, "base64url").toString("utf8")
    } catch {
      throw ApiError.unauthorized("INVALID_SIGNED_URL", "Failed to decode signed token payload")
    }

    const expectedSignature = crypto
      .createHmac("sha256", this.signingSecret)
      .update(payload)
      .digest("hex")

    const sigBuffer = Buffer.from(signature)
    const expectedSigBuffer = Buffer.from(expectedSignature)

    if (
      sigBuffer.length !== expectedSigBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
    ) {
      throw ApiError.unauthorized("INVALID_SIGNED_URL", "Signed URL token signature is invalid")
    }

    const [downloadId, videoId, userId, action, expStr] = payload.split(":")
    const exp = parseInt(expStr, 10)

    if (Number.isNaN(exp) || Math.floor(Date.now() / 1000) > exp) {
      throw ApiError.unauthorized("SIGNED_URL_EXPIRED", "The download URL has expired. Please request a new delivery link.")
    }

    if (expectedAction && action !== expectedAction) {
      throw ApiError.forbidden("INVALID_SIGNED_URL", `Token is not authorized for action: ${expectedAction}`)
    }

    return {
      downloadId,
      videoId,
      userId: userId === "anonymous" ? null : userId,
      action,
      exp,
      expiresAt: new Date(exp * 1000),
    }
  }

  /**
   * Create a readable stream for the given file path with optional byte ranges.
   */
  createReadStream(filePath, options = {}) {
    if (!this.isSafePath(filePath)) {
      logger.warn("PATH_TRAVERSAL_BLOCKED", { filePath })
      throw ApiError.forbidden("FORBIDDEN", "Invalid file access path")
    }
    return fs.createReadStream(filePath, options)
  }

  /**
   * Get file metadata safely.
   */
  getFileMetadata(filePath) {
    if (!this.isSafePath(filePath)) {
      throw ApiError.forbidden("FORBIDDEN", "Invalid file access path")
    }
    return fs.statSync(filePath)
  }
}

export const storageService = new StorageService()
export default storageService
