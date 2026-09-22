# Production Deployment & Cloud Infrastructure Guide

This guide details the step-by-step instructions for containerizing, configuring, and deploying the Video Platform and Subscription Management System to production environments.

---

## 1. Containerization with Docker

The repository includes pre-configured Dockerfiles and `docker-compose.yml` for isolated container deployment.

### Building Container Images:
```bash
# Build the production backend image
docker build -t video-platform-backend:latest -f server/Dockerfile .

# Build the Next.js frontend image
docker build -t video-platform-frontend:latest -f Dockerfile .
```

### Multi-Container Compose Deployment:
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    image: video-platform-backend:latest
    restart: always
    env_file: .env.production
    ports:
      - "5001:5001"
    environment:
      - NODE_ENV=production

  frontend:
    image: video-platform-frontend:latest
    restart: always
    ports:
      - "3000:3000"
    depends_on:
      - backend
```

Deploying with Docker Compose:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## 2. NGINX Reverse Proxy & SSL Configuration

Deploy NGINX as the TLS termination point and load balancer fronting Next.js and Express.js:

```nginx
server {
    listen 443 ssl http2;
    server_name stream.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/stream.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/stream.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Gzip Compression
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;

    # Backend API Routing
    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Next.js Frontend SSR & Static Routing
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 3. Pre-Deployment Readiness Check

Before cutover, always execute the automated pre-deployment validation suite:

```bash
npm run check:readiness
```

This automated validator confirms:
1. All required environment variables are set and meet length/format rules.
2. MongoDB database connection is responsive.
3. Razorpay test/live key configuration is valid.
4. Storage upload paths exist and are writable.
5. All database indexes are built and healthy.

---

## 4. Zero-Downtime Rolling Deployment Workflow

1. **Pull Latest Code**: `git pull origin main`
2. **Install Dependencies**: `npm ci && (cd server && npm ci)`
3. **Build Frontend Bundle**: `npm run build`
4. **Run Regression Suites**: `npm run test:all:phases`
5. **Reload Backend Workers**: `pm2 reload youtube-server --update-env`
6. **Restart Frontend**: `pm2 reload youtube-frontend`
7. **Post-Deployment Smoke Test**: `node server/scripts/postDeploymentValidation.js`
