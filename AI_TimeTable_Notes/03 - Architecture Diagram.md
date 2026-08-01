# 03 — Architecture Diagram

#architecture #diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                             │
│                                                                 │
│   ┌───────────────────────────────────────────────────────┐    │
│   │              Next.js Frontend (Port 3000)             │    │
│   │                                                       │    │
│   │  Pages:                                               │    │
│   │  /           → Dashboard (school list)                │    │
│   │  /login      → Auth (login/register)                  │    │
│   │  /setup      → New School wizard                      │    │
│   │  /school/:id → School detail + management             │    │
│   │  /rules      → Rule configuration                     │    │
│   │  /share/:tok → Parent read-only view                  │    │
│   │                                                       │    │
│   │  SWR fetches → /api/* (proxied to backend)            │    │
│   └──────────────────────┬────────────────────────────────┘    │
└─────────────────────────-|──────────────────────────────────────┘
                           │ HTTP (Next.js rewrites /api/* →)
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                   FastAPI Backend (Port 8000)                    │
│                                                                  │
│  Routers:                                                        │
│  /api/auth/*         → Authentication (register, login, me)      │
│  /api/schools/*      → School CRUD                               │
│  /api/schools/:id/   → Academic, Teachers, Timetables, Rules     │
│  /api/share/*        → Public parent share view                  │
│  /api/rules/*        → Global rule config + AI rule parsing      │
│  /api/health         → Health check                              │
│                                                                  │
│  Services:                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ preflight.py │  │generation.py │  │   solver/engine.py   │  │
│  │ (feasibility │  │(background   │  │   (OR-Tools CP-SAT)  │  │
│  │  math check) │  │ job runner)  │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │csv_import.py │  │excel_export  │  │   ai_rules.py        │  │
│  │(CSV → DB)    │  │(.xlsx bundle)│  │ (LLM rule parsing)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │ SQLAlchemy ORM
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               Database                                          │
│   Local: SQLite (timetable.db)                                  │
│   Prod:  PostgreSQL (Supabase)                                  │
│                                                                 │
│   Tables: users, schools, subjects, standards, rooms,           │
│           teachers, assignments, timetables, entries,           │
│           generation_jobs, share_links, rule_configs,           │
│           custom_rules, fixed_slots                             │
└─────────────────────────────────────────────────────────────────┘
```

## Request Flow — Generate Timetable

```
Admin clicks "Generate"
        │
        ▼
POST /api/schools/:id/timetables/generate-async
        │
        ▼
Backend creates GenerationJob (status=pending) ──► Returns job_id
        │
        ├── Background Thread starts:
        │       1. preflight.py  → feasibility check
        │       2. engine.py     → CP-SAT solve
        │       3. Save entries  → DB
        │       4. job.status = "done"
        │
Frontend polls GET /api/schools/:id/timetables/jobs/:job_id
        │
        ▼
When status="done" → display timetable
```

## Auth Flow

```
User submits login form
        │
POST /api/auth/login
        │
Backend: scrypt hash verify → sign HS256 JWT
        │
Response: { access_token: "..." }
        │
Frontend: localStorage.setItem("tt_token", token)
        │
All subsequent requests: Authorization: Bearer <token>
```

---
*Related: [[05 - Backend Setup & Dev]] · [[07 - Authentication & Security]] · [[08 - Solver Engine (OR-Tools)]] · [[09 - Background Job System]]*
