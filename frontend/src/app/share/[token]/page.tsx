"use client";

import { Fragment, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { ParentSlot, ShareView } from "@/lib/types";
import { Card, Button } from "@/components/ui";

/** Public, read-only parent view — resolved from a revocable share token. */
export default function SharedTimetablePage({ params }: { params: { token: string } }) {
  const { data, error } = useSWR<ShareView>(`/share/${params.token}`, fetcher, {
    shouldRetryOnError: false,
  });
  const [selectedSection, setSelectedSection] = useState<number | null>(null);

  const sections = useMemo(
    () =>
      data?.standards.flatMap((s) => s.sections.map((sec) => ({ ...sec, std: s.name }))) ?? [],
    [data]
  );
  const activeSection = selectedSection ?? sections[0]?.id ?? null;

  const periodTimes = useMemo(() => {
    const m = new Map<number, string>();
    for (const pp of data?.school.periods ?? []) {
      m.set(pp.period_number - 1, `${pp.start_time}-${pp.end_time}`);
    }
    return m;
  }, [data]);

  const grid = useMemo(() => {
    const m = new Map<string, ParentSlot>();
    for (const slot of data?.slots ?? []) {
      if (slot.section_id === activeSection) {
        m.set(`${slot.day_index}-${slot.period_index}`, slot);
      }
    }
    return m;
  }, [data, activeSection]);

  if (error) {
    return (
      <div className="mx-auto max-w-md pt-16 text-center">
        <Card>
          <h1 className="text-lg font-semibold">Link not available</h1>
          <p className="mt-2 text-sm text-slate-500">
            This share link is invalid or has been revoked by the school. Please ask the
            school for a new link.
          </p>
        </Card>
      </div>
    );
  }
  if (!data) return <p className="text-slate-500">Loading…</p>;

  const school = data.school;
  const days = school.working_days;
  const periods = school.periods_per_day;
  const lunch = school.breaks?.[0] ?? null;
  const lunchAfterIndex = lunch ? lunch.after_period - 1 : null;

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{school.name}</p>
          <h1 className="text-2xl font-bold">Class Timetable</h1>
          <p className="text-sm text-slate-500">{data.timetable.name}</p>
        </div>
        <Button variant="ghost" onClick={() => window.print()}>Print / PDF</Button>
      </div>

      <div className="no-print flex flex-wrap items-center gap-3">
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
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border bg-slate-50 px-3 py-2 text-left text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                Day / Period
              </th>
              {Array.from({ length: periods }, (_, p) => (
                <Fragment key={p}>
                  <th className="border bg-slate-50 px-3 py-2 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <div>P{p + 1}</div>
                    {periodTimes.get(p) && (
                      <div className="text-[10px] font-normal text-slate-400">{periodTimes.get(p)}</div>
                    )}
                  </th>
                  {lunchAfterIndex === p && (
                    <th className="border bg-amber-50 px-2 py-2 text-center text-[11px] font-semibold text-amber-700 dark:border-slate-700 dark:bg-amber-900/30 dark:text-amber-300">
                      {lunch?.name || "Break"}
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
                <td className="border bg-slate-50 px-3 py-2 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {day.day_name.slice(0, 3)}
                  {day.is_half_day && <span className="ml-1 text-xs text-amber-600">half</span>}
                </td>
                {Array.from({ length: periods }, (_, p) => {
                  const halfLimit = school.half_day_periods;
                  const slot = grid.get(`${d}-${p}`);
                  let cell;
                  if (day.is_half_day && halfLimit != null && p >= halfLimit) {
                    cell = (
                      <td className="border bg-slate-100 px-2 py-3 text-center text-xs text-slate-300 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-600">
                        -
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
                      <td className="border bg-red-100 px-2 py-3 text-center text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                        unfilled
                      </td>
                    );
                  } else {
                    cell = (
                      <td
                        className="border px-2 py-2 text-center align-middle dark:border-slate-700"
                        style={{ background: (slot.subject_color || "#e0e7ff") + "22" }}
                      >
                        <div className="font-medium" style={{ color: slot.subject_color || "#3730a3" }}>
                          {slot.is_fixed ? slot.subject_name || "Fixed" : slot.subject_name}
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
        Shared read-only by the school. Staff details are not shown.
      </p>
    </div>
  );
}
