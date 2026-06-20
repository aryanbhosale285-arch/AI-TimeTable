from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine
from app.api.routes import school, academic, teacher, timetable, rule, fixed_slot
import app.models  # noqa: F401  ensure models are registered

app = FastAPI(title="Timetable AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# For local/dev convenience; production uses Alembic migrations.
Base.metadata.create_all(bind=engine)

app.include_router(school.router, prefix="/api")
app.include_router(academic.router, prefix="/api")
app.include_router(teacher.router, prefix="/api")
app.include_router(timetable.router, prefix="/api")
app.include_router(rule.router, prefix="/api")
app.include_router(fixed_slot.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "timetable-ai"}
