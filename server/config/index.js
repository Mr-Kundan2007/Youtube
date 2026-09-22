import dotenv from "dotenv"
import fs from "fs"
import path from "path"

// Load .env.local first if it exists, then fallback to .env
if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" })
}
dotenv.config()

/**
 * Validates critical environment variables and returns a structured configuration object.
 */
const getEnv = (key, defaultValue = "") => {
  return process.env[key] !== undefined ? process.env[key] : defaultValue
}

export const appConfig = {
  env: getEnv("NODE_ENV", "development"),
  port: Number(getEnv("PORT", 5000)),
  frontendUrl: getEnv("FRONTEND_URL", "http://localhost:3000"),
}

export const dbConfig = {
  url: getEnv("DB_URL", ""),
}

export const authConfig = {
  jwtSecret: getEnv("JWT_SECRET", "thisisayoutubeclonesecretkey"),
  jwtExpiresIn: getEnv("JWT_EXPIRES_IN", "1h"),
}

export const razorpayConfig = {
  keyId: getEnv("RAZORPAY_KEY_ID", "rzp_test_mockkey12345678"),
  keySecret: getEnv("RAZORPAY_KEY_SECRET", "mock_razorpay_secret_key_87654321"),
  webhookSecret: getEnv("RAZORPAY_WEBHOOK_SECRET", "mock_webhook_secret_key_123456"),
  currency: getEnv("PAYMENT_CURRENCY", "INR"),
  isTestMode: getEnv("RAZORPAY_KEY_ID", "").startsWith("rzp_test_") || !getEnv("RAZORPAY_KEY_ID"),
}

export * from "./subscriptionPlans.js"

export const videoConfig = {
  provider: getEnv("VIDEO_PROVIDER", "livekit"),
  livekitUrl: getEnv("LIVEKIT_URL", "https://dev-project.livekit.cloud"),
  apiKey: getEnv("LIVEKIT_API_KEY", ""),
  apiSecret: getEnv("LIVEKIT_API_SECRET", ""),
  isConfigured: Boolean(getEnv("LIVEKIT_API_KEY") && getEnv("LIVEKIT_API_SECRET")),
  tokenTtlSeconds: 60 * 30, // 30 minutes short-lived meeting token
}

export const storageConfig = {
  provider: getEnv("STORAGE_PROVIDER", "local"),
  uploadDir: path.join(process.cwd(), getEnv("UPLOAD_DIR", "uploads")),
  maxAttachmentSizeBytes: Number(getEnv("MAX_ATTACHMENT_SIZE_MB", 25)) * 1024 * 1024,
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "application/zip",
    "video/mp4",
  ],
}

export const recordingConfig = {
  maxRecordingSizeMb: Number(getEnv("MAX_RECORDING_SIZE_MB", 500)),
  maxRecordingDurationMinutes: Number(getEnv("MAX_RECORDING_DURATION_MINUTES", 180)),
  recordingsDir: path.join(process.cwd(), getEnv("RECORDING_DIR", "uploads/recordings")),
  signedUrlExpirySeconds: Number(getEnv("RECORDING_SIGNED_URL_EXPIRY", 3600)),
  allowedMimeTypes: [
    "video/webm",
    "video/webm;codecs=vp8",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/mp4",
    "video/x-matroska",
  ],
}

export const downloadConfig = {
  plans: {
    free: {
      name: "Free",
      planKey: "free",
      quotaLimit: Number(getEnv("DOWNLOAD_LIMIT_FREE", 1)),
      quotaType: "daily",
      resetPeriod: "daily",
      price: 0,
      description: "Basic access with 1 download per day",
      downloadEnabled: true,
      maxDevices: 1,
      maxRegisteredDevices: 1,
      maxConcurrentDeviceDownloads: 1,
      maxConcurrentDownloadsPerDevice: 1,
      requireRegisteredDevice: true,
      duplicateWindowHours: 24,
      maxQuality: "720p",
    },
    bronze: {
      name: "Bronze",
      planKey: "bronze",
      quotaLimit: Number(getEnv("DOWNLOAD_LIMIT_BRONZE", 5)),
      quotaType: "daily",
      resetPeriod: "daily",
      price: 4.99,
      description: "Standard creator access with 5 downloads per day",
      downloadEnabled: true,
      maxDevices: 2,
      maxRegisteredDevices: 2,
      maxConcurrentDeviceDownloads: 2,
      maxConcurrentDownloadsPerDevice: 1,
      requireRegisteredDevice: true,
      duplicateWindowHours: 24,
      maxQuality: "1080p",
    },
    silver: {
      name: "Silver",
      planKey: "silver",
      quotaLimit: Number(getEnv("DOWNLOAD_LIMIT_SILVER", 15)),
      quotaType: "daily",
      resetPeriod: "daily",
      price: 12.99,
      description: "Pro tier with 15 downloads per day and high priority",
      downloadEnabled: true,
      maxDevices: 5,
      maxRegisteredDevices: 5,
      maxConcurrentDeviceDownloads: 3,
      maxConcurrentDownloadsPerDevice: 2,
      requireRegisteredDevice: true,
      duplicateWindowHours: 24,
      maxQuality: "1080p",
    },
    gold: {
      name: "Gold",
      planKey: "gold",
      quotaLimit: Number(getEnv("DOWNLOAD_LIMIT_GOLD", 50)),
      quotaType: "daily",
      resetPeriod: "daily",
      price: 24.99,
      description: "Enterprise tier with 50 downloads per day and maximum limits",
      downloadEnabled: true,
      maxDevices: 10,
      maxRegisteredDevices: 10,
      maxConcurrentDeviceDownloads: 5,
      maxConcurrentDownloadsPerDevice: 3,
      requireRegisteredDevice: true,
      duplicateWindowHours: 24,
      maxQuality: "4k",
    },
  },
  tokenExpirySeconds: Number(getEnv("DOWNLOAD_TOKEN_EXPIRY", getEnv("DOWNLOAD_TOKEN_TTL", 600))), // default: 10 minutes (600s)
  tokenSecret: getEnv("DOWNLOAD_TOKEN_SECRET", getEnv("JWT_SECRET", "thisisayoutubeclonesecretkey")),
  signedUrlTtlSeconds: Number(getEnv("SIGNED_URL_TTL", 300)), // 5 minutes (300s)
  privateStorageDir: path.resolve(process.cwd(), getEnv("DOWNLOAD_PRIVATE_DIR", "storage/private/videos")),
  duplicateWindowHours: Number(getEnv("DOWNLOAD_DUPLICATE_WINDOW_HOURS", 24)),
  duplicateWindowMinutes: Number(getEnv("DOWNLOAD_DUPLICATE_WINDOW_MINUTES", Number(getEnv("DOWNLOAD_DUPLICATE_WINDOW_HOURS", 24)) * 60)),
  maxRetries: Number(getEnv("DOWNLOAD_MAX_RETRIES", 3)),
  retryWindowMinutes: Number(getEnv("DOWNLOAD_RETRY_WINDOW_MINUTES", 60)),
  historyMaxLimit: Number(getEnv("DOWNLOAD_HISTORY_MAX_LIMIT", 50)),
  deviceRestrictionsEnabled: getEnv("DOWNLOAD_DEVICE_RESTRICTIONS", "true") === "true",
  deviceReplacementCooldownHours: Number(getEnv("DEVICE_REPLACEMENT_COOLDOWN_HOURS", 24)),
  maxConcurrentDownloadsPerDevice: Number(getEnv("MAX_CONCURRENT_DOWNLOADS_PER_DEVICE", 1)),
  deviceActivityUpdateIntervalSeconds: Number(getEnv("DEVICE_ACTIVITY_UPDATE_INTERVAL", 300)),
  downloadDeviceBindingEnabled: getEnv("DOWNLOAD_DEVICE_BINDING_ENABLED", "true") === "true",
  maxDevicesPerPlan: {
    free: 1,
    bronze: 2,
    silver: 5,
    gold: 10,
  },
  rateLimit: {
    windowMs: 60 * 1000,
    maxRequests: Number(getEnv("DOWNLOAD_RATE_LIMIT_MAX", 20)),
  },
  security: null, // Initialized below
}

export const downloadSecurityConfig = {
  rateLimits: {
    userRequestsPerMinute: Number(getEnv("DOWNLOAD_RATE_LIMIT_USER_PER_MINUTE", 20)),
    deviceRequestsPerMinute: Number(getEnv("DOWNLOAD_RATE_LIMIT_DEVICE_PER_MINUTE", 20)),
    ipRequestsPerMinute: Number(getEnv("DOWNLOAD_RATE_LIMIT_IP_PER_MINUTE", 60)),
    failedRequestsPerMinute: Number(getEnv("DOWNLOAD_FAILED_LIMIT_PER_MINUTE", 5)),
    tokenFailuresPerMinute: Number(getEnv("DOWNLOAD_TOKEN_FAILURE_LIMIT_PER_MINUTE", 5)),
    windowMs: 60 * 1000,
  },
  riskPoints: {
    RATE_LIMIT_EXCEEDED: 15,
    INVALID_DOWNLOAD_TOKEN: 20,
    TOKEN_REPLAY_ATTEMPT: 25,
    TOKEN_DEVICE_MISMATCH: 25,
    TOKEN_USER_MISMATCH: 25,
    REPEATED_AUTH_FAILURE: 20,
    DEVICE_LIMIT_ABUSE: 20,
    CONCURRENT_DOWNLOAD_ABUSE: 20,
    RAPID_DEVICE_SWITCH: 15,
    RAPID_IP_CHANGE: 10,
    UNUSUAL_DOWNLOAD_VOLUME: 15,
    RAPID_DOWNLOAD_PATTERN: 15,
    POSSIBLE_ACCOUNT_SHARING: 25,
    BLOCKED_DEVICE_ACCESS: 30,
    REVOKED_DEVICE_ACCESS: 30,
    DUPLICATE_DOWNLOAD_ABUSE_PATTERN: 15,
    QUOTA_BYPASS_ATTEMPT: 20,
  },
  riskThresholds: {
    low: 20,
    medium: 50,
    high: 75,
    critical: 76,
  },
  decayHours: Number(getEnv("RISK_SCORE_DECAY_HOURS", 24)),
  tempRestrictionMinutes: Number(getEnv("TEMP_RESTRICTION_MINUTES", 30)),
  rapidDeviceSwitchWindowMinutes: Number(getEnv("RAPID_DEVICE_SWITCH_WINDOW_MINUTES", 10)),
  rapidDeviceSwitchThreshold: Number(getEnv("RAPID_DEVICE_SWITCH_LIMIT", 3)),
  rapidIpChangeWindowMinutes: Number(getEnv("RAPID_IP_CHANGE_WINDOW_MINUTES", 10)),
  rapidIpChangeThreshold: Number(getEnv("RAPID_IP_CHANGE_LIMIT", 3)),
  deduplicationWindowMinutes: Number(getEnv("SECURITY_EVENT_WINDOW_MINUTES", 5)),
}

downloadConfig.security = downloadSecurityConfig

/**
 * Validates core configuration and warns about optional features.
 */
export const validateConfig = () => {
  const missing = []
  if (!dbConfig.url) missing.push("DB_URL")
  if (!authConfig.jwtSecret) missing.push("JWT_SECRET")

  if (missing.length > 0) {
    console.warn(`[CONFIG WARNING] Missing critical environment variables: ${missing.join(", ")}`)
  }

  if (!videoConfig.isConfigured) {
    console.info(
      "[CONFIG INFO] LiveKit API credentials not fully set. LiveKit token generation will run in development mode or require LIVEKIT_API_KEY / LIVEKIT_API_SECRET."
    )
  }
}

export default {
  app: appConfig,
  db: dbConfig,
  auth: authConfig,
  video: videoConfig,
  storage: storageConfig,
  recording: recordingConfig,
  download: downloadConfig,
  downloadSecurity: downloadSecurityConfig,
  validate: validateConfig,
}
