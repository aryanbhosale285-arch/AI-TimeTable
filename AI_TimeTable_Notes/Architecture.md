# Architecture

#architecture #system-design #deep-dive

## System Overview

AI-TimeTable is a **full-stack monorepo** with a clear separation:

```
Frontend (Next.js)  ←→  Backend (FastAPI)  ←→  Database (SQLite/PostgreSQL)
      :3000                  :8000
```

All frontend API calls go through a Next.js **proxy rewrite** locally, and **directly to backend** in production (to avoid Vercel's proxy timeouts on long solves).

---

## Frontend Architecture

### Framework: Next.js 14 App Router

Uses the `app/` directory convention — no `pages/`. Every folder = a route.

```
src/app/
  layout.tsx          ← Root shell: header, fonts, theme flash-prevention script
  page.tsx            ← / — Dashboard
  login/page.tsx      ← /login
  setup/page.tsx      ← /setup — New school wizard
  school/[id]/        ← Dynamic route: /school/:id
  rules/page.tsx      ← /rules
  share/[token]/      ← /share/:token — Public parent view
```

### Data Layer: SWR

SWR (stale-while-revalidate) is used for all data fetching. Pattern:

```tsx
const { data, error, isLoading } = useSWR<T>("/endpoint", fetcher);
```

- Cache shared across components on same key
- Auto-revalidates on window focus
- For job polling: `refreshInterval: job?.status === "running" ? 2000 : 0`

### API Client: `lib/api.ts`

Single source of truth for all API calls. Features:
- `apiBase()` — returns `/api` locally, `NEXT_PUBLIC_BACKEND_URL` in production
- Auth headers injected automatically via `getToken()` + `Authorization: Bearer`
- `handleUnauthorized()` — clears token, redirects to `/login` on 401
- `parseError()` — reads response body once (avoids "body already read" error)
- `ApiError` class — typed error with `.status` and `.detail`

### Component Architecture

```
components/
  ui/                 ← Design system primitives (Button, Card, Badge, Input, Label)
  ThemeToggle.tsx     ← Dark/light toggle (localStorage + CSS class)
  UserMenu.tsx        ← Logout button + user email display
  ShareLinks.tsx      ← Share link list + QR code generator
```

All UI primitives use CSS custom properties — no hardcoded colors.

---

## Backend Architecture

### Framework: FastAPI

```
app/
  main.py             ← App factory, CORS middleware, router registration
  api/
    deps.py           ← FastAPI dependency injection: auth + school ownership
    routes/           ← One file per resource domain
  core/
    config.py         ← Pydantic Settings (reads .env)
    database.py       ← SQLAlchemy engine + session factory
    security.py       ← scrypt hash, JWT sign/verify
    migrate.py        ← Startup ALTER TABLE migrations (column additions)
  models/             ← SQLAlchemy ORM models
  schemas/            ← Pydantic v2 I/O schemas (request/response)
  services/           ← Business logic (solver, preflight, generation, etc.)
```

### Dependency Injection Pattern

FastAPI's `Depends()` system is used for two key cross-cutting concerns:

```python
# 1. Auth: verify JWT token
get_current_user → returns User ORM object or raises 401

# 2. Ownership: verify school belongs to current user
require_school_access → returns school_id or raises 403
```

Every school-scoped route has `dependencies=[Depends(require_school_access)]`.

### Router Registration (`main.py`)

```python
# Public routes (no auth)
app.include_router(auth.router, prefix="/api")
app.include_router(share.router, prefix="/api")

# Admin routes (require auth + ownership)
app.include_router(school.router, prefix="/api")
app.include_router(academic.router, prefix="/api", dependencies=[Depends(require_school_access)])
app.include_router(teacher.router, prefix="/api", dependencies=[Depends(require_school_access)])
app.include_router(timetable.router, prefix="/api", dependencies=[Depends(require_school_access)])
app.include_router(fixed_slot.router, prefix="/api", dependencies=[Depends(require_school_access)])

# Global admin config
app.include_router(rule.router, prefix="/api", dependencies=[Depends(get_current_user)])
```

### Service Layer

Business logic is in `services/`, separate from route handlers:

| Service | Responsibility |
|---|---|
| `preflight.py` | Arithmetic feasibility check before solving |
| `generation.py` | Background job runner — orchestrates preflight + solver + DB save |
| `solver/engine.py` | OR-Tools CP-SAT model building + solving |
| `csv_import.py` | Parses CSV/Excel, upserts teachers/subjects/assignments |
| `excel_export.py` | Builds multi-sheet `.xlsx` from timetable entries |
| `ai_rules.py` | Calls Gemini/Claude to parse plain English → structured rule |

---

## Data Flow: Full Timetable Generation

```
1. Admin POSTs /generate-async
        │
2. Route creates GenerationJob (status=QUEUED) → returns job_id
        │
3. Python Thread spawned: run_generation_job(job_id)
        │
4. Thread: job.status = RUNNING
        │
5. Thread: run_preflight() → errors? → job.status = FAILED
        │ (no errors)
6. Thread: TimetableSolver(school, fixed_slots, rules, custom_rules).solve()
        │
7. Thread: save TimetableSlot records to DB
        │
8. Thread: job.status = DONE, job.timetable_id = new_timetable.id
        │
9. Frontend polling GET /jobs/:id sees status=DONE → fetches timetable
```

---

## Database Strategy

### Local Development: SQLite
- Zero setup — file created automatically (`timetable.db`)
- `Base.metadata.create_all(bind=engine)` — creates missing tables on boot
- `run_startup_migrations(engine)` — adds new columns with `ALTER TABLE` (idempotent)

### Production: PostgreSQL (Supabase)
- Switch via `DATABASE_URL` environment variable
- Alembic available for formal migrations if needed

### Session Management
- One DB session per request (`get_db` dependency yields a session, closes after)
- Background jobs open their own session (outside request lifecycle)

---

## Security Architecture

```
Request arrives
     │
     ├── Public routes (auth, share) → no token check
     │
     └── Protected routes
              │
        get_current_user()
              │ decodes JWT, queries User
              │ raises 401 if invalid
              │
        require_school_access()
              │ checks school.owner_id == current_user.id
              │ raises 403 if mismatch
              │
        Route handler executes
```

Parent share links bypass the JWT entirely — they're verified by token lookup + `revoked` flag check.

---

## Deployment Architecture

```
Vercel (Next.js)
    │
    ├─── Static assets, SSR pages
    │
    └─── NEXT_PUBLIC_BACKEND_URL → direct browser call to Render
                                        │
                                   Render (FastAPI, free tier)
                                        │
                                   DATABASE_URL → Supabase (PostgreSQL)
```

> **Key insight**: Frontend calls backend directly from the browser in production — bypassing Vercel's proxy. This prevents the 30s Vercel proxy timeout from killing long OR-Tools solves.

---
*Related: [[03 - Architecture Diagram]] · [[08 - Solver Engine (OR-Tools)]] · [[07 - Authentication & Security]] · [[14 - Deployment Guide]]*
