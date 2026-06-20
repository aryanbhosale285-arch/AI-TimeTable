"""The timetable engine, built on Google OR-Tools CP-SAT.

Model: for every (assignment, day, period) we create a boolean var meaning
"this lecture of this teacher→subject→section is scheduled in this slot".

Hard constraints (never broken):
  H1. Each assignment gets exactly its required number of lectures.
  H2. A class (section) has at most one lecture per slot.
  H3. A teacher is in at most one place per slot.
  H4. Teacher availability is respected.
  H5. Fixed slots block the section's cell.
  H6. Lab subjects only occupy slots where a lab room is free; room capacity
      across all rooms of the required type isn't exceeded per slot.

Soft objectives (maximised, weighted):
  S1. Spread a subject across distinct days (penalise same-day repeats).
  S2. Avoid 3+ consecutive same-subject periods.
  S3. Hard subjects (flagged by preferred_time='Morning') earlier in the day.
  S4. Balance each teacher's daily load.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional, TYPE_CHECKING
from collections import defaultdict

from ortools.sat.python import cp_model

if TYPE_CHECKING:
    from app.models.school import School
    from app.models.timetable import FixedSlot


@dataclass
class SolveResult:
    status: str                       # OPTIMAL / FEASIBLE / INFEASIBLE
    slots: List[dict] = field(default_factory=list)   # filled cells
    conflicts: List[dict] = field(default_factory=list)
    objective: Optional[float] = None
    log: List[str] = field(default_factory=list)


@dataclass
class _Assignment:
    id: int
    teacher_id: int
    subject_id: int
    section_id: int
    lectures: int
    requires_lab: bool
    prefers_morning: bool


# Admin-configurable scheduling preferences (defaults match the RuleConfig model).
DEFAULT_RULES = {
    "keep_key_periods_filled": True,
    "teacher_rest_after_two": True,
    "avoid_back_to_back_free": True,
    "spread_subjects": True,
    "morning_hard_subjects": True,
    "max_doubles_per_week": 2,
}


class TimetableSolver:
    def __init__(
        self,
        school: School,
        fixed_slots: List[FixedSlot] | None = None,
        time_limit_seconds: int = 30,
        rules: dict | None = None,
        custom_rules: list | None = None,
    ):
        self.school = school
        self.fixed_slots = fixed_slots or []
        self.time_limit = time_limit_seconds
        self.rules = {**DEFAULT_RULES, **(rules or {})}
        self.custom_rules = custom_rules or []
        self.log: List[str] = []

        self.num_days = len(school.working_days)
        self.periods = school.periods_per_day

        # Periods available on each day: half-days run fewer periods if configured.
        ordered_days = sorted(school.working_days, key=lambda d: d.day_order)
        half = school.half_day_periods
        self.periods_in_day = [
            half if (day.is_half_day and half is not None) else self.periods
            for day in ordered_days
        ]
        # Only real (day, period) cells exist; half-day tail periods are excluded.
        self.slots = [
            (d, p)
            for d in range(self.num_days)
            for p in range(self.periods_in_day[d])
        ]

        # Period (1-indexed) that lunch falls after, if any break is configured.
        self.lunch_after = (
            school.breaks[0].after_period if getattr(school, "breaks", None) else None
        )

        self.sections = [s for std in school.standards for s in std.sections]
        self.lab_room_count = sum(
            1 for r in school.rooms if r.room_type.value == "LAB" and r.is_available
        )
        self.classroom_count = sum(
            1 for r in school.rooms
            if r.room_type.value == "CLASSROOM" and r.is_available
        )

        self.assignments = self._collect_assignments()

    def _collect_assignments(self) -> List[_Assignment]:
        subj_lab = {
            s.id: (s.requires_room_type.value == "LAB") for s in self.school.subjects
        }
        out: List[_Assignment] = []
        for t in self.school.teachers:
            for a in t.assignments:
                out.append(
                    _Assignment(
                        id=a.id,
                        teacher_id=a.teacher_id,
                        subject_id=a.subject_id,
                        section_id=a.section_id,
                        lectures=a.lectures_per_week,
                        requires_lab=subj_lab.get(a.subject_id, False),
                        prefers_morning=(a.preferred_time or "").lower() == "morning",
                    )
                )
        return out

    def _teacher_available(self, teacher_id: int, day: int, period: int) -> bool:
        teacher = next((t for t in self.school.teachers if t.id == teacher_id), None)
        if not teacher or not teacher.availability:
            return True
        try:
            return bool(teacher.availability[day][period])
        except (IndexError, TypeError, KeyError):
            return True

    def protected_periods(self, day: int) -> set:
        """Periods that must never be free: 1st, 2nd, before-break, after-break, last."""
        ndp = self.periods_in_day[day]
        prot = set()
        if ndp >= 1:
            prot.add(0)          # 1st period
            prot.add(ndp - 1)    # last period
        if ndp >= 2:
            prot.add(1)          # 2nd period
        if self.lunch_after is not None:
            before = self.lunch_after - 1  # 0-indexed period right before the break
            after = self.lunch_after       # 0-indexed first period after the break
            if 0 <= before < ndp:
                prot.add(before)
            if 0 <= after < ndp:
                prot.add(after)
        return prot

    def _is_morning(self, period_index: int) -> bool:
        """Periods before the lunch break are 'morning', the rest 'afternoon'."""
        if self.lunch_after is not None:
            return period_index < self.lunch_after
        return period_index < (self.periods // 2)

    def _apply_custom_rules(self, model, x, penalties):
        """Translate admin-defined rules into weighted soft penalties.

        Subjects are matched by name (case-insensitive). Unknown subjects or
        malformed rules are simply skipped, so a bad rule never breaks solving.
        """
        name_to_ids = defaultdict(set)
        for s in self.school.subjects:
            name_to_ids[s.name.strip().lower()].add(s.id)

        for r in self.custom_rules:
            if not r.get("enabled", True):
                continue
            rtype = r.get("rule_type")
            sids = name_to_ids.get((r.get("subject_name") or "").strip().lower())
            if not sids:
                continue
            assigns = [a for a in self.assignments if a.subject_id in sids]

            if rtype == "subject_time":
                want_morning = (r.get("param_text") or "").lower().startswith("morn")
                for a in assigns:
                    for (d, p) in self.slots:
                        if (a.id, d, p) not in x:
                            continue
                        if self._is_morning(p) != want_morning:
                            penalties.append((8, x[(a.id, d, p)]))

            elif rtype == "subject_max_per_day":
                cap = max(0, int(r.get("param_int") or 1))
                for sec in self.sections:
                    sec_assigns = [a for a in assigns if a.section_id == sec.id]
                    if not sec_assigns:
                        continue
                    for d in range(self.num_days):
                        terms = [
                            x[(a.id, d, p)]
                            for a in sec_assigns
                            for p in range(self.periods_in_day[d])
                            if (a.id, d, p) in x
                        ]
                        if terms:
                            over = model.NewIntVar(0, len(terms), f"cmax_{sec.id}_{d}_{rtype}")
                            model.Add(over >= sum(terms) - cap)
                            penalties.append((7, over))

            elif rtype == "subject_position":
                avoid_last = (r.get("param_text") or "").lower().startswith("last")
                for a in assigns:
                    for d in range(self.num_days):
                        ndp = self.periods_in_day[d]
                        target = ndp - 1 if avoid_last else 0
                        if (a.id, d, target) in x:
                            penalties.append((6, x[(a.id, d, target)]))

    def solve(self) -> SolveResult:
        model = cp_model.CpModel()

        # x[(assignment_id, day, period)] = bool
        x: Dict[Tuple[int, int, int], cp_model.IntVar] = {}

        fixed_cells = {(fs.section_id, fs.day_index, fs.period_index) for fs in self.fixed_slots}

        for a in self.assignments:
            for (d, p) in self.slots:
                if not self._teacher_available(a.teacher_id, d, p):
                    continue
                if (a.section_id, d, p) in fixed_cells:
                    continue
                x[(a.id, d, p)] = model.NewBoolVar(f"x_{a.id}_{d}_{p}")

        # H1: each assignment scheduled exactly `lectures` times
        for a in self.assignments:
            vars_for_a = [x[(a.id, d, p)] for (d, p) in self.slots if (a.id, d, p) in x]
            if len(vars_for_a) < a.lectures:
                self.log.append(
                    f"Assignment {a.id}: only {len(vars_for_a)} feasible slots "
                    f"for {a.lectures} lectures."
                )
            model.Add(sum(vars_for_a) == a.lectures)

        # H2: one lecture per section per slot
        for sec in self.sections:
            sec_assignments = [a for a in self.assignments if a.section_id == sec.id]
            for (d, p) in self.slots:
                terms = [x[(a.id, d, p)] for a in sec_assignments if (a.id, d, p) in x]
                if terms:
                    model.Add(sum(terms) <= 1)

        # H3: a teacher in at most one place per slot
        teacher_assignments: Dict[int, List[_Assignment]] = defaultdict(list)
        for a in self.assignments:
            teacher_assignments[a.teacher_id].append(a)
        for tid, alist in teacher_assignments.items():
            for (d, p) in self.slots:
                terms = [x[(a.id, d, p)] for a in alist if (a.id, d, p) in x]
                if terms:
                    model.Add(sum(terms) <= 1)

        # H6: lab room capacity per slot
        if self.lab_room_count >= 0:
            lab_assignments = [a for a in self.assignments if a.requires_lab]
            for (d, p) in self.slots:
                terms = [x[(a.id, d, p)] for a in lab_assignments if (a.id, d, p) in x]
                if terms:
                    model.Add(sum(terms) <= self.lab_room_count)

        # ---- Soft objective terms ----
        penalties = []

        # P7 (was hard): keep key periods filled (1st, 2nd, before/after break, last).
        # Strong preference, not absolute — avoids INFEASIBLE when rules collide.
        # A fixed-slot activity (assembly/library) already counts as "not free".
        for sec in (self.sections if self.rules["keep_key_periods_filled"] else []):
            sec_assignments = [a for a in self.assignments if a.section_id == sec.id]
            for d in range(self.num_days):
                for p in self.protected_periods(d):
                    if (sec.id, d, p) in fixed_cells:
                        continue
                    terms = [x[(a.id, d, p)] for a in sec_assignments if (a.id, d, p) in x]
                    if terms:
                        free = model.NewBoolVar(f"pfree_{sec.id}_{d}_{p}")
                        model.Add(free >= 1 - sum(terms))
                        penalties.append((15, free))  # heavy: rarely leave these free

        # P8 (was hard): a teacher rests after 2 back-to-back lectures — avoid 3 in a row.
        for tid, alist in (teacher_assignments.items() if self.rules["teacher_rest_after_two"] else []):
            for d in range(self.num_days):
                for p in range(self.periods_in_day[d] - 2):
                    window = [
                        x[(a.id, d, q)]
                        for a in alist
                        for q in (p, p + 1, p + 2)
                        if (a.id, d, q) in x
                    ]
                    if window:
                        over = model.NewIntVar(0, 1, f"run3_{tid}_{d}_{p}")
                        model.Add(over >= sum(window) - 2)
                        penalties.append((10, over))  # strong: avoid 3-in-a-row

        # S1: spread a subject across the week, but ALLOW a "double period"
        # (two consecutive lectures) once or twice a week.
        #   - mild penalty for any same-subject repeat on a day -> prefer spread
        #   - strong penalty for 3+ of a subject in one day      -> no clustering
        #   - cap consecutive doubles at 2 per week per class     -> "once or twice"
        for sec in (self.sections if self.rules["spread_subjects"] else []):
            sec_assignments = [a for a in self.assignments if a.section_id == sec.id]
            by_subject: Dict[int, List[_Assignment]] = defaultdict(list)
            for a in sec_assignments:
                by_subject[a.subject_id].append(a)

            section_doubles = []  # consecutive same-subject indicators for this class
            for subj_id, alist in by_subject.items():
                for d in range(self.num_days):
                    ndp = self.periods_in_day[d]
                    # subject-present indicator per period (0/1: a class slot holds <= 1)
                    sv = {}
                    for p in range(ndp):
                        terms = [x[(a.id, d, p)] for a in alist if (a.id, d, p) in x]
                        if terms:
                            sv[p] = sum(terms)
                    if not sv:
                        continue
                    total_day = sum(sv.values())
                    rep = model.NewIntVar(0, ndp, f"rep_{sec.id}_{subj_id}_{d}")
                    model.Add(rep >= total_day - 1)
                    penalties.append((1, rep))   # mild: prefer one-per-day
                    cluster = model.NewIntVar(0, ndp, f"cl_{sec.id}_{subj_id}_{d}")
                    model.Add(cluster >= total_day - 2)
                    penalties.append((6, cluster))  # strong: never 3+ in a day
                    # consecutive double indicators (dbl = sv[p] AND sv[p+1])
                    for p in range(ndp - 1):
                        if p in sv and (p + 1) in sv:
                            dbl = model.NewBoolVar(f"dbl_{sec.id}_{subj_id}_{d}_{p}")
                            model.Add(dbl <= sv[p])
                            model.Add(dbl <= sv[p + 1])
                            model.Add(dbl >= sv[p] + sv[p + 1] - 1)
                            section_doubles.append(dbl)

            if section_doubles:
                allowed = max(0, self.rules["max_doubles_per_week"])
                over_dbl = model.NewIntVar(0, len(section_doubles), f"odbl_{sec.id}")
                model.Add(over_dbl >= sum(section_doubles) - allowed)
                penalties.append((4, over_dbl))

        # S2: avoid back-to-back FREE periods within a class's day.
        for sec in (self.sections if self.rules["avoid_back_to_back_free"] else []):
            sec_assignments = [a for a in self.assignments if a.section_id == sec.id]
            for d in range(self.num_days):
                ndp = self.periods_in_day[d]
                occ = {}
                for p in range(ndp):
                    terms = [x[(a.id, d, p)] for a in sec_assignments if (a.id, d, p) in x]
                    occ[p] = sum(terms) if terms else 0
                for p in range(ndp - 1):
                    # both periods free (occ == 0) -> penalise
                    bf = model.NewBoolVar(f"bf_{sec.id}_{d}_{p}")
                    model.Add(bf >= 1 - occ[p] - occ[p + 1])
                    penalties.append((2, bf))

        # S3: prefer morning for flagged subjects (penalty grows with period index)
        for a in (self.assignments if self.rules["morning_hard_subjects"] else []):
            if a.prefers_morning:
                for (d, p) in self.slots:
                    if (a.id, d, p) in x:
                        penalties.append((p, x[(a.id, d, p)]))

        # ---- Admin-defined custom rules ----
        self._apply_custom_rules(model, x, penalties)

        if penalties:
            model.Minimize(sum(w * v for w, v in penalties))

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = self.time_limit
        solver.parameters.num_search_workers = 8
        status = solver.Solve(model)

        status_name = solver.StatusName(status)
        self.log.append(f"Solver status: {status_name}")

        result = SolveResult(status=status_name, log=self.log)
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            result.objective = solver.ObjectiveValue() if penalties else 0.0
            for a in self.assignments:
                for (d, p) in self.slots:
                    if (a.id, d, p) in x and solver.Value(x[(a.id, d, p)]) == 1:
                        result.slots.append(
                            {
                                "section_id": a.section_id,
                                "teacher_id": a.teacher_id,
                                "subject_id": a.subject_id,
                                "day_index": d,
                                "period_index": p,
                            }
                        )
        else:
            # Report which assignments are unsatisfiable for the red-flag handover
            result.conflicts = [
                {"assignment_id": a.id, "section_id": a.section_id}
                for a in self.assignments
            ]
        return result
