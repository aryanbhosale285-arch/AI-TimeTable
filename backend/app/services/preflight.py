"""Pre-flight feasibility check — plain arithmetic, no AI.

Catches impossible requests *before* the solver wastes time, and reports
exactly what to fix. This is the cheapest way to make the product feel smart.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Dict, TYPE_CHECKING
from collections import defaultdict

if TYPE_CHECKING:
    from app.models.school import School
    from app.models.timetable import FixedSlot


@dataclass
class PreflightReport:
    feasible: bool = True
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    stats: Dict = field(default_factory=dict)

    def fail(self, msg: str):
        self.errors.append(msg)
        self.feasible = False

    def warn(self, msg: str):
        self.warnings.append(msg)


def run_preflight(school: School, fixed_slots: List[FixedSlot] | None = None) -> PreflightReport:
    report = PreflightReport()
    fixed_slots = fixed_slots or []

    num_days = len(school.working_days)
    periods_per_day = school.periods_per_day

    if num_days == 0:
        report.fail("No working days configured. Add at least one working day.")
    if periods_per_day == 0:
        report.fail("Periods per day is 0. Set how many periods each day has.")
    if not report.feasible:
        return report

    # Real slots per class: half-days run fewer periods if configured.
    half = school.half_day_periods
    total_slots_per_section = sum(
        half if (day.is_half_day and half is not None) else periods_per_day
        for day in school.working_days
    )

    # All sections across all standards
    sections = [sec for std in school.standards for sec in std.sections]
    if not sections:
        report.fail("No classes (sections) configured.")
        return report

    # Fixed slots consumed per section
    fixed_by_section: Dict[int, int] = defaultdict(int)
    for fs in fixed_slots:
        fixed_by_section[fs.section_id] += 1

    # Protected periods (must never be free): 1st, 2nd, before/after break, last.
    lunch_after = school.breaks[0].after_period if getattr(school, "breaks", None) else None
    ordered_days = sorted(school.working_days, key=lambda d: d.day_order)

    def _protected_for_day(ndp: int) -> set:
        prot = set()
        if ndp >= 1:
            prot.update({0, ndp - 1})
        if ndp >= 2:
            prot.add(1)
        if lunch_after is not None:
            if 0 <= lunch_after - 1 < ndp:
                prot.add(lunch_after - 1)
            if 0 <= lunch_after < ndp:
                prot.add(lunch_after)
        return prot

    protected_by_day = []
    total_protected = 0
    for day in ordered_days:
        ndp = half if (day.is_half_day and half is not None) else periods_per_day
        pset = _protected_for_day(ndp)
        protected_by_day.append(pset)
        total_protected += len(pset)

    # Fixed slots that already sit on a protected period (they count as not-free).
    fixed_protected_by_section: Dict[int, int] = defaultdict(int)
    for fs in fixed_slots:
        if 0 <= fs.day_index < len(protected_by_day) and fs.period_index in protected_by_day[fs.day_index]:
            fixed_protected_by_section[fs.section_id] += 1

    # ---- Per-section capacity check ----
    demand_by_section: Dict[int, int] = defaultdict(int)
    for a in (a for sec in sections for a in sec.assignments):
        # Use the minimum of a range for the lower bound of demand
        demand_by_section[a.section_id] += a.lectures_per_week

    for sec in sections:
        capacity = total_slots_per_section - fixed_by_section[sec.id]
        demand = demand_by_section.get(sec.id, 0)
        label = f"{sec.standard.name} {sec.name}"
        if demand > capacity:
            report.fail(
                f"Class {label}: {demand} lectures/week needed but only "
                f"{capacity} slots available ({total_slots_per_section} total "
                f"- {fixed_by_section[sec.id]} fixed). Remove "
                f"{demand - capacity} lecture(s) or add periods."
            )
        elif demand < capacity:
            report.warn(
                f"Class {label}: {capacity - demand} free period(s) will remain."
            )

        # Enough lectures to keep every protected period (1st/2nd/around break/last) filled?
        required = total_protected - fixed_protected_by_section[sec.id]
        if demand < required:
            report.warn(
                f"Class {label}: only {demand} lecture(s) for {required} key periods "
                f"(1st, 2nd, before/after break, last) — some key periods may stay free. "
                f"Add ~{required - demand} more lecture(s) to fully avoid this."
            )

    # ---- Per-teacher capacity check ----
    teacher_demand: Dict[int, int] = defaultdict(int)
    for t in school.teachers:
        for a in t.assignments:
            teacher_demand[t.id] += a.lectures_per_week

    for t in school.teachers:
        demand = teacher_demand.get(t.id, 0)
        # availability-aware capacity
        avail = _available_slots(t, num_days, periods_per_day, total_slots_per_section)
        if demand > avail:
            report.fail(
                f"Teacher {t.name}: assigned {demand} lectures/week but only "
                f"available for {avail} slots. Reduce load or widen availability."
            )
        if t.max_periods_per_day and demand > t.max_periods_per_day * num_days:
            report.fail(
                f"Teacher {t.name}: {demand} lectures/week exceeds max "
                f"{t.max_periods_per_day}/day × {num_days} days."
            )
        if t.min_periods_per_week and demand < t.min_periods_per_week:
            report.warn(
                f"Teacher {t.name}: {demand} lectures/week is below contract "
                f"minimum of {t.min_periods_per_week}."
            )

    # ---- Lab room capacity check ----
    lab_subjects = [s for s in school.subjects if s.requires_room_type.value == "LAB"]
    lab_rooms = [r for r in school.rooms if r.room_type.value == "LAB" and r.is_available]
    if lab_subjects and not lab_rooms:
        report.fail(
            f"{len(lab_subjects)} subject(s) need a LAB room but none are configured."
        )

    report.stats = {
        "num_days": num_days,
        "periods_per_day": periods_per_day,
        "total_slots_per_section": total_slots_per_section,
        "num_sections": len(sections),
        "num_teachers": len(school.teachers),
        "num_subjects": len(school.subjects),
        "num_rooms": len(school.rooms),
        "total_lectures": sum(demand_by_section.values()),
    }
    return report


def _available_slots(teacher, num_days: int, periods_per_day: int, total_slots: int) -> int:
    """Count available slots from the teacher's availability grid (None = all)."""
    grid = teacher.availability
    if not grid:
        return total_slots
    count = 0
    for d in range(num_days):
        for p in range(periods_per_day):
            try:
                if grid[d][p]:
                    count += 1
            except (IndexError, TypeError, KeyError):
                count += 1  # missing entry defaults to available
    return count
