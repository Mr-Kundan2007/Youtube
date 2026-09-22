import http from "http"
import { TestRunner } from "../helpers/testEnv.js"
import { connectTestDb, disconnectTestDb } from "../helpers/testDatabase.js"
import { createRateLimiter } from "../../security/middleware/rateLimitMiddleware.js"
import { detectSuspiciousActivity } from "../../security/middleware/suspiciousActivityMiddleware.js"
import { securityHeaders } from "../../security/middleware/securityHeadersMiddleware.js"
import app from "../../index.js"

export async function runSecurityHardeningTest() {
  const runner = new TestRunner("Security: Hardening, Rate Limiting & Threat Shielding")
  runner.start()

  let server = null
  let baseUrl = ""

  try {
    await connectTestDb()

    server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
    const port = server.address().port
    baseUrl = `http://127.0.0.1:${port}`

    // 1. Security Headers Verification
    const headersRes = await fetch(`${baseUrl}/api/subscription/plans`)
    runner.assert(
      headersRes.headers.get("x-content-type-options") === "nosniff",
      "X-Content-Type-Options is set to 'nosniff'"
    )
    runner.assert(
      headersRes.headers.get("x-frame-options") === "SAMEORIGIN",
      "X-Frame-Options is set to 'SAMEORIGIN'"
    )
    runner.assert(
      headersRes.headers.get("x-xss-protection") === "1; mode=block",
      "X-XSS-Protection is enabled with '1; mode=block'"
    )
    runner.assert(
      headersRes.headers.get("referrer-policy") === "strict-origin-when-cross-origin",
      "Referrer-Policy is set to 'strict-origin-when-cross-origin'"
    )

    // Cache-Control headers on sensitive routes
    const cacheControlHeader = headersRes.headers.get("cache-control") || ""
    runner.assert(
      cacheControlHeader.includes("no-store") || cacheControlHeader.includes("no-cache"),
      "Sensitive subscription routes enforce strict cache-busting headers"
    )

    // 2. Unit Verification of Rate Limiting Middleware
    const testLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 3,
      enforceInTest: true,
      category: "TEST",
    })

    const mockHeaders = {}
    let lastStatus = 200
    let lastBody = null

    function makeRateReq() {
      return {
        headers: {},
        ip: "127.0.0.1",
        user: null,
      }
    }

    function makeRateRes() {
      return {
        setHeader(name, val) {
          mockHeaders[name.toLowerCase()] = String(val)
        },
        status(code) {
          lastStatus = code
          return this
        },
        json(data) {
          lastBody = data
          return this
        },
      }
    }

    let nextCalled = 0
    const mockNext = () => {
      nextCalled++
    }

    // Call 1
    await new Promise((resolve) => testLimiter(makeRateReq(), makeRateRes(), () => { mockNext(); resolve() }))
    runner.assert(nextCalled === 1, "Rate limiter passes call 1")

    // Call 2
    await new Promise((resolve) => testLimiter(makeRateReq(), makeRateRes(), () => { mockNext(); resolve() }))
    runner.assert(nextCalled === 2, "Rate limiter passes call 2")

    // Call 3 (Threshold reached)
    await new Promise((resolve) => testLimiter(makeRateReq(), makeRateRes(), () => { mockNext(); resolve() }))
    runner.assert(nextCalled === 3, "Rate limiter passes call 3 (limit reached)")

    // Call 4 (Should be rate limited with HTTP 429)
    await new Promise((resolve) => {
      testLimiter(makeRateReq(), makeRateRes(), () => {
        mockNext()
        resolve()
      })
      if (lastStatus === 429) resolve()
    })

    runner.assert(lastStatus === 429, "Rate limiter blocks 4th request with HTTP 429 Too Many Requests")
    runner.assert(mockHeaders["x-ratelimit-remaining"] === "0", "X-RateLimit-Remaining header is set to 0")
    runner.assert(Boolean(mockHeaders["retry-after"]), "Retry-After header is provided on 429 response")

    // 3. Suspicious Payload Shielding: detectSuspiciousActivity Middleware
    function testSuspicious(reqObj) {
      let blockedCode = null
      let blockedPayload = null
      let didPass = false

      const mockRes = {
        status(code) {
          blockedCode = code
          return this
        },
        json(payload) {
          blockedPayload = payload
          return this
        },
      }

      detectSuspiciousActivity(reqObj, mockRes, () => {
        didPass = true
      })

      return { didPass, blockedCode, blockedPayload }
    }

    // Normal payload: Allowed
    const normalReq = {
      headers: { "user-agent": "Mozilla/5.0" },
      query: { plan: "silver", cycle: "monthly" },
      body: { name: "John Doe" },
    }
    const normalResult = testSuspicious(normalReq)
    runner.assert(normalResult.didPass === true, "Benign payload safely passes through inspection")

    // NoSQL Injection attempt: $where in query
    const nosqlReq = {
      headers: { "user-agent": "Mozilla/5.0" },
      query: { plan: { $where: "this.password.length > 0" } },
      body: {},
    }
    const nosqlResult = testSuspicious(nosqlReq)
    runner.assert(nosqlResult.didPass === false, "NoSQL $where injection attempt is blocked")
    runner.assert(nosqlResult.blockedCode === 400, "NoSQL injection returns HTTP 400 Bad Request")
    runner.assert(nosqlResult.blockedPayload?.code === "SUSPICIOUS_PAYLOAD", "Rejection response code is SUSPICIOUS_PAYLOAD")

    // Path Traversal attempt: ../ in body
    const pathReq = {
      headers: { "user-agent": "Mozilla/5.0" },
      query: {},
      body: { filePath: "../../etc/passwd" },
    }
    const pathResult = testSuspicious(pathReq)
    runner.assert(pathResult.didPass === false, "Path traversal attempt (../) is blocked")
    runner.assert(pathResult.blockedCode === 400, "Path traversal returns HTTP 400 Bad Request")

    // Script injection attempt: <script> in body
    const xssReq = {
      headers: { "user-agent": "Mozilla/5.0" },
      query: {},
      body: { comment: "<script>alert(document.cookie)</script>" },
    }
    const xssResult = testSuspicious(xssReq)
    runner.assert(xssResult.didPass === false, "XSS script injection is blocked")
    runner.assert(xssResult.blockedCode === 400, "XSS script injection returns HTTP 400 Bad Request")

    if (server) {
      server.close()
    }
  } catch (err) {
    runner.assert(false, `Unexpected error in security hardening test: ${err.message}`)
    if (server) {
      server.close()
    }
  }

  return runner.summary()
}

if (process.argv[1]?.endsWith("securityHardening.test.js")) {
  runSecurityHardeningTest()
    .then((res) => {
      disconnectTestDb()
      process.exit(res.failed > 0 ? 1 : 0)
    })
    .catch(() => {
      disconnectTestDb()
      process.exit(1)
    })
}
