#!/usr/bin/env node

/**
 * Phase 11 Master Test Orchestrator
 * Sequentially executes all automated Unit, Integration, API, Security, and Performance suites.
 * Outputs a unified, structured test report with execution timing and exits 0 on 100% pass.
 */

import { connectTestDb, disconnectTestDb } from "./helpers/testDatabase.js"

// Unit Suites
import { runPlanFeaturesUnitTest } from "./unit/subscription/planFeatures.test.js"
import { runSubscriptionLifecycleUnitTest } from "./unit/subscription/subscriptionLifecycle.test.js"
import { runSubscriptionStateMachineUnitTest } from "./unit/subscription/subscriptionStateMachine.test.js"
import { runPaymentValidationUnitTest } from "./unit/payment/paymentValidation.test.js"
import { runInvoiceTaxUnitTest } from "./unit/invoice/invoiceTax.test.js"
import { runSecurityControlsUnitTest } from "./unit/security/securityControls.test.js"

// Integration Suites
import { runSubscriptionWorkflowsIntegrationTest } from "./integration/subscription/subscriptionWorkflows.test.js"
import { runRazorpayTestModeFlowIntegrationTest } from "./integration/payment/razorpayTestModeFlow.test.js"
import { runWebhookIdempotencyFlowIntegrationTest } from "./integration/payment/webhookIdempotencyFlow.test.js"
import { runAdminControlsFlowIntegrationTest } from "./integration/admin/adminControlsFlow.test.js"

// API & Security Suites
import { runSubscriptionApiTest } from "./api/subscriptionApi.test.js"
import { runSecurityHardeningTest } from "./security/securityHardening.test.js"

// Performance Suites
import { runDatabaseBenchmarkTest } from "./performance/databaseBenchmark.test.js"
import { runLoadSimulationTest } from "./performance/loadSimulation.test.js"

async function runPhase11MasterSuite() {
  const masterStart = performance.now()

  console.log("=========================================================================")
  console.log("  PHASE 11: AUTOMATED TESTING, INTEGRATION, PERFORMANCE & DEPLOYMENT PREP")
  console.log(`  Started: ${new Date().toISOString()} | NODE_ENV=${process.env.NODE_ENV}`)
  console.log("=========================================================================\n")

  const suites = [
    // 1. Unit Testing
    { id: "UNIT-01", fn: runPlanFeaturesUnitTest },
    { id: "UNIT-02", fn: runSubscriptionLifecycleUnitTest },
    { id: "UNIT-03", fn: runSubscriptionStateMachineUnitTest },
    { id: "UNIT-04", fn: runPaymentValidationUnitTest },
    { id: "UNIT-05", fn: runInvoiceTaxUnitTest },
    { id: "UNIT-06", fn: runSecurityControlsUnitTest },

    // 2. Integration Testing
    { id: "INT-01", fn: runSubscriptionWorkflowsIntegrationTest },
    { id: "INT-02", fn: runRazorpayTestModeFlowIntegrationTest },
    { id: "INT-03", fn: runWebhookIdempotencyFlowIntegrationTest },
    { id: "INT-04", fn: runAdminControlsFlowIntegrationTest },

    // 3. API & Security Testing
    { id: "API-01", fn: runSubscriptionApiTest },
    { id: "SEC-01", fn: runSecurityHardeningTest },

    // 4. Performance & Load Simulation
    { id: "PERF-01", fn: runDatabaseBenchmarkTest },
    { id: "LOAD-01", fn: runLoadSimulationTest },
  ]

  const suiteSummaries = []
  let grandTotal = 0
  let grandPassed = 0
  let grandFailed = 0

  for (const suite of suites) {
    try {
      const summary = await suite.fn()
      suiteSummaries.push({ id: suite.id, ...summary })
      grandTotal += summary.total
      grandPassed += summary.passed
      grandFailed += summary.failed
    } catch (err) {
      console.error(`[FATAL] Suite ${suite.id} aborted with unexpected error:`, err)
      suiteSummaries.push({ id: suite.id, name: suite.id, total: 1, passed: 0, failed: 1, duration: 0 })
      grandTotal += 1
      grandFailed += 1
    }
  }

  await disconnectTestDb()
  const masterDuration = ((performance.now() - masterStart) / 1000).toFixed(2)

  console.log("\n=========================================================================")
  console.log("  PHASE 11 MASTER TEST EXECUTION SUMMARY REPORT")
  console.log("=========================================================================")

  suiteSummaries.forEach((s) => {
    const icon = s.failed === 0 ? "✓" : "✗"
    const title = String(s.name || s.suite || s.id || "Test Suite").slice(0, 52).padEnd(52)
    const statusText = s.failed === 0 ? "PASSED" : "FAILED"
    const dur = typeof s.duration === "number" ? s.duration.toFixed(2) : String(s.duration || "0.00")
    console.log(
      `  ${icon} [${s.id}] ${title} : ${String(s.passed).padStart(3)} passed | ${String(s.failed).padStart(2)} failed (${dur}s) [${statusText}]`
    )
  })

  console.log("-------------------------------------------------------------------------")
  console.log(
    `  GRAND TOTAL: ${grandTotal} ASSERTIONS | ${grandPassed} PASSED | ${grandFailed} FAILED (${masterDuration}s)`
  )
  console.log("=========================================================================\n")

  if (grandFailed > 0) {
    console.error(`  [FAILURE] Phase 11 master test run completed with ${grandFailed} failed assertions.`)
    process.exit(1)
  } else {
    console.log("  [SUCCESS] All Phase 11 test suites completed with 100% pass rate. System is certified ready.")
    process.exit(0)
  }
}

runPhase11MasterSuite()
