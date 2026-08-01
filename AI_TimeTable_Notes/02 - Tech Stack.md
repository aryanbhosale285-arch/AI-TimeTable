# 02 — Tech Stack

#tech-stack #architecture

## Technology Choices

| Layer | Technology | Version | Why |
|---|---|---|---|
| **Frontend** | Next.js (App Router) | 14.2.5 | SSR + file-based routing |
| **Styling** | Tailwind CSS | 3.4.6 | Utility-first rapid UI |
| **Data Fetching** | SWR | 2.2.5 | Stale-while-revalidate caching |
| **Backend** | FastAPI | 0.111.0 | Fast async Python API |
| **ORM** | SQLAlchemy | 2.0.30 | Type-safe DB access |
| **Migrations** | Alembic | 1.13.1 | DB schema versioning |
| **Solver** | Google OR-Tools CP-SAT | 9.10.4067 | Industry-grade constraint solver |
| **Database (local)** | SQLite | — | Zero-setup local dev |
| **Database (prod)** | PostgreSQL | — | Via Supabase |
| **Auth** | scrypt + HS256 JWT | stdlib | No external deps |
| **Language** | TypeScript + Python | TS 5.5.3 | Type safety both ends |

## Frontend Dependencies (`frontend/package.json`)

```json
{
  "next": "14.2.5",
  "react": "18.3.1",
  "react-dom": "18.3.1",
  "swr": "2.2.5",
  "qrcode": "^1.5.4"
}
```

## Backend Dependencies (`backend/requirements.txt`)

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
alembic==1.13.1
psycopg2-binary==2.9.9     # PostgreSQL driver
pydantic==2.7.1
pydantic-settings==2.2.1
ortools==9.10.4067          # THE SOLVER
pandas==2.2.2               # CSV processing
openpyxl==3.1.2             # Excel export
python-multipart==0.0.9     # File upload
httpx==0.27.0               # Async HTTP (for AI key calls)
```

## Why OR-Tools CP-SAT?

The timetabling problem is a **Constraint Satisfaction Problem (CSP)**:
- Variables: which teacher/subject goes in which time slot
- Constraints: no clashes, room capacity, etc.
- OR-Tools CP-SAT is Google's production solver used in Google Calendar and Maps routing. It's open-source, runs locally, and handles thousands of variables efficiently.

## Why No Docker?

The project deliberately avoids Docker for local development — SQLite runs in-file, and dependencies install directly in `.venv`. This reduces onboarding friction to just `pip install` + `npm install`.

---
*Related: [[01 - Project Overview]] · [[05 - Backend Setup & Dev]] · [[10 - Frontend Setup & Dev]]*
