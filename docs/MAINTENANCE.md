# Scheduled Maintenance & Platform Health Operations

This guide defines standard operating procedures (SOPs) for routine maintenance, log rotation, database hygiene, cache flushes, and background cron scheduling.

---

## 1. Routine Maintenance Schedule

| Frequency | Target System | Maintenance Action | Tool / Command |
| :--- | :--- | :--- | :--- |
| **Hourly** | Subscriptions | Sweep lapsed subscriptions & demote to Free. | `subscriptionCron.js` (Worker 1) |
| **Daily (00:00 UTC)**| Quotas | Reset daily download counts and watch time counters. | `subscriptionCron.js` (Worker 4) |
| **Daily (02:00 UTC)**| Grace Periods | Sweep accounts exceeding 72h grace window. | `subscriptionCron.js` (Worker 2) |
| **Daily (08:00 UTC)**| Notifications | Dispatch 3-day and 1-day renewal reminders. | `subscriptionCron.js` (Worker 3) |
| **Weekly** | Logs | Compress and rotate application log files. | `logrotate` / PM2 Logrotate |
| **Monthly** | Database | Re-index collections & analyze slow query logs. | `db.collection.reIndex()` |
| **Quarterly** | Security | Rotate JWT & download token HMAC secrets. | Key rotation SOP |

---

## 2. Automated Log Rotation Setup

Install and configure `pm2-logrotate` to prevent storage exhaustion:

```bash
# Install log rotation plugin
pm2 install pm2-logrotate

# Configure rotation parameters
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
```

---

## 3. Database Cleanup & Archival Procedures

### Purging Expired Download Tokens (Weekly Cron)
Single-use download tokens expire after 10 minutes. Clean up orphaned session entries:

```javascript
// Remove download sessions older than 30 days
db.downloadhistory.deleteMany({
  status: "failed",
  createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
});
```

### Defragmenting Indexes & Checking Storage
```javascript
// Check collection statistics in mongosh
db.subscriptions.stats();
db.paymenttransactions.stats();
```

---

## 4. Platform Health Check Endpoints

Automated uptime monitoring (UptimeRobot, Pingdom, AWS Route53) should poll:
* **Liveness Probe**: `GET /api/health` (Returns HTTP 200 `{ status: "ok" }`)
* **Readiness Probe**: `GET /api/health/ready` (Verifies MongoDB connection state is `1` [Connected])
