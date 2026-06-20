"""Build an .xlsx workbook from a timetable — one sheet per class.

Each sheet is a day × period grid with the subject + teacher in each cell,
colour-coded by subject. Kept dependency-light (openpyxl only).
"""
from io import BytesIO
from collections import defaultdict

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

_THIN = Side(style="thin", color="D0D0D0")
_BORDER = Border(left=_THIN, right=_THIN, top=_THIN, bottom=_THIN)
_HEADER_FILL = PatternFill(start_color="F1F5F9", fill_type="solid")
_CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)


def _argb(hex_color: str | None) -> str | None:
    if not hex_color:
        return None
    h = hex_color.lstrip("#")
    if len(h) == 6:
        return "FF" + h.upper()
    return None


def build_timetable_xlsx(
    *,
    days: list,            # ordered day names
    periods: int,
    sections: list,        # [{"id": int, "label": str}]
    period_labels: dict,   # period_index -> "08:00–08:45" or None
    slots_by_section: dict,  # section_id -> {(day_idx, period_idx): {"subject","teacher","color"}}
    title: str,
) -> bytes:
    wb = Workbook()
    wb.remove(wb.active)

    for sec in sections:
        name = (sec["label"] or f"Class {sec['id']}")[:31]  # Excel sheet name limit
        ws = wb.create_sheet(title=name)
        ws.column_dimensions["A"].width = 14

        # Header row
        hc = ws.cell(1, 1, "Day / Period")
        hc.font = Font(bold=True)
        hc.fill = _HEADER_FILL
        hc.border = _BORDER
        hc.alignment = _CENTER
        for p in range(periods):
            label = f"P{p + 1}"
            if period_labels.get(p):
                label += f"\n{period_labels[p]}"
            c = ws.cell(1, p + 2, label)
            c.font = Font(bold=True)
            c.fill = _HEADER_FILL
            c.border = _BORDER
            c.alignment = _CENTER
            ws.column_dimensions[c.column_letter].width = 16

        # Day rows
        grid = slots_by_section.get(sec["id"], {})
        for di, day_name in enumerate(days):
            dc = ws.cell(di + 2, 1, day_name)
            dc.font = Font(bold=True)
            dc.fill = _HEADER_FILL
            dc.border = _BORDER
            dc.alignment = _CENTER
            for p in range(periods):
                cell = ws.cell(di + 2, p + 2)
                cell.border = _BORDER
                cell.alignment = _CENTER
                info = grid.get((di, p))
                if info and info.get("subject"):
                    text = info["subject"]
                    if info.get("teacher"):
                        text += f"\n{info['teacher']}"
                    cell.value = text
                    argb = _argb(info.get("color"))
                    if argb:
                        cell.fill = PatternFill(start_color=argb, fill_type="solid")
            ws.row_dimensions[di + 2].height = 34

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
