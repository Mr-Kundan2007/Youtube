import multer from "multer"
import path from "path"
import fs from "fs"
import { storageConfig } from "../config/index.js"
import { ApiError } from "../utils/apiError.js"

const attachmentsDir = path.join(storageConfig.uploadDir, "attachments")
if (!fs.existsSync(attachmentsDir)) {
  fs.mkdirSync(attachmentsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, attachmentsDir)
  },
  filename: (req, file, cb) => {
    // Sanitize extension and base
    const ext = path.extname(file.originalname || "").toLowerCase()
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
    cb(null, `attachment-${uniqueSuffix}${ext}`)
  },
})

const fileFilter = (req, file, cb) => {
  if (storageConfig.allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(
      ApiError.badRequest(
        "INVALID_FILE_TYPE",
        `File type ${file.mimetype} is not supported. Supported types: images, PDFs, text, zip, docx, mp4.`
      ),
      false
    )
  }
}

export const chatAttachmentUpload = multer({
  storage,
  limits: {
    fileSize: storageConfig.maxAttachmentSizeBytes, // 25MB
  },
  fileFilter,
})

import { recordingConfig } from "../config/index.js"
import { recordingStorageService } from "../services/recordingStorageService.js"

const recordingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    recordingStorageService.ensureDirectory()
    cb(null, recordingConfig.recordingsDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".webm"
    const filename = recordingStorageService.generateFilename(req.params.roomId || "recording", ext)
    cb(null, filename)
  },
})

const recordingFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase()
  const isVideoExt = [".webm", ".mp4", ".mkv", ".mov"].includes(ext)
  const isVideoMime =
    file.mimetype.startsWith("video/") ||
    recordingConfig.allowedMimeTypes.includes(file.mimetype) ||
    file.mimetype === "application/octet-stream"

  if (isVideoMime || isVideoExt) {
    cb(null, true)
  } else {
    cb(
      ApiError.badRequest(
        "INVALID_FILE_TYPE",
        `Recording MIME type ${file.mimetype} is not supported. Expected video/webm or video/mp4.`
      ),
      false
    )
  }
}

export const recordingUpload = multer({
  storage: recordingStorage,
  limits: {
    fileSize: recordingConfig.maxRecordingSizeMb * 1024 * 1024,
  },
  fileFilter: recordingFileFilter,
})
