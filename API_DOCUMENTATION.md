# REST API Specification & Reference Manual

This document specifies the REST API endpoints available across the video platform, subscription management engine, and payment gateways.

> 🌐 **Interactive Explorer**: An interactive API explorer with live request testing is available directly in the web app at [`/api-docs`](http://localhost:3000/api-docs).
> 📖 **Extended Technical Guide**: For exhaustive request/response schemas and code examples, see [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md).

---

## 1. Authentication & Global Envelope

Protected endpoints require a Bearer token:
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

---

## 2. Subscription & Payment Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/subscriptions/plans` | Public | Retrieve public list of all 4 subscription tiers and pricing. |
| `GET` | `/api/subscriptions/current` | User | Retrieve current user's subscription tier, status, and expiry. |
| `POST`| `/api/subscriptions/create-order` | User | Create a Razorpay checkout order for plan upgrade/renewal. |
| `POST`| `/api/subscriptions/verify-payment`| User | Cryptographically verify HMAC-SHA256 signature and activate plan. |
| `POST`| `/api/subscriptions/cancel` | User | Schedule cancellation while preserving access until expiry. |
| `GET` | `/api/subscriptions/invoices` | User | List all past tax invoices for authenticated user. |
| `GET` | `/api/subscriptions/invoices/:id/download` | User | Stream official tax-compliant PDF invoice. |
| `POST`| `/api/subscriptions/webhook` | Gateway | Asynchronous Razorpay webhook processing (idempotent). |

---

## 3. Administrative Subscription Operations

| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/admin/subscriptions/subscribers` | Admin | Search subscribers with filtering and pagination. |
| `POST`| `/api/admin/subscriptions/subscribers/:id/extend` | Admin | Extend subscription validity (requires reason). |
| `PUT` | `/api/admin/subscriptions/subscribers/:id/plan` | Admin | Override subscriber's plan tier. |
| `PUT` | `/api/admin/subscriptions/subscribers/:id/status` | Admin | Suspend or restore subscriber account. |
| `GET` | `/api/admin/subscriptions/analytics` | Admin | Retrieve master KPI metrics (MRR, churn, distribution). |

---

## 4. Download & Video Streaming Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `POST`| `/api/downloads/request-token` | User | Generate single-use cryptographic token for offline download. |
| `GET` | `/api/downloads/stream/:token` | Token | Stream protected video file with HTTP 206 range support. |
| `GET` | `/api/downloads/history` | User | Paginated download history and active in-flight streams. |
| `GET` | `/api/downloads/devices` | User | List and manage registered devices tied to subscription tier. |

---

## 5. System Health Probes

| `GET` | `/api/health` | Public | Basic HTTP liveness probe (`200 OK`). |
| `GET` | `/api/health/ready` | Public | Database readiness probe verifying MongoDB connection. |

---

## 6. Multilingual Commenting, Translation & Moderation Endpoints

### Comment & Thread Management
| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/comment/post` | User | Create a new top-level comment (validated against Phase 8 safety). |
| `POST` | `/api/comment/:commentId/reply` | User | Post a threaded reply (enforces `MAX_REPLY_DEPTH` limit). |
| `GET`  | `/api/comment/content/:contentId` | Public | Fetch paginated comments with `sortBy` and keyset `cursor`. |
| `GET`  | `/api/comment/:commentId/replies` | Public | Fetch chronological replies for a parent comment. |
| `PUT`  | `/api/comment/:commentId/edit` | Author | Edit comment (enforces 15m window, version check, audit history). |
| `DELETE`| `/api/comment/:commentId/delete` | Author/Admin | Soft-delete comment (masks text, preserves child threads). |
| `GET`  | `/api/comment/:commentId/history` | Public | View immutable revision history snapshots for an edited comment. |

### Reactions & Mentions
| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/comment/:commentId/react` | User | Atomically toggle or switch reaction (`like` or `dislike`). |
| `GET`  | `/api/comment/mentions/search` | User | Autocomplete user candidates matching `@username` queries. |

### Multilingual Translation
| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/comment/:commentId/translate` | Public/User | Translate comment to target language (cached with auto-invalidation). |
| `GET`  | `/api/comment/languages/supported` | Public | List of 18 supported multilingual translation languages. |

### Reporting & Moderation
| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/comment/:commentId/report` | User | Submit a categorized moderation report on any comment or reply. |
| `GET`  | `/api/admin/comment-moderation/summary` | Moderator | Retrieve moderation KPI dashboard statistics and queue metrics. |
| `GET`  | `/api/admin/comment-moderation/reports` | Moderator | Paginated moderation reports list with status/priority filtering. |
| `GET`  | `/api/admin/comment-moderation/reports/:id` | Moderator | Comprehensive report detail dossier (safety signals, thread context). |
| `PUT`  | `/api/admin/comment-moderation/reports/:id/status` | Moderator | Update report review status (`reviewing`, `resolved`, `dismissed`). |
| `POST` | `/api/admin/comment-moderation/reports/:id/action` | Moderator | Execute moderation action (`HIDE_COMMENT`, `RESTORE_COMMENT`, `DELETE_COMMENT`). |

