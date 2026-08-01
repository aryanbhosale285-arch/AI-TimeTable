# 17 — CSV Import Format

#csv #import #data-format

## Template File

Download from the app or find at: `frontend/public/template.csv`

## Required Columns

| Column | Example | Notes |
|---|---|---|
| **Teacher Name** | `Mr. Sharma` | Same teacher may appear on many rows |
| **Subject** | `Maths` | Auto-created if new |
| **Standard** | `10th` | Grade / year level |
| **Section** | `A` | Each section = a separate class |
| **Lectures/Week** | `6` or `4-5` | Fixed number OR a range |
| **Preferred Time** | `Morning` | Optional soft preference |
| **Special Room** | `Lab` | Optional; links subject to a room type |

## Example CSV

```csv
Teacher Name,Subject,Standard,Section,Lectures/Week,Preferred Time,Special Room
Mr. Sharma,Maths,10th,A,6,,
Mr. Sharma,Maths,10th,B,6,,
Ms. Patel,Science,10th,A,5,Morning,Lab
Ms. Patel,Science,9th,A,5,Morning,Lab
Mr. Kumar,English,10th,A,4,,
Mr. Kumar,English,10th,B,4,,
Ms. Rao,History,9th,A,3,Afternoon,
```

## What Gets Auto-Created

When a CSV is imported:
1. **Teachers** — created from "Teacher Name" if not already in DB
2. **Subjects** — created from "Subject" if not already in DB
3. **Standards** — created from "Standard + Section" combo if not already in DB
4. **Assignments** — each row becomes one assignment record

## Range Lectures/Week

You can specify a range like `"4-5"` instead of a fixed number. The solver will try to place between 4 and 5 lectures (inclusive) per week for that assignment.

## Room Assignment Logic

- If `Special Room` = `"Lab"`, the subject is marked as requiring a lab
- The solver checks lab room capacity and ensures no more labs are booked simultaneously than the number of lab rooms available

## Import Endpoint

```
POST /api/schools/:id/import
Content-Type: multipart/form-data
Body: { file: <CSV or XLSX file> }
```

Response:
```json
{
  "imported": 14,
  "warnings": ["Row 3: Teacher 'Mr. Unknown' had no assignments — check spelling"]
}
```

## Common Import Errors

| Error | Cause | Fix |
|---|---|---|
| "Missing required column" | Column header mismatch | Match column names exactly |
| "Lectures/Week must be a number or range" | Invalid format like `"six"` | Use `6` or `4-5` |
| "Standard not found" | Standard/Section doesn't match created standards | Create standard first via UI, or let CSV auto-create |

---
*Related: [[01 - Project Overview]] · [[08 - Solver Engine (OR-Tools)]] · [[06 - API Endpoints Reference]]*
