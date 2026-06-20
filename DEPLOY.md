# Deploying Timetable AI

Three free pieces that talk to each other:

| Piece | Host | Notes |
|---|---|---|
| Frontend (Next.js) | **Vercel** | Root directory = `frontend` |
| Backend (FastAPI) | **Render** | Root directory = `backend`; long solves are fine here |
| Database | **Supabase** | Already set up |

Deploy the **backend first** (you need its URL for the frontend).

---

## 1. Backend → Render

1. Go to https://render.com → sign in with GitHub.
2. **New + → Blueprint** → pick the `AI-TimeTable` repo. It reads `render.yaml`.
   - (Or **New + → Web Service** manually: Root Directory `backend`, Build `pip install -r requirements.txt`, Start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.)
3. After it creates the service, open it → **Environment** → add:
   - `DATABASE_URL` = your Supabase pooler URL
     (`postgresql+psycopg://postgres.<ref>:<password>@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`)
4. Deploy. When it's live, copy the URL, e.g. `https://timetable-ai-backend.onrender.com`.
5. Test it: open `https://<your-backend>.onrender.com/api/health` → should show `{"status":"ok"}`.

> Note: Render's **free** tier sleeps after ~15 min idle, so the first request after a nap takes ~50s to wake up. That's normal for free hosting.

---

## 2. Frontend → Vercel

1. https://vercel.com → **Add New → Project** → import `AI-TimeTable`.
2. **IMPORTANT — set Root Directory to `frontend`** (click "Edit" next to Root Directory).
   Vercel will auto-detect Next.js.
3. Under **Environment Variables**, add BOTH (using your Render URL from step 1):
   - `BACKEND_URL` = `https://timetable-ai-backend.onrender.com`  *(no `/api`)*
   - `NEXT_PUBLIC_BACKEND_URL` = `https://timetable-ai-backend.onrender.com/api`  *(with `/api`)*
4. **Deploy.** Open the Vercel URL — your app is live.

---

## If you change code later
Push to GitHub → Vercel and Render **auto-redeploy** from the `main` branch. No manual rebuild.

## Quick gotchas
- Frontend shows "Couldn't reach the API" → the two Vercel env vars are wrong/missing, or the backend is still waking up (wait ~50s, refresh).
- Generation slow on first try → Render free tier waking up; subsequent runs are fast.
