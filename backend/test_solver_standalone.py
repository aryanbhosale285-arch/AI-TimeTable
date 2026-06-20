"""Standalone smoke test for the solver — no DB, no FastAPI.

Builds fake school/teacher objects matching the ORM attribute surface the
solver reads, then asserts a valid timetable is produced with no clashes.
Run:  python test_solver_standalone.py
"""
from types import SimpleNamespace
from collections import defaultdict

from app.services.solver.engine import TimetableSolver
from app.services.preflight import run_preflight


def make_school():
    days = [SimpleNamespace(day_name=d, day_order=i, is_half_day=False)
            for i, d in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])]

    def subj(id, name, lab=False):
        return SimpleNamespace(
            id=id, name=name, color="#000",
            requires_room_type=SimpleNamespace(value="LAB" if lab else "CLASSROOM"),
        )

    subjects = [
        subj(1, "Maths"), subj(2, "Science"), subj(3, "English"),
        subj(4, "Social"), subj(5, "Computer", lab=True), subj(6, "Hindi"),
    ]

    sec_a = SimpleNamespace(id=1, name="A", assignments=[])
    sec_b = SimpleNamespace(id=2, name="B", assignments=[])
    std = SimpleNamespace(id=1, name="10th", sections=[sec_a, sec_b])
    sec_a.standard = std
    sec_b.standard = std

    rooms = [
        SimpleNamespace(id=1, name="101", room_type=SimpleNamespace(value="CLASSROOM"), capacity=45, is_available=True),
        SimpleNamespace(id=2, name="102", room_type=SimpleNamespace(value="CLASSROOM"), capacity=45, is_available=True),
        SimpleNamespace(id=3, name="Lab", room_type=SimpleNamespace(value="LAB"), capacity=40, is_available=True),
    ]

    # teacher, subject_id, section, lectures, morning?
    plan = [
        (1, "Mr. Sharma", 1, sec_a, 6, True),
        (1, "Mr. Sharma", 1, sec_b, 6, True),
        (2, "Ms. Iyer", 2, sec_a, 6, True),
        (2, "Ms. Iyer", 2, sec_b, 6, True),
        (3, "Mr. Khan", 3, sec_a, 5, False),
        (3, "Mr. Khan", 3, sec_b, 5, False),
        (4, "Ms. Rao", 4, sec_a, 5, False),
        (4, "Ms. Rao", 4, sec_b, 5, False),
        (5, "Mr. Das", 5, sec_a, 4, False),
        (5, "Mr. Das", 5, sec_b, 4, False),
        (3, "Mr. Khan", 6, sec_a, 4, False),
        (4, "Ms. Rao", 6, sec_b, 4, False),
    ]

    teachers_by_id = {}
    aid = 1
    for tid, tname, subj_id, sec, lpw, morning in plan:
        t = teachers_by_id.get(tid)
        if not t:
            t = SimpleNamespace(id=tid, name=tname, availability=None,
                                max_periods_per_day=8, min_periods_per_week=0,
                                assignments=[])
            teachers_by_id[tid] = t
        a = SimpleNamespace(
            id=aid, teacher_id=tid, subject_id=subj_id, section_id=sec.id,
            lectures_per_week=lpw, lectures_per_week_max=None,
            preferred_time="Morning" if morning else None,
        )
        t.assignments.append(a)
        sec.assignments.append(a)
        aid += 1

    school = SimpleNamespace(
        id=1, name="Demo", periods_per_day=8, half_day_periods=None,
        working_days=days, periods=[], breaks=[],
        subjects=subjects, standards=[std], rooms=rooms,
        teachers=list(teachers_by_id.values()),
    )
    return school


def main():
    school = make_school()

    print("=== PRE-FLIGHT ===")
    report = run_preflight(school, [])
    print("feasible:", report.feasible)
    for e in report.errors:
        print("  ERROR:", e)
    for w in report.warnings[:5]:
        print("  warn:", w)
    print("stats:", report.stats)
    assert report.feasible, "Pre-flight should pass for the demo data"

    print("\n=== SOLVE ===")
    solver = TimetableSolver(school, [], time_limit_seconds=20)
    result = solver.solve()
    print("status:", result.status)
    print("objective:", result.objective)
    print("cells filled:", len(result.slots))
    for line in result.log:
        print("  log:", line)
    assert result.status in ("OPTIMAL", "FEASIBLE"), "Solver should find a solution"

    # ---- Validate hard rules ----
    section_slot = defaultdict(int)
    teacher_slot = defaultdict(int)
    per_assignment = defaultdict(int)
    for c in result.slots:
        section_slot[(c["section_id"], c["day_index"], c["period_index"])] += 1
        teacher_slot[(c["teacher_id"], c["day_index"], c["period_index"])] += 1

    clash_section = [k for k, v in section_slot.items() if v > 1]
    clash_teacher = [k for k, v in teacher_slot.items() if v > 1]
    assert not clash_section, f"Section double-booked: {clash_section}"
    assert not clash_teacher, f"Teacher double-booked: {clash_teacher}"

    # ---- Validate lecture counts ----
    total_expected = sum(a.lectures_per_week for t in school.teachers for a in t.assignments)
    assert len(result.slots) == total_expected, \
        f"Expected {total_expected} lectures, got {len(result.slots)}"

    print("\n[PASS] ALL CHECKS PASSED")
    print(f"   {len(result.slots)} lectures placed, 0 teacher clashes, 0 class clashes.")


if __name__ == "__main__":
    main()
