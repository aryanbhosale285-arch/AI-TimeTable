# 04 — Database Schema

#database #schema #models

## Overview

- **Local dev**: SQLite (`backend/timetable.db`) — auto-created on first boot
- **Production**: PostgreSQL (Supabase)
- Tables are auto-created via `Base.metadata.create_all()` + Alembic startup migrations

## Entity Relationship

```
User (admin)
  └── School (1:many, owner_id)
        ├── Subject (1:many)
        ├── Standard (1:many) — a class/grade
        ├── Room (1:many)
        ├── Teacher (1:many)
        │     └── Assignment (many:many → Standard, Subject)
        ├── FixedSlot (1:many) — locked periods
        ├── Timetable (1:many)
        │     ├── TimetableEntry (1:many) — individual cells
        │     ├── GenerationJob (1:many) — async solve job
        │     └── ShareLink (1:many) — parent access tokens
        └── RuleConfig (1:1) — soft-rule weights
              └── CustomRule (1:many) — AI-parsed plain English rules
```

## Key Tables

### `users`
| Column | Type | Notes |
|---|---|---|
| id | Integer PK | |
| email | String UNIQUE | Login credential |
| name | String | Display name |
| hashed_password | String | scrypt hash |
| created_at | DateTime | |

### `schools`
| Column | Type | Notes |
|---|---|---|
| id | Integer PK | |
| owner_id | FK → users | Ownership check on every request |
| name | String | School name |
| board | String | e.g. CBSE, ICSE |
| academic_year | String | e.g. 2025-26 |
| working_days | JSON | e.g. ["Mon","Tue","Wed","Thu","Fri"] |
| periods_per_day | Integer | |
| period_duration_min | Integer | |

### `teachers`
| Column | Type | Notes |
|---|---|---|
| id | Integer PK | |
| school_id | FK → schools | |
| name | String | |
| max_periods_per_day | Integer | Optional constraint |

### `assignments`
| Column | Type | Notes |
|---|---|---|
| id | Integer PK | |
| school_id | FK | |
| teacher_id | FK → teachers | |
| subject_id | FK → subjects | |
| standard_id | FK → standards | |
| lectures_per_week | Integer | Can be a range e.g. "4-5" |
| preferred_time | String | "Morning" / "Afternoon" |

### `timetable_entries`
| Column | Type | Notes |
|---|---|---|
| id | Integer PK | |
| timetable_id | FK | |
| day | String | "Mon", "Tue", etc. |
| period | Integer | 1-based |
| standard_id | FK | Which class |
| subject_id | FK | |
| teacher_id | FK | |
| room_id | FK (nullable) | |

### `generation_jobs`
| Column | Type | Notes |
|---|---|---|
| id | Integer PK | |
| school_id | FK | |
| timetable_id | FK (nullable) | Set when done |
| status | String | `pending`, `running`, `done`, `failed` |
| stage | String | Human-readable progress label |
| error | String (nullable) | Error message if failed |
| created_at | DateTime | |
| finished_at | DateTime (nullable) | |

### `share_links`
| Column | Type | Notes |
|---|---|---|
| id | Integer PK | |
| timetable_id | FK | |
| token | String UNIQUE | URL-safe random token |
| created_at | DateTime | |
| revoked | Boolean | Default False |

### `rule_configs`
| Column | Type | Notes |
|---|---|---|
| id | Integer PK | |
| school_id | FK (nullable) | NULL = global default |
| fill_key_periods | Boolean | |
| teacher_rest | Boolean | |
| subject_spread | Boolean | |
| morning_heavy | Boolean | |
| max_doubles | Integer | Max back-to-back periods for a subject |
| ai_api_key | String (nullable) | Admin's Gemini/Claude key |

---
*Related: [[03 - Architecture Diagram]] · [[05 - Backend Setup & Dev]]*
