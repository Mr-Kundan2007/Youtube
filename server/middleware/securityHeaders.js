/**
 * WebRTC-compatible Security Headers Middleware.
 * Hardens HTTP headers without blocking camera, microphone, or WebRTC data channels.
 */
export const securityHeaders = (req, res, next) => {
  // Prevent MIME-sniffing
  res.setHeader("X-Content-Type-Options", "nosniff")

  // Clickjacking protection while allowing same-origin framing if needed
  res.setHeader("X-Frame-Options", "SAMEORIGIN")

  // XSS protection for older browsers
  res.setHeader("X-XSS-Protection", "1; mode=block")


  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")

  // Permissions Policy: Explicitly allow camera, microphone, display-capture on self
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), microphone=(self), display-capture=(self), fullscreen=(self)"
  )

  // Disable browser caching for sensitive API responses
  if (req.originalUrl?.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    res.setHeader("Pragma", "no-cache")
    res.setHeader("Expires", "0")
  }

  next()
}
