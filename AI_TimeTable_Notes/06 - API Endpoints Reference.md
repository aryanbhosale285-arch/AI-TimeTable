# 06 — API Endpoints Reference

#api #endpoints #backend

Base URL: `http://localhost:8000/api`

> 🔐 = Requires `Authorization: Bearer <token>` header
> 🏫 = Also requires requesting user owns the school

---

## Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Create account |
| POST | `/auth/login` | — | Login → get token |
| GET | `/auth/me` | 🔐 | Get current user info |

**Login request body:**
```json
{ "email": "admin@school.edu", "password": "secret123" }
```

**Login response:**
```json
{ "access_token": "eyJ...", "token_type": "bearer" }
```

---

## Schools

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/schools` | 🔐 | List admin's schools |
| POST | `/schools` | 🔐 | Create school |
| GET | `/schools/:id` | 🔐🏫 | Get school detail |

---

## Academic (School-Scoped)

All require 🔐🏫.

| Method | Path | Description |
|---|---|---|
| GET | `/schools/:id/subjects` | List subjects |
| POST | `/schools/:id/subjects` | Create subject |
| PATCH | `/schools/:id/subjects/:subid` | Update subject |
| DELETE | `/schools/:id/subjects/:subid` | Delete subject |
| GET | `/schools/:id/standards` | List standards (classes) |
| POST | `/schools/:id/standards` | Create standard |
| GET | `/schools/:id/rooms` | List rooms |
| POST | `/schools/:id/rooms` | Create room |
| PATCH | `/schools/:id/rooms/:rid` | Update room |
| DELETE | `/schools/:id/rooms/:rid` | Delete room |

---

## Teachers & Assignments

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/schools/:id/teachers` | 🔐🏫 | List teachers |
| GET | `/schools/:id/assignments` | 🔐🏫 | List all assignments |
| POST | `/schools/:id/assignments` | 🔐🏫 | Create assignment |
| POST | `/schools/:id/import` | 🔐🏫 | CSV file upload (multipart) |

---

## Fixed Slots

| Method | Path | Description |
|---|---|---|
| GET | `/schools/:id/fixed-slots` | List fixed/locked periods |
| POST | `/schools/:id/fixed-slots` | Add fixed slot |
| DELETE | `/schools/:id/fixed-slots/:fsid` | Remove fixed slot |

---

## Timetables

| Method | Path | Description |
|---|---|---|
| GET | `/schools/:id/timetables` | List timetables |
| GET | `/schools/:id/timetables/:tid` | Get timetable detail |
| POST | `/schools/:id/timetables/preflight` | Run feasibility check |
| POST | `/schools/:id/timetables/generate-async` | Start background generation |
| GET | `/schools/:id/timetables/jobs/:jid` | Poll job status |
| POST | `/schools/:id/timetables/:tid/publish` | Mark timetable as published |
| DELETE | `/schools/:id/timetables/:tid` | Revoke/delete timetable |
| GET | `/schools/:id/timetables/:tid/export.xlsx` | Download Excel bundle |

**Job status values:** `pending` → `running` → `done` | `failed`

---

## Share Links (Parent Access)

| Method | Path | Description |
|---|---|---|
| POST | `/schools/:id/timetables/:tid/share-links` | Create share link |
| GET | `/schools/:id/timetables/:tid/share-links` | List share links |
| DELETE | `/schools/:id/timetables/:tid/share-links/:lid` | Revoke share link |
| GET | `/share/:token` | **Public** — parent reads timetable |

---

## Rules

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/rules` | 🔐 | Get rule config |
| PUT | `/rules` | 🔐 | Update rule config |
| GET | `/rules/custom` | 🔐 | List custom AI rules |
| POST | `/rules/custom` | 🔐 | Create custom rule |
| PATCH | `/rules/custom/:id` | 🔐 | Toggle rule enabled/disabled |
| DELETE | `/rules/custom/:id` | 🔐 | Delete custom rule |
| POST | `/rules/custom/parse` | 🔐 | Parse plain English → rule |

---

## Health

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Returns `{"status":"ok"}` |

---
*Related: [[07 - Authentication & Security]] · [[09 - Background Job System]] · [[12 - API Client (lib-api)]]*
