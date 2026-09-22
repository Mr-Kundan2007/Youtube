# YouTube Comment System & Community Moderation Architecture (Phase 1)

## 1. Executive Summary & Objective

This document defines the complete architectural blueprint, data flows, domain services, security boundaries, and multi-phase implementation roadmap for the enterprise-grade **YouTube Comment System & Community Moderation Engine**.

### Primary Objectives
1. **Exhaustive System Inspection**: Audit the existing comment schemas, controllers, endpoints, and frontend components in the codebase without breaking active dependencies.
2. **Backward & Dual Compatibility**: Preserve legacy field names (`videoid`, `userid`, `commentbody`, `usercommented`, `userimage`) while establishing modern camelCase and typed schemas for the advanced commenting features.
3. **Enterprise Scalability**: Design a 2-level threaded commenting hierarchy (top-level comments and nested replies) optimized for high read throughput, cursor pagination, and bounded memory footprints.
4. **Community Safety & Moderation**: Blueprint automated profanity filtering, heuristic spam detection, user reporting, creator controls (pinning, hearting, held-for-review), and shadowbanning.
5. **Global Accessibility**: Formulate an on-demand multilingual translation system with caching to minimize duplicate external API requests.
6. **Robust Security**: Enforce strict authenticated ownership verification for edits/deletes, rate limiting, and CAPTCHA challenge mechanics to combat bot automation.

---

## 2. 12-Phase Roadmap Alignment

The commenting engine will be built systematically across 12 distinct phases:

| Phase | Phase Title | Scope & Deliverables |
| :---: | :--- | :--- |
| **1** | **System Inspection & Architecture** *(Current)* | Baseline audit, gap analysis, architectural blueprint, domain boundaries, and data design. |
| **2** | **Database & Comment Data Model** | Dual-compatible Mongoose schema, parent-child references, reaction counts, moderation states, edit history, and translations. |
| **3** | **Core Comment Creation** | Authenticated comment posting, input validation, length bounds, user profile binding, and instant optimistic updates. |
| **4** | **Replies & Threaded Comments** | 2-level hierarchical replies, `parentId` linking, reply counter increments, expandable reply trees, and nested pagination. |
| **5** | **Likes, Dislikes & @Mentions** | Atomic toggle reactions, dislike tracking, `@username` regex parser, user lookup, and mention notifications. |
| **6** | **Edit, Delete & Comment History** | Strict author authorization, immutable edit audit log (`editHistory`), "edited" badge, and soft deletion (`isDeleted: true`). |
| **7** | **Multilingual Translation System** | On-demand translation engine (Hindi, Spanish, French, German, Japanese, etc.), inline translation UI, and document-level translation caching. |
| **8** | **Profanity, Spam & Content Protection** | Rule-based & regex profanity dictionary, link/URL spam filter, repetitive character detection, and shadowbanning. |
| **9** | **Rate Limiting & CAPTCHA** | Sliding-window per-user and per-IP comment rate limiting, burst mitigation, and CAPTCHA challenge triggers. |
| **10** | **Reporting & Admin Moderation** | User reporting dialog (spam, harassment, hate speech), creator moderation queue (Held for Review), comment approval, and comment pinning. |
| **11** | **Sorting, Performance & Security** | Compound indexing, "Top comments" ranking algorithm vs "Newest first", cursor pagination, and XSS sanitization. |
| **12** | **Testing, Edge Cases & Production Hardening** | Automated end-to-end test suite, concurrent load verification, edge-case hardening, and production deployment readiness. |

---

## 3. Existing System Audit & Gap Analysis

### 3.1 Existing Database Schema (`server/Modals/comment.js`)
The legacy model defined in `server/Modals/comment.js` exhibits several architectural bottlenecks:
* **Duplicate Field Names**: Uses parallel fields for lowercase and camelCase (`videoid` & `videoId`, `userid` & `userId`, `commentbody` & `commentBody`, `usercommented` & `userCommented`, `userimage` & `userImage`).
* **Flat Structure Only**: No `parentId` or `replyCount`, making it impossible to distinguish top-level comments from nested replies.
* **Primitive Reaction Tracking**: `likes` is an untyped array of strings (`likes: [String]`). No `dislikes` array or numerical reaction counts.
* **Absence of Lifecycle & Safety Fields**: No `status` (`APPROVED`, `HELD_FOR_REVIEW`, `SPAM`, `REJECTED`), no `isEdited`, no `editedAt`, and no `isDeleted` flag.
* **No Translation or History Storage**: Comments are static text strings with no metadata for language detection or revision tracking.

### 3.2 Existing Controller & Endpoints (`server/controllers/comment.js` & `server/routes/comment.js`)
* **Unauthenticated CRUD**:
  * `postcomment` allows a fallback `userid: "guest"`, permitting anonymous comments without user verification.
  * `deletecomment` (`DELETE /comment/delete/:id`) deletes records by ID without inspecting `req.user` or confirming ownership.
  * `editcomment` (`PATCH /comment/edit/:id`) overwrites comment text without author verification or edit history preservation.
* **Unbounded Reads**:
  * `getcomment` performs an unpaginated `find({ ... }).sort({ createdAt: -1 })`, loading all comments for a video into Node.js memory at once. For videos with thousands of comments, this causes high latency and memory spikes.
* **Lack of Advanced Features**:
  * No like/dislike toggle endpoints on the backend.
  * No search, sorting options (top vs newest), or reply fetching.

### 3.3 Existing Frontend Component (`src/components/Comments.tsx`)
* **UI Structure**: Renders below `<VideoInfo />` on `src/pages/watch/[id]/index.tsx`.
* **Client-Only Reactions**: The like button updates local state `likedComments[commentId]` in React memory; refreshing the page resets all likes.
* **Pseudo-Replies**: Clicking "Reply" merely inserts `@AuthorName ` into the main top-level textarea, appending replies to the root list without nesting.
* **No Pagination**: Renders the complete comment array with no "Show more" or virtualized scrolling.

---

## 4. Target Architecture & Domain Services

```text
                                  NEXT.JS WATCH PAGE (/watch/[id])
                                                │
                                                ▼
                                    ┌───────────────────────┐
                                    │ <EnhancedComments />  │
                                    │  - Top / Newest Sort  │
                                    │  - 2-Level Threading  │
                                    │  - Rich Mentions & Lk │
                                    │  - Translate Buttons  │
                                    │  - Report & Moderate  │
                                    └───────────┬───────────┘
                                                │ HTTP API
                                                ▼
                                    ┌───────────────────────┐
                                    │    EXPRESS GATEWAY    │
                                    │  - Rate Limiter (P9)  │
                                    │  - Auth Guards (JWT)  │
                                    └───────────┬───────────┘
                                                │
         ┌──────────────────┬───────────────────┼───────────────────┬──────────────────┐
         ▼                  ▼                   ▼                   ▼                  ▼
  ┌─────────────┐    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐    ┌─────────────┐
  │   COMMENT   │    │  THREADING  │     │ MODERATION  │     │ TRANSLATION │    │  REPORTING  │
  │   SERVICE   │    │   SERVICE   │     │   & SPAM    │     │   SERVICE   │    │   SERVICE   │
  │ (Phase 3,6) │    │  (Phase 4)  │     │  (Phase 8)  │     │  (Phase 7)  │    │ (Phase 10)  │
  └──────┬──────┘    └──────┬──────┘     └──────┬──────┘     └──────┬──────┘    └──────┬──────┘
         │                  │                   │                   │                  │
         └──────────────────┴───────────────────┼───────────────────┴──────────────────┘
                                                │
                                                ▼
                                ┌───────────────────────────────┐
                                │       MONGODB DATABASE        │
                                │  - Dual-Compatible Comment    │
                                │  - Indexes: (videoId, status) │
                                │  - Parent/Reply Hierarchy     │
                                │  - Translations & History     │
                                └───────────────────────────────┘
```

### Domain Services Breakdown
1. **`commentService`**: Core lifecycle orchestrator (creation, update, soft delete, fetch with sorting, dual-field mapping).
2. **`commentThreadService`**: Manages parent-child relationships, atomic `replyCount` adjustments, and paginated reply retrieval.
3. **`commentReactionService`**: Handles atomic `$addToSet` and `$pull` toggles for likes and dislikes, preventing conflicting simultaneous states.
4. **`commentMentionService`**: Scans comment text for `@username`, validates mentioned users against `User` collection, and triggers notifications.
5. **`commentTranslationService`**: Detects source language, executes translations via provider adapters, and caches translated strings on the comment record.
6. **`commentModerationService`**: Evaluates content against profanity lexicons, detects URL spam or bot signatures, and assigns initial moderation status (`APPROVED` vs `HELD_FOR_REVIEW`).
7. **`commentRateLimitService`**: In-memory / sliding window tracker enforcing maximum comment frequency per user and client IP.
8. **`commentReportService`**: Collects community abuse reports, aggregates report counters, and routes high-risk comments to creator/admin review queues.

---

## 5. Data Modeling Strategy (Phase 2 Preview)

To ensure **100% backward compatibility** with legacy code while enabling modern features, the new comment schema maintains dual getters/setters and pre-save hooks:

```javascript
const commentSchema = new mongoose.Schema({
  // Video Reference
  videoId: { type: String, required: true, index: true },
  videoid: { type: String }, // Legacy mirror

  // Author Reference
  userId: { type: String, required: true, index: true },
  userid: { type: String }, // Legacy mirror
  authorName: { type: String, required: true },
  usercommented: { type: String }, // Legacy mirror
  authorAvatar: { type: String, default: "" },
  userimage: { type: String }, // Legacy mirror

  // Content & Revisions
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  commentbody: { type: String }, // Legacy mirror
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date, default: null },
  editHistory: [{
    text: { type: String, required: true },
    editedAt: { type: Date, default: Date.now }
  }],

  // Threading Hierarchy (2-Level Tree)
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null, index: true },
  replyCount: { type: Number, default: 0 },

  // Reactions & Engagement
  likes: { type: [String], default: [] }, // Array of userIds
  dislikes: { type: [String], default: [] }, // Array of userIds
  likeCount: { type: Number, default: 0, index: true },
  dislikeCount: { type: Number, default: 0 },
  isPinned: { type: Boolean, default: false, index: true },
  pinnedAt: { type: Date, default: null },
  creatorHeart: { type: Boolean, default: false },

  // Mentions
  mentions: [{
    userId: { type: String },
    username: { type: String }
  }],

  // Multilingual Translations Cache
  originalLanguage: { type: String, default: "auto" },
  translations: {
    type: Map,
    of: new mongoose.Schema({
      text: { type: String, required: true },
      translatedAt: { type: Date, default: Date.now }
    }, { _id: false }),
    default: {}
  },

  // Moderation & Community Safety
  status: {
    type: String,
    enum: ["APPROVED", "HELD_FOR_REVIEW", "SPAM", "REJECTED"],
    default: "APPROVED",
    index: true
  },
  isFlagged: { type: Boolean, default: false },
  reportCount: { type: Number, default: 0 },
  moderationReason: { type: String, default: null },

  // Deletion Lifecycle
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null }
}, {
  timestamps: true
});
```

---

## 6. REST API Taxonomy

All endpoints follow consistent RESTful conventions with dual-routing support:

| Method | Endpoint | Auth | Phase | Purpose |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/comments/video/:videoId` | Optional | P3, P11 | Fetch top-level comments with sorting (`top`, `newest`) & cursor pagination |
| `POST` | `/api/comments` | Required | P3 | Post a new top-level comment |
| `GET` | `/api/comments/:commentId/replies` | Optional | P4 | Fetch paginated replies for a specific top-level comment |
| `POST` | `/api/comments/:commentId/replies` | Required | P4 | Post a reply to a comment |
| `POST` | `/api/comments/:commentId/like` | Required | P5 | Toggle like on a comment |
| `POST` | `/api/comments/:commentId/dislike` | Required | P5 | Toggle dislike on a comment |
| `PATCH` | `/api/comments/:commentId` | Required | P6 | Edit comment text (author only, records history) |
| `DELETE` | `/api/comments/:commentId` | Required | P6 | Soft delete comment (author or video creator) |
| `GET` | `/api/comments/:commentId/history` | Optional | P6 | View edit history revisions |
| `POST` | `/api/comments/:commentId/translate`| Optional | P7 | Translate comment to target language |
| `POST` | `/api/comments/:commentId/report` | Required | P10 | Submit community abuse report |
| `POST` | `/api/comments/:commentId/pin` | Required | P10 | Pin / unpin comment (creator only) |
| `POST` | `/api/comments/:commentId/heart` | Required | P10 | Heart / unheart comment (creator only) |
| `GET` | `/api/comments/moderation/queue` | Admin/Creator | P10 | Retrieve comments held for review |
| `PATCH` | `/api/comments/moderation/:id/status`| Admin/Creator | P10 | Approve or reject held comment |

*Note: Existing endpoints (`/comment/get/:videoid`, `/comment/post`, `/comment/delete/:id`, `/comment/edit/:id`) will be transparently redirected or handled by the enhanced controller to maintain zero downtime for legacy consumers.*

---

## 7. Security, Moderation & Performance Boundaries

1. **Authorization & Ownership Isolation**:
   - Edits are restricted strictly to `comment.userId === req.user.id`.
   - Deletions are permitted by either `comment.userId === req.user.id` or the owner of the video (`video.uploader === req.user.id`).
2. **Soft Deletion Preservation**:
   - Comments with active replies (`replyCount > 0`) are soft-deleted: `isDeleted = true`, text replaced with `"[This comment has been deleted]"`, while preserving the reply tree beneath them.
   - Leaf comments without replies may be safely purged or marked deleted.
3. **Automated Content Protection**:
   - Comments with detected profanity or suspicious link patterns are automatically set to `status = "HELD_FOR_REVIEW"`, invisible to the public until approved by the creator.
   - Malicious scripts and raw HTML tags are sanitized before persistence.
4. **Performance & Indexing Strategy**:
   - Compound indexes: `{ videoId: 1, parentId: 1, isDeleted: 1, status: 1, createdAt: -1 }`
   - Top comments index: `{ videoId: 1, parentId: 1, isDeleted: 1, status: 1, likeCount: -1 }`
   - Default page size capped at 20 comments with cursor-based retrieval to avoid expensive skip-offset operations at high volumes.

---

## 8. Conclusion & Readiness

Phase 1 provides the comprehensive architectural blueprint, field-level data schemas, and domain service isolation needed to implement the remaining phases smoothly. The system is fully ready to transition into **Phase 2: Database & Comment Data Model**.
