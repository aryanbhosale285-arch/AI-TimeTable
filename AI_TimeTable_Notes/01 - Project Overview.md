# 01 — Project Overview

#project #overview

## What is AI-TimeTable?

AI-TimeTable is a full-stack web application that automatically generates **conflict-free school timetables**. Admins input teacher assignments once; the AI solver produces valid timetables for every class and every teacher in a single pass.

## Core Problem It Solves

Traditional timetabling is a **NP-hard combinatorial problem** — manually assigning hundreds of teachers to thousands of slots without conflicts takes days. AI-TimeTable reduces that to minutes.

## How It Works (End-to-End)

```
CSV Upload → Pre-flight Check → CP-SAT Solver → Timetable Views
```

1. **Read & Structure Input** — Admin uploads a CSV of teacher assignments (teacher name, subject, class, periods/week)
2. **Pre-flight Check** — Arithmetic feasibility check *before* solving catches impossible requests (e.g., more periods needed than slots available)
3. **Solve** — Google OR-Tools CP-SAT model fills every cell of the timetable grid without breaking hard rules
4. **Score & Optimize** — Soft rules (morning-heavy subjects, even weekly spread) are maximized within a time limit
5. **Split into Views** — Master timetable → student view, teacher view, parent share link

## Hard Rules (Never Broken)
- ❌ A teacher cannot be in two classes at once
- ❌ A class cannot have two subjects simultaneously
- ❌ A lab subject needs a lab room (capacity per slot enforced)

## Soft Rules (Preferences, Maximized)
- ✅ Key periods filled
- ✅ Teacher rest after 2 consecutive periods
- ✅ Subject spread across the week
- ✅ Morning-heavy subjects scheduled early
- ✅ Custom rules typed in plain English (parsed by LLM — Gemini/Claude)

## User Roles

| Role | Access |
|---|---|
| **Admin** | Full CRUD on school, teachers, timetables, rules |
| **Parent** | Read-only via revocable share link + QR code |

## Version History
- **v2.1** (current) — secure login, background generation, share links with QR codes, Excel export, custom AI rules

---
*Related: [[02 - Tech Stack]] · [[03 - Architecture Diagram]] · [[16 - Feature List & Roadmap]]*
