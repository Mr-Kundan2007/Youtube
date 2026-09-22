# Known Platform Constraints & Architectural Limitations

This document outlines known architectural boundaries, technical trade-offs, and recommended operational workarounds in the current platform release.

---

## 1. Single-Region Database Primary

* **Constraint**: MongoDB Atlas primary write node resides in a single AWS/GCP region (e.g. `ap-south-1` Mumbai).
* **Impact**: Write operations (such as checkout and invoice generation) from distant international regions experience network round-trip latency (~150-250ms).
* **Workaround**: Read queries for public plan discovery and catalog browsing utilize localized edge caching and MongoDB Atlas secondary read replicas (`readPreference=secondaryPreferred`).

---

## 2. In-Memory NodeCache vs. Distributed Redis

* **Constraint**: The default analytics and quota caching layer utilizes an in-memory `NodeCache` instance inside each Express process.
* **Impact**: In a multi-server or multi-container cluster, cache invalidation triggered on Worker A is not instantly broadcast to Worker B until cache TTL (default 300 seconds) expires.
* **Workaround**: For enterprise multi-cluster deployments with $>10$ nodes, configure the optional Redis adapter (`REDIS_URL`) to centralize cache invalidation across all nodes.

---

## 3. Webhook Delivery Delays during Gateway Downtime

* **Constraint**: In rare scenarios of third-party payment gateway downtime, Razorpay webhook delivery can be queued for up to 1-2 hours.
* **Impact**: If a user closes the browser before the frontend redirect completes while the webhook is delayed, their account activation might be delayed.
* **Workaround**:
  - The client UI provides a "Verify Payment" button where users can paste their Razorpay Payment ID or click to re-query the payment status.
  - An automated reconciliation cron periodically polls Razorpay for pending orders every 30 minutes.

---

## 4. Browser Offline Storage Quota Limits

* **Constraint**: Client-side offline download caching depends on browser IndexedDB / Origin Private File System (OPFS) quotas.
* **Impact**: Mobile Safari restricts IndexedDB storage to approximately 1GB per domain without explicit user permission prompts.
* **Workaround**: The platform warns users when local device storage falls below 500MB and offers compressed video resolutions (360p/720p) for mobile download sessions.
