# 09 — Background Job System

#backend #jobs #async #generation

## Why Background Jobs?

Timetable generation can take 10-60 seconds for large schools. HTTP proxies (Vercel, Render) and browsers have short timeouts. A synchronous endpoint would:
- Time out on Render's free tier (cold starts)
- Fail through Vercel's proxy timeout
- Block the UI

## Solution: Poll-Based Async Generation

```
POST generate-async → returns job_id immediately
                        │
                        └── Background thread: solve
                                │
Frontend polls GET jobs/:id     │
every 2 seconds    ←────────────┘ (status updates)
                        │
When status = "done"    │
→ display timetable     ▼
                    Save to DB
```

## Job Lifecycle

```
created     → pending
thread starts → running (stage updates as it progresses)
solve done  → done     (timetable_id is set)
error       → failed   (error message is set)
```

### Stage Labels (shown in UI)

1. `"Checking feasibility…"`
2. `"Solving (this may take up to 60 s)…"`
3. `"Saving timetable…"`
4. `"Done"` or `"Failed: <reason>"`

## Code Structure

### `generation.py`
- `run_generation_job(job_id, db)` — the function that runs in the background thread
- Calls `preflight.py` → `engine.py` → saves `TimetableEntry` records → updates job

### `timetable.py` (route)
```python
@router.post("/schools/{school_id}/timetables/generate-async")
def generate_async(school_id, db):
    job = GenerationJob(school_id=school_id, status="pending")
    db.add(job); db.commit()
    
    # Fire and forget — Python thread
    thread = Thread(target=run_generation_job, args=(job.id,))
    thread.daemon = True
    thread.start()
    
    return job  # Returns immediately with job.id
```

### Polling (Frontend)
```typescript
// Frontend polls every 2 seconds
const { data: job } = useSWR(
  `/schools/${id}/timetables/jobs/${jobId}`,
  fetcher,
  { refreshInterval: job?.status === "running" ? 2000 : 0 }
);
```

## Database Record (`generation_jobs`)

| Field | Values |
|---|---|
| status | `pending` → `running` → `done` / `failed` |
| stage | Human-readable progress string |
| timetable_id | Set when `status = "done"` |
| error | Set when `status = "failed"` |

## Limitations

- Jobs are in-memory threads — if the server restarts mid-solve, the job is lost
- No job queue or retry mechanism (Celery/Redis is out of scope)
- Only one generation per school can run at a time (no parallelism check currently)

---
*Related: [[08 - Solver Engine (OR-Tools)]] · [[06 - API Endpoints Reference]] · [[05 - Backend Setup & Dev]]*
