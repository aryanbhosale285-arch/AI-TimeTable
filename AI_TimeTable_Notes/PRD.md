# PRD — Product Requirements Document

#prd #product #requirements

> Source of truth: `AI_TimeTable_PRD_V2.pdf` in the project root.
> This note is a structured, developer-friendly summary.

---

## Product Vision

**AI-TimeTable** is an AI-assisted, conflict-free school timetable generator. It turns messy, spreadsheet-based teacher assignments into valid, ready-to-publish timetables — in one automated pass. Target users: school administrators, department heads, and timetable coordinators.

---

## Goals

| Goal | Metric |
|---|---|
| Zero conflicts | 0 teacher double-bookings, 0 class double-bookings |
| Fast turnaround | Full school timetable generated in < 60 seconds |
| Self-serve setup | Admin can onboard without IT help |
| Transparent scheduling | Preflight reports exactly what's wrong before solving |
| Safe parent sharing | Revocable read-only links, no teacher data leaked |

---

## Users & Roles

| Role | Description | Access |
|---|---|---|
| **Admin** | School timetable coordinator | Full CRUD on their school |
| **Parent** | Read-only consumer of published timetable | Via share link only |
| *(Future)* Teacher | View own timetable, request changes | — |
| *(Future)* HOD | Approve changes before publish | — |

---

## Core Functional Requirements

### FR-1: School Setup
- Admin creates a school with: name, board, academic year, working days, periods per day, period duration
- Admin configures subjects, standards (grades), sections, rooms, teachers

### FR-2: Teacher Assignment Import
- Admin uploads a CSV with columns: Teacher, Subject, Standard, Section, Lectures/Week, Preferred Time, Special Room
- System auto-creates teachers, subjects, standards not yet in DB
- Provides import count + warnings on completion

### FR-3: Pre-flight Feasibility Check
- Before solving, run arithmetic checks:
  - Total lectures ≤ available slots per section
  - Each teacher's load ≤ their available slots
  - Lab subjects have a lab room configured
- Return structured errors (blocking) and warnings (non-blocking)
- Admin MUST fix errors before generation can proceed

### FR-4: Timetable Generation
- Use Google OR-Tools CP-SAT to solve the constraint problem
- Hard constraints: no teacher/class clash, room capacity, fixed slots respected, teacher availability
- Soft objectives: subject spread, teacher rest, morning-heavy subjects, doubles cap
- Run as background job — UI polls status; avoids proxy timeouts

### FR-5: Soft Rules Configuration
- Admin toggles on/off per-rule preferences in the Rules page:
  - Keep key periods filled (1st, 2nd, before/after break, last)
  - Teacher rest after 2 consecutive periods
  - Avoid back-to-back free periods
  - Spread subjects across days
  - Morning scheduling for hard subjects
  - Max double periods per week

### FR-6: AI Custom Rules
- Admin pastes own Gemini or Claude API key
- Types rule in plain English: *"Maths should be in the morning"*
- System calls LLM to parse into structured rule, adds to solver
- Rules can be toggled on/off per-solve

### FR-7: Timetable Views
- **Class view**: Rows = periods, columns = days, cells show subject + teacher
- **Teacher view**: Same grid from teacher's perspective
- **Print-friendly**: CSS `@media print` hides nav, renders clean grid

### FR-8: Share Links
- Admin creates revocable parent share link for a published timetable
- Share link generates a QR code (via `qrcode` library)
- Parent access: read-only, teacher details stripped
- Admin can revoke instantly — link returns 404 immediately

### FR-9: Excel Export
- Admin downloads `.xlsx` file containing:
  - One sheet per class (student view)
  - One sheet per teacher (teacher view)
- Auth-gated (bearer token in JS fetch, not `<a href>`)

### FR-10: Authentication
- Email + password account per admin
- scrypt password hashing (stdlib only)
- HS256 JWT bearer token
- School ownership enforced on every API request

---

## Non-Functional Requirements

| NFR | Target |
|---|---|
| **Performance** | Solve ≤ 60s for typical school (20 classes, 40 teachers) |
| **Reliability** | Zero data loss — atomic DB writes; job status tracked |
| **Security** | Auth on all admin endpoints; parent share strips staff data |
| **Zero-setup local dev** | SQLite, no Docker, no migration commands needed |
| **Deployment cost** | All-free-tier: Vercel + Render + Supabase |

---

## Out of Scope (v2.x)

- Exam timetable / invigilation scheduling
- Email verification / password reset (listed for v3 roadmap)
- Full role matrix with approval chains (HOD → Admin)
- Per-school rule configuration (currently global)

---

## Roadmap (from PRD §7)

| Phase | Feature |
|---|---|
| v3 | Full role matrix (HOD approval chain) |
| v3 | Per-school rule config |
| v3 | Email verification + password reset |
| Future | Exam / invigilation scheduling |
| Future | Teacher portal (view own timetable, requests) |

---
*Related: [[01 - Project Overview]] · [[16 - Feature List & Roadmap]] · [[08 - Solver Engine (OR-Tools)]]*
