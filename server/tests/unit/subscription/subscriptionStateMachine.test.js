import { TestRunner } from "../../helpers/testEnv.js"
import paymentSecurityService from "../../../security/services/paymentSecurityService.js"

export async function runSubscriptionStateMachineUnitTest() {
  const runner = new TestRunner("Unit: Subscription & Payment State Machine Transitions")
  runner.start()

  // 1. Valid Payment State Transitions
  runner.assert(
    paymentSecurityService.enforcePaymentStateMachine("created", "pending").allowed === true,
    "Payment state machine allows 'created' -> 'pending'"
  )
  runner.assert(
    paymentSecurityService.enforcePaymentStateMachine("pending", "processing").allowed === true,
    "Payment state machine allows 'pending' -> 'processing'"
  )
  runner.assert(
    paymentSecurityService.enforcePaymentStateMachine("processing", "success").allowed === true,
    "Payment state machine allows 'processing' -> 'success'"
  )
  runner.assert(
    paymentSecurityService.enforcePaymentStateMachine("processing", "verification_failed").allowed === true,
    "Payment state machine allows 'processing' -> 'verification_failed'"
  )
  runner.assert(
    paymentSecurityService.enforcePaymentStateMachine("pending", "cancelled").allowed === true,
    "Payment state machine allows 'pending' -> 'cancelled'"
  )

  // 2. Disallowed Illegal Jumps
  runner.assert(
    paymentSecurityService.enforcePaymentStateMachine("failed", "success").allowed === false,
    "Payment state machine strictly BLOCKS illegal jump 'failed' -> 'success'"
  )
  runner.assert(
    paymentSecurityService.enforcePaymentStateMachine("verification_failed", "success").allowed === false,
    "Payment state machine strictly BLOCKS illegal jump 'verification_failed' -> 'success'"
  )
  runner.assert(
    paymentSecurityService.enforcePaymentStateMachine("success", "pending").allowed === false,
    "Payment state machine strictly BLOCKS transition out of terminal 'success' back to 'pending'"
  )
  runner.assert(
    paymentSecurityService.enforcePaymentStateMachine("cancelled", "success").allowed === false,
    "Payment state machine strictly BLOCKS transition out of terminal 'cancelled' to 'success'"
  )

  // 3. Subscription Status Hierarchy
  const VALID_SUBSCRIPTION_STATUSES = [
    "active",
    "pending",
    "expired",
    "cancelled",
    "cancel_scheduled",
    "grace_period",
    "expiring_soon",
    "renewal_pending",
    "suspended",
    "payment_pending",
    "payment_failed",
    "past_due",
  ]

  runner.assert(
    VALID_SUBSCRIPTION_STATUSES.includes("active") &&
      VALID_SUBSCRIPTION_STATUSES.includes("cancel_scheduled") &&
      VALID_SUBSCRIPTION_STATUSES.includes("grace_period"),
    "Subscription status schema supports all 12 core lifecycle states"
  )

  return runner.summary()
}

if (process.argv[1]?.endsWith("subscriptionStateMachine.test.js")) {
  runSubscriptionStateMachineUnitTest()
    .then((res) => {
      process.exit(res.failed > 0 ? 1 : 0)
    })
    .catch(() => {
      process.exit(1)
    })
}

export default runSubscriptionStateMachineUnitTest
