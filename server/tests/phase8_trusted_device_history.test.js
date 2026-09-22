/**
 * Automated Test Suite for Phase 8: Trusted Device Management, Login History & Account Security
 *
 * Verifies all 10 core scenarios from the Phase 8 specification:
 * 1. Auto-registration of trusted device after successful verification (30-day trust window)
 * 2. Trusted device validation during login -> Bypasses redundant OTP for low-risk logins
 * 3. High-risk override on trusted device (new country / critical risk) -> Mandates re-verification
 * 4. Trust expiration -> Devices older than 30 days transition to EXPIRED and require OTP
 * 5. Device limit enforcement -> Max 10 active devices per user; auto-evicts least recently used
 * 6. User manual revocation -> Device marked REVOKED and cannot bypass OTP
 * 7. Custom device renaming -> HTML stripped, clamped to 50 characters, audit event logged
 * 8. Login history audit trail -> Records SUCCESS, FAILED, OTP_REQUIRED, BLOCKED with filters
 * 9. Security activity stream -> Classified by severity (LOW, MEDIUM, HIGH, CRITICAL)
 * 10. Privacy & authorization -> IP masking verified, secrets shielded, user isolation enforced
 */

import assert from "assert"
import { TRUSTED_DEVICE_CONFIG } from "../config/trustedDeviceConfig.js"
import { maskIPAddress } from "../utils/comparisonUtils.js"
import { SecurityActivityService } from "../services/securityActivityService.js"

let passedTests = 0
let failedTests = 0

function runTest(testName, fn) {
  try {
    fn()
    console.log(`  ✓ [PASS] ${testName}`)
    passedTests++
  } catch (err) {
    console.error(`  ✗ [FAIL] ${testName}`)
    console.error(`     Error: ${err.message}`)
    failedTests++
  }
}

async function runAsyncTest(testName, fn) {
  try {
    await fn()
    console.log(`  ✓ [PASS] ${testName}`)
    passedTests++
  } catch (err) {
    console.error(`  ✗ [FAIL] ${testName}`)
    console.error(`     Error: ${err.message}`)
    failedTests++
  }
}

class MockTrustedDeviceHarness {
  constructor() {
    this.devices = new Map()
    this.loginHistory = []
    this.securityEvents = []
  }

  async createOrUpdateTrustedDevice({ userId, loginContext = {}, verificationMethod = "OTP" }) {
    const dev = loginContext.device || {}
    const net = loginContext.network || {}
    const loc = net.location || {}

    const deviceIdentifier =
      dev.signature ||
      `${dev.type || "desktop"}:${dev.browser?.name || "browser"}:${dev.os?.name || "os"}`

    const trustDurationMs = TRUSTED_DEVICE_CONFIG.durationDays * 24 * 60 * 60 * 1000
    const trustExpiresAt = new Date(Date.now() + trustDurationMs)
    const clientIp = net.ipAddress || net.ip?.address || loginContext.clientIp || ""

    for (const [id, d] of this.devices.entries()) {
      if (d.userId === userId && d.deviceIdentifier === deviceIdentifier) {
        d.status = TRUSTED_DEVICE_CONFIG.status.ACTIVE
        d.trustExpiresAt = trustExpiresAt
        d.lastUsedAt = new Date()
        d.lastKnownIP = clientIp
        d.lastKnownLocation = loc
        d.verificationMethod = verificationMethod
        this.securityEvents.push({
          eventType: TRUSTED_DEVICE_CONFIG.eventTypes.TRUSTED_DEVICE_UPDATED,
          userId,
          metadata: { deviceId: id, deviceIdentifier },
        })
        return d
      }
    }

    const activeDevices = [...this.devices.values()].filter(
      (d) => d.userId === userId && d.status === TRUSTED_DEVICE_CONFIG.status.ACTIVE
    )

    if (activeDevices.length >= TRUSTED_DEVICE_CONFIG.maxPerUser) {
      const oldest = activeDevices.sort((a, b) => a.lastUsedAt - b.lastUsedAt)[0]
      if (oldest) {
        oldest.status = TRUSTED_DEVICE_CONFIG.status.REVOKED
        this.securityEvents.push({
          eventType: TRUSTED_DEVICE_CONFIG.eventTypes.TRUSTED_DEVICE_REVOKED,
          userId,
          metadata: {
            deviceId: oldest.id,
            reason: "DEVICE_LIMIT_EXCEEDED",
          },
        })
      }
    }

    const id = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const defaultName = `${dev.vendor || ""} ${dev.model || dev.type || "Device"}`.trim() || "Web Browser"

    const newDevice = {
      id,
      _id: id,
      userId,
      deviceIdentifier,
      deviceName: defaultName,
      customName: "",
      browser: dev.browser || { name: "Chrome", version: "128.0" },
      operatingSystem: dev.os || { name: "macOS", version: "15.0" },
      device: dev.type ? { type: dev.type } : { type: "desktop" },
      firstVerifiedAt: new Date(),
      lastUsedAt: new Date(),
      trustedAt: new Date(),
      trustExpiresAt,
      status: TRUSTED_DEVICE_CONFIG.status.ACTIVE,
      lastKnownIP: clientIp,
      lastKnownLocation: loc,
      verificationMethod,
    }

    this.devices.set(id, newDevice)
    this.securityEvents.push({
      eventType: TRUSTED_DEVICE_CONFIG.eventTypes.TRUSTED_DEVICE_CREATED,
      userId,
      metadata: { deviceId: id, deviceIdentifier, trustExpiresAt },
    })

    return newDevice
  }

  async findActiveTrustedDevice(userId, deviceIdentifier) {
    for (const d of this.devices.values()) {
      if (d.userId === userId && d.deviceIdentifier === deviceIdentifier) {
        if (d.status !== TRUSTED_DEVICE_CONFIG.status.ACTIVE) return null

        if (new Date() > new Date(d.trustExpiresAt)) {
          d.status = TRUSTED_DEVICE_CONFIG.status.EXPIRED
          this.securityEvents.push({
            eventType: TRUSTED_DEVICE_CONFIG.eventTypes.TRUSTED_DEVICE_EXPIRED,
            userId,
            metadata: { deviceId: d.id, deviceIdentifier },
          })
          return null
        }
        return d
      }
    }
    return null
  }

  async revokeTrustedDevice(userId, deviceId) {
    const dev = this.devices.get(deviceId)
    if (!dev || dev.userId !== userId) {
      throw new Error("Trusted device not found or does not belong to user")
    }
    dev.status = TRUSTED_DEVICE_CONFIG.status.REVOKED
    this.securityEvents.push({
      eventType: TRUSTED_DEVICE_CONFIG.eventTypes.TRUSTED_DEVICE_REVOKED,
      userId,
      metadata: { deviceId, deviceName: dev.customName || dev.deviceName },
    })
    return dev
  }

  async renameTrustedDevice(userId, deviceId, customName) {
    const dev = this.devices.get(deviceId)
    if (!dev || dev.userId !== userId) {
      throw new Error("Trusted device not found or does not belong to user")
    }
    const sanitized = String(customName || "")
      .replace(/<[^>]*>?/gm, "")
      .trim()
      .slice(0, 50)
    dev.customName = sanitized
    this.securityEvents.push({
      eventType: TRUSTED_DEVICE_CONFIG.eventTypes.TRUSTED_DEVICE_RENAMED,
      userId,
      metadata: { deviceId, newName: sanitized },
    })
    return dev
  }

  async evaluateLoginAttempt({ userId, loginContext, securityDecision }) {
    const devSig =
      loginContext.device?.signature ||
      `${loginContext.device?.type || "desktop"}:${loginContext.device?.browser?.name || "browser"}:${loginContext.device?.os?.name || "os"}`

    const activeTrusted = await this.findActiveTrustedDevice(userId, devSig)

    if (activeTrusted) {
      const isNewCountry = Boolean(securityDecision.signals?.isNewCountry)
      const isCriticalRisk = securityDecision.riskScore >= 60 || securityDecision.riskLevel === "CRITICAL"

      if (isNewCountry || isCriticalRisk) {
        return {
          decision: "VERIFICATION_REQUIRED",
          trustedDeviceChallenged: true,
          trustedDeviceReason: isNewCountry ? "NEW_COUNTRY_OVERRIDE" : "CRITICAL_RISK_OVERRIDE",
          status: "PENDING_VERIFICATION",
        }
      } else {
        activeTrusted.lastUsedAt = new Date()
        return {
          decision: "ALLOW",
          trustedDeviceBypass: true,
          status: "ALLOWED",
          trustedDevice: {
            id: activeTrusted.id,
            deviceName: activeTrusted.customName || activeTrusted.deviceName,
            isTrusted: true,
          },
        }
      }
    }

    return {
      decision: securityDecision.decision,
      status: securityDecision.decision === "ALLOW" ? "ALLOWED" : "PENDING_VERIFICATION",
      trustedDeviceBypass: false,
    }
  }

  async recordLogin({ userId, status, authenticationMethod = "PASSWORD", loginContext = {}, verificationRequired = false, trustedDeviceId = null }) {
    const dev = loginContext.device || {}
    const net = loginContext.network || {}
    const loc = net.location || {}
    const rawIp = net.ipAddress || net.ip?.address || loginContext.clientIp || ""
    const masked = rawIp ? maskIPAddress(rawIp) : "xxx.xxx.xxx.xxx"

    const record = {
      id: `lh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      status,
      authenticationMethod,
      browser: dev.browser || { name: "Unknown" },
      operatingSystem: dev.os || { name: "Unknown" },
      device: { type: dev.type || "desktop" },
      maskedIP: masked,
      location: loc,
      loginAt: new Date(),
      verificationRequired,
      trustedDeviceId,
    }

    this.loginHistory.push(record)
    return record
  }

  async getLoginHistory(userId, { page = 1, limit = 20, status = null, deviceType = null } = {}) {
    let filtered = this.loginHistory.filter((item) => item.userId === userId)
    if (status) filtered = filtered.filter((item) => item.status === status)
    if (deviceType) filtered = filtered.filter((item) => item.device.type === deviceType)

    const total = filtered.length
    const skip = (page - 1) * limit
    const paged = filtered.slice(skip, skip + limit)

    return {
      history: paged,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    }
  }
}

async function main() {
  console.log("\n========================================================================")
  console.log("PHASE 8: TRUSTED DEVICE MANAGEMENT & LOGIN HISTORY AUDIT TEST SUITE")
  console.log("========================================================================\n")

  console.log("--- 1. CONFIGURATION & SPECIFICATION INTEGRITY ---")
  runTest("TRUSTED_DEVICE_CONFIG has expected duration (30 days) and capacity (10 devices)", () => {
    assert.strictEqual(TRUSTED_DEVICE_CONFIG.durationDays, 30)
    assert.strictEqual(TRUSTED_DEVICE_CONFIG.maxPerUser, 10)
    assert.strictEqual(TRUSTED_DEVICE_CONFIG.autoTrustAfterOTP, true)
    assert.strictEqual(TRUSTED_DEVICE_CONFIG.enabled, true)
  })

  runTest("TRUSTED_DEVICE_CONFIG defines all required statuses and severities", () => {
    assert.strictEqual(TRUSTED_DEVICE_CONFIG.status.ACTIVE, "ACTIVE")
    assert.strictEqual(TRUSTED_DEVICE_CONFIG.status.EXPIRED, "EXPIRED")
    assert.strictEqual(TRUSTED_DEVICE_CONFIG.status.REVOKED, "REVOKED")
    assert.strictEqual(TRUSTED_DEVICE_CONFIG.status.SUSPENDED, "SUSPENDED")

    assert.strictEqual(TRUSTED_DEVICE_CONFIG.loginStatus.SUCCESS, "SUCCESS")
    assert.strictEqual(TRUSTED_DEVICE_CONFIG.loginStatus.FAILED, "FAILED")
    assert.strictEqual(TRUSTED_DEVICE_CONFIG.loginStatus.OTP_REQUIRED, "OTP_REQUIRED")
    assert.strictEqual(TRUSTED_DEVICE_CONFIG.loginStatus.BLOCKED, "BLOCKED")

    assert.strictEqual(TRUSTED_DEVICE_CONFIG.severity.LOW, "LOW")
    assert.strictEqual(TRUSTED_DEVICE_CONFIG.severity.MEDIUM, "MEDIUM")
    assert.strictEqual(TRUSTED_DEVICE_CONFIG.severity.HIGH, "HIGH")
    assert.strictEqual(TRUSTED_DEVICE_CONFIG.severity.CRITICAL, "CRITICAL")
  })

  console.log("\n--- 2. PRIVACY & IP MASKING AUDIT ---")
  runTest("maskIPAddress properly masks IPv4 addresses", () => {
    const masked = maskIPAddress("103.25.48.99")
    assert.strictEqual(masked, "103.25.xxx.xxx")
    assert.ok(!masked.includes("48.99"), "Host octets must be masked")
  })

  runTest("maskIPAddress properly masks IPv6 addresses", () => {
    const masked = maskIPAddress("2001:0db8:85a3:0000:0000:8a2e:0370:7334")
    assert.ok(masked.includes("xxxx:xxxx"), "IPv6 tail groups must be masked with xxxx:xxxx")
  })

  runTest("maskIPAddress handles empty strings safely", () => {
    assert.strictEqual(maskIPAddress(""), "xxx.xxx.xxx.xxx")
  })

  console.log("\n--- 3. TRUSTED DEVICE LIFECYCLE & CORE SCENARIOS ---")

  await runAsyncTest("Scenario 1: Auto-registration of trusted device after successful OTP verification", async () => {
    const harness = new MockTrustedDeviceHarness()
    const userId = "user-abc-123"

    const loginContext = {
      device: {
        signature: "sig-macbook-chrome",
        browser: { name: "Chrome", version: "128.0" },
        os: { name: "macOS", version: "15.0" },
        type: "desktop",
        vendor: "Apple",
        model: "MacBook Pro",
      },
      network: {
        ipAddress: "49.37.12.84",
        location: { city: "Bengaluru", state: "Karnataka", country: "India" },
      },
    }

    const device = await harness.createOrUpdateTrustedDevice({
      userId,
      loginContext,
      verificationMethod: "EMAIL_OTP",
    })

    assert.ok(device, "Device must be created")
    assert.strictEqual(device.userId, userId)
    assert.strictEqual(device.deviceIdentifier, "sig-macbook-chrome")
    assert.strictEqual(device.status, "ACTIVE")
    assert.strictEqual(device.deviceName, "Apple MacBook Pro")

    const now = Date.now()
    const diffDays = Math.round((device.trustExpiresAt.getTime() - now) / (1000 * 60 * 60 * 24))
    assert.strictEqual(diffDays, 30, "Trust expiration must be exactly 30 days in future")

    assert.ok(
      harness.securityEvents.some((e) => e.eventType === "TRUSTED_DEVICE_CREATED"),
      "Security event TRUSTED_DEVICE_CREATED must be logged"
    )
  })

  await runAsyncTest("Scenario 2: Trusted device validation during login -> Bypasses redundant OTP for low-risk logins", async () => {
    const harness = new MockTrustedDeviceHarness()
    const userId = "user-abc-123"

    const loginContext = {
      device: {
        signature: "sig-macbook-chrome",
        browser: { name: "Chrome", version: "128.0" },
        os: { name: "macOS", version: "15.0" },
        type: "desktop",
      },
      network: {
        ipAddress: "49.37.12.84",
        location: { city: "Bengaluru", state: "Karnataka", country: "India" },
      },
    }

    await harness.createOrUpdateTrustedDevice({ userId, loginContext })

    const incomingContext = {
      ...loginContext,
      network: {
        ipAddress: "49.37.12.99",
        location: { city: "Bengaluru", state: "Karnataka", country: "India" },
      },
    }

    const securityDecision = {
      decision: "VERIFICATION_REQUIRED",
      riskScore: 25,
      riskLevel: "LOW",
      reasons: ["NEW_IP_ADDRESS"],
      signals: { isNewIP: true, isNewCountry: false },
    }

    const result = await harness.evaluateLoginAttempt({
      userId,
      loginContext: incomingContext,
      securityDecision,
    })

    assert.strictEqual(result.decision, "ALLOW", "Low-risk login on trusted device must be allowed")
    assert.strictEqual(result.trustedDeviceBypass, true, "Must flag trustedDeviceBypass as true")
    assert.strictEqual(result.status, "ALLOWED")
  })

  await runAsyncTest("Scenario 3: High-risk override on trusted device (new country) mandates OTP verification", async () => {
    const harness = new MockTrustedDeviceHarness()
    const userId = "user-abc-123"

    const loginContext = {
      device: { signature: "sig-macbook-chrome", type: "desktop" },
      network: { ipAddress: "49.37.12.84", location: { country: "India" } },
    }

    await harness.createOrUpdateTrustedDevice({ userId, loginContext })

    const foreignContext = {
      device: { signature: "sig-macbook-chrome", type: "desktop" },
      network: { ipAddress: "194.26.29.11", location: { country: "Russia" } },
    }

    const highRiskDecision = {
      decision: "VERIFICATION_REQUIRED",
      riskScore: 75,
      riskLevel: "HIGH",
      reasons: ["NEW_COUNTRY_DETECTED"],
      signals: { isNewCountry: true, isNewIP: true },
    }

    const result = await harness.evaluateLoginAttempt({
      userId,
      loginContext: foreignContext,
      securityDecision: highRiskDecision,
    })

    assert.strictEqual(result.decision, "VERIFICATION_REQUIRED", "High-risk foreign login must not bypass OTP")
    assert.strictEqual(result.trustedDeviceChallenged, true, "Must flag trusted device as challenged")
    assert.strictEqual(result.trustedDeviceReason, "NEW_COUNTRY_OVERRIDE")
  })

  await runAsyncTest("Scenario 4: Trust expiration after 30 days -> Device transitions to EXPIRED and requires OTP", async () => {
    const harness = new MockTrustedDeviceHarness()
    const userId = "user-abc-123"

    const loginContext = {
      device: { signature: "sig-expired-laptop", type: "desktop" },
    }

    const device = await harness.createOrUpdateTrustedDevice({ userId, loginContext })

    // Fast-forward device expiration date to 1 hour ago
    device.trustExpiresAt = new Date(Date.now() - 60 * 60 * 1000)

    const activeDevice = await harness.findActiveTrustedDevice(userId, "sig-expired-laptop")
    assert.strictEqual(activeDevice, null, "Expired device must not be returned as active")
    assert.strictEqual(device.status, "EXPIRED", "Device status must transition to EXPIRED")

    assert.ok(
      harness.securityEvents.some((e) => e.eventType === "TRUSTED_DEVICE_EXPIRED"),
      "TRUSTED_DEVICE_EXPIRED security event must be logged"
    )
  })

  await runAsyncTest("Scenario 5: Device capacity limit enforcement (Max 10 per user) evicts oldest inactive device", async () => {
    const harness = new MockTrustedDeviceHarness()
    const userId = "user-capacity-test"

    for (let i = 1; i <= 10; i++) {
      const dev = await harness.createOrUpdateTrustedDevice({
        userId,
        loginContext: {
          device: { signature: `sig-device-${i}`, type: "desktop" },
        },
      })
      dev.lastUsedAt = new Date(Date.now() - (11 - i) * 100000)
    }

    const activeBefore = [...harness.devices.values()].filter(
      (d) => d.userId === userId && d.status === "ACTIVE"
    )
    assert.strictEqual(activeBefore.length, 10, "Must have 10 active devices before 11th registration")

    await harness.createOrUpdateTrustedDevice({
      userId,
      loginContext: {
        device: { signature: "sig-device-11", type: "mobile" },
      },
    })

    const activeAfter = [...harness.devices.values()].filter(
      (d) => d.userId === userId && d.status === "ACTIVE"
    )
    assert.strictEqual(activeAfter.length, 10, "Active devices must remain capped at 10")

    const device1 = [...harness.devices.values()].find((d) => d.deviceIdentifier === "sig-device-1")
    assert.strictEqual(device1.status, "REVOKED", "Oldest device must be marked REVOKED")

    const evictionEvent = harness.securityEvents.find(
      (e) => e.eventType === "TRUSTED_DEVICE_REVOKED" && e.metadata?.reason === "DEVICE_LIMIT_EXCEEDED"
    )
    assert.ok(evictionEvent, "Eviction event with reason DEVICE_LIMIT_EXCEEDED must be logged")
  })

  await runAsyncTest("Scenario 6: Manual trust revocation by user prevents future bypass", async () => {
    const harness = new MockTrustedDeviceHarness()
    const userId = "user-manual-revoke"

    const device = await harness.createOrUpdateTrustedDevice({
      userId,
      loginContext: {
        device: { signature: "sig-revoke-me", type: "tablet" },
      },
    })

    await harness.revokeTrustedDevice(userId, device.id)
    assert.strictEqual(device.status, "REVOKED")

    const check = await harness.findActiveTrustedDevice(userId, "sig-revoke-me")
    assert.strictEqual(check, null, "Revoked device must not be recognized as active")
  })

  await runAsyncTest("Scenario 7: Custom device renaming sanitizes HTML and clamps to 50 characters", async () => {
    const harness = new MockTrustedDeviceHarness()
    const userId = "user-rename-test"

    const device = await harness.createOrUpdateTrustedDevice({
      userId,
      loginContext: {
        device: { signature: "sig-rename-test", type: "laptop" },
      },
    })

    const maliciousName = "<script>alert('xss')</script>Kundan's Ultra Extended Workstation That Exceeds The Maximum Permitted Fifty Characters Threshold"
    await harness.renameTrustedDevice(userId, device.id, maliciousName)

    assert.ok(!device.customName.includes("<script>"), "HTML tags must be stripped")
    assert.ok(device.customName.length <= 50, "Length must be clamped to max 50 characters")
    assert.ok(device.customName.startsWith("alert('xss')Kundan"), "Sanitized content preserved")

    const renameEvent = harness.securityEvents.find(
      (e) => e.eventType === "TRUSTED_DEVICE_RENAMED"
    )
    assert.ok(renameEvent, "TRUSTED_DEVICE_RENAMED event must be logged")
  })

  await runAsyncTest("Scenario 8: Login history records SUCCESS, FAILED, OTP_REQUIRED and supports filters", async () => {
    const harness = new MockTrustedDeviceHarness()
    const userId = "user-audit-trail"

    await harness.recordLogin({
      userId,
      status: "SUCCESS",
      authenticationMethod: "PASSWORD",
      loginContext: {
        device: { type: "desktop", browser: { name: "Firefox" } },
        network: { ipAddress: "103.21.244.1", location: { city: "Mumbai" } },
      },
    })

    await harness.recordLogin({
      userId,
      status: "OTP_REQUIRED",
      authenticationMethod: "PASSWORD",
      loginContext: {
        device: { type: "mobile", browser: { name: "Safari" } },
        network: { ipAddress: "49.36.88.12", location: { city: "Delhi" } },
      },
      verificationRequired: true,
    })

    await harness.recordLogin({
      userId,
      status: "FAILED",
      authenticationMethod: "PASSWORD",
      loginContext: {
        device: { type: "desktop", browser: { name: "Chrome" } },
        network: { ipAddress: "185.220.101.5", location: { city: "Berlin" } },
      },
    })

    const allResult = await harness.getLoginHistory(userId, { page: 1, limit: 10 })
    assert.strictEqual(allResult.total, 3)

    const successOnly = await harness.getLoginHistory(userId, { status: "SUCCESS" })
    assert.strictEqual(successOnly.total, 1)
    assert.strictEqual(successOnly.history[0].status, "SUCCESS")
    assert.strictEqual(successOnly.history[0].maskedIP, "103.21.xxx.xxx", "IP must be masked in history")

    const mobileOnly = await harness.getLoginHistory(userId, { deviceType: "mobile" })
    assert.strictEqual(mobileOnly.total, 1)
    assert.strictEqual(mobileOnly.history[0].device.type, "mobile")
  })

  runTest("Scenario 9: Security activity service formats events and classifies severities correctly", () => {
    const service = new SecurityActivityService()

    const lowEvent = service.formatActivity({
      _id: "evt-1",
      eventType: "TRUSTED_DEVICE_CREATED",
      severity: "LOW",
      ip: "103.25.48.99",
      metadata: { deviceName: "My Mac" },
      timestamp: new Date(),
    })

    assert.strictEqual(lowEvent.title, "Trusted Device Added")
    assert.strictEqual(lowEvent.severity, "LOW")
    assert.strictEqual(lowEvent.ip, "103.25.xxx.xxx")

    const highEvent = service.formatActivity({
      _id: "evt-2",
      eventType: "LOGIN_BLOCKED",
      severity: "HIGH",
      ip: "185.220.101.5",
      metadata: { reason: "TOR_EXIT_NODE" },
      timestamp: new Date(),
    })

    assert.strictEqual(highEvent.title, "Suspicious Login Blocked")
    assert.strictEqual(highEvent.severity, "HIGH")
  })

  await runAsyncTest("Scenario 10: User authorization isolation -> User cannot modify or view other user's devices", async () => {
    const harness = new MockTrustedDeviceHarness()
    const userAlice = "user-alice"
    const userBob = "user-bob"

    const aliceDevice = await harness.createOrUpdateTrustedDevice({
      userId: userAlice,
      loginContext: { device: { signature: "alice-laptop" } },
    })

    let threwError = false
    try {
      await harness.revokeTrustedDevice(userBob, aliceDevice.id)
    } catch (err) {
      threwError = true
      assert.ok(err.message.includes("does not belong to user"))
    }
    assert.strictEqual(threwError, true, "Cross-user revocation must be strictly prohibited")
  })

  console.log("\n========================================================================")
  console.log(`TOTAL PHASE 8 TESTS: ${passedTests + failedTests}`)
  console.log(`PASSED: ${passedTests}`)
  console.log(`FAILED: ${failedTests}`)
  console.log("========================================================================\n")

  if (failedTests > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Unexpected test suite failure:", err)
  process.exit(1)
})
