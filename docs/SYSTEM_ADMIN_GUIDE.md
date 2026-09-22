# System Administrator & Infrastructure Operations Guide

This guide covers deployment topology, cluster scaling, database index management, caching, telemetry, monitoring, alerting thresholds, and circuit breaker configuration.

---

## 1. System Architecture & Topology

The platform operates as a decoupled microservices-ready architecture:

```
[ Internet / Public Traffic ]
              |
      [ Cloudflare CDN / WAF ]
              |
  [ NGINX Reverse Proxy / Load Balancer ]
       /                     \
[ Next.js Frontend ]    [ Node.js API Cluster (PM2) ]
(SSR & Static Assets)   (Port 5001/5004 Cluster)
                               |
              +----------------+----------------+
              |                                 |
     [ MongoDB Atlas Cluster ]        [ In-Memory Caching ]
     (Primary + 2 Secondaries)        (NodeCache / Redis)
```

---

## 2. Process Management with PM2

In staging and production, run the backend cluster using PM2 in cluster mode to utilize all CPU cores:

```bash
# Start cluster with automatic CPU core scaling
pm2 start server/ecosystem.config.cjs --env production

# View active workers and CPU / memory consumption
pm2 list
pm2 monit

# Zero-downtime hot reload
pm2 reload youtube-server --update-env

# View aggregated logs
pm2 logs youtube-server
```

Sample `ecosystem.config.cjs`:
```javascript
module.exports = {
  apps: [
    {
      name: "youtube-server",
      script: "index.js",
      cwd: "./server",
      instances: "max",
      exec_mode: "cluster",
      env_production: {
        NODE_ENV: "production",
        PORT: 5001
      },
      max_memory_restart: "1G",
      restart_delay: 4000
    }
  ]
};
```

---

## 3. Database Indexes & Performance Optimization

To sustain high throughput under peak load, ensure the following compound indexes are maintained in MongoDB:

```javascript
// Subscription lookups by user and status
db.subscriptions.createIndex({ userId: 1, status: 1 });
db.subscriptions.createIndex({ endDate: 1, status: 1 });

// Payment transaction reconciliation and anti-replay
db.paymenttransactions.createIndex({ razorpayOrderId: 1 }, { unique: true });
db.paymenttransactions.createIndex({ userId: 1, createdAt: -1 });

// Fast invoice retrieval
db.invoices.createIndex({ userId: 1, issuedAt: -1 });
db.invoices.createIndex({ invoiceNumber: 1 }, { unique: true });

// Audit log chronological queries
db.adminsubscriptionauditlogs.createIndex({ targetUserId: 1, createdAt: -1 });
db.adminsubscriptionauditlogs.createIndex({ adminId: 1, createdAt: -1 });
```

---

## 4. Rate Limiting & Circuit Breakers

### API Rate Limiting Thresholds
Configured in `server/middleware/rateLimiter.js`:
* **General API**: 120 requests / minute per IP.
* **Checkout & Payment Endpoints**: 15 requests / minute per user/IP.
* **Download Access**: 20 requests / minute per device.

### Payment Circuit Breaker Configuration
If Razorpay experiences upstream latency or repeated timeouts:
* **Failure Threshold**: 5 consecutive 5xx or timeout errors.
* **Open State Duration**: 30 seconds (circuit opens; requests fail fast to prevent connection starvation).
* **Half-Open Probing**: Tests 1 request; if successful, circuit closes and normal traffic resumes.

---

## 5. Monitoring & Alerting Metrics

Prometheus / Datadog telemetry exporters monitor critical operational indicators:

| Indicator | Normal Baseline | Warning Alert | Critical PagerDuty Alert |
| :--- | :---: | :---: | :---: |
| **API Latency (p95)** | < 150ms | > 350ms | > 800ms |
| **Payment Failure Rate**| < 4% | > 10% | > 20% over 5m window |
| **DB Connection Pool** | < 40% utilized | > 75% utilized | > 90% utilized |
| **Node.js Memory RSS** | < 450MB / worker | > 850MB / worker | > 1GB (Auto-restart) |
| **Active Webhook Errors**| 0 errors | > 2 errors / 10m | > 5 errors / 10m |
