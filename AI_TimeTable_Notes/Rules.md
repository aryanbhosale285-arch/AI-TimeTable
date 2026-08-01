# Rules

#rules #solver #configuration #constraints

## Overview

The Rules system has two layers:
1. **Built-in Soft Rules** — toggle on/off in the UI → controls solver's objective function
2. **Custom AI Rules** — typed in plain English → parsed by LLM → injected into solver

Both are stored in the database and applied at generation time.

---

## Built-in Hard Rules (Always Active, Cannot Be Disabled)

These are structural constraints coded directly into `solver/engine.py`. The solver **never** produces a solution that violates them.

| Code | Rule | Description |
|---|---|---|
| **H1** | Exact lecture count | Each assignment gets *exactly* its `lectures_per_week` lectures placed |
| **H2** | Class uniqueness | A section has at most one lecture per (day, period) slot |
| **H3** | Teacher uniqueness | A teacher is in at most one place per (day, period) slot |
| **H4** | Teacher availability | Teacher's availability grid is respected (if configured) |
| **H5** | Fixed slots | Pre-locked periods are blocked for other subjects |
| **H6** | Lab room capacity | Lab subjects only occupy slots where a lab room is free |

---

## Built-in Soft Rules (Configurable, Toggled in Rules Page)

These become **weighted objectives** in the CP-SAT `model.Maximize(...)` call. They can be toggled on or off by the admin in the `/rules` page.

### S1: `keep_key_periods_filled`
**Default**: ✅ On
**What it does**: Prefers scheduling subjects into *key periods* — 1st period, 2nd period, period before lunch, period after lunch, and last period — rather than leaving them empty.
**Why**: Free periods in the middle or at the start of school are disruptive for students.

---

### S2: `teacher_rest_after_two` (also `avoid_back_to_back_free`)
**Default**: ✅ On
**What it does**: Penalizes assigning a teacher 3 or more consecutive teaching periods without a break.
**Why**: Prevents teacher burnout and reduces errors in long teaching stretches.

---

### S3: `spread_subjects`
**Default**: ✅ On
**What it does**: Penalizes placing two lectures of the same subject in the same day for a class. Prefers distributing Maths on Mon, Wed, Fri over Mon, Mon, Tue.
**Why**: Research shows spaced repetition improves learning retention.

---

### S4: `morning_hard_subjects`
**Default**: ✅ On
**What it does**: For assignments marked `preferred_time = "Morning"`, penalizes placing them in afternoon periods.
**Why**: Cognitively demanding subjects (Maths, Science) are better absorbed when students are fresh.

---

### S5: `max_doubles_per_week`
**Default**: 2
**What it does**: Limits how many times the same subject can appear in consecutive periods (back-to-back doubles) per week, per class.
**Why**: Too many doubles can make a school day feel monotonous and unbalanced.

---

### S6: `solve_time_limit`
**Default**: 30 seconds
**What it does**: CP-SAT stops solving after this many seconds. Returns the best `FEASIBLE` solution found so far.
**Why**: Large schools may not reach `OPTIMAL` in time — a good-enough solution is better than no solution.

---

## Rule Configuration API

```http
GET  /api/rules          → Get current config
PUT  /api/rules          → Update config (partial — only send what's changing)
```

Example PUT request:
```json
{
  "spread_subjects": true,
  "morning_hard_subjects": false,
  "max_doubles_per_week": 3,
  "solve_time_limit": 60
}
```

> **Note**: The API key is **never returned** in GET responses — only `has_ai_key: true/false` is shown. The key is stored in the DB but not echoed back.

---

## Custom AI Rules

Admin types a rule in plain English. The system sends it to the LLM (Gemini or Claude) and gets back a structured rule.

### How It Works

```
Admin types: "Keep Maths in the morning"
      │
POST /api/rules/custom/parse
      │
Backend: ai_rules.parse_rule(text, provider, api_key)
      │
LLM (Gemini/Claude): returns JSON
{
  "rule_type": "subject_time",
  "subject_name": "Maths",
  "param_text": "morning",
  "param_int": null
}
      │
Stored as CustomRule in DB
      │
Applied at next generation
```

### Supported Custom Rule Types

| `rule_type` | `param_text` | `param_int` | Meaning |
|---|---|---|---|
| `subject_time` | `"morning"` or `"afternoon"` | null | Schedule this subject in specified time of day |
| `subject_max_per_day` | null | Integer (e.g. 1) | Max N occurrences of this subject per day |
| `subject_position` | `"first"` or `"last"` | null | Avoid this subject in first/last period |

### Setting Up the AI Key

1. Go to `/rules` page → **AI Assistant** section
2. Paste your Gemini API key (`AIza...`) or Anthropic key (`sk-ant-...`)
3. Provider is **auto-detected** from key prefix:
   - `sk-ant-...` → Claude (`claude-haiku-4-5-20251001`)
   - anything else → Gemini (`gemini-2.0-flash`)
4. Click Save

### Custom Rule Management

| Action | UI | API |
|---|---|---|
| Create | Type in text box + Parse | `POST /api/rules/custom/parse` |
| Toggle on/off | Toggle switch | `PATCH /api/rules/custom/:id` |
| Delete | Delete button | `DELETE /api/rules/custom/:id` |

---

## Default Rule Values (`engine.py`)

```python
DEFAULT_RULES = {
    "keep_key_periods_filled": True,
    "teacher_rest_after_two": True,
    "avoid_back_to_back_free": True,
    "spread_subjects": True,
    "morning_hard_subjects": True,
    "max_doubles_per_week": 2,
}
```

These are used if no `RuleConfig` row exists in the DB.

---

## Preflight Rules (Not Solver Rules)

Preflight checks (in `preflight.py`) also apply rule-like logic — but these run *before* the solver and catch infeasible configurations:

| Check | Type |
|---|---|
| Total lectures ≤ available slots per section | Error (blocks generation) |
| Teacher load ≤ teacher's available slots | Error |
| Lab subjects require lab rooms | Error |
| Free periods remaining after assignment | Warning |
| Demand < key periods required | Warning |
| Teacher below contract minimum | Warning |

---
*Related: [[08 - Solver Engine (OR-Tools)]] · [[PRD]] · [[06 - API Endpoints Reference]]*
