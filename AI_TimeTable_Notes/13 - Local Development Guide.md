# 13 — Local Development Guide

#dev #local #setup #quickstart

## Prerequisites

- **Python 3.10+** (for backend)
- **Node.js 18+** (for frontend)
- **Google Chrome** (for browser preview)

## First-Time Setup

### 1. Backend

```bash
cd "d:\Project\AI Timetable\AI-TimeTable\backend"

# Create virtual environment
python -m venv .venv

# Activate (Windows PowerShell)
.venv\Scripts\Activate.ps1

# Install packages
pip install -r requirements.txt
```

### 2. Frontend

```bash
cd "d:\Project\AI Timetable\AI-TimeTable\frontend"
npm install
```

---

## Starting Servers (Every Dev Session)

Both servers must run simultaneously. Open **two separate terminals**:

### Terminal 1 — Backend (port 8000)

```bash
cd "d:\Project\AI Timetable\AI-TimeTable\backend"
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

✅ Ready when you see: `Uvicorn running on http://127.0.0.1:8000`

### Terminal 2 — Frontend (port 3000)

```bash
cd "d:\Project\AI Timetable\AI-TimeTable\frontend"
npm run dev
```

✅ Ready when you see: `Ready in X.Xs`

---

## Verification

```bash
# Check backend is alive
Invoke-WebRequest http://localhost:8000/api/health
# Expected: {"status":"ok","service":"timetable-ai"}

# Check frontend is serving
Invoke-WebRequest http://localhost:3000
# Expected: HTML with "AI-TimeTable" title
```

---

## Common Issues & Fixes

### ❌ Frontend shows "Loading…" indefinitely
**Cause**: Backend not running
**Fix**: Start the backend on port 8000

### ❌ "ECONNREFUSED 127.0.0.1:8000" in frontend logs
**Cause**: Backend not running or crashed
**Fix**: Check backend terminal for errors, restart it

### ❌ Backend crashes on startup with import errors
**Fix**: Make sure `.venv` is activated and all packages are installed:
```bash
.venv\Scripts\python.exe -c "from app.main import app; print('OK')"
```

### ❌ Frontend not redirecting to login (stays on blank/loading)
**Cause**: Stale token in localStorage
**Fix**: Open DevTools → Application → Local Storage → delete `tt_token`

### ❌ `uvicorn --reload` hangs on Windows
**Cause**: Windows file watcher is slow
**Fix**: Use without `--reload` flag

### ❌ Port 8000 already in use
```powershell
# Find what's using port 8000
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess
# Kill it
Stop-Process -Id <PID> -Force
```

---

## Dev Workflow: Adding a Feature

1. **API change** → Edit a route in `backend/app/api/routes/`
2. **Schema change** → Update `backend/app/schemas/`
3. **DB change** → Update `backend/app/models/` and add migration in `backend/app/core/migrate.py`
4. **Frontend type** → Update `frontend/src/lib/types.ts`
5. **Frontend API call** → Update `frontend/src/lib/api.ts`
6. **UI** → Create/update component in `frontend/src/app/` or `frontend/src/components/`

---

## Useful Links

| Link | Purpose |
|---|---|
| http://localhost:3000 | App UI |
| http://localhost:8000/docs | Swagger API docs |
| http://localhost:8000/redoc | ReDoc API docs |
| [template.csv](file:///d:/Project/AI%20Timetable/AI-TimeTable/frontend/public/template.csv) | CSV upload template |

---
*Related: [[05 - Backend Setup & Dev]] · [[10 - Frontend Setup & Dev]] · [[15 - Testing & Verification]] · [[18 - Bugs & Known Issues]]*
