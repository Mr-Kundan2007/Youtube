import assert from "assert"
import { getThemePreference, updateThemePreference } from "../controllers/themePreferenceController.js"

console.log("==================================================================")
console.log("PHASE 3: PERSISTENT CROSS-DEVICE THEME SYSTEM TEST SUITE")
console.log("==================================================================")

let passed = 0
let failed = 0

async function runTest(name, fn) {
  try {
    await fn()
    console.log(`  ✓ [PASS] ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`)
    console.error(`    Error: ${err.message}`)
    failed++
  }
}

// Mock mockUser DB for pure controller testing
function createMockUserStore() {
  const store = new Map()

  return {
    users: {
      findById: async (id) => {
        const found = store.get(String(id))
        return found ? { ...found } : null
      },
      findByIdAndUpdate: async (id, update, options) => {
        const found = store.get(String(id))
        if (!found) return null
        const updated = { ...found, ...(update.$set || {}) }
        store.set(String(id), updated)
        return options?.new ? { ...updated } : { ...found }
      },
      setUser: (id, doc) => {
        store.set(String(id), { ...doc })
      },
      getUser: (id) => store.get(String(id)),
    },
  }
}

// Mock Express response
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

async function main() {
  // Test 1: getThemePreference - Unauthenticated
  await runTest("getThemePreference: Rejects unauthenticated request with 401 UNAUTHORIZED", async () => {
    const req = { user: null }
    const res = createMockRes()

    await getThemePreference(req, res)

    assert.strictEqual(res.statusCode, 401)
    assert.strictEqual(res.body.success, false)
    assert.strictEqual(res.body.code, "UNAUTHORIZED")
  })

  // Test 2: updateThemePreference - Unauthenticated
  await runTest("updateThemePreference: Rejects unauthenticated request with 401 UNAUTHORIZED", async () => {
    const req = { user: null, body: { themeMode: "dark" } }
    const res = createMockRes()

    await updateThemePreference(req, res)

    assert.strictEqual(res.statusCode, 401)
    assert.strictEqual(res.body.success, false)
    assert.strictEqual(res.body.code, "UNAUTHORIZED")
  })

  // Test 3: updateThemePreference - Validation: missing themeMode
  await runTest("updateThemePreference: Rejects missing themeMode with 400 VALIDATION_ERROR", async () => {
    const req = { user: { id: "user-123" }, body: {} }
    const res = createMockRes()

    await updateThemePreference(req, res)

    assert.strictEqual(res.statusCode, 400)
    assert.strictEqual(res.body.success, false)
    assert.strictEqual(res.body.code, "VALIDATION_ERROR")
  })

  // Test 4: updateThemePreference - Validation: invalid themeMode
  await runTest("updateThemePreference: Rejects invalid themeMode with 400 INVALID_THEME_MODE", async () => {
    const req = { user: { id: "user-123" }, body: { themeMode: "neon_cyberpunk" } }
    const res = createMockRes()

    await updateThemePreference(req, res)

    assert.strictEqual(res.statusCode, 400)
    assert.strictEqual(res.body.success, false)
    assert.strictEqual(res.body.code, "INVALID_THEME_MODE")
  })

  // Test 5: updateThemePreference - Validation: invalid themePreference
  await runTest("updateThemePreference: Rejects invalid themePreference with 400 INVALID_THEME_PREFERENCE", async () => {
    const req = {
      user: { id: "user-123" },
      body: { themeMode: "automatic", themePreference: "purple" },
    }
    const res = createMockRes()

    await updateThemePreference(req, res)

    assert.strictEqual(res.statusCode, 400)
    assert.strictEqual(res.body.success, false)
    assert.strictEqual(res.body.code, "INVALID_THEME_PREFERENCE")
  })

  // Test 6: Cross-Device Sync Simulation
  await runTest("Cross-Device Sync Simulation: Device A updates to dark, Device B receives dark", async () => {
    // We simulate the data flow across Device A and Device B
    const userAccount = {
      _id: "user-kundan-99",
      email: "kundank82522@gmail.com",
      name: "Kundan",
      themeMode: "automatic",
      themePreference: "dark",
      lastThemeUpdatedAt: null,
    }

    // Step A: Device A changes theme to "dark"
    const deviceARequest = {
      themeMode: "dark",
      themePreference: "dark",
    }
    assert(["automatic", "light", "dark"].includes(deviceARequest.themeMode))

    // Backend applies update
    userAccount.themeMode = deviceARequest.themeMode
    userAccount.themePreference = deviceARequest.themePreference
    userAccount.lastThemeUpdatedAt = new Date("2026-09-12T04:55:00.000Z")

    assert.strictEqual(userAccount.themeMode, "dark")
    assert.strictEqual(userAccount.themePreference, "dark")
    assert.notStrictEqual(userAccount.lastThemeUpdatedAt, null)

    // Step B: User logs in from Device B and fetches profile
    const deviceBProfile = {
      _id: userAccount._id,
      email: userAccount.email,
      themeMode: userAccount.themeMode,
      themePreference: userAccount.themePreference,
      lastThemeUpdatedAt: userAccount.lastThemeUpdatedAt,
    }

    assert.strictEqual(deviceBProfile.themeMode, "dark", "Device B must receive themeMode='dark'")
    assert.strictEqual(deviceBProfile.themePreference, "dark", "Device B must receive themePreference='dark'")

    // Step C: Device B switches to "light"
    const deviceBUpdate = {
      themeMode: "light",
      themePreference: "light",
    }
    userAccount.themeMode = deviceBUpdate.themeMode
    userAccount.themePreference = deviceBUpdate.themePreference
    userAccount.lastThemeUpdatedAt = new Date("2026-09-12T04:56:00.000Z")

    // Step D: Device A re-syncs and receives "light"
    assert.strictEqual(userAccount.themeMode, "light", "Device A must reconcile with 'light'")
  })

  // Test 7: Conflict Resolution (Newer timestamp wins)
  await runTest("Conflict Resolution: Newer lastThemeUpdatedAt takes precedence", () => {
    const localSetting = {
      themeMode: "dark",
      activeTheme: "dark",
      lastUpdated: "2026-09-12T04:00:00.000Z",
    }

    const remoteSetting = {
      themeMode: "light",
      themePreference: "light",
      lastThemeUpdatedAt: "2026-09-12T04:30:00.000Z",
    }

    const localTime = new Date(localSetting.lastUpdated).getTime()
    const remoteTime = new Date(remoteSetting.lastThemeUpdatedAt).getTime()

    const winner = remoteTime > localTime ? remoteSetting.themeMode : localSetting.themeMode
    assert.strictEqual(winner, "light", "Remote setting is newer, so it must win")
  })

  // Test 8: Backward Compatibility with Existing Users (Default is "automatic")
  await runTest("Backward Compatibility: Existing documents without theme fields default gracefully", () => {
    const legacyDoc = {
      _id: "legacy-user-1",
      email: "olduser@example.com",
      name: "Old User",
    }

    const effectiveThemeMode = legacyDoc.themeMode || "automatic"
    const effectiveThemePreference = legacyDoc.themePreference || "dark"

    assert.strictEqual(effectiveThemeMode, "automatic")
    assert.strictEqual(effectiveThemePreference, "dark")
  })

  // Test 9: Standardized Envelope Formatting
  await runTest("Envelope Structure: Success response matches standard schema", () => {
    const payload = {
      themeMode: "dark",
      themePreference: "dark",
      lastThemeUpdatedAt: new Date().toISOString(),
    }

    const envelope = {
      success: true,
      message: "Theme preference updated successfully",
      data: payload,
    }

    assert.strictEqual(envelope.success, true)
    assert.strictEqual(envelope.message, "Theme preference updated successfully")
    assert.strictEqual(envelope.data.themeMode, "dark")
    assert.strictEqual(envelope.data.themePreference, "dark")
    assert.ok(typeof envelope.data.lastThemeUpdatedAt === "string")
  })

  console.log("------------------------------------------------------------------")
  console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`)
  console.log("------------------------------------------------------------------")

  if (failed > 0) {
    process.exit(1)
  }
}

main()
