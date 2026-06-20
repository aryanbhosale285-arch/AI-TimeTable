# Timetable AI

AI-powered, conflict-free timetable generator for schools, colleges, and universities.
Admins feed teacher data once; the engine generates valid timetables for **every class
and every teacher in one pass**.

This repo is the **MVP** described in the PRD (Section 3.1).

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
5. **Split into views** — one master timetable → student view + teacher view.

### Hard rules (never broken)
- A teacher can't be in two places at once.
- A class can't have two subjects at once.
- A lab subject needs a lab room (lab-room capacity per slot is enforced).

### Soft rules (preferences, maximized)
- Hard subjects (flagged `Preferred Time = Morning`) earlier in the day.
- Spread a subject across distinct days.

## Tech stack

| Layer     | Choice                                   |
|-----------|------------------------------------------|
| Frontend  | Next.js 14 (App Router) + Tailwind + SWR |
| Backend   | FastAPI + SQLAlchemy                     |
| Solver    | Google OR-Tools (CP-SAT)                 |
| Database  | PostgreSQL                               |
| Dev       | Docker Compose                           |

## Quick start (Docker)

```bash
docker compose up --build
```

- Frontend → http://localhost:3000
- API docs → http://localhost:8000/docs

The backend seeds a **Demo Public School** (2 sections, 5 teachers, 60 lectures/week) on
first boot, so you can click **Generate timetable** immediately.

## Quick start (local, no Docker)

**Backend**
```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate   # Windows
pip install -r requirements.txt
# point DATABASE_URL at a local Postgres, or sqlite for a quick spin
python -m app.seed
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

## Verifying the solver

A dependency-light smoke test builds the demo school and asserts the generated timetable
has **zero teacher clashes and zero class clashes**:

```bash
cd backend
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
    api/routes/      # school, academic, teacher, timetable endpoints
    models/          # SQLAlchemy ORM
    schemas/         # Pydantic I/O
    services/
      csv_import.py  # CSV/Excel -> DB
      preflight.py   # feasibility math
      solver/        # OR-Tools CP-SAT engine
    seed.py          # demo school
frontend/
  src/
    app/             # Next.js App Router pages
    components/ui/   # small UI primitives
    lib/             # API client + types
docker-compose.yml
```

## Roadmap

See the PRD. **V2**: natural-language input, teacher self-service, substitute finder,
lock-and-regenerate, parent share links, analytics, electives, lab batch splitting.
**Out of scope for now**: exam timetable / invigilation.
