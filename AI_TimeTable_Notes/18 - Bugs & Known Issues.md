# 18 — Bugs & Known Issues

#bugs #issues #troubleshooting

## Active Known Issues

### 🐛 Chrome Preview (Antigravity IDE) Doesn't Open
**Status**: IDE infrastructure issue
**Cause**: Playwright driver (`playwright-1.57.0-win32_x64.zip`) returns 404 from Microsoft's CDN — the browser automation dependency is unavailable.
**Workaround**: Open Chrome manually and navigate to `http://localhost:3000`. Press `F5` in the IDE (uses `.vscode/launch.json`) to launch Chrome directly.

---

### 🐛 `uvicorn --reload` Hangs on Windows
**Status**: Known Windows limitation
**Cause**: The `--reload` flag uses filesystem watchers which are slow on Windows
**Workaround**: Start backend without `--reload`:
```bash
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

---

### 🐛 Dashboard Shows "Loading…" Indefinitely
**Status**: Not a bug — expected when backend is down
**Cause**: Backend not running on port 8000
**Fix**: Start the backend. See [[13 - Local Development Guide]].

---

### 🐛 Login Redirect Loop
**Status**: Occasional
**Cause**: Stale/corrupt token in localStorage
**Fix**:
1. Open Chrome DevTools (`F12`)
2. Application → Local Storage → `http://localhost:3000`
3. Delete `tt_token`
4. Refresh the page

---

### 🐛 Generation Job Stuck at "running" After Server Restart
**Status**: Known limitation
**Cause**: The background thread is lost on server restart. The job record in DB still shows `running`.
**Fix**: There is no automatic recovery. You'll need to manually update the DB or create a new generation job.

---

### 🐛 Render Free Tier Cold Start (Production)
**Status**: Known — Render free tier limitation
**Cause**: Render shuts down free services after 15 min of inactivity. Cold start takes 20-40 seconds.
**Workaround**: Frontend calls backend directly (bypassing Vercel proxy timeout). First request after cold start may be slow. A paid Render plan eliminates this.

---

## Resolved Issues

| Issue | Resolution |
|---|---|
| `body stream already read` error on API errors | Fixed in `api.ts` — body read once as text, then parsed |
| Proxy timeout during long solves (Vercel) | Fixed — frontend calls backend directly via `NEXT_PUBLIC_BACKEND_URL` |
| New columns not added to existing SQLite DB | Fixed — `run_startup_migrations()` handles ALTER TABLE automatically |

---

## Reporting New Bugs

Add them here with:
- **Date found**
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Status**: Open / Fixed / Won't Fix

---
*Related: [[13 - Local Development Guide]] · [[15 - Testing & Verification]]*
