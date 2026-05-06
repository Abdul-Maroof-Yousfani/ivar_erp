# 🚀 Manual Deployment Guide

This guide walks through deploying the Speed Limit application **without Docker** on a fresh Ubuntu 20.04/22.04 VPS.

**Stack overview:**
- **Backend** — NestJS (Fastify), runs on port `3000`
- **Frontend** — Next.js (standalone), runs on port `3001`
- **Database** — PostgreSQL 17
- **Cache/Queue** — Redis 7
- **Reverse Proxy** — Nginx with Let's Encrypt SSL
- **Runtime** — Bun

---

## 📋 Prerequisites

- Fresh VPS (Ubuntu 20.04/22.04)
- Root or sudo access
- Domain `spl.inplsoftwares.com` with DNS A records pointing to your VPS IP:

| Type | Name | Value |
|------|------|-------|
| A | `auth` | `YOUR_VPS_IP` |
| A | `hr` | `YOUR_VPS_IP` |
| A | `erp` | `YOUR_VPS_IP` |
| A | `master` | `YOUR_VPS_IP` |
| A | `pos` | `YOUR_VPS_IP` |
| A | `admin` | `YOUR_VPS_IP` |

---

## 1. System Packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget unzip build-essential \
  nginx certbot python3-certbot-nginx \
  postgresql postgresql-contrib redis-server \
  postgresql-client
```

---

## 2. Install Bun & PM2

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version

# Install Node.js (needed for PM2)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2
pm2 --version
```

---

## 3. PostgreSQL Setup

```bash
# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database user and database
sudo -u postgres psql <<EOF
CREATE USER spl_admin WITH PASSWORD 'SecureDbPass2026';
CREATE DATABASE spl_core_db OWNER spl_admin;
GRANT ALL PRIVILEGES ON DATABASE spl_core_db TO spl_admin;
EOF
```

---

## 4. Redis Setup

```bash
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify Redis is running
redis-cli ping
# Expected output: PONG
```

---

## 5. Clone the Repository

```bash
cd /opt
sudo git clone --recursive https://github.com/Abdul-Maroof-Yousfani/hr_speed_limited.git speed-limit
sudo chown -R $USER:$USER /opt/speed-limit
cd /opt/speed-limit
```

---

## 6. Backend Setup

### 6a. Environment file

```bash
cd /opt/speed-limit/nestjs_backend
cp .env.example .env
nano .env
```

Set the following values in `.env`:

```env
PORT=3000
HOSTNAME=0.0.0.0
NODE_ENV=production

# Database
DATABASE_URL=postgresql://spl_admin:SecureDbPass2026@localhost:5432/spl_core_db?schema=public
DATABASE_URL_MANAGEMENT=postgresql://spl_admin:SecureDbPass2026@localhost:5432/spl_core_db?schema=public

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Secrets — change these to strong random values in production
JWT_ACCESS_SECRET=xr76tyhgvdfhrt67uhyfdhxui76t8ohybgftiuhgchj76tiy
JWT_REFRESH_SECRET=tf76yghtjuioy7gdehyu6t78rdye432wsterdtyuh
COOKIE_SECRET=ft67hubgti768yguvf7ihugyt78yhbgihbj
MASTER_ENCRYPTION_KEY=savdbia8s98ydgiqwns98s0a9djsa98hsu_master_key_encryption

# CORS — all frontend subdomains
FRONTEND_URL=https://hr.spl.inplsoftwares.com,https://admin.spl.inplsoftwares.com,https://master.spl.inplsoftwares.com,https://auth.spl.inplsoftwares.com,https://erp.spl.inplsoftwares.com,https://pos.spl.inplsoftwares.com

COOKIE_DOMAIN=.spl.inplsoftwares.com
RUN_BACKUP_RESTORE=true
```

### 6b. Install dependencies and build

```bash
cd /opt/speed-limit/nestjs_backend
bun install

# Generate Prisma clients
bun run prisma:master:generate
bun run prisma:tenant:generate

# Push schemas to database
bun run prisma:master:push --accept-data-loss
bun run prisma:tenant:push

# Check if seeding is needed, then seed
bun run check-seed.ts || bun run prisma:master:seed

# Build the application
bun run build
```

### 6c. Start with PM2

```bash
cd /opt/speed-limit/nestjs_backend

pm2 start "bun run start:prod" \
  --name spl-backend \
  --cwd /opt/speed-limit/nestjs_backend

# Check it started correctly
pm2 status
pm2 logs spl-backend --lines 50
```

---

## 7. Frontend Setup

### 7a. Environment file

```bash
cd /opt/speed-limit/frontend
nano .env
```

Set the following:

```env
NODE_ENV=production
NEXT_PUBLIC_API_BASE_URL=https://auth.spl.inplsoftwares.com/api
API_URL=https://auth.spl.inplsoftwares.com/api
NEXT_PUBLIC_BASE_DOMAIN=spl.inplsoftwares.com
NEXT_PUBLIC_COOKIE_DOMAIN=.spl.inplsoftwares.com
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=LjRCInkgXG3wowhfDggE0aUvovxxYUog0hdHcGarO/o=
```

### 7b. Install dependencies and build

```bash
cd /opt/speed-limit/frontend
bun install
bun run build
```

> The build uses `output: "standalone"` in `next.config.ts`, so the output is self-contained in `.next/standalone`.

### 7c. Start with PM2

```bash
# Copy static assets into the standalone output (required by Next.js standalone)
cp -r /opt/speed-limit/frontend/.next/static /opt/speed-limit/frontend/.next/standalone/.next/static
cp -r /opt/speed-limit/frontend/public /opt/speed-limit/frontend/.next/standalone/public

pm2 start "bun run server.js" \
  --name spl-frontend \
  --cwd /opt/speed-limit/frontend/.next/standalone \
  --env production

# Check it started correctly
pm2 status
pm2 logs spl-frontend --lines 50
```

### 7d. Save PM2 process list and enable startup on boot

Run this **once** after both services are started:

```bash
pm2 save
pm2 startup
# PM2 will print a command — copy and run it (it looks like):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u youruser --hp /home/youruser
```

---

## 8. Nginx Configuration

### 8a. Create the site config

```bash
sudo nano /etc/nginx/sites-available/speed-limit
```

Paste the following (HTTP only for now — SSL will be added in the next step):

```nginx
server {
    listen 80;
    server_name hr.spl.inplsoftwares.com auth.spl.inplsoftwares.com master.spl.inplsoftwares.com pos.spl.inplsoftwares.com erp.spl.inplsoftwares.com admin.spl.inplsoftwares.com;

    client_max_body_size 500M;

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket (Socket.IO)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 8b. Enable the site

```bash
sudo ln -s /etc/nginx/sites-available/speed-limit /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. SSL with Let's Encrypt

Run Certbot once to issue certificates for all subdomains:

```bash
sudo certbot --nginx \
  -d auth.spl.inplsoftwares.com \
  -d hr.spl.inplsoftwares.com \
  -d erp.spl.inplsoftwares.com \
  -d master.spl.inplsoftwares.com \
  -d pos.spl.inplsoftwares.com \
  -d admin.spl.inplsoftwares.com \
  --email admin@inplsoftwares.com \
  --agree-tos \
  --non-interactive
```

Certbot will automatically update your Nginx config with SSL settings and set up auto-renewal via a systemd timer.

Verify auto-renewal is active:

```bash
sudo systemctl status certbot.timer
```

---

## ✅ Verification

Check all services are running:

```bash
# PM2 processes
pm2 status

# System services
sudo systemctl status postgresql redis nginx
```

Test the endpoints:

| URL | Expected |
|-----|----------|
| `https://auth.spl.inplsoftwares.com` | Frontend login page |
| `https://hr.spl.inplsoftwares.com` | HR portal |
| `https://erp.spl.inplsoftwares.com` | ERP portal |
| `https://auth.spl.inplsoftwares.com/api` | Backend API root |

---

## 🔄 Updates

```bash
cd /opt/speed-limit

# Pull latest code
git pull origin main
git submodule update --init --recursive

# Rebuild backend
cd nestjs_backend
bun install
bun run prisma:master:push --accept-data-loss
bun run prisma:tenant:push
bun run build
pm2 restart spl-backend

# Rebuild frontend
cd ../frontend
bun install
bun run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
pm2 restart spl-frontend
```

---

## 🛠️ Useful Commands

```bash
# View all PM2 processes
pm2 status

# Live logs
pm2 logs spl-backend
pm2 logs spl-frontend

# Restart / stop
pm2 restart spl-backend
pm2 restart spl-frontend
pm2 stop spl-backend

# Monitor CPU/memory in real time
pm2 monit

# View Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Reload Nginx after config changes
sudo nginx -t && sudo systemctl reload nginx

# Check PostgreSQL connection
psql -U spl_admin -h localhost -d spl_core_db -c "\l"
```


---

---

# 🐳 Docker Deployment Guide (Legacy)

This is the original Docker-based deployment guide, kept for reference.

## 📋 Prerequisites

- A fresh VPS (Ubuntu 20.04/22.04 recommended).
- Root or sudo access.
- Domain name `spl.inplsoftwares.com`.

## 🌐 1. DNS Configuration

Configure your DNS records to point to your VPS IP address.

| Type | Name | Content | Proxy Status |
| :--- | :--- | :--- | :--- |
| A | `auth` | `YOUR_VPS_IP` | Proxied / DNS Only |
| A | `hr` | `YOUR_VPS_IP` | Proxied / DNS Only |
| A | `erp` | `YOUR_VPS_IP` | Proxied / DNS Only |
| A | `*` | `YOUR_VPS_IP` | Proxied / DNS Only |

*This setup supports subdomains like `auth.spl.inplsoftwares.com`, `hr.spl.inplsoftwares.com`, etc.*

## 🛠️ 2. Install Docker & Git

Connect to your VPS via SSH and run the following snippet to install everything.

```bash
# Update system and install Docker
sudo apt update 
sudo apt install -y git curl
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo systemctl start docker && sudo systemctl enable docker
```

## 🚀 3. Deploy

Clone the repository (with submodules) and start the application.

```bash
# Clone the repository with submodules
git clone --recursive https://github.com/Abdul-Maroof-Yousfani/hr_speed_limited.git
cd speed-limit

# Start everything
sudo docker compose -f docker-compose.prod.yml up -d --build
```

## 🔐 4. Enable HTTPS (SSL)

Once the containers are running, run the following command **once** to get your SSL certificates.

```bash
# Make script executable
chmod +x init-ssl.sh

# Run the SSL setup
sudo ./init-ssl.sh
```

*This script will interact with Let's Encrypt to issue certificates for your configured subdomains on `spl.inplsoftwares.com`.*

**That's it!** Docker will build the frontend with your domain settings and start the Nginx proxy with full HTTPS.

## ✅ Verification

You should be able to access:
- Auth Portal: `https://auth.spl.inplsoftwares.com`
- ERP Portal: `https://erp.spl.inplsoftwares.com`
- Backend API (via any): `https://auth.spl.inplsoftwares.com/api`

## 🔄 Updates

To update the application code:

```bash
# Pull latest code and submodules
git pull origin main
git submodule update --init --recursive

# Rebuild and restart
sudo docker compose -f docker-compose.prod.yml up -d --build
```
