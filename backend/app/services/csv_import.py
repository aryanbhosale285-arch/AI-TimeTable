"""Parse an uploaded CSV/Excel of teacher assignments into DB rows.

Resolves teacher / subject / standard / section by name, creating them if
they don't exist yet, so a school can bootstrap entirely from one file.
"""
from io import BytesIO
from typing import List, Tuple
import pandas as pd
from sqlalchemy.orm import Session

from app.models.teacher import Teacher, TeacherAssignment
from app.models.academic import Subject, Standard, Section, RoomType
from app.models.school import School


def _room_type_for(special_room: str | None) -> RoomType:
    """Map the CSV 'Special Room' text to a room type."""
    text = (special_room or "").strip().lower()
    if not text:
        return RoomType.CLASSROOM
    if "lab" in text:
        return RoomType.LAB
    if "librar" in text:
        return RoomType.LIBRARY
    if "hall" in text or "audi" in text:
        return RoomType.HALL
    if "ground" in text or "field" in text or "play" in text:
        return RoomType.OTHER
    return RoomType.OTHER
from app.models.timetable import Timetable, TimetableSlot, FixedSlot


def clear_teaching_data(db: Session, school: School) -> None:
    """Remove a school's teachers/subjects/classes/timetables so a re-upload
    REPLACES the data instead of stacking on top of it.

    Deletes are issued child-first to satisfy foreign keys (slots reference
    subjects/teachers/sections/timetables, which must outlive them)."""
    tt_ids = [t.id for t in db.query(Timetable.id).filter(Timetable.school_id == school.id)]
    std_ids = [s.id for s in db.query(Standard.id).filter(Standard.school_id == school.id)]

    opt = {"synchronize_session": False}
    if tt_ids:
        db.query(TimetableSlot).filter(TimetableSlot.timetable_id.in_(tt_ids)).delete(**opt)
    db.query(Timetable).filter(Timetable.school_id == school.id).delete(**opt)
    db.query(FixedSlot).filter(FixedSlot.school_id == school.id).delete(**opt)
    db.query(TeacherAssignment).filter(TeacherAssignment.school_id == school.id).delete(**opt)
    if std_ids:
        db.query(Section).filter(Section.standard_id.in_(std_ids)).delete(**opt)
    db.query(Standard).filter(Standard.school_id == school.id).delete(**opt)
    db.query(Subject).filter(Subject.school_id == school.id).delete(**opt)
    db.query(Teacher).filter(Teacher.school_id == school.id).delete(**opt)
    db.flush()
    db.expire_all()  # refresh school.teachers / .subjects / .standards relationships

EXPECTED_COLUMNS = {
    "teacher name": "teacher_name",
    "subject": "subject",
    "standard": "standard",
    "section": "section",
    "lectures/week": "lectures_per_week",
    "preferred time": "preferred_time",
    "special room": "special_room",
}

# Distinct, readable colors per subject so the timetable is truly colour-coded.
# Known subjects get a fixed colour (matches the seed demo); anything else is
# assigned from PALETTE in creation order so two subjects never collide.
SUBJECT_COLORS = {
    "maths": "#6366f1", "mathematics": "#6366f1", "math": "#6366f1",
    "science": "#10b981",
    "physics": "#0ea5e9", "chemistry": "#14b8a6", "biology": "#22c55e",
    "english": "#f59e0b",
    "hindi": "#ec4899",
    "social studies": "#ef4444", "sst": "#ef4444", "social science": "#ef4444",
    "history": "#f43f5e", "geography": "#84cc16", "civics": "#fb7185",
    "computer": "#8b5cf6", "computer science": "#8b5cf6", "it": "#8b5cf6",
    "sanskrit": "#a855f7", "marathi": "#d946ef", "french": "#06b6d4",
    "physical education": "#f97316", "pe": "#f97316", "sports": "#f97316",
    "art": "#e11d48", "drawing": "#e11d48", "music": "#0891b2",
    "moral science": "#65a30d", "gk": "#ca8a04", "general knowledge": "#ca8a04",
    "economics": "#0d9488", "accountancy": "#7c3aed", "business studies": "#db2777",
}
# Fallback rotation for unknown subject names.
PALETTE = [
    "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899",
    "#0ea5e9", "#84cc16", "#f97316", "#14b8a6", "#a855f7", "#06b6d4",
]


def color_for_subject(name: str, fallback_index: int) -> str:
    """Pick a distinct colour for a subject by name, else rotate the palette."""
    key = name.strip().lower()
    if key in SUBJECT_COLORS:
        return SUBJECT_COLORS[key]
    # try a partial match (e.g. "Maths 1", "Maths 2" -> maths)
    for known, color in SUBJECT_COLORS.items():
        if key.startswith(known):
            return color
    return PALETTE[fallback_index % len(PALETTE)]


def _parse_lectures(value: str) -> Tuple[int, int | None]:
    """'8' -> (8, None);  '4-5' -> (4, 5)."""
    text = str(value).strip()
    if "-" in text:
        lo, hi = text.split("-", 1)
        return int(lo.strip()), int(hi.strip())
    return int(float(text)), None


def parse_file(content: bytes, filename: str) -> pd.DataFrame:
    if filename.lower().endswith((".xlsx", ".xls")):
        df = pd.read_excel(BytesIO(content))
    else:
        df = pd.read_csv(BytesIO(content))

    # Normalise headers
    rename = {}
    for col in df.columns:
        key = str(col).strip().lower()
        if key in EXPECTED_COLUMNS:
            rename[col] = EXPECTED_COLUMNS[key]
    df = df.rename(columns=rename)

    required = {"teacher_name", "subject", "standard", "section", "lectures_per_week"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")
    return df


def import_assignments(
    db: Session, school: School, df: pd.DataFrame, replace: bool = True
) -> Tuple[int, List[str]]:
    """Returns (rows_imported, warnings). Upserts teachers/subjects/sections by name.

    When replace=True (default), the school's existing teaching data is cleared
    first so an upload is authoritative and never stacks on a previous one.
    """
    warnings: List[str] = []
    imported = 0

    if replace:
        clear_teaching_data(db, school)

    # Cache existing lookups
    teachers = {t.name.lower(): t for t in school.teachers}
    subjects = {s.name.lower(): s for s in school.subjects}
    standards = {s.name.lower(): s for s in school.standards}
    # Sections keyed by (standard_id, section_name_lower). Must be a manual cache:
    # reading standard.sections mid-loop won't reflect just-added sections, which
    # would create a duplicate section for every CSV row.
    sections: dict[tuple[int, str], Section] = {
        (sec.standard_id, sec.name.lower()): sec
        for std in school.standards
        for sec in std.sections
    }

    for idx, row in df.iterrows():
        try:
            teacher_name = str(row["teacher_name"]).strip()
            subject_name = str(row["subject"]).strip()
            standard_name = str(row["standard"]).strip()
            section_name = str(row["section"]).strip()
            lpw, lpw_max = _parse_lectures(row["lectures_per_week"])
            preferred = (
                str(row["preferred_time"]).strip()
                if "preferred_time" in df.columns and not pd.isna(row.get("preferred_time"))
                else None
            )
            special_room = (
                str(row["special_room"]).strip()
                if "special_room" in df.columns and not pd.isna(row.get("special_room"))
                else None
            )
        except (ValueError, KeyError) as e:
            warnings.append(f"Row {idx + 2}: skipped ({e})")
            continue

        # Teacher
        teacher = teachers.get(teacher_name.lower())
        if not teacher:
            teacher = Teacher(school_id=school.id, name=teacher_name)
            db.add(teacher)
            db.flush()
            teachers[teacher_name.lower()] = teacher

        # Subject (room type comes from the "Special Room" column, if given)
        subject = subjects.get(subject_name.lower())
        if not subject:
            subject = Subject(
                school_id=school.id,
                name=subject_name,
                color=color_for_subject(subject_name, len(subjects)),
                requires_room_type=_room_type_for(special_room),
            )
            db.add(subject)
            db.flush()
            subjects[subject_name.lower()] = subject
        elif special_room and subject.requires_room_type == RoomType.CLASSROOM:
            # A later row specifies a special room for an already-created subject.
            subject.requires_room_type = _room_type_for(special_room)

        # Standard
        standard = standards.get(standard_name.lower())
        if not standard:
            standard = Standard(school_id=school.id, name=standard_name)
            db.add(standard)
            db.flush()
            standards[standard_name.lower()] = standard

        # Section (within standard)
        sec_key = (standard.id, section_name.lower())
        section = sections.get(sec_key)
        if not section:
            section = Section(standard_id=standard.id, name=section_name)
            db.add(section)
            db.flush()
            sections[sec_key] = section

        db.add(
            TeacherAssignment(
                school_id=school.id,
                teacher_id=teacher.id,
                subject_id=subject.id,
                section_id=section.id,
                lectures_per_week=lpw,
                lectures_per_week_max=lpw_max,
                preferred_time=preferred,
            )
        )
        imported += 1

    db.commit()
    return imported, warnings
