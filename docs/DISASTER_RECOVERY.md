# Disaster Recovery & Business Continuity Plan

This plan establishes recovery objectives, backup policies, failover procedures, and data reconstruction steps in the event of an infrastructure failure or catastrophic data loss.

---

## 1. Recovery Objectives (RTO & RPO)

* **Recovery Point Objective (RPO)**: **< 5 Minutes**. Maximum acceptable data loss period in disaster scenarios. Achieved via continuous MongoDB Atlas oplog replication.
* **Recovery Time Objective (RTO)**: **< 30 Minutes**. Maximum acceptable time to bring full streaming, subscription checkout, and access control services back online.

---

## 2. Backup Architecture & Policies

```
+---------------------------+
| MongoDB Atlas Primary DB  |
+---------------------------+
       |
       | Continuous Oplog Sync (Continuous Backup)
       v
+---------------------------+
| Point-In-Time Snapshots   | (Retained for 7 Days)
+---------------------------+
       |
       | Daily Cross-Region Export (03:00 UTC)
       v
+---------------------------+
| Encrypted S3 Cold Bucket  | (Retained for 90 Days)
+---------------------------+
```

### Backup Types:
1. **Continuous Point-In-Time Restore (PITR)**: Enables second-by-second restoration to any timestamp within the past 7 days.
2. **Daily Snapshots**: Automated daily cloud snapshots kept for 30 days.
3. **Monthly Offline Dumps**: Exported via `mongodump` with AES-256 encryption and archived into cold storage for 7 years to meet tax audit mandates.

---

## 3. Database Restoration Procedures

### Scenario A: Accidental Data Mutation or Deletion
1. Identify the exact UTC timestamp immediately preceding the corrupted operation (e.g., `2026-09-08T00:15:30Z`).
2. In the MongoDB Atlas Console:
   - Navigate to **Clusters** $\rightarrow$ **Backup** $\rightarrow$ **Point-in-Time Restore**.
   - Select the target timestamp.
   - Choose to restore to a new staging cluster (to verify integrity prior to traffic cutover).
3. Validate row counts in `subscriptions`, `paymenttransactions`, and `invoices`.
4. Update `DB_URL` environment variable in PM2 / Kubernetes configurations and trigger rolling restart.

### Scenario B: Manual Restoration from Archive (`mongorestore`)
```bash
# Decompress and restore specific collections
mongorestore \
  --uri="mongodb+srv://<admin>:<password>@cluster.mongodb.net/youtube" \
  --nsInclude="youtube.subscriptions" \
  --nsInclude="youtube.paymenttransactions" \
  --nsInclude="youtube.invoices" \
  --gzip \
  --archive=backup-2026-09-08.gz
```

---

## 4. Payment Gateway Reconciliation Procedure

In the event of database restoration from a historical snapshot:
1. Identify all transactions settled by Razorpay between the snapshot timestamp and the current time:
   ```bash
   node server/scripts/reconcileRazorpayTransactions.js --since="2026-09-08T00:15:00Z"
   ```
2. The script queries Razorpay `/orders` and `/payments` APIs and upserts missing `PaymentTransaction` records.
3. For every confirmed payment missing an active subscription, the reconciler reactivates the subscriber's tier and generates the corresponding tax invoice.
4. No user loses paid subscription time or access privileges.
