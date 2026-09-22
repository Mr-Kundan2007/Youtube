import dotenv from "dotenv"
import path from "path"
import fs from "fs"

// 1. Force test environment
process.env.NODE_ENV = "test"

// 2. Load .env.test if present
const testEnvPath = path.resolve(process.cwd(), ".env.test")
const serverTestEnvPath = path.resolve(process.cwd(), "server", ".env.test")

if (fs.existsSync(testEnvPath)) {
  dotenv.config({ path: testEnvPath, override: true })
} else if (fs.existsSync(serverTestEnvPath)) {
  dotenv.config({ path: serverTestEnvPath, override: true })
} else {
  dotenv.config()
}

/**
 * Ensures test safety: guarantees tests never run against production credentials.
 */
export const assertTestEnvironmentSafety = () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("CRITICAL SAFETY HALT: Automated tests must NEVER run with NODE_ENV=production!")
  }

  const razorpayKey = process.env.RAZORPAY_KEY_ID || ""
  if (razorpayKey.startsWith("rzp_live_")) {
    throw new Error("CRITICAL SAFETY HALT: Production Razorpay Live Key detected in test environment!")
  }
}

/**
 * Lightweight test suite runner and assertion aggregator.
 */
export class TestRunner {
  constructor(suiteName) {
    this.suiteName = suiteName
    this.passed = 0
    this.failed = 0
    this.startTime = Date.now()
  }

  start() {
    assertTestEnvironmentSafety()
    console.log("=========================================================================")
    console.log(`  SUITE: ${this.suiteName}`)
    console.log("=========================================================================\n")
  }

  assert(condition, description) {
    if (condition) {
      console.log(`  ✓ ${description}`)
      this.passed++
    } else {
      console.error(`  ✗ FAILED: ${description}`)
      this.failed++
    }
  }

  summary() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2)
    console.log("\n-------------------------------------------------------------------------")
    console.log(`  RESULTS for [${this.suiteName}]: ${this.passed} PASSED | ${this.failed} FAILED (${duration}s)`)
    console.log("-------------------------------------------------------------------------\n")
    return {
      name: this.suiteName,
      suite: this.suiteName,
      passed: this.passed,
      failed: this.failed,
      total: this.passed + this.failed,
      duration: duration,
      durationSeconds: Number(duration),
    }
  }
}

export default {
  assertTestEnvironmentSafety,
  TestRunner,
}
