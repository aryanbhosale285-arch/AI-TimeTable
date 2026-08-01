# Phases & Modules

#phases #modules #development #roadmap

## Development Phases

### ✅ Phase 1 — Core Engine (v1.0)
*Goal: Prove the solver works.*

| Module | Status | Description |
|---|---|---|
| OR-Tools CP-SAT solver | ✅ Done | `services/solver/engine.py` |
| Hard constraint model | ✅ Done | Teacher clash, class clash, lab rooms |
| Soft objective model | ✅ Done | Spread, morning preference, teacher rest |
| SQLite database | ✅ Done | Zero-setup local DB |
| Basic FastAPI backend | ✅ Done | Core CRUD endpoints |
| Synchronous generation | ✅ Done | `POST /generate` (no background job) |

---

### ✅ Phase 2 — Full-Stack MVP (v2.0)
*Goal: Working end-to-end product with UI.*

| Module | Status | Description |
|---|---|---|
| Next.js frontend | ✅ Done | App Router, SWR, Tailwind |
| School setup wizard | ✅ Done | `/setup` page |
| CSV import | ✅ Done | Upload → parse → upsert teachers/assignments |
| Preflight check | ✅ Done | Feasibility errors/warnings before solve |
| Timetable grid views | ✅ Done | Class view + teacher view |
| Print CSS | ✅ Done | `@media print` clean output |
| Excel export | ✅ Done | Multi-sheet `.xlsx` via openpyxl |
| Share links | ✅ Done | Revocable parent read-only access |
| QR code generation | ✅ Done | Via `qrcode` library on frontend |

---

### ✅ Phase 3 — Production Readiness (v2.1)
*Goal: Secure, deployable, robust.*

| Module | Status | Description |
|---|---|---|
| Authentication | ✅ Done | scrypt + HS256 JWT, no external deps |
| School ownership guards | ✅ Done | `require_school_access` dependency |
| Background job system | ✅ Done | Thread-based async generation + polling |
| Live job progress UI | ✅ Done | Stage labels shown during generation |
| AI custom rules | ✅ Done | Gemini + Claude LLM rule parsing |
| Rules configuration page | ✅ Done | `/rules` page with toggles |
| Dark mode | ✅ Done | CSS variables + localStorage toggle |
| Render deployment config | ✅ Done | `render.yaml` blueprint |
| Vercel deployment | ✅ Done | Frontend on Vercel with backend URL env var |
| Supabase (PostgreSQL) | ✅ Done | Production DB support |
| Startup migrations | ✅ Done | `run_startup_migrations()` — no manual Alembic |

---

### 🔲 Phase 4 — Role Matrix & Approvals (v3.0 — Planned)
*Goal: Multi-user collaboration within a school.*

| Module | Status | Description |
|---|---|---|
| HOD role | 🔲 Planned | Head of Department can review timetable |
| Approval chain | 🔲 Planned | HOD approves before Admin publishes |
| Teacher portal | 🔲 Planned | Teachers view own timetable, submit requests |
| Per-school rule config | 🔲 Planned | Rules scoped to school, not global |
| Email verification | 🔲 Planned | Verify email on register |
| Password reset | 🔲 Planned | Reset via email link |

---

### 🔲 Phase 5 — Advanced Scheduling (Future)
*Goal: More complex school scenarios.*

| Module | Status | Description |
|---|---|---|
| Exam timetable | 🔲 Out of scope | Invigilation scheduling |
| Substitution scheduling | 🔲 Future | Fill absent teacher slots |
| Multi-school admin | 🔲 Future | One admin, multiple schools |
| Analytics dashboard | 🔲 Future | Teacher utilization, load charts |
| Mobile app | 🔲 Future | Parent/student mobile view |

---

## Module Map (Current Codebase)

### Backend Modules

```
app/
├── api/
│   ├── deps.py              🔐 Auth + ownership guards
│   └── routes/
│       ├── auth.py          👤 Register, login, me
│       ├── school.py        🏫 School CRUD
│       ├── academic.py      📚 Subjects, standards, rooms
│       ├── teacher.py       👨‍🏫 Teachers, assignments, CSV import
│       ├── timetable.py     🗓️ Generate, poll, publish, export, share
│       ├── rule.py          ⚙️ Rule config + AI rule parsing
│       └── share.py         🔗 Public parent timetable view
│
├── core/
│   ├── config.py            🔧 Environment settings
│   ├── database.py          🗄️ DB engine + session
│   ├── security.py          🔒 scrypt hash + JWT
│   └── migrate.py           🔄 Startup column migrations
│
├── models/                  📦 SQLAlchemy ORM (all tables)
├── schemas/                 📋 Pydantic I/O schemas
│
└── services/
    ├── preflight.py         ✅ Feasibility math
    ├── generation.py        🏃 Background job orchestrator
    ├── csv_import.py        📥 CSV/Excel → DB
    ├── excel_export.py      📤 Timetable → .xlsx
    ├── ai_rules.py          🤖 LLM rule parsing (Gemini/Claude)
    └── solver/
        └── engine.py        🧩 OR-Tools CP-SAT model
```

### Frontend Modules

```
src/
├── app/                     📄 Pages (Next.js App Router)
│   ├── layout.tsx            🏗️ Root shell
│   ├── page.tsx              🏠 Dashboard
│   ├── login/               🔑 Auth
│   ├── setup/               🎓 School wizard
│   ├── school/[id]/         📋 School detail + timetable
│   ├── rules/               ⚙️ Rule config
│   └── share/[token]/       👨‍👩‍👧 Parent view
│
├── components/
│   ├── ui/                  🎨 Design system (Button, Card, Badge, Input, Label)
│   ├── ThemeToggle.tsx      🌗 Dark/light mode
│   ├── UserMenu.tsx         👤 User info + logout
│   └── ShareLinks.tsx       🔗 Share link list + QR
│
└── lib/
    ├── api.ts               📡 Auth-aware API client (all endpoints)
    └── types.ts             📝 TypeScript types
```

---

## Dependencies Between Modules

```
Frontend (api.ts) 
    → calls → Backend (routes/)
                   → uses → Services (generation, preflight, solver)
                                → uses → Models (SQLAlchemy)
                                              → stored in → Database
```

```
AI rules flow:
Frontend (rules page)
    → POST /rules/custom/parse
    → ai_rules.py
    → Gemini API / Claude API
    → CustomRule stored in DB
    → TimetableSolver reads at generation time
```

---
*Related: [[PRD]] · [[Architecture]] · [[08 - Solver Engine (OR-Tools)]] · [[16 - Feature List & Roadmap]]*
