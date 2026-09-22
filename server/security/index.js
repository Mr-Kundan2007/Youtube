// Security Services
import securityAuditService from "./services/securityAuditService.js"
import idempotencyService from "./services/idempotencyService.js"
import paymentSecurityService from "./services/paymentSecurityService.js"
import fraudDetectionService from "./services/fraudDetectionService.js"
import anomalyDetectionService from "./services/anomalyDetectionService.js"
import securityAlertService from "./services/securityAlertService.js"
import backgroundJobMonitorService from "./services/backgroundJobMonitorService.js"

// Security Middleware
import { securityHeaders } from "./middleware/securityHeadersMiddleware.js"
import {
  authRateLimiter,
  paymentRateLimiter,
  adminRateLimiter,
  downloadRateLimiter,
  generalApiRateLimiter,
  createRateLimiter,
} from "./middleware/rateLimitMiddleware.js"
import {
  validateObjectId,
  validatePagination,
  validatePlanTier,
  validateDateRange,
  validatePositiveAmount,
} from "./middleware/requestValidationMiddleware.js"
import { detectSuspiciousActivity } from "./middleware/suspiciousActivityMiddleware.js"
import { requireAdminSecurity } from "./middleware/adminSecurityMiddleware.js"

// Security Utilities
import { constantTimeCompare, sanitizeMetadata, sha256 } from "./utils/securityUtils.js"
import { getClientIp, hashIp, parseUserAgent } from "./utils/ipUtils.js"
import {
  requestCorrelationMiddleware,
  computeClientFingerprint,
  generateCorrelationId,
} from "./utils/requestFingerprint.js"
import { validateEnvironment } from "./utils/envValidator.js"

// Router
import securityRoutes from "./routes/securityRoutes.js"

export {
  // Services
  securityAuditService,
  idempotencyService,
  paymentSecurityService,
  fraudDetectionService,
  anomalyDetectionService,
  securityAlertService,
  backgroundJobMonitorService,

  // Middleware
  securityHeaders,
  authRateLimiter,
  paymentRateLimiter,
  adminRateLimiter,
  downloadRateLimiter,
  generalApiRateLimiter,
  createRateLimiter,
  validateObjectId,
  validatePagination,
  validatePlanTier,
  validateDateRange,
  validatePositiveAmount,
  detectSuspiciousActivity,
  requireAdminSecurity,

  // Utilities
  constantTimeCompare,
  sanitizeMetadata,
  sha256,
  getClientIp,
  hashIp,
  parseUserAgent,
  requestCorrelationMiddleware,
  computeClientFingerprint,
  generateCorrelationId,
  validateEnvironment,

  // Router
  securityRoutes,
}

export default {
  securityAuditService,
  idempotencyService,
  paymentSecurityService,
  fraudDetectionService,
  anomalyDetectionService,
  securityAlertService,
  backgroundJobMonitorService,
  securityHeaders,
  securityRoutes,
}
