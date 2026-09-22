#!/usr/bin/env node

/**
 * Post-Deployment Live Validation Smoke Test
 * Validates the deployed backend application in its running operational state:
 * - Base healthcheck probe
 * - Plans catalog endpoint availability
 * - Security headers enforcement
 * - Unauthenticated route protection
 */

const BASE_URL = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5004}`

async function runPostDeploymentValidation() {
  console.log("=========================================================================")
  console.log("  POST-DEPLOYMENT OPERATIONAL VALIDATION (SMOKE SUITE)")
  console.log(`  Target Base URL: ${BASE_URL} | Timestamp: ${new Date().toISOString()}`)
  console.log("=========================================================================\n")

  const checks = []

  function report(name, passed, detail) {
    checks.push({ name, passed, detail })
    const icon = passed ? "✓ PASS" : "✗ FAIL"
    console.log(`  [${icon}] ${name}: ${detail}`)
  }

  try {
    // 1. Root Healthcheck
    const rootRes = await fetch(`${BASE_URL}/`)
    const rootText = await rootRes.text()
    report(
      "Service Health Probe",
      rootRes.status === 200 && rootText.includes("backend is working"),
      `HTTP ${rootRes.status} (Response: "${rootText.trim()}")`
    )

    // 2. Plans Catalog Retrieval
    const plansRes = await fetch(`${BASE_URL}/api/subscription/plans`)
    const plansJson = await plansRes.json()
    const planCount = plansJson.data?.plans?.length || 0
    report(
      "Subscription Catalog API",
      plansRes.status === 200 && planCount >= 4,
      `HTTP ${plansRes.status} (${planCount} active subscription tiers loaded)`
    )

    // 3. Security Headers Verification
    const nosniff = plansRes.headers.get("x-content-type-options") === "nosniff"
    const frame = plansRes.headers.get("x-frame-options") === "SAMEORIGIN"
    report(
      "Hardened Security Headers",
      nosniff && frame,
      `X-Content-Type-Options: ${plansRes.headers.get("x-content-type-options")}, X-Frame-Options: ${plansRes.headers.get("x-frame-options")}`
    )

    // 4. Route Protection
    const unauthRes = await fetch(`${BASE_URL}/api/subscription/me`)
    report(
      "Authentication Barrier",
      unauthRes.status === 401,
      `Unauthenticated query blocked with HTTP ${unauthRes.status}`
    )

    console.log("\n-------------------------------------------------------------------------")
    const passedCount = checks.filter((c) => c.passed).length
    const failedCount = checks.length - passedCount
    console.log(`  SMOKE TEST SUMMARY: ${passedCount}/${checks.length} PASSED (${failedCount} FAILED)`)
    console.log("-------------------------------------------------------------------------\n")

    if (failedCount > 0) {
      console.error("  [STATUS: VALIDATION FAILED] Deployed service failed operational smoke tests.")
      process.exit(1)
    } else {
      console.log("  [STATUS: HEALTHY] Deployed service verified operational and secure.")
      process.exit(0)
    }
  } catch (err) {
    console.error("  [CRITICAL ERROR] Failed to connect to service:", err.message)
    process.exit(1)
  }
}

runPostDeploymentValidation()
