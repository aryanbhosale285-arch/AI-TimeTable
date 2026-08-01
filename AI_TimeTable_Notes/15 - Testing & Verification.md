# 15 — Testing & Verification

#testing #verification #smoke-tests

## Test Files

| File | What it tests |
|---|---|
| `backend/test_api_smoke.py` | End-to-end API: auth, ownership, CSV import, background jobs, zero clashes, share links, Excel |
| `backend/test_solver_standalone.py` | Solver-only: 60 lectures placed, 0 teacher clashes, 0 class clashes |

---

## Running Tests

```bash
cd "d:\Project\AI Timetable\AI-TimeTable\backend"

# Activate venv
.venv\Scripts\Activate.ps1

# Full API smoke suite (requires backend NOT already running on 8000)
python test_api_smoke.py

# Solver unit test (no server needed)
python test_solver_standalone.py
```

### Expected Output — API Smoke

```
[PASS] ALL API SMOKE CHECKS PASSED
(27 checks: auth, ownership, CSV import, background job lifecycle,
 zero clashes, share links, Excel bundle)
```

### Expected Output — Solver

```
[PASS] ALL CHECKS PASSED: 60 lectures placed, 0 teacher clashes, 0 class clashes.
```

---

## What the Smoke Tests Cover

1. **Auth**: Register → Login → get token → `/auth/me`
2. **Ownership**: Admin A cannot access Admin B's school (→ 403)
3. **School setup**: Create school, subjects, standards, rooms, teachers
4. **CSV import**: Upload template CSV → verify teachers/assignments created
5. **Preflight**: Run feasibility check, get structured result
6. **Generation**: `generate-async` → poll job → wait for `done`
7. **Zero clashes**: Inspect every timetable entry — verify no teacher or class appears twice in same slot
8. **Share links**: Create link, access `/share/<token>` without auth, revoke link → 404
9. **Excel export**: Download `.xlsx` bundle, verify it's valid Excel

---

## Manual Verification Checklist

After starting both servers:

- [ ] `http://localhost:3000` loads without errors
- [ ] Can register a new account at `/login`
- [ ] Can create a new school at `/setup`
- [ ] Can upload `template.csv` to import teachers
- [ ] Preflight check runs and shows results
- [ ] Generate timetable → job completes → timetable displays
- [ ] Can create a share link and open it in incognito (no login)
- [ ] Can revoke share link → link no longer works
- [ ] Can download `.xlsx` export
- [ ] Dark/light mode toggle works

---

## Checking for Errors in the Browser

1. Open Chrome DevTools (`F12`)
2. Go to **Console** tab — look for red errors
3. Go to **Network** tab → filter by "Fetch/XHR" — look for failed requests (red rows)
4. Common: 401 (not logged in), 403 (wrong school), 500 (backend error)

---
*Related: [[13 - Local Development Guide]] · [[05 - Backend Setup & Dev]] · [[18 - Bugs & Known Issues]]*
