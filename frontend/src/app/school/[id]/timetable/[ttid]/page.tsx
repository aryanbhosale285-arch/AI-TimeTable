"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, fetcher } from "@/lib/api";
import type { School, Timetable, Standard, Teacher, TimetableSlot } from "@/lib/types";
import { Card, Button, Badge } from "@/components/ui";

type View = "student" | "teacher";

export default function TimetableView({
  params,
}: {
  params: { id: string; ttid: string };
}) {
  const sid = Number(params.id);
  const tid = Number(params.ttid);

  const { data: school } = useSWR<School>(`/schools/${sid}`, fetcher);
  const { data: tt, mutate } = useSWR<Timetable>(`/schools/${sid}/timetables/${tid}`, fetcher);
  const { data: standards } = useSWR<Standard[]>(`/schools/${sid}/standards`, fetcher);
  const { data: teachers } = useSWR<Teacher[]>(`/schools/${sid}/teachers`, fetcher);

  const [view, setView] = useState<View>("student");
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<number | null>(null);

  const sections = useMemo(
    () => standards?.flatMap((s) => s.sections.map((sec) => ({ ...sec, std: s.name }))) ?? [],
    [standards]
  );

  const days = school?.working_days ?? [];
  const periods = school?.periods_per_day ?? 0;

  // default selections
  const activeSection = selectedSection ?? sections[0]?.id ?? null;
  const activeTeacher = selectedTeacher ?? teachers?.[0]?.id ?? null;

  // period_index (0-based) -> "08:00–08:45" for the grid header.
  const periodTimes = useMemo(() => {
    const m = new Map<number, string>();
    for (const pp of school?.periods ?? []) {
      m.set(pp.period_number - 1, `${pp.start_time}–${pp.end_time}`);
    }
    return m;
  }, [school]);

  // The lunch break and the period_index it falls after (e.g. after P4 -> index 3).
  const lunch = school?.breaks && school.breaks.length > 0 ? school.breaks[0] : null;
  const lunchAfterIndex = lunch ? lunch.after_period - 1 : null;

  const grid = useMemo(() => {
    const m = new Map<string, TimetableSlot>();
    if (!tt?.slots) return m;
    for (const slot of tt.slots) {
      const match =
        view === "student"
          ? slot.section_id === activeSection
          : slot.teacher_id === activeTeacher;
      if (match) m.set(`${slot.day_index}-${slot.period_index}`, slot);
    }
    return m;
  }, [tt, view, activeSection, activeTeacher]);

  // teacher weekly load
  const teacherLoad = useMemo(() => {
    if (view !== "teacher" || !tt?.slots) return 0;
    return tt.slots.filter((s) => s.teacher_id === activeTeacher).length;
  }, [tt, view, activeTeacher]);

  async function publish() {
    await api.publish(sid, tid);
    mutate();
  }

  async function revoke() {
    if (!confirm("Discard this timetable? You can then generate a new one.")) return;
    await api.revoke(sid, tid);
    window.location.href = `/school/${sid}`;
  }

  if (!school || !tt) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/school/${sid}`} className="text-sm text-slate-500 hover:text-brand-600">
            ← {school.name}
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            {tt.name}
            <Badge color={tt.status === "PUBLISHED" ? "green" : "indigo"}>{tt.status}</Badge>
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => window.print()}>Print / PDF</Button>
          <a href={`/api/schools/${sid}/timetables/${tid}/export.xlsx`} download>
            <Button variant="ghost">Excel</Button>
          </a>
          <Button variant="danger" onClick={revoke}>Revoke</Button>
          {tt.status !== "PUBLISHED" && <Button onClick={publish}>Publish</Button>}
        </div>
      </div>

      {/* View toggle */}
      <div className="no-print flex flex-wrap items-center gap-4">
        <div className="inline-flex rounded-lg border bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
          {(["student", "teacher"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize ${
                view === v ? "bg-brand-600 text-white" : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {v} view
            </button>
          ))}
        </div>

        {view === "student" ? (
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            value={activeSection ?? ""}
            onChange={(e) => setSelectedSection(Number(e.target.value))}
          >
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.std} {sec.name}
              </option>
            ))}
          </select>
        ) : (
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            value={activeTeacher ?? ""}
            onChange={(e) => setSelectedTeacher(Number(e.target.value))}
          >
            {teachers?.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}

        {view === "teacher" && (
          <Badge color="indigo">Weekly load: {teacherLoad} periods</Badge>
        )}
      </div>

      {/* Grid */}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border px-3 py-2 text-left text-slate-500 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">Day / Period</th>
              {Array.from({ length: periods }, (_, p) => (
                <Fragment key={p}>
                  <th className="border px-3 py-2 font-medium text-slate-600 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <div>P{p + 1}</div>
                    {periodTimes.get(p) && (
                      <div className="text-[10px] font-normal text-slate-400">{periodTimes.get(p)}</div>
                    )}
                  </th>
                  {lunchAfterIndex === p && (
                    <th className="border px-2 py-2 text-center text-[11px] font-semibold text-amber-700 bg-amber-50 dark:border-slate-700 dark:bg-amber-900/30 dark:text-amber-300">
                      🍱 {lunch?.name || "Break"}
                      {lunch?.duration_minutes ? (
                        <div className="text-[10px] font-normal">{lunch.duration_minutes}m</div>
                      ) : null}
                    </th>
                  )}
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day, d) => (
              <tr key={day.id ?? d}>
                <td className="border px-3 py-2 font-medium text-slate-600 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {day.day_name.slice(0, 3)}
                  {day.is_half_day && <span className="ml-1 text-xs text-amber-600">½</span>}
                </td>
                {Array.from({ length: periods }, (_, p) => {
                  const halfLimit = school.half_day_periods;
                  const slot = grid.get(`${d}-${p}`);
                  let cell;
                  if (day.is_half_day && halfLimit != null && p >= halfLimit) {
                    // Half-days run fewer periods: the tail periods don't exist.
                    cell = (
                      <td className="border bg-slate-100 px-2 py-3 text-center text-xs text-slate-300 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-600">
                        —
                      </td>
                    );
                  } else if (!slot) {
                    cell = (
                      <td className="border px-2 py-3 text-center text-xs text-slate-300 dark:border-slate-700 dark:text-slate-600">
                        free
                      </td>
                    );
                  } else if (slot.conflict) {
                    cell = (
                      <td className="border bg-red-100 px-2 py-3 text-center text-xs text-red-700">
                        ⚠ unfilled
                      </td>
                    );
                  } else {
                    cell = (
                      <td
                        className="border px-2 py-2 text-center align-top dark:border-slate-700"
                        style={{ background: (slot.subject_color || "#e0e7ff") + "22" }}
                      >
                        <div className="font-medium" style={{ color: slot.subject_color || "#3730a3" }}>
                          {slot.is_fixed ? slot.subject_name || "Fixed" : slot.subject_name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {view === "student" ? slot.teacher_name : sectionLabel(slot.section_id, sections)}
                        </div>
                      </td>
                    );
                  }
                  return (
                    <Fragment key={p}>
                      {cell}
                      {lunchAfterIndex === p && (
                        <td className="border bg-amber-50 text-center align-middle text-[10px] font-medium text-amber-600 dark:border-slate-700 dark:bg-amber-900/20 dark:text-amber-400">
                          {lunch?.name || "Break"}
                        </td>
                      )}
                    </Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-slate-400">
        Color-coded by subject. Empty cells are free periods.
      </p>
    </div>
  );
}

function sectionLabel(
  sectionId: number,
  sections: { id: number; name: string; std: string }[]
) {
  const s = sections.find((x) => x.id === sectionId);
  return s ? `${s.std} ${s.name}` : `#${sectionId}`;
}
