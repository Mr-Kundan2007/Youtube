# Controlled Video Download Management System

This document outlines the complete operational lifecycle, business rules, and technical implementation of the controlled video download management system.

---

## 1. End-to-End Download Lifecycle

```
User Clicks "Download"
         │
         ▼
[1] Authentication Guard ────► (Missing/Invalid JWT) ────► 401 UNAUTHORIZED
         │ Valid
         ▼
[2] Account Status Guard ────► (Account Blocked) ────────► 403 ACCOUNT_BLOCKED
         │ Active
         ▼
[3] Subscription Guard ──────► (Expired Paid Plan) ──────► Fallback to Free / 403 SUBSCRIPTION_EXPIRED
         │ Active / Free
         ▼
[4] Video Access Guard ──────► (Deleted / Private) ──────► 404 VIDEO_NOT_AVAILABLE
         │ Accessible
         ▼
[5] Device Restriction Guard ► (Device Limit Reached) ───► 403 DEVICE_LIMIT_REACHED
         │ Authorized Device
         ▼
[6] Security & Abuse Guard ──► (Suspicious Velocity) ───► 429 RATE_LIMIT_EXCEEDED / 403 RESTRICTED
         │ Clear
         ▼
[7] Duplicate Download Check
         ├─► (Within 24h Window) ──► Re-issue Token WITHOUT Quota Deduction
         └─► (First Download / Expired Window)
                 │
                 ▼
[8] Atomic Quota Reservation ─► (Quota Exhausted) ───────► 403 DOWNLOAD_QUOTA_EXCEEDED
         │ Atomic $inc Succeeded
         ▼
[9] Cryptographic Token Issuance (HMAC SHA-256 Single-Use Token)
         │
         ▼
[10] Streaming Delivery (HTTP 200 / HTTP 206 Partial Content Range)
         ├─► Streaming Succeeded ──► Mark COMPLETED ──► Send In-App Notification
         └─► Streaming Failed ─────► Mark FAILED ────► Release Reserved Quota ──► Trigger Notification
```

---

## 2. Subscription Plan Tiers & Limits

| Plan Tier | Daily Quota | Max Devices | Max Concurrent | Video Quality | Price / Month | Duplicate Window |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Free** | 1 download / day | 1 device | 1 active stream | 720p (SD) | $0.00 | 24 Hours |
| **Bronze** | 5 downloads / day | 2 devices | 2 active streams | 1080p (HD) | $4.99 | 24 Hours |
| **Silver** | 15 downloads / day | 5 devices | 3 active streams | 1080p (HD) | $12.99 | 24 Hours |
| **Gold** | 50 downloads / day | 10 devices | 5 active streams | 4K (Ultra HD) | $24.99 | 24 Hours |

---

## 3. Quota Management & Concurrency Controls

### A. Atomic Database Operations
Quota consumption utilizes conditional MongoDB queries to prevent race conditions:
```javascript
const quotaDoc = await DownloadQuota.findOneAndUpdate(
  {
    userId: userObjectId,
    quota_type: "daily",
    period_start: currentPeriodStart,
    quota_used: { $lt: planLimit },
  },
  {
    $inc: { quota_used: 1 },
    $setOnInsert: { period_end: currentPeriodEnd, quota_limit: planLimit },
  },
  { new: true, upsert: true }
)
```
If 10 concurrent requests arrive simultaneously for a user with 1 remaining download, exactly 1 will increment `quota_used` and proceed; the remaining 9 will immediately fail with `DOWNLOAD_QUOTA_EXCEEDED` without over-allocation.

### B. Lazy UTC Quota Resets
Daily quotas reset at 00:00:00 UTC automatically. When a user requests a download on a new calendar day, the system calculates the current UTC period window `[start, end)`. Because no record exists yet for the new window, a fresh quota period is initialized with `quota_used: 0`.

---

## 4. Secure File Delivery & Tokens

1. **Short-Lived Token**: Tokens carry a 10-minute validity window (`DOWNLOAD_TOKEN_EXPIRY = 600s`).
2. **Single-Use Verification**: Once file delivery commences, the token record is flagged `is_used = true`. Any attempt to reuse the token triggers `TOKEN_REPLAY_ATTEMPT`.
3. **Resumable Range Requests**: Video streaming endpoints support `Range: bytes=X-Y` headers, returning HTTP 206 Partial Content.
4. **Failure Recovery**: If delivery terminates unexpectedly before byte streaming begins, `downloadDeliveryService` catches the exception, updates the record status to `failed`, and calls `quotaService.releaseReservation(userId)` to restore the user's allowance.

---

## 5. Duplicate Detection & Retry Management

1. **Duplicate Check Window**: Download history is queried for identical `(userId, videoId)` pairs created within the last 24 hours.
2. **Zero-Deduction Re-download**: If an active, completed record is located within the duplicate window, the existing download is re-authorized and a new stream token is issued with `is_duplicate: true` without decrementing user quota.
3. **Retry Eligibility**: Failed downloads can be retried up to 3 times (`DOWNLOAD_MAX_RETRIES = 3`) within 60 minutes.
