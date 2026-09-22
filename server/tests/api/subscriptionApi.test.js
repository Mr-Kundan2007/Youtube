import http from "http"
import jwt from "jsonwebtoken"
import { TestRunner } from "../helpers/testEnv.js"
import { connectTestDb, disconnectTestDb, cleanTestFixtures } from "../helpers/testDatabase.js"
import { createTestUser, createTestAdmin, createTestSubscription } from "../helpers/testDataFactories.js"
import { authConfig } from "../../config/index.js"
import app from "../../index.js"

export async function runSubscriptionApiTest() {
  const runner = new TestRunner("API: HTTP Envelopes, Route Gating & Role Authorization")
  runner.start()

  const testUserIds = []
  let server = null
  let baseUrl = ""

  try {
    await connectTestDb()

    // Start ephemeral test server on random free port
    server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
    const port = server.address().port
    baseUrl = `http://127.0.0.1:${port}`

    // 1. Create Normal User and Admin User
    const user = await createTestUser({ name: "API Client User" })
    const admin = await createTestAdmin({ name: "API Admin User" })
    testUserIds.push(user._id, admin._id)

    await createTestSubscription({
      userId: user._id,
      plan: "silver",
      status: "active",
    })

    const userToken = jwt.sign(
      { id: user._id.toString(), email: user.email, role: "user" },
      authConfig.jwtSecret,
      { expiresIn: "1h" }
    )

    const adminToken = jwt.sign(
      { id: admin._id.toString(), email: admin.email, role: "admin" },
      authConfig.jwtSecret,
      { expiresIn: "1h" }
    )

    // 2. Public Route: GET /api/subscription/plans
    const plansRes = await fetch(`${baseUrl}/api/subscription/plans`)
    runner.assert(plansRes.status === 200, "GET /api/subscription/plans returns HTTP 200 OK")

    const plansJson = await plansRes.json()
    runner.assert(plansJson.success === true, "Public response uses standard success envelope")
    runner.assert(Array.isArray(plansJson.data?.plans), "Plans endpoint returns an array of plans")
    runner.assert(plansJson.data.plans.length >= 4, "Plans array includes Free, Bronze, Silver, Gold")

    // 3. Unauthenticated Route Access: GET /api/subscription/me
    const unauthSubRes = await fetch(`${baseUrl}/api/subscription/me`)
    runner.assert(unauthSubRes.status === 401, "GET /api/subscription/me without token returns HTTP 401 Unauthorized")

    const unauthSubJson = await unauthSubRes.json()
    runner.assert(unauthSubJson.success === false, "Unauthorized response conforms to standard error envelope")

    // 4. Authenticated Customer Access: GET /api/subscription/me
    const authSubRes = await fetch(`${baseUrl}/api/subscription/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    runner.assert(authSubRes.status === 200, "GET /api/subscription/me with valid Bearer token returns HTTP 200 OK")

    const authSubJson = await authSubRes.json()
    runner.assert(authSubJson.success === true, "Authenticated subscription response returns success: true")
    runner.assert(authSubJson.data?.planKey === "silver", "Returns user's current subscription plan ('silver')")

    // 5. Unauthenticated Admin Route Access: GET /api/admin/subscription/analytics
    const unauthAdminRes = await fetch(`${baseUrl}/api/admin/subscription/analytics`)
    runner.assert(
      unauthAdminRes.status === 401,
      "GET /api/admin/subscription/analytics without token returns HTTP 401"
    )

    // 6. Role-Gated Admin Access: Non-Admin User Accessing Admin Route
    const forbiddenAdminRes = await fetch(`${baseUrl}/api/admin/subscription/analytics`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    runner.assert(
      forbiddenAdminRes.status === 403,
      "GET /api/admin/subscription/analytics with regular user token returns HTTP 403 Forbidden"
    )

    const forbiddenJson = await forbiddenAdminRes.json()
    runner.assert(forbiddenJson.success === false, "Forbidden response uses standard error envelope")

    // 7. Legitimate Admin Access: Admin User Accessing Admin Route
    const authorizedAdminRes = await fetch(`${baseUrl}/api/admin/subscription/analytics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    runner.assert(
      authorizedAdminRes.status === 200,
      "GET /api/admin/subscription/analytics with admin token returns HTTP 200 OK"
    )

    const adminJson = await authorizedAdminRes.json()
    runner.assert(adminJson.success === true, "Admin analytics response uses standard success envelope")

    // Cleanup
    await cleanTestFixtures({ userIds: testUserIds })
    if (server) {
      server.close()
    }
  } catch (err) {
    runner.assert(false, `Unexpected error in subscription API test: ${err.message}`)
    await cleanTestFixtures({ userIds: testUserIds })
    if (server) {
      server.close()
    }
  }

  return runner.summary()
}

if (process.argv[1]?.endsWith("subscriptionApi.test.js")) {
  runSubscriptionApiTest()
    .then((res) => {
      disconnectTestDb()
      process.exit(res.failed > 0 ? 1 : 0)
    })
    .catch(() => {
      disconnectTestDb()
      process.exit(1)
    })
}
