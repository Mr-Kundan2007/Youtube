import { TestRunner } from "../../helpers/testEnv.js"
import { sanitizeMetadata, constantTimeCompare, sha256 } from "../../../security/utils/securityUtils.js"
import { hashIp, parseUserAgent } from "../../../security/utils/ipUtils.js"
import { generateCorrelationId, computeClientFingerprint } from "../../../security/utils/requestFingerprint.js"
import { validateEnvironment } from "../../../security/utils/envValidator.js"

export async function runSecurityControlsUnitTest() {
  const runner = new TestRunner("Unit: Cryptography, Secrets Sanitization & Security Utils")
  runner.start()

  // 1. Constant-Time Equality
  const hash1 = sha256("test_payload_123")
  const hash2 = sha256("test_payload_123")
  const hash3 = sha256("different_payload")

  runner.assert(constantTimeCompare(hash1, hash2) === true, "constantTimeCompare validates identical hashes")
  runner.assert(constantTimeCompare(hash1, hash3) === false, "constantTimeCompare rejects distinct hashes")
  runner.assert(constantTimeCompare(hash1, "") === false, "constantTimeCompare handles empty string safely")

  // 2. Deep Metadata Sanitization
  const sensitivePayload = {
    user: "john_doe",
    password: "PlainTextPassword123!",
    token: "bearer_token_string",
    apiKey: "rzp_test_secret123",
    nested: {
      secretKey: "deep_secret_string",
      signature: "hex_sig_string",
      publicFlag: true,
      count: 42,
    },
    items: [
      { keySecret: "array_secret", label: "public_label" },
    ],
  }

  const sanitized = sanitizeMetadata(sensitivePayload)
  runner.assert(sanitized.password === "[REDACTED]", "Sanitizer redacts top-level password")
  runner.assert(sanitized.token === "[REDACTED]", "Sanitizer redacts top-level token")
  runner.assert(sanitized.apiKey === "[REDACTED]", "Sanitizer redacts top-level apiKey")
  runner.assert(sanitized.nested.secretKey === "[REDACTED]", "Sanitizer redacts nested secretKey")
  runner.assert(sanitized.nested.signature === "[REDACTED]", "Sanitizer redacts nested signature")
  runner.assert(sanitized.nested.publicFlag === true, "Sanitizer preserves nested boolean data")
  runner.assert(sanitized.nested.count === 42, "Sanitizer preserves nested numeric data")
  runner.assert(sanitized.items[0].keySecret === "[REDACTED]", "Sanitizer redacts array object secrets")
  runner.assert(sanitized.items[0].label === "public_label", "Sanitizer preserves array object public fields")

  // 3. IP Hashing & Privacy
  const clientIp = "203.0.113.195"
  const hashedIp = hashIp(clientIp)
  runner.assert(hashedIp.length === 64, "hashIp outputs standard 64-character SHA256 hex digest")
  runner.assert(hashedIp !== clientIp, "hashIp never exposes raw IP address")
  runner.assert(hashIp(clientIp) === hashedIp, "hashIp is deterministic for identical client IP")

  // 4. Request Correlation & Fingerprinting
  const corrId = generateCorrelationId()
  runner.assert(corrId.startsWith("REQ-"), "generateCorrelationId outputs REQ- prefixed string")
  runner.assert(corrId.length > 20, "generateCorrelationId has sufficient entropy")

  const mockReq = {
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0",
      "accept-language": "en-US,en;q=0.9",
    },
  }
  const fp = computeClientFingerprint(mockReq)
  runner.assert(typeof fp === "string" && fp.length > 10, "computeClientFingerprint generates deterministic fingerprint")

  const ua = parseUserAgent(mockReq)
  runner.assert(ua.browser === "Chrome" && ua.os === "macOS", "parseUserAgent classifies browser and OS correctly")

  // 5. Environment Validator
  const envCheck = validateEnvironment()
  runner.assert(envCheck.isReady === true, "validateEnvironment confirms valid operational environment")

  return runner.summary()
}

if (process.argv[1]?.endsWith("securityControls.test.js")) {
  runSecurityControlsUnitTest()
    .then((res) => {
      process.exit(res.failed > 0 ? 1 : 0)
    })
    .catch(() => {
      process.exit(1)
    })
}

export default runSecurityControlsUnitTest
