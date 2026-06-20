"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Card, Button, Input, Label, Badge } from "@/components/ui";

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const BOARDS = ["CBSE", "ICSE", "STATE", "IB", "CUSTOM"];
const BOARD_DEFAULTS: Record<string, { periodsPerDay: number; periodMins: number; lunchAfter: number }> = {
  CBSE: { periodsPerDay: 8, periodMins: 45, lunchAfter: 4 },
  ICSE: { periodsPerDay: 8, periodMins: 40, lunchAfter: 4 },
  STATE: { periodsPerDay: 7, periodMins: 45, lunchAfter: 4 },
};

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [board, setBoard] = useState("CBSE");
  const [academicYear, setAcademicYear] = useState("2025-26");
  const [periodsPerDay, setPeriodsPerDay] = useState(8);
  const [halfDayPeriods, setHalfDayPeriods] = useState(4);
  const [days, setDays] = useState<string[]>(ALL_DAYS.slice(0, 6));
  const [halfDays, setHalfDays] = useState<string[]>(["Saturday"]);
  const [startHour, setStartHour] = useState(8);
  const [periodMins, setPeriodMins] = useState(45);
  const [lunchAfter, setLunchAfter] = useState(4);
  const [lunchMins, setLunchMins] = useState(30);
  const [afterBreakMins, setAfterBreakMins] = useState(45);    // afternoon period length (reduce or same)
  const [manual, setManual] = useState({
    periodsPerDay: false,
    periodMins: false,
    lunchAfter: false,
    afterBreakMins: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const defaults = BOARD_DEFAULTS[board];
    if (!defaults) return;
    if (!manual.periodsPerDay) setPeriodsPerDay(defaults.periodsPerDay);
    if (!manual.periodMins) setPeriodMins(defaults.periodMins);
    if (!manual.lunchAfter) setLunchAfter(defaults.lunchAfter);
    if (!manual.afterBreakMins) setAfterBreakMins(defaults.periodMins);
  }, [board, manual]);

  function toggleDay(day: string) {
    setDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day]));
  }
  function toggleHalf(day: string) {
    setHalfDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day]));
  }

  const fmt = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  function buildPeriods() {
    const periods = [];
    let cursor = startHour * 60; // running clock in minutes
    for (let p = 1; p <= periodsPerDay; p++) {
      // Insert the lunch gap once, right after the lunch-after period.
      if (p === lunchAfter + 1) {
        cursor += lunchMins;
      }
      // Afternoon periods may be shorter (or the same) than morning periods.
      const len = p > lunchAfter ? afterBreakMins : periodMins;
      const start = cursor;
      const end = start + len;
      periods.push({
        period_number: p,
        start_time: fmt(start),
        end_time: fmt(end),
        label: `Period ${p}`,
      });
      cursor = end;
    }
    return periods;
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const orderedDays = ALL_DAYS.filter((d) => days.includes(d));
      const school = await api.createSchool({
        name,
        board,
        periods_per_day: periodsPerDay,
        half_day_periods: halfDays.length > 0 ? halfDayPeriods : null,
        academic_year: academicYear,
        working_days: orderedDays.map((d, i) => ({
          day_name: d,
          is_half_day: halfDays.includes(d),
          day_order: i,
        })),
        periods: buildPeriods(),
        breaks: [{ name: "Lunch", after_period: lunchAfter, duration_minutes: lunchMins }],
      });
      router.push(`/school/${school.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? String(e.message) : "Failed to create school");
      setBusy(false);
    }
  }

  const canSubmit = name.trim() && days.length > 0 && periodsPerDay > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New School Setup</h1>
        <p className="text-sm text-slate-500">
          Nothing is hardcoded — set your own days, periods, and timings.
        </p>
      </div>

      <Card className="space-y-4">
        <div>
          <Label>School name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Demo Public School" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Board template</Label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              value={board}
              onChange={(e) => setBoard(e.target.value)}
            >
              {BOARDS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Academic year</Label>
            <Input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="space-y-3">
        <Label>Working days</Label>
        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map((d) => {
            const active = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-300 text-slate-500"
                }`}
              >
                {d.slice(0, 3)}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-500">Tap a selected day below to mark it a half-day.</p>
        <div className="flex flex-wrap gap-2">
          {days.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleHalf(d)}
              className="flex items-center gap-1"
            >
              <Badge color={halfDays.includes(d) ? "amber" : "slate"}>
                {d.slice(0, 3)} {halfDays.includes(d) ? "· half" : ""}
              </Badge>
            </button>
          ))}
        </div>
      </Card>

      <Card className="grid grid-cols-2 gap-4">
        <div>
          <Label>Periods per day</Label>
          <Input type="number" min={1} max={14} value={periodsPerDay}
            onChange={(e) => {
              setManual((m) => ({ ...m, periodsPerDay: true }));
              setPeriodsPerDay(Number(e.target.value));
            }} />
        </div>
        {halfDays.length > 0 && (
          <div>
            <Label>Periods on half-days</Label>
            <Input type="number" min={1} max={periodsPerDay} value={halfDayPeriods}
              onChange={(e) => setHalfDayPeriods(Number(e.target.value))} />
            <p className="mt-1 text-xs text-slate-500">
              For {halfDays.map((d) => d.slice(0, 3)).join(", ")}
            </p>
          </div>
        )}
        <div>
          <Label>Period length (min)</Label>
          <Input type="number" min={20} max={120} value={periodMins}
            onChange={(e) => {
              setManual((m) => ({ ...m, periodMins: true }));
              setPeriodMins(Number(e.target.value));
            }} />
        </div>
        <div>
          <Label>Day starts at (hour)</Label>
          <Input type="number" min={5} max={12} value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))} />
        </div>
        <div>
          <Label>Lunch after period</Label>
          <Input type="number" min={1} max={periodsPerDay} value={lunchAfter}
            onChange={(e) => {
              setManual((m) => ({ ...m, lunchAfter: true }));
              setLunchAfter(Number(e.target.value));
            }} />
        </div>
        <div>
          <Label>Lunch / break duration (min)</Label>
          <Input type="number" min={0} max={120} value={lunchMins}
            onChange={(e) => setLunchMins(Number(e.target.value))} />
        </div>

        <div>
          <Label>After-break period length (min)</Label>
          <Input type="number" min={10} max={120} value={afterBreakMins}
            onChange={(e) => {
              setManual((m) => ({ ...m, afterBreakMins: true }));
              setAfterBreakMins(Number(e.target.value));
            }} />
          <p className="mt-1 text-xs text-slate-500">
            {afterBreakMins === periodMins
              ? "Same as morning periods."
              : afterBreakMins < periodMins
              ? `Shorter than morning (${periodMins} min).`
              : `Longer than morning (${periodMins} min).`}
          </p>
        </div>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={() => router.push("/")}>Cancel</Button>
        <Button onClick={submit} disabled={!canSubmit || busy}>
          {busy ? "Creating…" : "Create School"}
        </Button>
      </div>
    </div>
  );
}
