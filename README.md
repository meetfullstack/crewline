# Crewline

Workforce management and employee scheduling for restaurants and hospitality teams.

Managers build the week on a drag-and-drop schedule, see labour cost as they go, and publish when it's right. Staff get a portal to see their shifts, set availability, request time off and pick up open shifts.

> Portfolio project, in active development.

## Features

| Module | Status |
| --- | --- |
| Auth with Owner / Manager / Employee roles | ✅ Done |
| Employee management (directory, profiles, positions, availability, certifications) | ✅ Done |
| Schedule builder (drag and drop, live conflict checks, labour cost, copy week, publish) | ✅ Done |
| Employee portal (my shifts, availability, time off) | 🚧 Next |
| Manager dashboard (staffing today, labour cost, warnings) | Planned |
| Shift swaps and open-shift pickup | Planned |
| Time & attendance (clock in/out, breaks, overtime) | Planned |
| Labour analytics | Planned |

## Stack

| Layer | Tech |
| --- | --- |
| Web | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query |
| API | NestJS 12, Prisma 7, PostgreSQL 17, Swagger / OpenAPI |
| Auth | JWT access token + rotating refresh token in httpOnly cookies, argon2 password hashing, role guards |
| Realtime & jobs | Socket.IO, BullMQ + Redis *(planned)* |
| Testing | Vitest, Playwright *(planned)* |
| Tooling | npm workspaces, Docker Compose, GitHub Actions |

## Architecture

```
apps/
  web/   Next.js front end (port 3300). Rewrites /api/* to the API, so auth cookies stay first-party.
  api/   NestJS REST API (port 4000). Swagger UI at /api/docs.
docker-compose.yml   Postgres + Redis for local development
```

Security notes:

- Access tokens live 15 minutes. Refresh tokens are random, stored only as SHA-256 hashes, and rotated on every use. Reusing an old refresh token revokes the whole session family.
- Every API route requires auth unless explicitly marked `@Public()`. Role checks run in a global guard.
- Login uses constant-time behaviour for unknown emails, and auth endpoints are rate limited.

## Getting started

Prerequisites: Node.js 22+, npm 11+, Docker Desktop.

```bash
# 1. Install dependencies
npm install

# 2. Start Postgres and Redis
npm run db:up

# 3. Configure environment
cp .env.example apps/api/.env          # then set real JWT secrets
echo "API_URL=http://localhost:4000" > apps/web/.env.local

# 4. Create the database schema and load demo data
npm run db:migrate
npm run db:seed

# 5. Run the API and web app together
npm run dev
```

Open http://localhost:3300 for the app and http://localhost:4000/api/docs for the API reference.

### Demo data

`npm run db:seed` creates **Harbour & Vine — King Street**, a fictional Toronto restaurant. It has 14 staff across 7 positions, a published schedule for this week, a draft for next week with an open shift, pending time-off requests, and an expired certification to trigger warnings. Re-running it resets the demo.

| Role | Email | Password |
| --- | --- | --- |
| Owner | `owner@harbourvine.test` | `crewline-demo` |
| Manager | `manager@harbourvine.test` | `crewline-demo` |
| Employee | `maya@harbourvine.test` | `crewline-demo` |

These accounts exist only in your local database.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API and web in watch mode |
| `npm run build` | Production build of both apps |
| `npm run lint` | oxlint (API) and ESLint (web) |
| `npm test` | Vitest unit tests in every workspace |
| `npm run db:up` / `db:down` | Start or stop Postgres and Redis |
| `npm run db:migrate` | Apply Prisma migrations in development |
| `npm run db:seed` | Reset and load the demo restaurant |
