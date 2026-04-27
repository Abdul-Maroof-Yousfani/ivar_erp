# 🚀 Deployment Guide

This guide provides the simplest path to deploy the Speed Limit application on a fresh VPS.

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
