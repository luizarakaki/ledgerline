# Ledgerline

A subsidiary consolidation tool. A parent company with one wholly-owned (100%)
subsidiary uploads four CSVs — Parent P&L, Parent Balance Sheet, Subsidiary P&L,
Subsidiary Balance Sheet — and Ledgerline produces a consolidated P&L and Balance
Sheet in the standard worksheet format (**Parent | Subsidiary | Eliminations |
Consolidated**), with intercompany eliminations handled at the account level.

Built from a Claude Design handoff. USD only, no multi-currency.

## What it does

- **Auth** — email + password sign up / sign in. Passwords hashed with **argon2id**;
  sessions are signed JWTs in an httpOnly cookie.
- **Import** — four labeled CSV drop-zones, drag-and-drop or browse, plus a
  **Load sample data** button. Account matching is keyword-based (due to/from,
  investment in, subsidiary revenue, parent fees) — nothing is hardcoded to the
  sample files, so renamed or reordered rows still work.
- **Consolidation worksheet** — every figure ties out. Intercompany
  Subsidiary Revenue ↔ Parent Company Fees eliminate on the P&L; due-from/due-to
  and the parent's investment ↔ the sub's common stock eliminate on the balance
  sheet. The consolidated balance sheet still balances (green badge).
- **Eliminations** — hover any elimination figure (marked ①②) for a plain-English
  journal-entry explanation.
- **Validation** — flags unmatched eliminations, out-of-balance sheets, and net
  income mismatches.
- **Two views** — the full worksheet, or a clean final-statement view.
- **Persistence** — every consolidation is saved server-side as a *dataset* with
  its raw CSVs. Each user sees only their own datasets and can reopen them later.

## Stack

- **API** — Fastify 5, Drizzle ORM, PostgreSQL, argon2, Zod. Node 22, TypeScript, ESM.
- **Web** — React 18, Vite 6, Tailwind CSS, shadcn/ui, React Hook Form, TypeScript.
- **Deploy** — single Docker image (Fastify serves the API under `/api` and the
  built SPA for everything else). Targets Railway.

```
ledgerline/
├── api/                 # Fastify + Drizzle + Postgres
│   ├── src/
│   │   ├── index.ts     # server entry (runs migrations, serves API + SPA)
│   │   ├── config.ts
│   │   ├── db/          # schema.ts, client.ts
│   │   ├── lib/         # csv.ts (parser), engine.ts (consolidation), auth.ts (argon2)
│   │   └── routes/      # auth.ts, datasets.ts
│   └── drizzle/         # generated SQL migrations (source of truth)
├── web/                 # React SPA
│   └── src/
│       ├── screens/     # AuthScreen, UploadScreen, ResultScreen
│       ├── components/  # ui/ (shadcn), icons, primitives
│       └── lib/         # api client, types, sample data
├── Dockerfile           # multi-stage build for Railway
└── docker-compose.yml   # local Postgres
```

## Local development

Requires Node 22 and Docker (for Postgres).

```bash
# 1. Install dependencies (npm workspaces)
npm install

# 2. Start Postgres
docker compose up -d db

# 3. Configure environment
cp .env.example api/.env       # adjust if needed

# 4. Apply migrations (also run automatically on server boot)
npm run db:push                # or: npm run db:generate to add a new migration

# 5. Run API (:8080) and web dev server (:5173) together
npm run dev
```

The Vite dev server proxies `/api` to the Fastify server, so open
**http://localhost:5173**. Sign up, hit **Load sample data**, name it, and
**Run consolidation**.

### Environment variables

| Variable       | Description                                  | Default (dev)                                             |
| -------------- | -------------------------------------------- | --------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string                 | `postgres://ledgerline:ledgerline@localhost:5432/ledgerline` |
| `JWT_SECRET`   | Secret used to sign session JWTs             | `dev-insecure-secret-change-me`                           |
| `PORT`         | Port the server listens on                   | `8080`                                                    |
| `NODE_ENV`     | `development` / `production`                 | `development`                                             |

## Database & migrations

Drizzle migrations in `api/drizzle/` are the single source of truth for the
schema. They are generated from `api/src/db/schema.ts`:

```bash
npm run db:generate    # write a new migration after editing schema.ts
npm run db:migrate     # apply migrations explicitly
```

The server also runs pending migrations automatically on boot, so a fresh
database is provisioned on first start (including in the Docker image).

## Production build & Docker

```bash
# Build everything (web SPA + compiled API)
npm run build

# Or build the deployable image
docker build -t ledgerline .
docker run -p 8080:8080 \
  -e DATABASE_URL=postgres://... \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  -e NODE_ENV=production \
  ledgerline
```

The container serves the whole app on `$PORT`.

### Deploying to Railway

1. Create a Railway project and add a **PostgreSQL** plugin.
2. Add this repo as a service; Railway detects the `Dockerfile` automatically.
3. Set service variables: `JWT_SECRET` (a long random value) and `NODE_ENV=production`.
   Reference the Postgres plugin's connection string as `DATABASE_URL`
   (e.g. `${{Postgres.DATABASE_URL}}`). Railway injects `PORT` automatically.
4. Deploy. Migrations run on boot; no separate release step is required.

## API reference

All dataset routes require the session cookie set by sign in / sign up.

| Method | Path                              | Description                               |
| ------ | --------------------------------- | ----------------------------------------- |
| POST   | `/api/auth/signup`                | Create account, set session cookie        |
| POST   | `/api/auth/signin`                | Sign in, set session cookie               |
| POST   | `/api/auth/signout`               | Clear session cookie                      |
| GET    | `/api/auth/me`                    | Current user                              |
| GET    | `/api/datasets`                   | List the user's datasets                  |
| POST   | `/api/datasets`                   | Create a dataset from four uploaded CSVs  |
| GET    | `/api/datasets/:id`               | Dataset detail incl. stored raw CSV       |
| GET    | `/api/datasets/:id/consolidation` | Run the consolidation engine, return result |
| DELETE | `/api/datasets/:id`               | Delete a dataset                          |

## Consolidation logic

Sign convention is preserved from the trial-balance input — revenue & assets
positive; expenses, liabilities & equity negative — so on every line
**Consolidated = Parent + Subsidiary + Eliminations**, and a balanced
consolidated balance sheet sums its Consolidated column to zero.

Against the sample data the engine produces **Net income = $133,500**,
**Total assets = $732,000**, and a balanced balance sheet. The investment
elimination recognizes any excess over the sub's contributed equity as goodwill
rather than silently absorbing it.
