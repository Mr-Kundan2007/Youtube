# Platform Troubleshooting & Incident Resolution Guide

This operational manual catalogs known error codes, diagnostic procedures, log query recipes, and recovery actions for production incidents.

---

## 1. Quick Diagnostic Flowchart

```
Issue Reported
   |
   +---> Payment Succeeded, Plan Not Upgraded?
   |        +---> Check PaymentTransaction status in DB
   |        +---> Inspect Razorpay Webhook delivery logs
   |        +---> Trigger manual resync via Admin Console
   |
   +---> Checkout Button Shows Error / Disabled?
   |        +---> Verify NEXT_PUBLIC_RAZORPAY_KEY_ID in frontend env
   |        +---> Check backend /create-order API status & rate limits
   |
   +---> Download Blocked with HTTP 403?
   |        +---> Inspect daily download usage in user subscription
   |        +---> Check device registration slot limits
   |        +---> Verify token expiration time
   |
   +---> High Latency / 504 Gateway Timeout?
            +---> Inspect MongoDB Atlas connection pool & CPU
            +---> Verify Node.js memory leaks with `pm2 monit`
            +---> Check Circuit Breaker state in application logs
```

---

## 2. Common Subscription & Payment Errors

### Error: `PAYMENT_SIGNATURE_INVALID` (HTTP 400)
* **Symptom**: User receives alert "Payment verification failed" after Razorpay modal completes.
* **Root Cause**:
  - `RAZORPAY_KEY_SECRET` in `.env` does not match the secret of `RAZORPAY_KEY_ID`.
  - Client tampered with `razorpay_order_id` or `razorpay_payment_id` before posting.
* **Resolution**:
  1. Check server environment: ensure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` belong to the same Razorpay mode (both `rzp_test_` or both `rzp_live_`).
  2. Inspect backend logs for exact HMAC mismatch string.

### Error: `DUPLICATE_WEBHOOK_EVENT` (HTTP 200)
* **Symptom**: Webhook log displays `[RazorpayWebhook] Duplicate webhook event safely deduplicated`.
* **Root Cause**: Razorpay retried delivery after an initial network delay.
* **Resolution**: Normal idempotent behavior. No action needed.

### Error: `DOWNLOAD_QUOTA_EXCEEDED` (HTTP 403)
* **Symptom**: User receives "You have reached your daily download quota".
* **Root Cause**: User utilized all downloads allotted for their tier.
* **Resolution**:
  1. Inform user that quota resets automatically at 00:00 UTC.
  2. Offer prompt upgrade to Silver (15/day) or Gold (50/day).
  3. If user downloaded the same video within 24 hours, verify duplicate window logic.

---

## 3. Database Diagnostic Commands

Run these queries in MongoDB Shell (`mongosh`) to inspect affected records:

```javascript
// Check user's current subscription and status
db.subscriptions.find({ userId: ObjectId("USER_ID_HERE") });

// Check latest payment transactions for a user
db.paymenttransactions.find({ userId: ObjectId("USER_ID_HERE") }).sort({ createdAt: -1 }).limit(5);

// Reconcile Razorpay order with internal database
db.paymenttransactions.findOne({ razorpayOrderId: "order_XXXXXXXXXXXXXX" });

// View recent administrative audit entries
db.adminsubscriptionauditlogs.find({ targetUserId: ObjectId("USER_ID_HERE") }).sort({ createdAt: -1 });
```

---

## 4. Useful Diagnostic Shell Commands

```bash
# Verify backend server health
curl -s http://localhost:5001/api/health | jq .

# Verify subscription plans endpoint
curl -s http://localhost:5001/api/subscriptions/plans | jq .

# Test database connection & pre-deployment health
node server/scripts/preDeploymentCheck.js

# View live application log streams
tail -f server/logs/app.log | grep -E "ERROR|WARN|Payment"
```
