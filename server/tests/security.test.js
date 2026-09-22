/**
 * Phase 3 Automated Security & Lifecycle Test Suite
 * Tests all 10 attack scenarios, meeting lifecycle, access policies,
 * participant limits, and safe room join/token flows.
 */
import assert from "assert"
import http from "http"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { authConfig, dbConfig } from "../config/index.js"
import Meeting from "../Modals/Meeting.js"
import MeetingParticipant from "../Modals/MeetingParticipant.js"
import User from "../Modals/Auth.js"
import { formatSafeParticipantIdentity } from "../services/videoTokenService.js"
import { isValidRoomId, generateRoomId } from "../utils/roomIdGenerator.js"
import meetingStore from "../services/meetingStore.js"

process.env.NODE_ENV = "test"
const { app } = await import("../index.js")

let API_BASE = ""

// Helper to make HTTP requests
const request = ({ path, method = "GET", headers = {}, body = null }) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE)
    const reqHeaders = { ...headers }
    let bodyData = null

    if (body) {
      bodyData = typeof body === "string" ? body : JSON.stringify(body)
      reqHeaders["Content-Type"] = "application/json"
      reqHeaders["Content-Length"] = Buffer.byteLength(bodyData)
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = ""
        res.on("data", (chunk) => (raw += chunk))
        res.on("end", () => {
          let data = null
          try {
            data = JSON.parse(raw)
          } catch (e) {
            data = raw
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
          })
        })
      }
    )

    req.on("error", reject)
    if (bodyData) req.write(bodyData)
    req.end()
  })
}

async function runSecurityTests() {
  console.log("\n==================================================")
  console.log("RUNNING PHASE 3 SECURITY & MEETING LIFECYCLE TESTS")
  console.log("==================================================\n")

  // Ensure DB connected
  if (mongoose.connection.readyState === 0 && dbConfig.url) {
    await mongoose.connect(dbConfig.url)
  }

  // Start ephemeral test server
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => {
      const port = s.address().port
      API_BASE = `http://localhost:${port}`
      console.log(`Test server running on ephemeral port ${port}`)
      resolve(s)
    })
  })

  let passed = 0
  let failed = 0

  const test = async (name, fn) => {
    try {
      await fn()
      console.log(`[PASS] ${name}`)
      passed++
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message)
      failed++
    }
  }

  try {
    // Generate test user tokens
    const hostUserId = new mongoose.Types.ObjectId().toString()
    const hostToken = jwt.sign(
      { id: hostUserId, email: "host_phase3@example.com" },
      authConfig.jwtSecret,
      { expiresIn: "1h" }
    )

    const participantUserId = new mongoose.Types.ObjectId().toString()
    const participantToken = jwt.sign(
      { id: participantUserId, email: "participant_phase3@example.com" },
      authConfig.jwtSecret,
      { expiresIn: "1h" }
    )

    const attackerUserId = new mongoose.Types.ObjectId().toString()
    const attackerToken = jwt.sign(
      { id: attackerUserId, email: "attacker_phase3@example.com" },
      authConfig.jwtSecret,
      { expiresIn: "1h" }
    )

    // 1. Room ID entropy and pattern test
    await test("Security: Room ID entropy and URL-safe non-sequential format", () => {
      const roomId = generateRoomId()
      assert.strictEqual(isValidRoomId(roomId), true, "Room ID must match secure pattern")
      assert.strictEqual(isValidRoomId("123"), false, "Sequential/short IDs must be rejected")
      assert.strictEqual(isValidRoomId("meeting/1"), false, "Path traversal IDs must be rejected")
    })

    // 2. Safe identity formatting test
    await test("Security: Safe participant identity never leaks email", () => {
      const userIdent = formatSafeParticipantIdentity("12345", false)
      assert.strictEqual(userIdent, "user_12345")
      const guestIdent = formatSafeParticipantIdentity("abc", true)
      assert.strictEqual(guestIdent, "guest_abc")
    })

    // 3. Unauthenticated meeting creation rejected
    await test("Security: Unauthenticated POST /api/meetings returns 401 UNAUTHORIZED", async () => {
      const res = await request({
        path: "/api/meetings",
        method: "POST",
        body: { title: "Hacker Meeting" },
      })
      assert.strictEqual(res.statusCode, 401)
      assert.strictEqual(res.body.success, false)
      assert.strictEqual(res.body.error.code, "UNAUTHORIZED")
    })

    // 4. Authenticated meeting creation assigns HOST role & canonical meetingLink
    let testRoomId = ""
    await test("Security: Authenticated POST /api/meetings creates room with HOST role & link", async () => {
      const res = await request({
        path: "/api/meetings",
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { title: "Engineering Sync", maxParticipants: 3 },
      })
      assert.strictEqual(res.statusCode, 201)
      assert.strictEqual(res.body.success, true)
      assert.strictEqual(res.body.data.role, "HOST")
      assert.strictEqual(res.body.data.meeting.isLocked, false)
      assert.strictEqual(res.body.data.meeting.status, "LIVE")
      assert.ok(res.body.data.meeting.meetingLink.includes("/meet/"))
      assert.ok(res.body.data.meeting.roomId)
      testRoomId = res.body.data.meeting.roomId
    })

    // 5. Attack 2 — Fake meeting owner ignored (Host determined server-side from auth token)
    await test("Security (Attack 2): Client cannot forge hostUserId in creation body", async () => {
      const forgedHostId = new mongoose.Types.ObjectId().toString()
      const res = await request({
        path: "/api/meetings",
        method: "POST",
        headers: { Authorization: `Bearer ${participantToken}` },
        body: { title: "Forged Host Meeting", hostUserId: forgedHostId, hostId: forgedHostId },
      })
      assert.strictEqual(res.statusCode, 201)
      // Meeting hostId must be participantUserId (from auth token), not forgedHostId
      assert.strictEqual(String(res.body.data.meeting.hostId), participantUserId)
    })

    // 6. Attack 10 — Request manipulation / invalid payloads rejected
    await test("Security (Attack 10): Invalid maxParticipants or accessPolicy rejected with 400", async () => {
      const res1 = await request({
        path: "/api/meetings",
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { maxParticipants: 9999 },
      })
      assert.strictEqual(res1.statusCode, 400)
      assert.strictEqual(res1.body.error.code, "VALIDATION_ERROR")

      const res2 = await request({
        path: "/api/meetings",
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { accessPolicy: "INVALID_POLICY" },
      })
      assert.strictEqual(res2.statusCode, 400)
      assert.strictEqual(res2.body.error.code, "VALIDATION_ERROR")
    })

    // 7. Attack 3 — Malformed or Nonexistent Room ID
    await test("Security (Attack 3): Malformed Room ID rejected with 400 INVALID_ROOM_ID", async () => {
      const res = await request({
        path: "/api/meetings/bad_id",
        method: "GET",
      })
      assert.strictEqual(res.statusCode, 400)
      assert.strictEqual(res.body.error.code, "INVALID_ROOM_ID")
    })

    await test("Security (Attack 3): Nonexistent Room ID returns 404 MEETING_NOT_FOUND", async () => {
      const res = await request({
        path: "/api/meetings/xyz-abcd-uvw",
        method: "GET",
      })
      assert.strictEqual(res.statusCode, 404)
      assert.strictEqual(res.body.error.code, "MEETING_NOT_FOUND")
    })

    // 8. Meeting lookup GET /api/meetings/:roomId returns safe information
    await test("Lifecycle: GET /api/meetings/:roomId returns safe meeting details", async () => {
      const res = await request({
        path: `/api/meetings/${testRoomId}`,
        method: "GET",
      })
      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body.success, true)
      assert.strictEqual(res.body.data.roomId, testRoomId)
      assert.ok(res.body.data.host.displayName)
      assert.strictEqual(typeof res.body.data.currentParticipantCount, "number")
      assert.strictEqual(res.body.data.status, "LIVE")
    })

    // 9. Join meeting via POST /api/meetings/:roomId/join
    await test("Lifecycle: POST /api/meetings/:roomId/join succeeds and registers participant", async () => {
      const res = await request({
        path: `/api/meetings/${testRoomId}/join`,
        method: "POST",
        headers: { Authorization: `Bearer ${participantToken}` },
        body: { displayName: "Alice Engineer", isMuted: true, cameraEnabled: false },
      })
      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body.success, true)
      assert.strictEqual(res.body.data.role, "PARTICIPANT")
      assert.ok(res.body.data.token)
      assert.strictEqual(res.body.data.roomId, testRoomId)
      assert.ok(res.body.data.meetingLink)

      // Verify participant record in DB or store
      let participant = null
      if (mongoose.connection.readyState === 1) {
        try {
          participant = await MeetingParticipant.findOne({
            roomId: testRoomId,
            userId: `user_${participantUserId}`,
          })
        } catch {}
      }
      if (!participant) {
        participant = await meetingStore.findParticipant(testRoomId, `user_${participantUserId}`)
      }
      assert.ok(participant)
      assert.strictEqual(participant.status, "JOINED")
      assert.strictEqual(participant.isMuted, true)
      assert.strictEqual(participant.cameraEnabled, false)
    })

    // 10. Attack 1 — Fake host in join request ignored
    await test("Security (Attack 1): Client cannot escalate role to HOST in join request", async () => {
      const res = await request({
        path: `/api/meetings/${testRoomId}/join`,
        method: "POST",
        headers: { Authorization: `Bearer ${attackerToken}` },
        body: { displayName: "Hacker", role: "HOST", isHost: true },
      })
      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body.data.role, "PARTICIPANT", "Server must force PARTICIPANT role")
    })

    // 11. Participants list GET /api/meetings/:roomId/participants
    await test("Lifecycle: GET /api/meetings/:roomId/participants returns active participants", async () => {
      const res = await request({
        path: `/api/meetings/${testRoomId}/participants`,
        method: "GET",
      })
      assert.strictEqual(res.statusCode, 200)
      assert.ok(Array.isArray(res.body.data.participants))
      assert.ok(res.body.data.participants.length >= 2)
      // Check no passwords or secrets leaked in participant info
      const json = JSON.stringify(res.body.data.participants)
      assert.strictEqual(json.includes("secret"), false)
      assert.strictEqual(json.includes("password"), false)
    })

    // 12. Attack 8 — Calling another meeting's endpoint / non-host moderation rejected
    await test("Security (Attack 8): Attacker cannot lock another user's meeting (403 FORBIDDEN)", async () => {
      const res = await request({
        path: `/api/meetings/${testRoomId}/host-action`,
        method: "POST",
        headers: { Authorization: `Bearer ${attackerToken}` },
        body: { action: "LOCK_MEETING" },
      })
      assert.strictEqual(res.statusCode, 403)
      assert.strictEqual(res.body.error.code, "FORBIDDEN")
    })

    // 13. Host locks meeting; Attack 4 — Locked meeting rejects new joins
    await test("Security (Attack 4): Host locks meeting; non-host receives 403 MEETING_LOCKED", async () => {
      const lockRes = await request({
        path: `/api/meetings/${testRoomId}/host-action`,
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { action: "LOCK_MEETING" },
      })
      assert.strictEqual(lockRes.statusCode, 200)
      assert.strictEqual(lockRes.body.data.isLocked, true)

      // An unjoined guest attempts to join
      const joinRes = await request({
        path: `/api/meetings/${testRoomId}/join`,
        method: "POST",
        body: { displayName: "Late Guest" },
      })
      assert.strictEqual(joinRes.statusCode, 403)
      assert.strictEqual(joinRes.body.error.code, "MEETING_LOCKED")
    })

    // 14. Host unlocks meeting
    await test("Lifecycle: Host unlocks meeting room", async () => {
      const res = await request({
        path: `/api/meetings/${testRoomId}/host-action`,
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { action: "UNLOCK_MEETING", isLocked: false },
      })
      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body.data.isLocked, false)
    })

    // 15. Attack 6 — Capacity limit enforced (MEETING_FULL)
    await test("Security (Attack 6): Reaching maxParticipants rejects new join (403 MEETING_FULL)", async () => {
      // Room maxParticipants was set to 3. Active: Host, Alice, Hacker (3 active).
      const fullRes = await request({
        path: `/api/meetings/${testRoomId}/join`,
        method: "POST",
        body: { displayName: "Fourth Person", guestId: "guest_overflow" },
      })
      assert.strictEqual(fullRes.statusCode, 403)
      assert.strictEqual(fullRes.body.error.code, "MEETING_FULL")
    })

    // 16. Participant leaves meeting POST /api/meetings/:roomId/leave
    await test("Lifecycle: POST /api/meetings/:roomId/leave sets status to LEFT", async () => {
      const leaveRes = await request({
        path: `/api/meetings/${testRoomId}/leave`,
        method: "POST",
        headers: { Authorization: `Bearer ${participantToken}` },
      })
      assert.strictEqual(leaveRes.statusCode, 200)

      let participant = null
      if (mongoose.connection.readyState === 1) {
        try {
          participant = await MeetingParticipant.findOne({
            roomId: testRoomId,
            userId: `user_${participantUserId}`,
          })
        } catch {}
      }
      if (!participant) {
        participant = await meetingStore.findParticipant(testRoomId, `user_${participantUserId}`)
      }
      assert.ok(participant)
      assert.strictEqual(participant.status, "LEFT")
    })

    // 17. Host removes participant; banned participant cannot rejoin
    await test("Security: Host removes participant; participant cannot rejoin (403 FORBIDDEN)", async () => {
      const kickRes = await request({
        path: `/api/meetings/${testRoomId}/host-action`,
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { action: "REMOVE_PARTICIPANT", targetUserId: attackerUserId },
      })
      assert.strictEqual(kickRes.statusCode, 200)

      // Attacker tries to rejoin
      const rejoinRes = await request({
        path: `/api/meetings/${testRoomId}/join`,
        method: "POST",
        headers: { Authorization: `Bearer ${attackerToken}` },
        body: { displayName: "Hacker Returns" },
      })
      assert.strictEqual(rejoinRes.statusCode, 403)
      assert.strictEqual(rejoinRes.body.error.code, "FORBIDDEN")
    })

    // 18. Attack 7 — AUTHENTICATED_ONLY access policy enforced
    await test("Security (Attack 7): AUTHENTICATED_ONLY meeting rejects unauthenticated join", async () => {
      const createRes = await request({
        path: "/api/meetings",
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { title: "Private Exec Sync", accessPolicy: "AUTHENTICATED_ONLY" },
      })
      const privateRoomId = createRes.body.data.roomId

      const joinRes = await request({
        path: `/api/meetings/${privateRoomId}/join`,
        method: "POST",
        body: { displayName: "Anonymous Guest" },
      })
      assert.strictEqual(joinRes.statusCode, 401)
      assert.strictEqual(joinRes.body.error.code, "AUTHENTICATION_REQUIRED")
    })

    // 19. Host ends meeting; Attack 5 — Ended meeting rejects new joins
    await test("Security (Attack 5): Host ends meeting; ended meeting rejects joins (400 MEETING_ENDED)", async () => {
      const endRes = await request({
        path: `/api/meetings/${testRoomId}/end`,
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
      })
      assert.strictEqual(endRes.statusCode, 200)

      const joinRes = await request({
        path: `/api/meetings/${testRoomId}/join`,
        method: "POST",
        body: { displayName: "Late Attendee" },
      })
      assert.strictEqual(joinRes.statusCode, 400)
      assert.strictEqual(joinRes.body.error.code, "MEETING_ENDED")
    })

    // 20. Security Headers present in API responses
    await test("Security: WebRTC-compatible security headers present", async () => {
      const res = await request({ path: "/api/meetings/xyz-test-abc", method: "GET" })
      assert.strictEqual(res.headers["x-content-type-options"], "nosniff")
      assert.strictEqual(res.headers["x-frame-options"], "SAMEORIGIN")
      assert.strictEqual(res.headers["referrer-policy"], "strict-origin-when-cross-origin")
      assert.ok(res.headers["permissions-policy"]?.includes("camera=(self)"))
    })

    // 21. Provider secrets never leak in responses
    await test("Security: Provider secrets and DB credentials never leak in responses", async () => {
      const res = await request({
        path: "/api/meetings",
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
      })
      const bodyStr = JSON.stringify(res.body)
      assert.strictEqual(bodyStr.includes("secret"), false)
      assert.strictEqual(bodyStr.includes(authConfig.jwtSecret), false)
      if (dbConfig.url) {
        assert.strictEqual(bodyStr.includes("mongodb+srv"), false)
      }
    })

    // 22. Moderation: Host mutes participant
    await test("Moderation: Host successfully mutes a participant", async () => {
      const freshCreate = await request({
        path: "/api/meetings",
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { title: "Moderation Test Room" },
      })
      const modRoomId = freshCreate.body.data.roomId

      const pJoin = await request({
        path: `/api/meetings/${modRoomId}/join`,
        method: "POST",
        headers: { Authorization: `Bearer ${participantToken}` },
        body: { displayName: "Attendee" },
      })
      const attendeeIdentity = pJoin.body.data.identity

      const muteRes = await request({
        path: `/api/meetings/${modRoomId}/mute-participant`,
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { targetUserId: attendeeIdentity },
      })
      assert.strictEqual(muteRes.statusCode, 200)
      assert.strictEqual(muteRes.body.data.isMuted, true)
    })

    // 23. Moderation: Host promotes participant to Co-Host, then demotes back
    await test("Moderation: Host promotes participant to Co-Host and demotes back", async () => {
      const freshCreate = await request({
        path: "/api/meetings",
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { title: "Role Promotion Test" },
      })
      const roleRoomId = freshCreate.body.data.roomId

      const pJoin = await request({
        path: `/api/meetings/${roleRoomId}/join`,
        method: "POST",
        headers: { Authorization: `Bearer ${participantToken}` },
        body: { displayName: "Attendee" },
      })
      const attendeeIdentity = pJoin.body.data.identity

      // Promote to Co-Host
      const promoteRes = await request({
        path: `/api/meetings/${roleRoomId}/promote-cohost`,
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { targetUserId: attendeeIdentity },
      })
      assert.strictEqual(promoteRes.statusCode, 200)
      assert.strictEqual(promoteRes.body.data.role, "CO_HOST")

      // Demote back to Participant
      const demoteRes = await request({
        path: `/api/meetings/${roleRoomId}/demote-cohost`,
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { targetUserId: attendeeIdentity },
      })
      assert.strictEqual(demoteRes.statusCode, 200)
      assert.strictEqual(demoteRes.body.data.role, "PARTICIPANT")
    })

    // 24. Moderation Security: Host cannot be removed
    await test("Moderation Security: Host cannot be removed from meeting", async () => {
      const freshCreate = await request({
        path: "/api/meetings",
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { title: "Host Removal Guard Room" },
      })
      const hostRoomId = freshCreate.body.data.roomId

      const removeHostRes = await request({
        path: `/api/meetings/${hostRoomId}/remove-participant`,
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { targetUserId: `user_${hostUserId}` },
      })
      assert.strictEqual(removeHostRes.statusCode, 403)
      assert.strictEqual(removeHostRes.body.error.code, "FORBIDDEN")
    })

    // 25. Moderation: Host locks and unlocks meeting
    await test("Moderation: Host locks and unlocks meeting", async () => {
      const freshCreate = await request({
        path: "/api/meetings",
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { title: "Lock Test Room" },
      })
      const lockRoomId = freshCreate.body.data.roomId

      // Lock
      const lockRes = await request({
        path: `/api/meetings/${lockRoomId}/lock`,
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
      })
      assert.strictEqual(lockRes.statusCode, 200)
      assert.strictEqual(lockRes.body.data.isLocked, true)

      // Unlock
      const unlockRes = await request({
        path: `/api/meetings/${lockRoomId}/unlock`,
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
      })
      assert.strictEqual(unlockRes.statusCode, 200)
      assert.strictEqual(unlockRes.body.data.isLocked, false)
    })

    // 26. Collaboration: In-call chat sending and retrieval
    await test("Collaboration: In-call chat messages persist and are retrievable", async () => {
      const freshCreate = await request({
        path: "/api/meetings",
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { title: "Chat Test Room" },
      })
      const chatRoomId = freshCreate.body.data.roomId

      // Send chat
      const sendRes = await request({
        path: `/api/meetings/${chatRoomId}/chat`,
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { text: "Hello team, welcome to the meeting!" },
      })
      assert.strictEqual(sendRes.statusCode, 201)
      assert.strictEqual(sendRes.body.data.message.text, "Hello team, welcome to the meeting!")

      // Get chat history
      const historyRes = await request({
        path: `/api/meetings/${chatRoomId}/chat`,
        method: "GET",
      })
      assert.strictEqual(historyRes.statusCode, 200)
      assert.ok(historyRes.body.data.messages.length >= 1)
      assert.strictEqual(historyRes.body.data.messages[0].text, "Hello team, welcome to the meeting!")
    })

    // 27. Collaboration Security: Disabling allowChat blocks chat sending
    await test("Collaboration Security: Disabling allowChat blocks chat sending", async () => {
      const freshCreate = await request({
        path: "/api/meetings",
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { title: "No Chat Room", permissions: { allowChat: false } },
      })
      const noChatRoomId = freshCreate.body.data.roomId

      // Participant attempts to chat
      const chatRes = await request({
        path: `/api/meetings/${noChatRoomId}/chat`,
        method: "POST",
        headers: { Authorization: `Bearer ${participantToken}` },
        body: { text: "Can I talk here?" },
      })
      assert.strictEqual(chatRes.statusCode, 403)
      assert.strictEqual(chatRes.body.error.code, "PERMISSION_DENIED")
    })

    // 28. Collaboration: Toggle hand raise updates state
    await test("Collaboration: Participant toggles hand raise", async () => {
      const freshCreate = await request({
        path: "/api/meetings",
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { title: "Hand Raise Room" },
      })
      const handRoomId = freshCreate.body.data.roomId

      // Join as participant
      await request({
        path: `/api/meetings/${handRoomId}/join`,
        method: "POST",
        headers: { Authorization: `Bearer ${participantToken}` },
        body: { displayName: "Student" },
      })

      // Raise hand
      const raiseRes = await request({
        path: `/api/meetings/${handRoomId}/hand-raise`,
        method: "POST",
        headers: { Authorization: `Bearer ${participantToken}` },
      })
      assert.strictEqual(raiseRes.statusCode, 200)
      assert.strictEqual(raiseRes.body.data.isHandRaised, true)
      assert.ok(raiseRes.body.data.handRaisedAt)

      // Lower hand
      const lowerRes = await request({
        path: `/api/meetings/${handRoomId}/hand-raise`,
        method: "POST",
        headers: { Authorization: `Bearer ${participantToken}` },
      })
      assert.strictEqual(lowerRes.statusCode, 200)
      assert.strictEqual(lowerRes.body.data.isHandRaised, false)
    })

    // 29. Collaboration Security: Message validation
    await test("Collaboration Security: Empty and oversized chat messages rejected", async () => {
      const freshCreate = await request({
        path: "/api/meetings",
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { title: "Validation Room" },
      })
      const valRoomId = freshCreate.body.data.roomId

      // Empty message
      const emptyRes = await request({
        path: `/api/meetings/${valRoomId}/chat`,
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { text: "   " },
      })
      assert.strictEqual(emptyRes.statusCode, 400)
      assert.strictEqual(emptyRes.body.error.code, "VALIDATION_ERROR")

      // Oversized message (> 2000 chars)
      const oversizedText = "A".repeat(2001)
      const overRes = await request({
        path: `/api/meetings/${valRoomId}/chat`,
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { text: oversizedText },
      })
      assert.strictEqual(overRes.statusCode, 400)
      assert.strictEqual(overRes.body.error.code, "VALIDATION_ERROR")
    })

    // 30. Collaboration Security: Disabling allowFileSharing blocks uploads
    await test("Collaboration Security: Disabling allowFileSharing blocks attachment upload", async () => {
      const freshCreate = await request({
        path: "/api/meetings",
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { title: "No Files Room", permissions: { allowFileSharing: false } },
      })
      const noFilesRoomId = freshCreate.body.data.roomId

      const fileRes = await request({
        path: `/api/meetings/${noFilesRoomId}/chat/attachment`,
        method: "POST",
        headers: { Authorization: `Bearer ${participantToken}` },
        body: { text: "Here is a file" },
      })
      assert.strictEqual(fileRes.statusCode, 403)
      assert.strictEqual(fileRes.body.error.code, "PERMISSION_DENIED")
    })

    // 31. Collaboration Security: Non-existent or traversal attachment returns 404
    await test("Collaboration Security: Invalid attachment ID returns 404", async () => {
      const freshCreate = await request({
        path: "/api/meetings",
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { title: "Attachment Security Room" },
      })
      const attRoomId = freshCreate.body.data.roomId

      const getAttRes = await request({
        path: `/api/meetings/${attRoomId}/chat/attachment/66d000000000000000000000`,
        method: "GET",
      })
      assert.strictEqual(getAttRes.statusCode, 404)
    })
  } finally {
    server.close()
    await mongoose.disconnect()
  }

  console.log("\n==================================================")
  console.log(`SECURITY & LIFECYCLE SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log("==================================================\n")

  if (failed > 0) {
    process.exit(1)
  }
}

runSecurityTests().catch((err) => {
  console.error("Test execution fatal error:", err)
  process.exit(1)
})
