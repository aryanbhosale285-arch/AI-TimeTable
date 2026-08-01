# 08 — Solver Engine (OR-Tools)

#solver #ortools #cpsat #algorithm

## What is CP-SAT?

**CP-SAT** (Constraint Programming - Satisfiability) is Google OR-Tools' flagship solver. It:
- Finds solutions to constraint satisfaction problems
- Is used in production at Google (Calendar, Maps routing)
- Handles thousands of Boolean and integer variables efficiently
- Can optimize an objective function while satisfying all constraints

File: `backend/app/services/solver/engine.py` (~18KB)

## The Timetabling Model

### Variables

For each assignment (teacher, subject, class), one Boolean variable per possible slot:

```
x[teacher_id, subject_id, standard_id, day, period] ∈ {0, 1}
```

Where `1` means "this combination is scheduled in this slot."

### Hard Constraints (must all be satisfied)

| Constraint | Description |
|---|---|
| **Teacher uniqueness** | A teacher can appear at most once per (day, period) |
| **Class uniqueness** | A class can have at most one subject per (day, period) |
| **Room capacity** | At most N lab subjects per slot (if lab room exists) |
| **Lecture count** | Total weekly lectures must equal the `lectures_per_week` value |
| **Fixed slots** | Pre-locked periods cannot be assigned other subjects |

### Soft Constraints (objectives, maximized)

These become the **maximize** objective function when enabled in RuleConfig:

| Rule | Description |
|---|---|
| `fill_key_periods` | Schedule important subjects in periods 1-3 |
| `teacher_rest` | Penalize 3+ consecutive teaching periods |
| `subject_spread` | Spread subject across Mon-Fri, not clumped |
| `morning_heavy` | Prefer early periods for morning-heavy subjects |
| `max_doubles` | Limit consecutive same-subject back-to-back slots |

### Custom Rules (AI-Parsed)

Admin types plain English:
> "Mr. Sharma should not teach on Fridays"
> "Maths should always be in the first two periods"

These are parsed by the admin's LLM (Gemini or Claude) via `ai_rules.py` into structured constraints, then applied to the model.

## Preflight Check (`preflight.py`)

Before solving, arithmetic checks catch obvious impossibilities:

```
Total required lectures = sum of all assignments' lectures_per_week
Total available slots   = working_days × periods_per_day

If required > available → INFEASIBLE (report to admin)
```

Also checks:
- Each teacher's total load vs. their `max_periods_per_day`
- Lab subject demand vs. lab room count

## Solve Process

```python
model = cp_model.CpModel()
# 1. Create Boolean variables for all possible assignments
# 2. Add hard constraints
# 3. Add soft objectives
# 4. model.Maximize(objective)
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 60.0  # Time limit
status = solver.Solve(model)
```

Status outcomes:
- `OPTIMAL` — perfect solution found
- `FEASIBLE` — valid solution found (not proven optimal, time ran out)
- `INFEASIBLE` — no valid solution exists (preflight should have caught this)

## Performance Notes

- Small school (5 classes, 10 teachers, 6 periods/day × 5 days): solves in ~1-2 seconds
- Large school (20+ classes, 40+ teachers): may hit the 60-second limit with a `FEASIBLE` (good-enough) result
- The solver runs in a **background thread** so the UI doesn't block

---
*Related: [[09 - Background Job System]] · [[01 - Project Overview]] · [[17 - CSV Import Format]]*
