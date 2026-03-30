# Delivery Command Center — Railway Deployment Guide

## Stack
- **API**: Node.js + Express + Prisma ORM
- **DB**: PostgreSQL (Railway managed)
- **Client**: React + Vite (served by Express in production)
- **Deployment**: Single Railway service — API serves both `/api/*` and the built React client

---

## One-Time Setup

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "initial: DCC monorepo"
git remote add origin https://github.com/YOUR_ORG/delivery-command-center.git
git push -u origin main
```

### 2. Create Railway Project
1. Go to [railway.app](https://railway.app) → New Project
2. **Deploy from GitHub repo** → select your repo
3. Railway will detect it as a Node.js project

### 3. Add PostgreSQL
1. In your Railway project → **+ New** → **Database** → **PostgreSQL**
2. Railway auto-injects `DATABASE_URL` into your service — no manual copy needed

### 4. Set Environment Variables
In your Railway service → **Variables** tab, add:

```
NODE_ENV=production
PORT=3001
CLIENT_URL=https://YOUR-APP.railway.app
```

That's it. `DATABASE_URL` is injected automatically by Railway.

### 5. Configure Build & Start Commands
In Railway service → **Settings** → **Deploy**:

- **Build Command**: `npm install && cd client && npm install && npm run build && cd ../api && npm install && npx prisma generate`
- **Start Command**: `cd api && npx prisma migrate deploy && npx prisma db seed && node src/index.js`

> The seed command is idempotent — it uses `upsert` and skips existing records. Safe to run on every deploy.

---

## Local Development

### Prerequisites
- Node 18+
- PostgreSQL running locally (or use a Railway dev DB)

### Setup
```bash
# Install all deps
npm install        # installs root devDependencies (concurrently)
cd api && npm install
cd ../client && npm install

# Create api/.env
cp api/.env.example api/.env
# Edit api/.env — set DATABASE_URL to your local postgres connection string

# Run migrations + seed
cd api
npx prisma migrate dev --name init
npx prisma db seed

# Start both API + client with hot reload
cd ..
npm run dev
```

### .env file (api/.env)
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/dcc_dev
NODE_ENV=development
PORT=3001
```

Client dev server runs on `:5173` and proxies `/api` → `:3001` via vite.config.js.

---

## Database Commands

```bash
# New migration (after schema changes)
cd api && npx prisma migrate dev --name describe_change

# Apply migrations (production)
cd api && npx prisma migrate deploy

# Re-seed data
cd api && npx prisma db seed

# Open Prisma Studio (GUI)
cd api && npx prisma studio
```

---

## Project Structure

```
delivery-command-center/
├── package.json          ← root scripts (dev, build, start)
├── railway.toml          ← Railway config
├── api/
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma ← data model
│   │   └── seed.js       ← seed data (skills, currencies, 9 resources)
│   └── src/
│       ├── index.js      ← Express server + static file serving
│       ├── lib/
│       │   ├── prisma.js      ← singleton DB client
│       │   └── costEngine.js  ← cost rate calculations (source of truth)
│       └── routes/
│           ├── resources.js   ← CRUD + cost history
│           ├── skills.js
│           ├── currencies.js
│           ├── config.js
│           ├── projects.js    ← SOW + roles + milestones
│           ├── pipeline.js
│           ├── deployments.js ← resource assignments
│           ├── actuals.js     ← monthly hours entry
│           └── dashboard.js   ← computed KPIs + alerts
└── client/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css          ← full design system (DM Sans + DM Mono)
        ├── lib/
        │   ├── api.js         ← all API calls
        │   └── costEngine.js  ← client-side cost preview
        ├── pages/
        │   ├── Dashboard.jsx
        │   ├── Resources.jsx
        │   ├── ResourceProfile.jsx
        │   ├── Projects.jsx   ← stub (next sprint)
        │   ├── Pipeline.jsx   ← stub
        │   ├── Financials.jsx ← stub
        │   └── Settings.jsx   ← currencies + config + skills CRUD
        └── components/
            ├── layout/
            │   ├── Sidebar.jsx
            │   └── Topbar.jsx
            └── resources/
                └── ResourceModal.jsx  ← 4-step form
```

---

## API Routes Reference

```
GET    /api/dashboard                   ← KPIs + alerts (computed)
GET    /api/resources                   ← list (filters: location, employmentType, status, search)
GET    /api/resources/:id               ← detail with costHistory + deployments
POST   /api/resources                   ← create (builds first costHistory entry)
PATCH  /api/resources/:id               ← update (auto-closes cost history if rate changed)
DELETE /api/resources/:id

GET    /api/skills                      ← all skills + submods
POST   /api/skills
PATCH  /api/skills/:id
DELETE /api/skills/:id

GET    /api/currencies
POST   /api/currencies                  ← upsert
PATCH  /api/currencies/:code            ← update rate
DELETE /api/currencies/:code

GET    /api/config
PATCH  /api/config                      ← update system parameters

GET    /api/projects                    ← active SOWs
GET    /api/projects/:id
POST   /api/projects
PATCH  /api/projects/:id
POST   /api/projects/:id/roles
POST   /api/projects/:id/milestones
PATCH  /api/projects/milestones/:mid

POST   /api/deployments                 ← assign resource to role
PATCH  /api/deployments/:id
DELETE /api/deployments/:id             ← recomputes resource status

POST   /api/actuals                     ← upsert monthly hours (deploymentId + month)
DELETE /api/actuals/:id

GET    /api/pipeline
POST   /api/pipeline
PATCH  /api/pipeline/:id
```

---

## Build Sequence (what's done, what's next)

### ✅ Done
- Prisma schema: all models (Resource, CostHistory, Skill, Currency, Project, Role, Deployment, Actual, Opportunity)
- API: all routes scaffolded
- Cost engine: all 8 scenarios, point-in-time P&L aware
- Client: DM Sans design system, routing, sidebar, topbar
- Dashboard: computed KPIs + alerts panel
- Resources: list view, profile view, 4-step add/edit modal
- Settings: currency CRUD, system config, skills CRUD
- Seed: 21 skills, 9 sample resources with full cost history

### 🔜 Next Sprint
1. SOW module (Projects page): create SOW, add roles, assign resources, enter monthly actuals
2. P&L page: project-level and company-level margin reports
3. Pipeline: opportunity management + convert to SOW
4. Auth: Clerk or simple JWT — one admin role for now
