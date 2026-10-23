# DocFlow — Hostinger Deployment Guide

This guide covers deploying DocFlow to Hostinger VPS (Docker-based) or Hostinger shared hosting (static + Node backend).

---

## Architecture Overview

```
User → Nginx (port 80/443)
         ├── /          → Frontend (React static files)
         ├── /api/      → Backend (Fastify, port 3001)
         ├── /worker/   → Python OCR worker (port 8001)
         └── /health    → Backend health check

PostgreSQL (port 5432)  → Database
Redis (port 6379)       → Job queue
LibreOffice (port 2003) → Document conversion
```

---

## Option A: Hostinger VPS (Recommended)

Hostinger VPS gives you full Docker support. This is the recommended path.

### Prerequisites
- Hostinger VPS (minimum 4 GB RAM, 2 vCPU — KVM plan)
- Ubuntu 22.04 or 24.04
- SSH access
- Domain name pointed to VPS IP

### Step 1: Point Domain to VPS
1. In Hostinger hPanel → DNS Zone Editor
2. Add A record: `@` → your VPS IP
3. Add A record: `www` → your VPS IP
4. Wait for DNS propagation (5-30 min)

### Step 2: SSH into VPS & Install Docker
```bash
ssh root@YOUR_VPS_IP

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Install Docker Compose
apt install docker-compose-plugin -y
```

### Step 3: Clone & Configure
```bash
cd /opt
git clone https://github.com/yourusername/docflow.git
cd docflow

# Copy and edit production env
cp infra/.env.production.example .env
nano .env
```

**Critical values to change in `.env`:**
```env
DB_PASSWORD=<strong-random-password>
JWT_SECRET=<64-char-random-string>
CORS_ORIGIN=https://yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=your@gmail.com
```

### Step 4: Build & Start
```bash
# Build and start all services
docker compose -f infra/docker-compose.prod.yml --env-file .env up -d --build

# Check status
docker compose -f infra/docker-compose.prod.yml ps

# View logs
docker compose -f infra/docker-compose.prod.yml logs -f backend
```

### Step 5: Run Database Migrations
```bash
docker compose -f infra/docker-compose.prod.yml exec backend npx drizzle-kit push
```

### Step 6: Set Up SSL (Let's Encrypt)
```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get SSL certificate
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up automatically
```

### Step 7: Set Up Backups
```bash
# Edit backup script
nano infra/backup.sh

# Set up cron job (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /opt/docflow/infra/backup.sh /backups
```

---

## Option B: Hostinger Shared Hosting (Limited)

Shared hosting doesn't support Docker. You can deploy the frontend as static files and run the backend on a Node.js-capable plan.

### Frontend (Static)
1. Build locally: `cd frontend && npm run build`
2. Upload `frontend/dist/` contents to `public_html/` via File Manager or FTP
3. Add `.htaccess` for SPA routing (see below)

### `.htaccess` for SPA routing
Create `public_html/.htaccess`:
```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

### Backend (Node.js)
1. Upload `backend/` folder to your hosting
2. In hPanel → "Node.js" section, create a new app
3. Set entry point to `dist/index.js`
4. Set environment variables in the Node.js panel
5. Use Hostinger's PostgreSQL database (create via hPanel)

**Limitations of shared hosting:**
- No Redis (BullMQ jobs won't work — OCR/export features limited)
- No Docker (no LibreOffice worker — export to DOCX/XLSX won't work)
- No Python worker (OCR won't work)
- Only suitable for basic PDF text editing

**Recommendation:** Use VPS for full functionality.

---

## Production Checklist

### Security
- [ ] Change `DB_PASSWORD` from default
- [ ] Set strong `JWT_SECRET` (64+ chars random)
- [ ] Set `CORS_ORIGIN` to your actual domain
- [ ] Enable HTTPS via Let's Encrypt
- [ ] Configure SMTP with real credentials
- [ ] Remove test/debug endpoints
- [ ] Set `NODE_ENV=production`
- [ ] Firewall: only expose ports 80, 443, 22
  ```bash
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw enable
  ```

### Database
- [ ] Run migrations: `npx drizzle-kit push`
- [ ] Create admin user (via SQL or API)
- [ ] Set up daily backups
- [ ] Verify PostgreSQL is not exposed externally (port 5432 blocked by firewall)

### Performance
- [ ] Enable gzip in nginx (already configured)
- [ ] Set up CDN for static assets (optional: Cloudflare)
- [ ] Configure nginx caching for static files
- [ ] Monitor memory usage (minimum 4 GB RAM recommended)

### Monitoring
- [ ] Set up uptime monitoring (UptimeRobot, free)
- [ ] Check `/health` endpoint regularly
- [ ] Monitor disk space (uploads can grow)
- [ ] Set up log rotation for Docker

### Email
- [ ] Configure SMTP (Gmail App Password or Hostinger mail)
- [ ] Test OTP delivery
- [ ] Set `SMTP_FROM` to a valid sender address
- [ ] Check spam folder delivery (set SPF/DKIM records if using custom domain)

### Payment Gateways (Optional)
- [ ] Stripe: Set API keys in `.env`
- [ ] bKash: Set sandbox keys first, test, then switch to production
- [ ] SSL Commerz: Configure store ID and password

---

## Admin Panel Access

### How to log in as admin:
1. Sign in normally via `/auth` with your admin email
2. The dashboard header shows an "Admin" button if `is_admin = true` for your user
3. Click it to access `/admin`

### How to set a user as admin:
**Option 1 — SQL:**
```sql
UPDATE users SET is_admin = true WHERE email = 'your@email.com';
```

**Option 2 — Admin panel:**
Once you have admin access, go to Users tab → click the crown icon next to any user.

### What's available in admin:
- **Stats**: Total users, projects, payments, revenue, plan distribution
- **Users**: View all customers, change plans, grant/revoke admin, delete users, add manual payments
- **Projects**: View all projects across all users (name, pages, size, share status)
- **Payments**: View all payment records (amount, provider, status, date)

---

## Quick Deploy Commands (VPS)

```bash
# One-time setup
ssh root@YOUR_IP
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin certbot python3-certbot-nginx -y
cd /opt && git clone https://github.com/yourusername/docflow.git
cd docflow && cp infra/.env.production.example .env
nano .env  # Edit all values

# Deploy
docker compose -f infra/docker-compose.prod.yml --env-file .env up -d --build
docker compose -f infra/docker-compose.prod.yml exec backend npx drizzle-kit push

# SSL
certbot --nginx -d yourdomain.com

# Update (future)
cd /opt/docflow
git pull
docker compose -f infra/docker-compose.prod.yml --env-file .env up -d --build
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| OTP not sending | Check SMTP credentials in `.env`, restart backend |
| 502 Bad Gateway | Backend not running — check `docker compose logs backend` |
| Upload fails | Check `client_max_body_size` in nginx.conf (50M default) |
| OCR not working | Python worker not running — check `docker compose logs worker` |
| Export stuck | LibreOffice worker not running — check `docker compose logs libreoffice` |
| Database connection error | Check PostgreSQL container is healthy, verify `DATABASE_URL` |
| Redis version error | Ensure Redis 7+ image is used (already configured) |

---

## Post-Deploy Verification

After deployment, verify these endpoints:
1. `https://yourdomain.com/` — Landing page loads
2. `https://yourdomain.com/auth` — Login page works
3. `https://yourdomain.com/health` — Returns `{"status":"ok"}`
4. Request OTP → check email arrives
5. Verify OTP → dashboard loads
6. Create project → editor opens
7. Upload PDF → pages render
8. Admin panel → `/admin` accessible (if admin)
