/**
 * Phase 1: Comment System Inspection & Functional Verification Test Suite
 * Tests all existing comment controller functions, route mappings, aliases, and edge case handling.
 */

import assert from "node:assert/strict"
import {
  postcomment,
  postComment,
  addComment,
  getcomment,
  getComment,
  getAllComments,
  editcomment,
  editComment,
  deletecomment,
  deleteComment,
} from "../controllers/comment.js"
import Comment from "../Modals/comment.js"
import commentRoutes from "../routes/comment.js"

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ [PASS] ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`)
    console.error(`    ${err.message}`)
    failed++
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn()
    console.log(`  ✓ [PASS] ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`)
    console.error(`    ${err.message}`)
    failed++
  }
}

// In-memory mock storage simulating Comment collection for offline unit verification
const mockComments = new Map()

// Mock Mongoose model methods if MongoDB is not connected
const originalSave = Comment.prototype.save
const originalFind = Comment.find
const originalFindByIdAndUpdate = Comment.findByIdAndUpdate
const originalFindOneAndUpdate = Comment.findOneAndUpdate
const originalFindByIdAndDelete = Comment.findByIdAndDelete
const originalDeleteOne = Comment.deleteOne

Comment.prototype.save = async function () {
  const id = this._id ? String(this._id) : `mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  this._id = id
  this.id = id
  const doc = {
    _id: id,
    id: id,
    videoid: this.videoid || this.videoId,
    videoId: this.videoId || this.videoid,
    userid: this.userid || this.userId,
    userId: this.userId || this.userid,
    commentbody: this.commentbody || this.commentBody,
    commentBody: this.commentBody || this.commentbody,
    usercommented: this.usercommented || this.userCommented,
    userCommented: this.userCommented || this.usercommented,
    userimage: this.userimage || this.userImage,
    userImage: this.userImage || this.userimage,
    commentedon: this.commentedon || new Date(),
    createdAt: this.createdAt || this.commentedon || new Date(),
    likes: this.likes || [],
    toObject: function () {
      return { ...this }
    },
  }
  mockComments.set(id, doc)
  return doc
}

Comment.find = function (query = {}) {
  const results = Array.from(mockComments.values()).filter((c) => {
    if (!query || Object.keys(query).length === 0) return true
    if (query.$or) {
      return query.$or.some((clause) => {
        if (clause.videoid && (c.videoid === clause.videoid || c.videoId === clause.videoid)) return true
        if (clause.videoId && (c.videoId === clause.videoId || c.videoid === clause.videoId)) return true
        return false
      })
    }
    return true
  })

  return {
    sort: function () {
      return Promise.resolve(
        results.map((r) => ({
          ...r,
          toObject: () => ({ ...r }),
        }))
      )
    },
  }
}

Comment.findByIdAndUpdate = async function (id, update, options = {}) {
  const doc = mockComments.get(String(id))
  if (!doc) return null
  if (update.$set) {
    Object.assign(doc, update.$set)
  }
  return {
    ...doc,
    toObject: () => ({ ...doc }),
  }
}

Comment.findOneAndUpdate = Comment.findByIdAndUpdate

Comment.findByIdAndDelete = async function (id) {
  const doc = mockComments.get(String(id))
  if (doc) mockComments.delete(String(id))
  return doc
}

Comment.deleteOne = async function (filter) {
  const id = filter?._id || filter?.id
  if (id && mockComments.has(String(id))) {
    mockComments.delete(String(id))
    return { deletedCount: 1 }
  }
  return { deletedCount: 0 }
}

function mockResponse() {
  const res = {
    statusCode: 200,
    data: null,
    status: function (code) {
      this.statusCode = code
      return this
    },
    json: function (payload) {
      this.data = payload
      return this
    },
  }
  return res
}

console.log("\n========================================================================")
console.log("PHASE 1: COMMENT SYSTEM INSPECTION & FUNCTIONAL VERIFICATION")
console.log("========================================================================\n")

console.log("--- 1. FUNCTION ALIAS INTEGRITY ---")
test("postcomment aliases are properly bound", () => {
  assert.strictEqual(typeof postcomment, "function")
  assert.strictEqual(postComment, postcomment)
  assert.strictEqual(addComment, postcomment)
})

test("getcomment aliases are properly bound", () => {
  assert.strictEqual(typeof getcomment, "function")
  assert.strictEqual(getComment, getcomment)
  assert.strictEqual(getAllComments, getcomment)
})

test("editcomment aliases are properly bound", () => {
  assert.strictEqual(typeof editcomment, "function")
  assert.strictEqual(editComment, editcomment)
})

test("deletecomment aliases are properly bound", () => {
  assert.strictEqual(typeof deletecomment, "function")
  assert.strictEqual(deleteComment, deletecomment)
})

console.log("\n--- 2. POST COMMENT FUNCTIONALITY ---")
await runAsyncTest("postcomment: successfully creates comment with lowercase fields", async () => {
  const req = {
    body: {
      videoid: "vid_101",
      userid: "usr_101",
      commentbody: "This is a great video on TypeScript!",
      usercommented: "Alice Developer",
      userimage: "https://example.com/alice.png",
    },
  }
  const res = mockResponse()
  await postcomment(req, res)

  assert.strictEqual(res.statusCode, 200)
  assert.ok(res.data.id)
  assert.strictEqual(res.data.author, "Alice Developer")
  assert.strictEqual(res.data.text, "This is a great video on TypeScript!")
  assert.strictEqual(res.data.avatarUrl, "https://example.com/alice.png")
  assert.strictEqual(res.data.likes, 0)
})

await runAsyncTest("postcomment: successfully creates comment with camelCase fields", async () => {
  const req = {
    body: {
      videoId: "vid_102",
      userId: "usr_102",
      commentBody: "Second test comment with camelCase",
      userCommented: "Bob Coder",
      userImage: "https://example.com/bob.png",
    },
  }
  const res = mockResponse()
  await postcomment(req, res)

  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.data.author, "Bob Coder")
  assert.strictEqual(res.data.text, "Second test comment with camelCase")
})

await runAsyncTest("postcomment: rejects missing video ID with 400", async () => {
  const req = {
    body: {
      commentbody: "Missing video ID here",
      userid: "usr_103",
    },
  }
  const res = mockResponse()
  await postcomment(req, res)

  assert.strictEqual(res.statusCode, 400)
  assert.strictEqual(res.data.message, "Video ID is required")
})

await runAsyncTest("postcomment: rejects empty comment body with 400", async () => {
  const req = {
    body: {
      videoid: "vid_101",
      commentbody: "",
    },
  }
  const res = mockResponse()
  await postcomment(req, res)

  assert.strictEqual(res.statusCode, 400)
  assert.strictEqual(res.data.message, "Comment text cannot be empty")
})

await runAsyncTest("postcomment: rejects whitespace-only comment body with 400", async () => {
  const req = {
    body: {
      videoid: "vid_101",
      commentbody: "     \n\t   ",
    },
  }
  const res = mockResponse()
  await postcomment(req, res)

  assert.strictEqual(res.statusCode, 400)
  assert.strictEqual(res.data.message, "Comment text cannot be empty")
})

await runAsyncTest("postcomment: safely handles undefined body without throwing", async () => {
  const req = { body: undefined }
  const res = mockResponse()
  await postcomment(req, res)

  assert.strictEqual(res.statusCode, 400)
  assert.strictEqual(res.data.message, "Video ID is required")
})

console.log("\n--- 3. GET COMMENTS FUNCTIONALITY ---")
await runAsyncTest("getcomment: retrieves comments for a specific video ID", async () => {
  const req = { params: { videoid: "vid_101" } }
  const res = mockResponse()
  await getcomment(req, res)

  assert.strictEqual(res.statusCode, 200)
  assert.ok(Array.isArray(res.data))
  assert.ok(res.data.length >= 1)
  assert.strictEqual(res.data[0].videoid, "vid_101")
  assert.strictEqual(res.data[0].avatarText, "A")
})

await runAsyncTest("getcomment: supports 'all' keyword to fetch all comments", async () => {
  const req = { params: { videoid: "all" } }
  const res = mockResponse()
  await getcomment(req, res)

  assert.strictEqual(res.statusCode, 200)
  assert.ok(Array.isArray(res.data))
  assert.ok(res.data.length >= 2)
})

console.log("\n--- 4. EDIT COMMENT FUNCTIONALITY ---")
await runAsyncTest("editcomment: updates comment body successfully", async () => {
  // First create a comment
  const createReq = {
    body: {
      videoid: "vid_edit_test",
      commentbody: "Original text before edit",
      usercommented: "Editor",
    },
  }
  const createRes = mockResponse()
  await postcomment(createReq, createRes)
  const commentId = createRes.data.id

  // Now edit it
  const editReq = {
    params: { id: commentId },
    body: { text: "Updated text after edit" },
  }
  const editRes = mockResponse()
  await editcomment(editReq, editRes)

  assert.strictEqual(editRes.statusCode, 200)
  assert.strictEqual(editRes.data.text, "Updated text after edit")
  assert.strictEqual(editRes.data.commentbody, "Updated text after edit")
})

await runAsyncTest("editcomment: rejects empty update body with 400", async () => {
  const req = {
    params: { id: "any_id" },
    body: { text: "   " },
  }
  const res = mockResponse()
  await editcomment(req, res)

  assert.strictEqual(res.statusCode, 400)
  assert.strictEqual(res.data.message, "Comment body cannot be empty")
})

await runAsyncTest("editcomment: rejects missing ID with 400", async () => {
  const req = {
    params: {},
    body: { text: "Some text" },
  }
  const res = mockResponse()
  await editcomment(req, res)

  assert.strictEqual(res.statusCode, 400)
  assert.strictEqual(res.data.message, "Comment ID required")
})

await runAsyncTest("editcomment: returns 404 when comment does not exist", async () => {
  const req = {
    params: { id: "non_existent_comment_id" },
    body: { text: "Some updated text" },
  }
  const res = mockResponse()
  await editcomment(req, res)

  assert.strictEqual(res.statusCode, 404)
  assert.strictEqual(res.data.message, "Comment not found")
})

console.log("\n--- 5. DELETE COMMENT FUNCTIONALITY ---")
await runAsyncTest("deletecomment: successfully deletes comment by ID", async () => {
  // Create a comment to delete
  const createReq = {
    body: {
      videoid: "vid_del_test",
      commentbody: "Will be deleted",
      usercommented: "Deleter",
    },
  }
  const createRes = mockResponse()
  await postcomment(createReq, createRes)
  const commentId = createRes.data.id

  // Delete it
  const delReq = { params: { id: commentId } }
  const delRes = mockResponse()
  await deletecomment(delReq, delRes)

  assert.strictEqual(delRes.statusCode, 200)
  assert.strictEqual(delRes.data.message, "Comment deleted successfully")
  assert.strictEqual(delRes.data.id, commentId)

  // Verify it no longer exists
  assert.strictEqual(mockComments.has(commentId), false)
})

await runAsyncTest("deletecomment: rejects missing ID with 400", async () => {
  const req = { params: {} }
  const res = mockResponse()
  await deletecomment(req, res)

  assert.strictEqual(res.statusCode, 400)
  assert.strictEqual(res.data.message, "Comment ID required")
})

console.log("\n--- 6. ROUTE STRUCTURE VERIFICATION ---")
test("commentRoutes has all required endpoints registered", () => {
  assert.ok(commentRoutes.stack, "Router should have middleware stack")
  const routes = commentRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }))

  const paths = routes.map((r) => r.path)
  assert.ok(paths.includes("/post"), "Contains /post route")
  assert.ok(paths.includes("/get/:videoid"), "Contains /get/:videoid route")
  assert.ok(paths.includes("/edit/:id"), "Contains /edit/:id route")
  assert.ok(paths.includes("/delete/:id"), "Contains /delete/:id route")
})

console.log("\n========================================================================")
console.log(`TOTAL PHASE 1 TESTS: ${passed + failed}`)
console.log(`PASSED: ${passed}`)
console.log(`FAILED: ${failed}`)
console.log("========================================================================\n")

if (failed > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
