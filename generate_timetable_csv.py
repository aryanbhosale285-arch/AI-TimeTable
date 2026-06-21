"""Generate a teacher-assignment CSV for the timetable importer.

Columns: Teacher Name,Subject,Standard,Section,Lectures/Week,Preferred Time,Special Room
- 1st-4th teachers are disjoint from 5th-10th teachers.
- Each section totals 42-43 lectures (week capacity 44 -> 1-2 free periods).
- Rows are shuffled so each teacher's assignments are scattered randomly.
"""
import csv
import random

random.seed(7)

# NOTE: Science is intentionally NOT mapped to "Lab" — the school has no LAB
# rooms configured, and preflight fails if a subject needs a lab that doesn't
# exist. Leaving it blank runs Science in a normal classroom.
SPECIAL = {
    "PE": "Ground",
    "Library": "Library",
}

rows = []  # (teacher, subject, standard, lectures)


def add(teacher, subject, standard, lectures):
    rows.append((teacher, subject, standard, lectures))


# ---- LOWER PRIMARY: 1st-4th (these teachers ONLY teach 1st-4th) ----
for std in ["1st", "2nd", "3rd", "4th"]:
    add("Mrs. Kulkarni", "Maths", std, 6)
    add("Mr. Pawar", "Science", std, 5)
    add("Ms. Fernandes", "English", std, 6)
    add("Mrs. Deshpande", "Hindi", std, 4)
    add("Mrs. Patil", "Marathi", std, 4)
    add("Mr. Joshi", "Social Studies", std, 4)
    add("Mr. Joshi", "Geography", std, 3)
    add("Mr. Gaikwad", "Drawing", std, 4)
    add("Mrs. Deshpande", "PE", std, 3)
    add("Mrs. Patil", "Library", std, 3)
# total per std = 42

# ---- UPPER: 5th-7th (single Maths / single Science) ----
for std in ["5th", "6th", "7th"]:
    add("Mr. Kapoor", "Maths", std, 7)
    add("Ms. Iyer", "Science", std, 6)
    add("Ms. Bose", "English", std, 6)
    add("Mrs. Naik", "Hindi", std, 5)
    add("Mrs. Jadhav", "Marathi", std, 5)
    add("Mr. Rao", "Social Studies", std, 5)
    add("Mr. Nair", "Geography", std, 4)
    add("Ms. Iyer", "PE", std, 2)
    add("Mr. Kapoor", "Library", std, 2)
# total per std = 42

# ---- UPPER: 8th-10th (split Maths 1/2 and Science 1/2) ----
for std in ["8th", "9th", "10th"]:
    add("Mr. Verma", "Maths 1", std, 5)
    add("Mr. Nair", "Maths 2", std, 5)
    add("Mr. Reddy", "Science 1", std, 4)
    add("Mr. Reddy", "Science 2", std, 4)
    add("Mr. Khan", "English", std, 6)
    add("Mrs. Naik", "Hindi", std, 4)
    add("Mrs. Jadhav", "Marathi", std, 4)
    add("Mr. Rao", "Social Studies", std, 4)
    add("Mr. Verma", "Geography", std, 3)
    add("Mr. Khan", "PE", std, 2)
    add("Ms. Bose", "Library", std, 2)
# total per std = 43

random.shuffle(rows)

with open("teacher_assignments.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["Teacher Name", "Subject", "Standard", "Section",
                "Lectures/Week", "Preferred Time", "Special Room"])
    for teacher, subject, std, lec in rows:
        w.writerow([teacher, subject, std, "A", lec, "", SPECIAL.get(subject, "")])

# ---- verify ----
from collections import defaultdict
per_std = defaultdict(int)
per_teacher = defaultdict(int)
teacher_stds = defaultdict(set)
for teacher, subject, std, lec in rows:
    per_std[std] += lec
    per_teacher[teacher] += lec
    teacher_stds[teacher].add(std)

order = ["1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th"]
print("Rows:", len(rows))
print("Per-section weekly lectures (cap 44):")
for s in order:
    print(f"  {s}: {per_std[s]}  free={44-per_std[s]}")
print("Per-teacher load:")
for t in sorted(per_teacher):
    print(f"  {t}: {per_teacher[t]}  stds={sorted(teacher_stds[t])}")

lower = {"1st","2nd","3rd","4th"}
for t, stds in teacher_stds.items():
    if stds & lower and stds - lower:
        print("OVERLAP:", t, stds)
