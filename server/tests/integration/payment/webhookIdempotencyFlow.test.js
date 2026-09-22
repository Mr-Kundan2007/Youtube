import crypto from "crypto"
import { TestRunner } from "../../helpers/testEnv.js"
import { connectTestDb, disconnectTestDb } from "../../helpers/testDatabase.js"
import { razorpayWebhookHandler } from "../../../controllers/paymentController.js"
import idempotencyService from "../../../security/services/idempotencyService.js"
import { razorpayConfig } from "../../../config/index.js"

export async function runWebhookIdempotencyFlowIntegrationTest() {
  const runner = new TestRunner("Integration: Webhook Signature Verification & Idempotency")
  runner.start()

  try {
    await connectTestDb()

    const webhookSecret = razorpayConfig.webhookSecret || "mock_webhook_secret_for_tests"
    const eventId = `evt_test_${crypto.randomBytes(8).toString("hex")}`

    const eventPayload = {
      id: eventId,
      entity: "event",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: `pay_test_${crypto.randomBytes(6).toString("hex")}`,
            amount: 49900,
            currency: "INR",
            status: "captured",
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    }

    const rawBody = JSON.stringify(eventPayload)
    const validSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex")

    // Helper mock response
    function createMockRes() {
      const res = {
        statusCode: 200,
        body: null,
        status(code) {
          this.statusCode = code
          return this
        },
        json(data) {
          this.body = data
          return this
        },
      }
      return res
    }

    // 1. Valid Webhook Event Delivery
    const req1 = {
      headers: {
        "x-razorpay-signature": validSignature,
        "x-razorpay-event-id": eventId,
      },
      body: eventPayload,
    }
    const res1 = createMockRes()

    await razorpayWebhookHandler(req1, res1)
    runner.assert(res1.statusCode === 200, "First valid webhook delivery responds with 200 OK")
    runner.assert(res1.body?.status === "ok", "Response body status is 'ok'")

    // 2. Idempotent Redelivery with Identical Event ID
    const req2 = {
      headers: {
        "x-razorpay-signature": validSignature,
        "x-razorpay-event-id": eventId,
      },
      body: eventPayload,
    }
    const res2 = createMockRes()

    await razorpayWebhookHandler(req2, res2)
    runner.assert(res2.statusCode === 200, "Duplicate webhook redelivery responds with 200 OK")
    runner.assert(res2.body?.deduplicated === true, "Response confirms event was safely deduplicated")

    // 3. Reject Tampered / Invalid Signature
    const invalidEventId = `evt_invalid_${crypto.randomBytes(6).toString("hex")}`
    const req3 = {
      headers: {
        "x-razorpay-signature": "invalid_tampered_signature_hex_digest",
        "x-razorpay-event-id": invalidEventId,
      },
      body: { ...eventPayload, id: invalidEventId },
    }
    const res3 = createMockRes()

    await razorpayWebhookHandler(req3, res3)
    runner.assert(res3.statusCode === 400, "Tampered webhook signature is rejected with 400 Bad Request")
    runner.assert(res3.body?.error === "Invalid webhook signature", "Error message flags invalid signature")

    // 4. Concurrent Webhook Event Lock Race Condition
    const raceKey = `race_evt_${Date.now()}`
    const [lock1, lock2] = await Promise.all([
      idempotencyService.checkOrAcquire(raceKey, "webhook_test"),
      idempotencyService.checkOrAcquire(raceKey, "webhook_test"),
    ])

    const acquiredCount = (!lock1.isDuplicate ? 1 : 0) + (!lock2.isDuplicate ? 1 : 0)
    runner.assert(acquiredCount === 1, "Exactly one concurrent thread successfully acquires idempotency lock")

    // Release test lock
    await idempotencyService.release(raceKey).catch(() => {})
  } catch (err) {
    runner.assert(false, `Unexpected error in webhook idempotency test: ${err.message}`)
  }

  return runner.summary()
}

if (process.argv[1]?.endsWith("webhookIdempotencyFlow.test.js")) {
  runWebhookIdempotencyFlowIntegrationTest()
    .then((res) => {
      disconnectTestDb()
      process.exit(res.failed > 0 ? 1 : 0)
    })
    .catch(() => {
      disconnectTestDb()
      process.exit(1)
    })
}
