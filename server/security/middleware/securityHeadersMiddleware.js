/**
 * Hardened Security Headers Middleware
 * Protects against MIME-sniffing, clickjacking, XSS, and unauthorized framing,
 * while preventing sensitive subscription and payment data from being cached.
 */
export const securityHeaders = (req, res, next) => {
  // Prevent MIME sniffing
  res.setHeader("X-Content-Type-Options", "nosniff")

  // Clickjacking protection: only allow same-origin frames
  res.setHeader("X-Frame-Options", "SAMEORIGIN")

  // Cross-site scripting (XSS) filter
  res.setHeader("X-XSS-Protection", "1; mode=block")

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")

  // Permissions Policy
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), microphone=(self), display-capture=(self), fullscreen=(self)"
  )

  // HSTS in production environments
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    )
  }

  // Remove Express signature header
  res.removeHeader("X-Powered-By")

  // Expose correlation and rate limit headers to clients
  res.setHeader(
    "Access-Control-Expose-Headers",
    "X-Request-Id, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset"
  )

  // For sensitive subscription, payment, and admin API requests, enforce strict cache busting
  if (
    req.path &&
    (req.path.startsWith("/api/payment") ||
      req.path.startsWith("/api/subscription") ||
      req.path.startsWith("/api/admin") ||
      req.path.startsWith("/admin/comment-moderation") ||
      req.path.startsWith("/api/security") ||
      req.path.startsWith("/api/download"))
  ) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    res.setHeader("Pragma", "no-cache")
    res.setHeader("Expires", "0")
  }

  next()
}

export default securityHeaders
