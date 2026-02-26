# West Yorkshire Carpets — Lead Management Backend

A secure, GDPR-compliant lead management API built with Node.js and Express.
Integrates seamlessly with the existing landing page to collect and manage
customer enquiries.

---

## Project Structure

```
wyc-backend/
├── server.js                    # Express entry point
├── package.json
├── .env.example                 # Copy to .env and configure
│
├── data/                        # Auto-created — SQLite database lives here
│   └── wyc_leads.db             # Created on first run
│
├── logs/                        # Auto-created in production
│   ├── combined.log
│   └── error.log
│
└── src/
    ├── config/
    │   ├── database.js           # SQLite / PostgreSQL adapter
    │   ├── schema.sql            # Database schema
    │   └── initDb.js             # Initialisation script
    │
    ├── controllers/
    │   ├── leadController.js     # POST /api/leads logic
    │   └── adminController.js    # Admin CRUD operations
    │
    ├── middleware/
    │   ├── security.js           # Helmet, CORS, rate limiter, CSRF
    │   └── validate.js           # Input validation chains
    │
    ├── routes/
    │   ├── leads.js              # Public API routes
    │   └── admin.js              # Protected admin routes
    │
    ├── services/
    │   ├── emailService.js       # Nodemailer notifications
    │   └── csvService.js         # CSV export generator
    │
    └── utils/
        └── logger.js             # Winston structured logger
```

---

## Quick Start — Local Development

### Prerequisites
- Node.js 18+ (check: `node -v`)
- npm 9+ (check: `npm -v`)

### Steps

```bash
# 1. Navigate to the backend directory
cd wyc-backend

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env

# 4. Open .env and set:
#    SESSION_SECRET  — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#    ADMIN_TOKEN     — generate with: node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
#    ALLOWED_ORIGIN  — URL of your frontend (e.g. http://localhost:5500)

# 5. Initialise the database
node src/config/initDb.js

# 6. Start the development server (auto-restarts on file changes)
npm run dev
```

The API is now running at **http://localhost:3001**

Open your `index.html` via VS Code Live Server (http://localhost:5500)
and submit the contact form to test the integration.

---

## API Reference

### Public Endpoints

| Method | Path              | Description                              |
|--------|-------------------|------------------------------------------|
| GET    | `/health`         | Server health check                      |
| GET    | `/api/csrf-token` | Get CSRF token (call before POST)        |
| POST   | `/api/leads`      | Submit a new lead enquiry                |

#### POST /api/leads — Request Body

```json
{
  "name":             "Jane Smith",
  "email":            "jane@example.com",
  "phone":            "07700 900000",
  "postcode":         "LS1 1AA",
  "service_type":     "Carpet Fitting",
  "message":          "I need a quote for my living room and hallway.",
  "gdpr_consent":     true,
  "room_length_m":    4.5,
  "room_width_m":     3.2,
  "flooring_type":    "carpet_premium",
  "include_underlay": true,
  "include_fitting":  false,
  "estimated_cost":   144.00
}
```

#### POST /api/leads — Response (201 Created)

```json
{
  "success":   true,
  "message":   "Thank you! We'll be in touch within 24 hours.",
  "reference": "A3B2C1D4"
}
```

#### POST /api/leads — Validation Error (422)

```json
{
  "success": false,
  "error":   "Please check the highlighted fields and try again.",
  "fields": [
    { "field": "phone",    "message": "Please enter a valid UK phone number." },
    { "field": "postcode", "message": "Please enter a valid UK postcode." }
  ]
}
```

---

### Admin Endpoints

All admin endpoints require:
```
Authorization: Bearer YOUR_ADMIN_TOKEN
```

| Method | Path                          | Description                    |
|--------|-------------------------------|--------------------------------|
| GET    | `/api/admin/dashboard`        | Summary stats                  |
| GET    | `/api/admin/leads`            | List leads (paginated)         |
| GET    | `/api/admin/leads?status=new` | Filter by status               |
| GET    | `/api/admin/leads/export.csv` | Download all leads as CSV      |
| GET    | `/api/admin/leads/:id`        | Single lead + audit log        |
| PATCH  | `/api/admin/leads/:id/status` | Update lead status             |
| DELETE | `/api/admin/leads/:id`        | Anonymise lead (GDPR)          |
| DELETE | `/api/admin/leads/:id?hard=true` | Permanently delete          |

#### Example: List new leads (curl)

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     "http://localhost:3001/api/admin/leads?status=new&limit=20"
```

#### Example: Update lead status

```bash
curl -X PATCH \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"status": "contacted"}' \
     "http://localhost:3001/api/admin/leads/UUID-HERE/status"
```

#### Example: Export CSV

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     "http://localhost:3001/api/admin/leads/export.csv" \
     --output leads-export.csv
```

#### Lead Status Lifecycle

```
new → contacted → quoted → won
                         → lost
         (any) → spam
```

---

## Email Notifications

To enable admin email alerts on each new lead:

1. Set `MAIL_ENABLED=true` in `.env`
2. Configure SMTP credentials (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`)
3. Set `MAIL_TO` to your admin email address

### Gmail Setup

1. Enable 2-Factor Authentication on your Google account
2. Visit: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Create an App Password for "Mail"
4. Use that 16-character password as `SMTP_PASS`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=yourname@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
```

### Brevo (Sendinblue) — Free tier: 300 emails/day

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=yourname@gmail.com
SMTP_PASS=your_brevo_smtp_key
```

---

## Production Deployment

### Option A — Small VPS (Recommended for this use case)

Tested on Ubuntu 22.04 LTS, DigitalOcean Droplet / Hetzner Cloud.

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 process manager
sudo npm install -g pm2

# Clone / upload your code
cd /var/www/wyc-backend
npm install --omit=dev

# Create production .env
nano .env
# Set: NODE_ENV=production, ALLOWED_ORIGIN=https://yourdomain.co.uk

# Initialise database
node src/config/initDb.js

# Start with PM2 (auto-restarts on crash, survives reboots)
pm2 start server.js --name wyc-api --env production
pm2 save
pm2 startup
```

### Nginx Reverse Proxy (Recommended)

Serve your frontend on port 80/443 and proxy /api to Node.js on 3001.

```nginx
server {
    listen 443 ssl http2;
    server_name westyorkshirecarpets.co.uk;

    # SSL — use Certbot for free Let's Encrypt cert
    ssl_certificate     /etc/letsencrypt/live/westyorkshirecarpets.co.uk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/westyorkshirecarpets.co.uk/privkey.pem;

    # Frontend static files
    root /var/www/wyc-frontend;
    index index.html;

    # API proxy
    location /api {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3001;
    }
}
```

When frontend and API are on the same domain, update `.env`:
```env
ALLOWED_ORIGIN=https://westyorkshirecarpets.co.uk
```

And update `API_BASE` in `form-handler.js`:
```javascript
const API_BASE = '';  // Empty string = same origin
```

### Option B — Railway / Render / Heroku (Zero-config cloud)

```bash
# Railway
npm install -g @railway/cli
railway login
railway init
railway up

# Set environment variables in the Railway dashboard
# The PORT is set automatically by Railway
```

---

## Switching to PostgreSQL

For high-traffic or multi-server deployments:

1. Install PostgreSQL and create a database:
```sql
CREATE DATABASE wyc_leads;
CREATE USER wyc_user WITH PASSWORD 'strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE wyc_leads TO wyc_user;
```

2. Install the pg driver:
```bash
npm install pg
```

3. Update `.env`:
```env
DB_TYPE=postgres
POSTGRES_HOST=localhost
POSTGRES_DB=wyc_leads
POSTGRES_USER=wyc_user
POSTGRES_PASSWORD=strong_password_here
```

4. Convert schema.sql for PostgreSQL:
- Replace `strftime('%Y-%m-%dT%H:%M:%SZ', 'now')` → `NOW()`
- Replace `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
- Run schema manually: `psql -U wyc_user -d wyc_leads -f src/config/schema.sql`

---

## Security Summary

| Threat              | Defence                                                    |
|---------------------|------------------------------------------------------------|
| SQL Injection        | Prepared statements (never string concatenation)          |
| XSS                  | Helmet CSP headers + express-validator `.escape()`        |
| CSRF                 | Double-submit cookie pattern (`X-CSRF-Token` header)      |
| Spam / Bots          | Honeypot field + IP rate limiting (5 req/15 min)          |
| Brute Force          | General rate limiter (60 req/min) + Admin token auth      |
| Timing Attacks       | `crypto.timingSafeEqual` for all token comparisons        |
| Info Leakage         | Generic 500 errors, no stack traces in production         |
| IP Privacy           | Last IP octet anonymised before storage                   |
| GDPR Article 17      | Soft anonymisation preserves analytics, removes PII       |

---

## GDPR Compliance Notes

- Minimal data collection (Art. 5): only fields necessary for the service
- Consent recorded with timestamp (Art. 7) via `gdpr_consent_at`
- Right to erasure (Art. 17): `DELETE /api/admin/leads/:id` anonymises PII
- IP addresses are anonymised before storage (last octet removed)
- Audit log provides accountability trail for Subject Access Requests
- Data should not be retained beyond 2 years without active customer relationship

---

## Maintenance

```bash
# View live logs
pm2 logs wyc-api

# Monitor CPU / memory
pm2 monit

# Restart after code update
pm2 reload wyc-api

# SQLite backup (run daily via cron)
cp data/wyc_leads.db "data/backups/wyc_leads_$(date +%Y%m%d).db"

# View recent leads in SQLite directly
sqlite3 data/wyc_leads.db "SELECT name, phone, postcode, service_type, status, created_at FROM leads ORDER BY created_at DESC LIMIT 20;"
```

---

## Environment Variables Reference

| Variable              | Required | Default           | Description                        |
|-----------------------|----------|-------------------|------------------------------------|
| `NODE_ENV`            | No       | `development`     | `development` or `production`      |
| `PORT`                | No       | `3001`            | Server port                        |
| `ALLOWED_ORIGIN`      | Yes      | `localhost:5500`  | Frontend origin (no trailing /)    |
| `DB_TYPE`             | No       | `sqlite`          | `sqlite` or `postgres`             |
| `SQLITE_PATH`         | No       | `./data/wyc.db`   | SQLite file path                   |
| `SESSION_SECRET`      | Yes      | —                 | 32+ char random string             |
| `ADMIN_TOKEN`         | Yes      | —                 | Admin API bearer token             |
| `MAIL_ENABLED`        | No       | `false`           | Enable email notifications         |
| `SMTP_HOST`           | No       | `smtp.gmail.com`  | SMTP server hostname               |
| `SMTP_PORT`           | No       | `587`             | SMTP port                          |
| `SMTP_USER`           | No       | —                 | SMTP username                      |
| `SMTP_PASS`           | No       | —                 | SMTP password / app password       |
| `MAIL_FROM`           | No       | —                 | From address for emails            |
| `MAIL_TO`             | No       | —                 | Admin notification recipient       |
| `RATE_LIMIT_MAX`      | No       | `5`               | Max lead submissions per window    |
| `RATE_LIMIT_WINDOW_MS`| No       | `900000`          | Rate limit window (15 min default) |
| `LOG_LEVEL`           | No       | `info`            | `debug/info/warn/error`            |
