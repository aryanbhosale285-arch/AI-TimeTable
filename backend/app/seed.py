"""Seed a demo school so the app is usable immediately after `docker compose up`.

Run:  python -m app.seed
"""
from datetime import time

from app.core.database import SessionLocal, Base, engine
from app.models.school import School, WorkingDay, Period, Break, BoardTemplate
from app.models.academic import Subject, Standard, Section, Room, RoomType
from app.models.teacher import Teacher, TeacherAssignment

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    if db.query(School).first():
        print("Database already seeded.")
        db.close()
        return

    school = School(
        name="Demo Public School",
        board=BoardTemplate.CBSE,
        periods_per_day=8,
        academic_year="2025-26",
    )
    db.add(school)
    db.flush()

    for i, day in enumerate(DAYS):
        db.add(WorkingDay(
            school_id=school.id, day_name=day, day_order=i,
            is_half_day=(day == "Saturday"),
        ))

    start = time(8, 0)
    for p in range(1, 9):
        h = 8 + (p - 1)
        db.add(Period(
            school_id=school.id, period_number=p,
            start_time=time(h, 0), end_time=time(h, 45),
            label=f"Period {p}",
        ))
    db.add(Break(school_id=school.id, name="Lunch", after_period=4, duration_minutes=30))

    # Subjects
    subjects = {}
    subject_defs = [
        ("Maths", "#6366f1", RoomType.CLASSROOM),
        ("Science", "#10b981", RoomType.CLASSROOM),
        ("English", "#f59e0b", RoomType.CLASSROOM),
        ("Social Studies", "#ef4444", RoomType.CLASSROOM),
        ("Computer", "#8b5cf6", RoomType.LAB),
        ("Hindi", "#ec4899", RoomType.CLASSROOM),
    ]
    for name, color, rtype in subject_defs:
        s = Subject(school_id=school.id, name=name, color=color, requires_room_type=rtype)
        db.add(s)
        db.flush()
        subjects[name] = s

    # Standards & sections
    std10 = Standard(school_id=school.id, name="10th", order=10)
    db.add(std10)
    db.flush()
    sec_a = Section(standard_id=std10.id, name="A", strength=40)
    sec_b = Section(standard_id=std10.id, name="B", strength=38)
    db.add_all([sec_a, sec_b])
    db.flush()

    # Rooms
    db.add_all([
        Room(school_id=school.id, name="Room 101", room_type=RoomType.CLASSROOM, capacity=45),
        Room(school_id=school.id, name="Room 102", room_type=RoomType.CLASSROOM, capacity=45),
        Room(school_id=school.id, name="Computer Lab", room_type=RoomType.LAB, capacity=40),
    ])

    # Teachers + assignments
    teachers = {}
    for tname in ["Mr. Sharma", "Ms. Iyer", "Mr. Khan", "Ms. Rao", "Mr. Das"]:
        t = Teacher(school_id=school.id, name=tname)
        db.add(t)
        db.flush()
        teachers[tname] = t

    # (teacher, subject, section, lectures/week)
    plan = [
        ("Mr. Sharma", "Maths", sec_a, 6),
        ("Mr. Sharma", "Maths", sec_b, 6),
        ("Ms. Iyer", "Science", sec_a, 6),
        ("Ms. Iyer", "Science", sec_b, 6),
        ("Mr. Khan", "English", sec_a, 5),
        ("Mr. Khan", "English", sec_b, 5),
        ("Ms. Rao", "Social Studies", sec_a, 5),
        ("Ms. Rao", "Social Studies", sec_b, 5),
        ("Mr. Das", "Computer", sec_a, 4),
        ("Mr. Das", "Computer", sec_b, 4),
        ("Mr. Khan", "Hindi", sec_a, 4),
        ("Ms. Rao", "Hindi", sec_b, 4),
    ]
    for tname, subj, sec, lpw in plan:
        db.add(TeacherAssignment(
            school_id=school.id,
            teacher_id=teachers[tname].id,
            subject_id=subjects[subj].id,
            section_id=sec.id,
            lectures_per_week=lpw,
            preferred_time="Morning" if subj in ("Maths", "Science") else None,
        ))

    db.commit()
    print(f"Seeded school id={school.id} with {len(plan)} assignments.")
    db.close()


if __name__ == "__main__":
    seed()
