# 05 — Backend Setup & Dev

#backend #setup #dev

## Directory Structure

```
backend/
├── app/
│   ├── main.py              ← FastAPI app entry, middleware, routers
│   ├── api/
│   │   ├── deps.py          ← Auth + school-ownership dependencies
│   │   └── routes/
│   │       ├── auth.py      ← /api/auth/*
│   │       ├── school.py    ← /api/schools/*
│   │       ├── academic.py  ← subjects, standards, rooms, fixed_slots
│   │       ├── teacher.py   ← teachers, assignments, CSV import
│   │       ├── timetable.py ← generate, poll jobs, publish, export
│   │       ├── rule.py      ← rule config, AI rule parsing
│   │       └── share.py     ← public parent share view
│   ├── core/
│   │   ├── config.py        ← Settings (SECRET_KEY, DATABASE_URL)
│   │   ├── database.py      ← SQLAlchemy engine + session
│   │   ├── security.py      ← scrypt hash, JWT sign/verify
│   │   └── migrate.py       ← Startup column migrations
│   ├── models/              ← SQLAlchemy ORM models
│   ├── schemas/             ← Pydantic request/response schemas
│   └── services/
│       ├── preflight.py     ← Feasibility arithmetic
│       ├── generation.py    ← Background job runner
│       ├── csv_import.py    ← CSV/Excel → DB
│       ├── excel_export.py  ← Timetable → .xlsx
│       ├── ai_rules.py      ← LLM rule parsing (Gemini/Claude)
│       └── solver/
│           └── engine.py    ← OR-Tools CP-SAT solver
├── alembic/                 ← DB migration scripts
├── requirements.txt
├── timetable.db             ← SQLite file (local dev)
├── test_api_smoke.py        ← End-to-end API tests
└── test_solver_standalone.py← Solver-only tests
```

## Local Setup (First Time)

```bash
cd backend

# 1. Create virtual environment
python -m venv .venv

# 2. Activate it (Windows)
.venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start server (with auto-reload)
python -m uvicorn app.main:app --reload --port 8000
```

> ⚠️ **Note**: `--reload` uses file watchers and can be slow to start on Windows. If it hangs, use without `--reload`.

## Start Without Reload (Faster)

```bash
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Environment Variables

Create `backend/.env` (already exists locally):

```env
DATABASE_URL=sqlite:///./timetable.db
SECRET_KEY=your-secret-key-here        # auto-generated on Render
```

For PostgreSQL (production):
```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

## CORS Configuration

Currently set to `allow_origins=["*"]` with `allow_credentials=False` — safe because auth uses bearer tokens in headers, not cookies.

## API Documentation

Swagger UI auto-generated at: **http://localhost:8000/docs**
ReDoc at: **http://localhost:8000/redoc**

## Database Notes

- SQLite file auto-created at `backend/timetable.db` on first start
- `Base.metadata.create_all()` adds new tables automatically
- `run_startup_migrations()` adds new columns to existing tables (safe to re-run)
- **No manual `alembic upgrade`** needed for local dev

---
*Related: [[06 - API Endpoints Reference]] · [[07 - Authentication & Security]] · [[08 - Solver Engine (OR-Tools)]]*
