# Timetable AI

AI-powered, conflict-free timetable generator for schools, colleges, and universities.
Admins feed teacher data once; the engine generates valid timetables for **every class
and every teacher in one pass**.

This repo implements the PRD (see [`PRD.md`](PRD.md)) through **v2.1** — the
production-readiness release: secure login, background generation with live progress,
revocable parent share links with QR codes, and a full-school Excel bundle.

## How it works

A timetable is a grid: rows are time slots (periods × days), columns are classes. Every
cell needs a subject + teacher + room. The engine fills every cell without breaking a
hard rule.

1. **Read & structure input** — CSV/Excel upload of teacher assignments.
2. **Pre-flight check** — plain arithmetic catches impossible requests *before* solving
   and reports exactly what to fix ([`preflight.py`](backend/app/services/preflight.py)).
3. **Solve** — a Google OR-Tools CP-SAT model places lectures while guaranteeing no
   teacher or class is ever double-booked ([`engine.py`](backend/app/services/solver/engine.py)).
4. **Score & optimize** — soft rules (morning-heavy subjects, even weekly spread) are
   maximized within a time limit.
5. **Split into views** — one master timetable → student view + teacher view + parent
   share link.

Generation runs as a **background job** ([`generation.py`](backend/app/services/generation.py)):
the UI polls the job and shows the stage (*checking feasibility → solving → saving*),
so long solves survive proxy timeouts and free-tier cold starts.

### Hard rules (never broken)
- A teacher can't be in two places at once.
- A class can't have two subjects at once.
- A lab subject needs a lab room (lab-room capacity per slot is enforced).

### Soft rules (preferences, maximized)
- Configurable on the Rules page: key periods filled, teacher rest after 2 in a row,
  subject spread, morning-heavy subjects, doubles cap.
- Custom rules typed in plain English, parsed by the admin's own LLM key (Gemini/Claude).

## Security model (v2.1)

- **Login required** — email + password accounts; scrypt password hashing and
  HMAC-signed bearer tokens implemented with the Python standard library (no extra
  dependencies).
- **School ownership** — every admin route checks that the school belongs to the
  signed-in admin; other accounts get 403.
- **Parent access via revocable share links** — `POST …/share-links` mints a token URL
  (`/share/<token>`) with a QR code; the payload strips staff details server-side;
  revoking the link kills access instantly.
- Set `SECRET_KEY` in production (`render.yaml` auto-generates it on Render).

## Tech stack

| Layer     | Choice                                   |
|-----------|------------------------------------------|
| Frontend  | Next.js 14 (App Router) + Tailwind + SWR |
| Backend   | FastAPI + SQLAlchemy                     |
| Solver    | Google OR-Tools (CP-SAT)                 |
| Database  | SQLite locally (zero setup) / PostgreSQL in production |
| Auth      | scrypt + HS256 bearer tokens (stdlib)    |

## Quick start (local — no Docker needed)

**Backend**
```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate   # Windows
pip install -r requirements.txt
python -m uvicorn app.main:app --reload            # http://localhost:8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev                                        # http://localhost:3000
```

Open http://localhost:3000, create an account, then **New School** → upload a CSV →
**Generate timetable**. The database is a local SQLite file — tables and new columns
are created/added automatically on boot, so there is nothing to set up or migrate by
hand. API docs live at http://localhost:8000/docs.

## Verifying

```bash
cd backend
python test_api_smoke.py
# -> [PASS] ALL API SMOKE CHECKS PASSED   (27 checks: auth, ownership, CSV import,
#    background job lifecycle, zero clashes, share links, Excel bundle)

python test_solver_standalone.py
# -> [PASS] ALL CHECKS PASSED: 60 lectures placed, 0 teacher clashes, 0 class clashes.
```

## CSV format

| Column        | Example     | Notes                                  |
|---------------|-------------|----------------------------------------|
| Teacher Name  | Mr. Sharma  | Same teacher may appear on many rows   |
| Subject       | Maths       | Auto-created if new                     |
| Standard      | 10th        | Grade / year                           |
| Section       | A           | Each section is a separate class        |
| Lectures/Week | 6 (or 4-5)  | Fixed number or a range                 |
| Preferred Time| Morning     | Optional soft preference                |
| Special Room  | Lab         | Optional; links subject to a room type  |

A ready-to-use template lives at [`frontend/public/template.csv`](frontend/public/template.csv).

## Project layout

```
backend/
  app/
    api/deps.py      # auth + school-ownership dependencies
    api/routes/      # auth, share, school, academic, teacher, timetable, rule endpoints
    core/            # config, db, security, startup migrations
    models/          # SQLAlchemy ORM (incl. User, GenerationJob, ShareLink)
    schemas/         # Pydantic I/O
    services/
      csv_import.py  # CSV/Excel -> DB
      preflight.py   # feasibility math
      generation.py  # shared pipeline + background job runner
      excel_export.py# class + teacher sheets -> .xlsx
      solver/        # OR-Tools CP-SAT engine
    seed.py          # demo school
  test_api_smoke.py  # end-to-end API suite
frontend/
  src/
    app/             # pages: dashboard, login, setup, school, timetable, rules, share
    components/      # UI primitives, user menu, share links + QR
    lib/             # auth-aware API client + types
render.yaml          # Render deploy blueprint
DEPLOY.md            # deployment guide
PRD.md               # product requirements (living doc)
```

## Deploying

See [`DEPLOY.md`](DEPLOY.md) — frontend on Vercel, backend on Render, database on
Supabase, all free tiers.

## Roadmap

See [`PRD.md`](PRD.md) §7. Next: full role matrix with approval chains, per-school
rules config, email verification/password reset. **Out of scope for now**: exam
timetable / invigilation.
