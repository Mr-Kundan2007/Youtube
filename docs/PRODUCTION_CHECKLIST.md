# Production Readiness Checklist & Launch Gate Review

This checklist must be reviewed, executed, and signed off prior to deploying any production release of the Subscription Management System.

---

## 1. Security & Cryptography Verification

- [ ] **Secret Shielding**: Ensure zero development secrets, test keys, or passwords are committed to Git.
- [ ] **Cryptographic Strength**:
  - `JWT_SECRET` is random and at least 32 characters long.
  - `DOWNLOAD_TOKEN_SECRET` is random and at least 32 characters long.
- [ ] **Payment Credentials**:
  - Production `RAZORPAY_KEY_ID` (starts with `rzp_live_`).
  - Production `RAZORPAY_KEY_SECRET` configured in environment secrets manager.
  - `RAZORPAY_WEBHOOK_SECRET` matches Razorpay Dashboard webhook setup.
- [ ] **Rate Limiting Active**:
  - `DOWNLOAD_RATE_LIMIT_USER_PER_MINUTE` active and tested.
  - Checkout order creation rate limiter verified against abuse.
- [ ] **CORS Configuration**:
  - `FRONTEND_URL` strictly locked to production domain (no `*` wildcard in production).

---

## 2. Database & Data Integrity

- [ ] **Connection Resilience**:
  - MongoDB connection string includes `retryWrites=true&w=majority`.
  - SSL/TLS enabled for database connections (`tls=true`).
- [ ] **Compound Indexes Verified**:
  - `subscriptions` indexed on `{ userId: 1 }` and `{ status: 1, endDate: 1 }`.
  - `paymenttransactions` indexed on `{ razorpayOrderId: 1 }` and `{ userId: 1, createdAt: -1 }`.
  - `invoices` indexed on `{ invoiceNumber: 1 }` and `{ userId: 1, issuedAt: -1 }`.
- [ ] **Backup Automation**:
  - MongoDB Atlas continuous oplog backup active with 7-day retention.
  - Point-in-time recovery tested on a staging replica.

---

## 3. Financial & Tax Invoicing

- [ ] **GST Tax Settings**:
  - SAC code `998439` configured for streaming services.
  - GST rate verified at 18% (9% CGST + 9% SGST or 18% IGST).
  - Corporate registered address and GSTIN correctly displayed on PDF header.
- [ ] **Invoice PDF Generation**:
  - PDFKit generates valid `%PDF-1.3` binary buffers without memory leaks.
  - Sequential invoice numbering (`INV-YYYYMM-XXXXXX`) verified without duplicates.

---

## 4. Background Workers & Automation

- [ ] **Cron Workers Online**:
  - Hourly expiration worker (`0 * * * *`) scheduled and active.
  - Grace period monitor (`0 2 * * *`) operational.
  - Renewal notification worker (`0 8 * * *`) tested.
  - Midnight quota reset (`0 0 * * *` UTC) operational.
- [ ] **Webhook Listener**:
  - Razorpay Webhook endpoint `POST /api/subscriptions/webhook` tested and responding with HTTP 200 within 500ms.
  - Webhook idempotency verified (replaying event produces HTTP 200 without duplicate crediting).

---

## 5. Automated Pre-Launch Verification Commands

Run the automated verification suite before cutting over production DNS:

```bash
# 1. Run Pre-Deployment Configuration & System Readiness Check (10/10 checks)
npm run check:readiness

# 2. Run Master Phase 11 Test Suite (206/206 assertions)
npm run test:phase11

# 3. Run Master Phase 12 End-to-End System Suite (20/20 stages)
npm run test:e2e

# 4. Verify Next.js Production Build
npm run build

# 5. Run Post-Deployment Live Sanity Check
node server/scripts/postDeploymentValidation.js
```
