# 14 — Deployment Guide

#deployment #production #vercel #render #supabase

Full guide in [DEPLOY.md](file:///d:/Project/AI%20Timetable/AI-TimeTable/DEPLOY.md).

## Deployment Topology

```
Browser → Vercel (Next.js frontend) → Render (FastAPI backend) → Supabase (PostgreSQL)
```

All **free tiers** — zero cost to host.

## 1. Database — Supabase

1. Go to [supabase.com](https://supabase.com) → New project
2. Copy the **connection string** (postgresql://...) from Settings → Database
3. Use this as `DATABASE_URL` in the backend

## 2. Backend — Render

### `render.yaml` (already in repo)

```yaml
services:
  - type: web
    name: timetable-ai-backend
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: DATABASE_URL
        sync: false        # You set this manually
      - key: SECRET_KEY
        generateValue: true  # Render auto-generates a secure random key
```

### Steps

1. Push repo to GitHub
2. In Render → New Web Service → connect your GitHub repo
3. Render auto-detects `render.yaml`
4. Set `DATABASE_URL` to your Supabase connection string
5. Deploy → get URL like `https://timetable-ai-backend.onrender.com`

> ⚠️ Free tier Render services **spin down after 15 min of inactivity** (cold start ~30s)

## 3. Frontend — Vercel

1. Go to [vercel.com](https://vercel.com) → Import Git repo
2. Set **root directory** to `frontend`
3. Add environment variable:
   ```
   NEXT_PUBLIC_BACKEND_URL = https://your-backend.onrender.com
   ```
4. Deploy

### How the frontend handles cold starts

In `api.ts`, when `NEXT_PUBLIC_BACKEND_URL` is set, the browser calls the backend **directly** instead of through Vercel's proxy. This bypasses Vercel's 30-second proxy timeout, so Render cold starts (30s+) don't fail.

```typescript
function apiBase(): string {
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL;  // Direct call to Render
  }
  return "/api";  // Local: use Next.js proxy
}
```

## Environment Variables Summary

### Backend (Render)
| Variable | Value | Required |
|---|---|---|
| `DATABASE_URL` | Supabase PostgreSQL URL | ✅ |
| `SECRET_KEY` | Random 32+ char string | ✅ (auto-generated) |

### Frontend (Vercel)
| Variable | Value | Required |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | `https://your-backend.onrender.com` | ✅ |

## Post-Deploy Verification

```bash
# Check backend health
curl https://your-backend.onrender.com/api/health

# Check API docs
open https://your-backend.onrender.com/docs
```

---
*Related: [[07 - Authentication & Security]] · [[13 - Local Development Guide]]*
