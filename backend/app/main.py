from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.deps import get_current_user, require_school_access
from app.api.routes import (
    academic, auth, fixed_slot, rule, school, share, teacher, timetable,
)
from app.core.database import Base, engine
from app.core.migrate import run_startup_migrations
import app.models  # noqa: F401  ensure models are registered

app = FastAPI(title="Timetable AI", version="2.1.0")

# The frontend (Vercel) calls this API directly from the browser. Auth uses
# bearer tokens in the Authorization header — no cookies — so a permissive
# origin list with allow_credentials=False is safe.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# create_all adds new tables; run_startup_migrations adds new columns to old ones.
Base.metadata.create_all(bind=engine)
run_startup_migrations(engine)

# Public: health, auth, parent share links.
app.include_router(auth.router, prefix="/api")
app.include_router(share.router, prefix="/api")

# Admin, school-scoped: every route carries /schools/{school_id}/ so one
# dependency enforces both login and school ownership.
_school_scoped = [Depends(require_school_access)]
app.include_router(school.router, prefix="/api")  # handlers check ownership themselves
app.include_router(academic.router, prefix="/api", dependencies=_school_scoped)
app.include_router(teacher.router, prefix="/api", dependencies=_school_scoped)
app.include_router(timetable.router, prefix="/api", dependencies=_school_scoped)
app.include_router(fixed_slot.router, prefix="/api", dependencies=_school_scoped)

# Admin, global config (per-school scoping is on the roadmap).
app.include_router(rule.router, prefix="/api", dependencies=[Depends(get_current_user)])


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "timetable-ai"}
