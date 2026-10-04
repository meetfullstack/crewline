# Deploying Crewline

Three free services host the live demo:

```
Visitor → Vercel (Next.js web) ──/api/* rewrite──▶ Render (NestJS API) ──▶ Neon (Postgres)
              │                                         ▲               └─▶ Upstash Redis (optional)
              └────────────── realtime socket ──────────┘
```

- **Vercel** serves the web app and forwards `/api/*` to the API, so auth cookies stay first-party.
- **Render** runs the API (free tier sleeps after ~15 idle minutes; the first request then takes ~30–50 s).
- **Neon** is serverless Postgres 17.
- **Redis is optional.** Without `REDIS_URL` the API runs background work in-process: publish notifications still go out, only the 2-hour shift reminders are skipped. Add an Upstash Redis URL to turn the full BullMQ queue on.

## 1. Database — Neon

1. Create a project at [neon.tech](https://neon.tech) (Postgres 17, a region near Ohio/Virginia).
2. Copy the connection string (it ends in `?sslmode=require`). This is `DATABASE_URL`.
3. Load the schema and demo data once, from your machine:

   ```bash
   DATABASE_URL="postgres://…neon.tech/neondb?sslmode=require" npm run migrate:deploy -w @crewline/api
   DATABASE_URL="postgres://…neon.tech/neondb?sslmode=require" npm run db:seed
   ```

## 2. API — Render

1. At [render.com](https://render.com), choose **New → Blueprint** and pick this repository. Render reads `render.yaml`.
2. Fill in the variables it asks for:
   - `DATABASE_URL` — the Neon string from step 1
   - `WEB_ORIGIN` — your Vercel URL (you can come back to set this after step 3)
   - `REDIS_URL` — optional (Upstash `rediss://…` URL)

   JWT secrets are generated for you.
3. Deploy. Check `https://<your-api>.onrender.com/api/health` returns `{"status":"ok"}`. API docs live at `/api/docs`.

## 3. Web — Vercel

1. At [vercel.com](https://vercel.com), import the repository.
2. **Root Directory:** `apps/web`. **Node.js version:** 24.x (Settings → General).
3. Environment variables:
   - `API_URL` = `https://<your-api>.onrender.com`
   - `NEXT_PUBLIC_SOCKET_URL` = `https://<your-api>.onrender.com`
4. Deploy, then put the Vercel URL into Render's `WEB_ORIGIN` and redeploy the API (this allows the realtime socket's origin).

## 4. Nightly demo reset (optional)

In GitHub → Settings → Secrets and variables → Actions:

- Secret `DEMO_DATABASE_URL` = the Neon connection string
- Variable `DEMO_RESET` = `true`

The **Reset live demo** workflow then re-seeds the demo every night (and can be run by hand). It only replaces the demo organization.

## Demo accounts

All use the password `crewline-demo`: `owner@`, `manager@`, `maya@`, `sofia@`, `grace@`, `elena@`, `chloe@harbourvine.test`.
