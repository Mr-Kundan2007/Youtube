/**
 * Phase 9: Video Call Recording & Recording Security Automated Test Suite
 * Tests role permissions (Host vs Participant), start/stop lifecycle,
 * multipart upload validation, private storage, HMAC-SHA256 signed access tokens,
 * HTTP 206 Partial Content Range streaming, Content-Disposition downloads,
 * and secure file deletion.
 */
import assert from "assert"
import http from "http"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import fs from "fs"
import path from "path"
import { authConfig, dbConfig, recordingConfig } from "../config/index.js"
import Meeting from "../Modals/Meeting.js"
import MeetingRecording from "../Modals/MeetingRecording.js"
import User from "../Modals/Auth.js"
import { recordingStorageService } from "../services/recordingStorageService.js"

process.env.NODE_ENV = "test"
const { app } = await import("../index.js")

let API_BASE = ""

// Helper to make HTTP requests
const makeRequest = ({ path, method = "GET", headers = {}, body = null }) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE)
    const reqHeaders = { ...headers }
    let bodyData = null

    if (body) {
      if (Buffer.isBuffer(body) || typeof body === "string") {
        bodyData = body
        if (!reqHeaders["Content-Length"]) {
          reqHeaders["Content-Length"] = Buffer.byteLength(bodyData)
        }
      } else {
        bodyData = JSON.stringify(body)
        reqHeaders["Content-Type"] = "application/json"
        reqHeaders["Content-Length"] = Buffer.byteLength(bodyData)
      }
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        const chunks = []
        res.on("data", (chunk) => chunks.push(chunk))
        res.on("end", () => {
          const rawBuffer = Buffer.concat(chunks)
          const raw = rawBuffer.toString("utf8")
          let data = null
          try {
            data = JSON.parse(raw)
          } catch (e) {
            data = raw
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data,
            rawBuffer,
          })
        })
      }
    )

    req.on("error", reject)
    if (bodyData) {
      req.write(bodyData)
    }
    req.end()
  })
}

// Multipart helper for file upload
const makeMultipartUpload = ({ path, token, fields = {}, file = null }) => {
  const boundary = `----WebKitFormBoundary${Date.now().toString(36)}`
  const chunks = []

  // Add text fields
  for (const [key, val] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`))
  }

  // Add file
  if (file) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`
      )
    )
    chunks.push(file.buffer)
    chunks.push(Buffer.from("\r\n"))
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`))
  const body = Buffer.concat(chunks)

  const headers = {
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
    "Content-Length": body.length,
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  return makeRequest({
    path,
    method: "POST",
    headers,
    body,
  })
}

const JWT_SECRET = authConfig.jwtSecret || "thisisayoutubeclonesecretkey"

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: "1h" }
  )
}

let serverInstance
let hostUser
let participantUser
let hostToken
let participantToken
let testMeeting
let createdRecordingId

async function setup() {
  console.log("\n==================================================")
  console.log("STARTING PHASE 9: VIDEO RECORDING & SECURITY TESTS")
  console.log("==================================================\n")

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(dbConfig.url)
  }

  // Start test server on random port
  const server = http.createServer(app)
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port
      API_BASE = `http://127.0.0.1:${port}`
      serverInstance = server
      resolve()
    })
  })

  // Clean up previous test artifacts
  await User.deleteMany({ email: /recording_phase9_/ })
  await Meeting.deleteMany({ roomId: /^rec-p9-/ })
  await MeetingRecording.deleteMany({ roomId: /^rec-p9-/ })

  hostUser = await User.create({
    name: "Recording Host",
    channelname: "HostStudio",
    email: `recording_phase9_host_${Date.now()}@example.com`,
  })

  participantUser = await User.create({
    name: "Meeting Attendee",
    channelname: "AttendeeStudio",
    email: `recording_phase9_peer_${Date.now()}@example.com`,
  })

  hostToken = generateToken(hostUser)
  participantToken = generateToken(participantUser)

  testMeeting = await Meeting.create({
    roomId: `rec-p9-${Date.now().toString(36)}`,
    title: "Phase 9 Architecture Review",
    hostId: hostUser._id,
    hostName: hostUser.name,
    status: "LIVE",
    accessPolicy: "LINK_ACCESS",
    permissions: {
      allowRecording: false,
    },
  })
}

async function teardown() {
  if (testMeeting) {
    await Meeting.deleteOne({ _id: testMeeting._id })
    const recs = await MeetingRecording.find({ roomId: testMeeting.roomId })
    for (const r of recs) {
      try {
        await recordingStorageService.deleteFile(r.storagePath)
      } catch {}
    }
    await MeetingRecording.deleteMany({ roomId: testMeeting.roomId })
  }
  if (hostUser) await User.deleteOne({ _id: hostUser._id })
  if (participantUser) await User.deleteOne({ _id: participantUser._id })

  if (serverInstance) {
    await new Promise((res) => serverInstance.close(res))
  }
  await mongoose.disconnect()
}

let passedTests = 0
let failedTests = 0

function logPass(name) {
  passedTests++
  console.log(`[PASS] ${name}`)
}

function logFail(name, err) {
  failedTests++
  console.error(`[FAIL] ${name}:`, err)
}

async function runTests() {
  await setup()

  try {
    // 1. Unauthenticated start recording
    try {
      const res = await makeRequest({
        path: `/api/meetings/${testMeeting.roomId}/recordings/start`,
        method: "POST",
      })
      assert.strictEqual(res.status, 401)
      logPass("Unauthenticated request to start recording is rejected (401)")
    } catch (e) {
      logFail("Unauthenticated request to start recording", e)
    }

    // 2. Participant attempts start recording
    try {
      const res = await makeRequest({
        path: `/api/meetings/${testMeeting.roomId}/recordings/start`,
        method: "POST",
        headers: { Authorization: `Bearer ${participantToken}` },
      })
      assert.strictEqual(res.status, 403)
      logPass("Participant forbidden from starting recording (403)")
    } catch (e) {
      logFail("Participant forbidden from starting recording", e)
    }

    // 3. Host starts recording
    try {
      const res = await makeRequest({
        path: `/api/meetings/${testMeeting.roomId}/recordings/start`,
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
      })
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.data.success, true)
      assert.strictEqual(res.data.data.status, "recording")
      assert.ok(res.data.data.startedAt)

      const meetingInDb = await Meeting.findById(testMeeting._id)
      assert.strictEqual(meetingInDb.recording.status, "recording")
      logPass("Host starts meeting recording successfully (200)")
    } catch (e) {
      logFail("Host starts meeting recording", e)
    }

    // 4. Participant cannot stop recording
    try {
      const res = await makeRequest({
        path: `/api/meetings/${testMeeting.roomId}/recordings/stop`,
        method: "POST",
        headers: { Authorization: `Bearer ${participantToken}` },
      })
      assert.strictEqual(res.status, 403)
      logPass("Participant cannot stop recording (403)")
    } catch (e) {
      logFail("Participant cannot stop recording", e)
    }

    // 5. Host stops recording
    try {
      const res = await makeRequest({
        path: `/api/meetings/${testMeeting.roomId}/recordings/stop`,
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
      })
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.data.data.status, "processing")

      const meetingInDb = await Meeting.findById(testMeeting._id)
      assert.strictEqual(meetingInDb.recording.status, "processing")
      logPass("Host stops recording successfully (200)")
    } catch (e) {
      logFail("Host stops recording", e)
    }

    // 6. Upload without file
    try {
      const res = await makeMultipartUpload({
        path: `/api/meetings/${testMeeting.roomId}/recordings/upload`,
        token: hostToken,
        fields: { duration: 60 },
      })
      assert.strictEqual(res.status, 400)
      logPass("Upload rejected when no file attached (400)")
    } catch (e) {
      logFail("Upload rejected when no file attached", e)
    }

    // 7. Host uploads valid recording
    try {
      const sampleWebM = Buffer.from(
        "1a45dfa3010000000000001f4286810142f7810142f2810442f381084282847765626d80",
        "hex"
      )
      const res = await makeMultipartUpload({
        path: `/api/meetings/${testMeeting.roomId}/recordings/upload`,
        token: hostToken,
        fields: {
          title: "Sprint Retrospective Recording",
          duration: "125",
          resolution: "1280x720",
        },
        file: {
          fieldname: "recording",
          filename: "meeting-recording.webm",
          contentType: "video/webm",
          buffer: sampleWebM,
        },
      })

      assert.strictEqual(res.status, 201)
      assert.strictEqual(res.data.success, true)
      assert.ok(res.data.data.recording.recordingId)
      assert.strictEqual(res.data.data.recording.duration, 125)
      assert.strictEqual(res.data.data.recording.status, "READY")

      createdRecordingId = res.data.data.recording.recordingId
      const inDb = await MeetingRecording.findById(createdRecordingId)
      assert.ok(inDb)
      assert.strictEqual(fs.existsSync(inDb.storagePath), true)
      logPass("Host uploads recording, validates MIME and persists to private storage (201)")
    } catch (e) {
      logFail("Host uploads recording", e)
    }

    // 8. List recordings
    try {
      const res = await makeRequest({
        path: `/api/meetings/${testMeeting.roomId}/recordings`,
        headers: { Authorization: `Bearer ${hostToken}` },
      })
      assert.strictEqual(res.status, 200)
      assert.ok(Array.isArray(res.data.data.recordings))
      assert.ok(res.data.data.recordings.length >= 1)
      assert.strictEqual(res.data.data.recordings[0].recordingId, createdRecordingId.toString())
      logPass("Meeting recordings listed with metadata (200)")
    } catch (e) {
      logFail("Meeting recordings listed", e)
    }

    // 9. Get recording metadata
    try {
      const res = await makeRequest({
        path: `/api/recordings/${createdRecordingId}`,
      })
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.data.data.recording.recordingId, createdRecordingId.toString())
      assert.strictEqual(res.data.data.recording.title, "Sprint Retrospective Recording")
      logPass("Recording metadata retrieved by recordingId (200)")
    } catch (e) {
      logFail("Recording metadata retrieved", e)
    }

    // 10. Generate short-lived signed access token
    let signedStreamToken = ""
    try {
      const res = await makeRequest({
        path: `/api/recordings/${createdRecordingId}/access?action=stream`,
        headers: { Authorization: `Bearer ${hostToken}` },
      })
      assert.strictEqual(res.status, 200)
      assert.ok(res.data.data.token)
      assert.ok(res.data.data.streamUrl.includes(createdRecordingId.toString()))
      assert.ok(res.data.data.streamUrl.includes("token="))
      signedStreamToken = res.data.data.token

      const verified = recordingStorageService.verifySignedAccessToken(
        signedStreamToken,
        createdRecordingId,
        "stream"
      )
      assert.strictEqual(verified.recordingId, createdRecordingId.toString())
      logPass("Generates and cryptographically verifies short-lived signed access token (200)")
    } catch (e) {
      logFail("Generates and verifies short-lived signed access token", e)
    }

    // 11. Tampered access token rejected
    try {
      const res = await makeRequest({
        path: `/api/recordings/${createdRecordingId}/stream?token=malformed.tampered_signature`,
      })
      assert.strictEqual(res.status, 401)
      logPass("Streaming rejects tampered token (401)")
    } catch (e) {
      logFail("Streaming rejects tampered token", e)
    }

    // 12. HTTP 206 Range streaming for HTML5 video player seeking
    try {
      const res = await makeRequest({
        path: `/api/recordings/${createdRecordingId}/stream?token=${signedStreamToken}`,
        headers: {
          Range: "bytes=0-10",
        },
      })
      assert.strictEqual(res.status, 206)
      assert.ok(res.headers["content-range"].startsWith("bytes 0-10/"))
      assert.strictEqual(res.headers["accept-ranges"], "bytes")
      assert.strictEqual(res.headers["content-type"], "video/webm")
      logPass("HTTP 206 Partial Content Range streaming enables HTML5 video player seeking (206)")
    } catch (e) {
      logFail("HTTP 206 Partial Content Range streaming", e)
    }

    // 13. Secure download with Content-Disposition
    try {
      const accessRes = await makeRequest({
        path: `/api/recordings/${createdRecordingId}/access?action=download`,
        headers: { Authorization: `Bearer ${hostToken}` },
      })
      const downloadToken = accessRes.data.data.token

      const res = await makeRequest({
        path: `/api/recordings/${createdRecordingId}/download?token=${downloadToken}`,
      })
      assert.strictEqual(res.status, 200)
      assert.ok(res.headers["content-disposition"].includes("attachment"))
      logPass("Secure download sends file with Content-Disposition header (200)")
    } catch (e) {
      logFail("Secure download", e)
    }

    // 14. Unauthorized user cannot delete recording
    try {
      const res = await makeRequest({
        path: `/api/recordings/${createdRecordingId}`,
        method: "DELETE",
        headers: { Authorization: `Bearer ${participantToken}` },
      })
      assert.strictEqual(res.status, 403)
      logPass("Participant cannot delete recording (403)")
    } catch (e) {
      logFail("Participant cannot delete recording", e)
    }

    // 15. Host deletes recording safely
    try {
      const rec = await MeetingRecording.findById(createdRecordingId)
      const diskPath = rec.storagePath

      const res = await makeRequest({
        path: `/api/recordings/${createdRecordingId}`,
        method: "DELETE",
        headers: { Authorization: `Bearer ${hostToken}` },
      })
      assert.strictEqual(res.status, 200)

      const updated = await MeetingRecording.findById(createdRecordingId)
      assert.strictEqual(updated.status, "DELETED")
      assert.strictEqual(fs.existsSync(diskPath), false)
      logPass("Host deletes recording, safely unlinking private disk file (200)")
    } catch (e) {
      logFail("Host deletes recording", e)
    }

    // 16. Path traversal attack prevented
    try {
      assert.throws(
        () => {
          recordingStorageService.validatePath("../../../etc/shadow")
        },
        (err) => err.statusCode === 403
      )
      logPass("Path traversal attacks blocked with 403 Forbidden")
    } catch (e) {
      logFail("Path traversal attacks blocked", e)
    }
  } finally {
    await teardown()
  }

  console.log("\n==================================================")
  console.log(`RECORDING TESTS SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`)
  console.log("==================================================\n")

  if (failedTests > 0) {
    process.exit(1)
  }
}

runTests().catch((e) => {
  console.error("Test execution failed with error:", e)
  process.exit(1)
})
