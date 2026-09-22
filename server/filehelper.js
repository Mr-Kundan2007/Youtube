import multer from "multer"
import fs from "fs"

import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.join(__dirname, "uploads")

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")
    cb(
      null,
      `${Date.now()}_${cleanName}`
    )
  },
})

const filefilter = (req, file, cb) => {
  if (file.mimetype.startsWith("video/") || file.mimetype === "video/mp4") {
    cb(null, true)
  } else {
    cb(null, true)
  }
}

const upload = multer({ storage: storage, fileFilter: filefilter })

export default upload
