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
  const [afterBreakMins, setAfterBreakMins] = useState(45);
  const [manual, setManual] = useState({
    periodsPerDay: false,
    periodMins: false,
    lunchAfter: false,
    afterBreakMins: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // ---- Auto-save: keep the whole form as a draft so a refresh or an
  // accidental tab close never loses setup progress. ----
  const DRAFT_KEY = "tt_setup_draft";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setName(d.name ?? "");
        setBoard(d.board ?? "CBSE");
        setAcademicYear(d.academicYear ?? "2025-26");
        setPeriodsPerDay(d.periodsPerDay ?? 8);
        setHalfDayPeriods(d.halfDayPeriods ?? 4);
        setDays(d.days ?? ALL_DAYS.slice(0, 6));
        setHalfDays(d.halfDays ?? ["Saturday"]);
        setStartHour(d.startHour ?? 8);
        setPeriodMins(d.periodMins ?? 45);
        setLunchAfter(d.lunchAfter ?? 4);
        setLunchMins(d.lunchMins ?? 30);
        setAfterBreakMins(d.afterBreakMins ?? 45);
        setManual(d.manual ?? { periodsPerDay: false, periodMins: false, lunchAfter: false, afterBreakMins: false });
        if (d.name) setDraftRestored(true);
      }
    } catch { /* corrupt draft — start fresh */ }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return; // don't overwrite the stored draft before restoring it
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      name, board, academicYear, periodsPerDay, halfDayPeriods, days, halfDays,
      startHour, periodMins, lunchAfter, lunchMins, afterBreakMins, manual,
    }));
  }, [hydrated, name, board, academicYear, periodsPerDay, halfDayPeriods, days,
      halfDays, startHour, periodMins, lunchAfter, lunchMins, afterBreakMins, manual]);

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  }

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
      clearDraft();
      router.push(`/school/${school.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? String(e.message) : "Failed to create school");
      setBusy(false);
    }
  }

  const canSubmit = name.trim() && days.length > 0 && periodsPerDay > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          § 01 — New School
        </div>
        <h1 className="mt-3 font-display text-5xl leading-tight">Configure your school</h1>
        <p className="mt-3 text-muted-foreground">
          Nothing is hardcoded — set your own days, periods, and timings.
          Your progress auto-saves on this device.
        </p>
      </div>

      {draftRestored && (
        <Card className="flex items-center justify-between border-accent/30 bg-accent/5 py-4">
          <p className="text-sm text-accent-foreground">
            Restored your unsaved draft.
          </p>
          <Button
            variant="ghost"
            className="px-3 py-1.5"
            onClick={() => { clearDraft(); window.location.reload(); }}
          >
            Start fresh
          </Button>
        </Card>
      )}

      <Card className="space-y-5">
        <div>
          <Label>School name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Demo Public School" />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <Label>Board template</Label>
            <select
              className="w-full rounded-sm border border-border bg-paper px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
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

      <Card className="space-y-4">
        <Label>Working days</Label>
        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map((d) => {
            const active = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={`rounded-sm border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition ${
                  active ? "border-ink bg-ink text-cream" : "border-border text-muted-foreground hover:border-ink/40"
                }`}
              >
                {d.slice(0, 3)}
              </button>
            );
          })}
        </div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Tap a selected day below to mark it a half-day.
        </p>
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

      <Card className="grid grid-cols-2 gap-5">
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
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
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
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {afterBreakMins === periodMins
              ? "Same as morning periods."
              : afterBreakMins < periodMins
              ? `Shorter than morning (${periodMins} min).`
              : `Longer than morning (${periodMins} min).`}
          </p>
        </div>
      </Card>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <p className="text-sm text-destructive">{error}</p>
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
