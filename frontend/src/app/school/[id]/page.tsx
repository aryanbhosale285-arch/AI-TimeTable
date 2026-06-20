"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import type { KeyedMutator } from "swr";
import { api, fetcher, ApiError } from "@/lib/api";
import type {
  School,
  Teacher,
  Assignment,
  Subject,
  PreflightResult,
  Timetable,
  Room,
  Standard,
  FixedSlot,
} from "@/lib/types";
import { Card, Button, Badge, Input, Label } from "@/components/ui";

const ROOM_TYPES = ["CLASSROOM", "LAB", "LIBRARY", "HALL", "OTHER"];

export default function SchoolPage({ params }: { params: { id: string } }) {
  const sid = Number(params.id);

  const { data: school } = useSWR<School>(`/schools/${sid}`, fetcher);
  const { data: teachers } = useSWR<Teacher[]>(`/schools/${sid}/teachers`, fetcher);
  const { data: subjects, mutate: mutateSubjects } = useSWR<Subject[]>(`/schools/${sid}/subjects`, fetcher);
  const { data: assignments } = useSWR<Assignment[]>(`/schools/${sid}/assignments`, fetcher);
  const { data: standards } = useSWR<Standard[]>(`/schools/${sid}/standards`, fetcher);
  const { data: rooms, mutate: mutateRooms } = useSWR<Room[]>(`/schools/${sid}/rooms`, fetcher);
  const {
    data: fixedSlots,
    error: fixedSlotsError,
    mutate: mutateFixedSlots,
  } = useSWR<FixedSlot[]>(`/schools/${sid}/fixed-slots`, fetcher, { shouldRetryOnError: false });
  const { data: timetables, mutate: mutateTT } = useSWR<Timetable[]>(
    `/schools/${sid}/timetables`, fetcher
  );

  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [genError, setGenError] = useState<string[] | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadMsg("Uploading…");
    try {
      const res = await api.importCsv(sid, file);
      setUploadMsg(`Imported ${res.imported} assignment(s)${res.warnings.length ? `, ${res.warnings.length} warning(s)` : ""}.`);
      // refresh all data
      window.location.reload();
    } catch (err) {
      setUploadMsg(err instanceof ApiError ? `Error: ${err.message}` : "Upload failed");
    }
  }

  async function runPreflight() {
    setBusy(true);
    setPreflight(null);
    try {
      const res = await api.preflight(sid);
      setPreflight(res);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    setGenError(null);
    const startedAt = Date.now();
    try {
      const tt = await api.generate(sid, { name: `Timetable ${new Date().toLocaleString()}` });
      await mutateTT();
      window.location.href = `/school/${sid}/timetable/${tt.id}`;
    } catch (err) {
      if (!(err instanceof ApiError) || err.status >= 500) {
        const latest = await recoverGeneratedTimetable(sid, startedAt);
        if (latest) {
          await mutateTT();
          window.location.href = `/school/${sid}/timetable/${latest.id}`;
          return;
        }
      }
      if (err instanceof ApiError && err.detail && typeof err.detail === "object") {
        const d = err.detail as { errors?: string[]; message?: string; log?: string[] };
        setGenError(d.errors || d.log || [d.message || "Generation failed"]);
      } else {
        setGenError([String((err as Error).message)]);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!school) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-brand-600">← All schools</Link>
          <h1 className="text-2xl font-bold">{school.name}</h1>
          <p className="text-sm text-slate-500">
            {school.board} · {school.academic_year} · {school.working_days.length} days ·{" "}
            {school.periods_per_day} periods/day
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Teachers" value={teachers?.length ?? 0} />
        <Stat label="Subjects" value={subjects?.length ?? 0} />
        <Stat label="Assignments" value={assignments?.length ?? 0} />
        <Stat label="Timetables" value={timetables?.length ?? 0} />
      </div>

      <RoomsCard sid={sid} rooms={rooms} mutateRooms={mutateRooms} />

      <SubjectsCard sid={sid} subjects={subjects} mutateSubjects={mutateSubjects} />

      <FixedSlotsCard
        sid={sid}
        school={school}
        standards={standards}
        subjects={subjects}
        fixedSlots={fixedSlots}
        fixedSlotsError={fixedSlotsError}
        mutateFixedSlots={mutateFixedSlots}
      />

      {/* CSV upload */}
      <Card className="space-y-3">
        <h2 className="font-semibold">1. Import teacher assignments</h2>
        <p className="text-sm text-slate-500">
          Upload a CSV/Excel with columns: Teacher Name, Subject, Standard, Section,
          Lectures/Week, Preferred Time, Special Room.{" "}
          <a href="/template.csv" download className="text-brand-600">Download template</a>
        </p>
        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleUpload}
          className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-white" />
        {uploadMsg && <p className="text-sm text-slate-600">{uploadMsg}</p>}
      </Card>

      {/* Assignments preview */}
      {assignments && assignments.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">Assignments ({assignments.length})</h2>
          <div className="max-h-64 overflow-auto rounded-lg border dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2">Teacher</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Section</th>
                  <th className="px-3 py-2">Lectures/wk</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => {
                  const t = teachers?.find((x) => x.id === a.teacher_id);
                  const sub = subjects?.find((x) => x.id === a.subject_id);
                  return (
                    <tr key={a.id} className="border-t dark:border-slate-700">
                      <td className="px-3 py-2">{t?.name ?? a.teacher_id}</td>
                      <td className="px-3 py-2">{sub?.name ?? a.subject_id}</td>
                      <td className="px-3 py-2">#{a.section_id}</td>
                      <td className="px-3 py-2">
                        {a.lectures_per_week}
                        {a.lectures_per_week_max ? `–${a.lectures_per_week_max}` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Preflight + generate */}
      <Card className="space-y-4">
        <h2 className="font-semibold">2. Check feasibility &amp; generate</h2>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={runPreflight} disabled={busy}>
            Run pre-flight check
          </Button>
          <Button onClick={generate} disabled={busy || !assignments?.length}>
            {busy ? "Working…" : "Generate timetable"}
          </Button>
        </div>

        {preflight && (
          <div className={`rounded-lg border p-4 ${preflight.feasible ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
            <p className="font-medium">
              {preflight.feasible ? "✓ Feasible" : "✗ Not feasible — fix these first:"}
            </p>
            {preflight.errors.map((er, i) => (
              <p key={i} className="mt-1 text-sm text-red-700">• {er}</p>
            ))}
            {preflight.warnings.slice(0, 5).map((w, i) => (
              <p key={i} className="mt-1 text-sm text-amber-700">⚠ {w}</p>
            ))}
          </div>
        )}

        {genError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="font-medium text-red-700">Generation failed:</p>
            {genError.map((er, i) => (
              <p key={i} className="mt-1 text-sm text-red-700">• {er}</p>
            ))}
          </div>
        )}
      </Card>

      {/* Timetables */}
      {timetables && timetables.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">Generated timetables</h2>
          <ul className="divide-y">
            {timetables.map((tt) => (
              <li key={tt.id} className="flex items-center justify-between py-3">
                <div>
                  <Link href={`/school/${sid}/timetable/${tt.id}`} className="font-medium text-brand-600">
                    {tt.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {new Date(tt.created_at).toLocaleString()}
                  </p>
                </div>
                <Badge color={tt.status === "PUBLISHED" ? "green" : "indigo"}>{tt.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

async function recoverGeneratedTimetable(sid: number, startedAt: number) {
  try {
    const timetables = await api.listTimetables(sid);
    return timetables
      .filter((tt) => new Date(tt.created_at).getTime() >= startedAt - 10_000)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  } catch {
    return undefined;
  }
}

function RoomsCard({
  sid,
  rooms,
  mutateRooms,
}: {
  sid: number;
  rooms?: Room[];
  mutateRooms: KeyedMutator<Room[]>;
}) {
  const [name, setName] = useState("");
  const [roomType, setRoomType] = useState("CLASSROOM");
  const [capacity, setCapacity] = useState(40);
  const [isAvailable, setIsAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addRoom() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.createRoom(sid, {
        name: name.trim(),
        room_type: roomType,
        capacity,
        is_available: isAvailable,
      });
      setName("");
      setCapacity(40);
      setIsAvailable(true);
      await mutateRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add room");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRoom(id: number) {
    if (!confirm("Delete this room?")) return;
    setError(null);
    try {
      await api.deleteRoom(sid, id);
      await mutateRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete room");
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Rooms</h2>
        <Badge color="slate">{rooms?.length ?? 0}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <div className="sm:col-span-2">
          <Label>Room name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lab 1" />
        </div>
        <div>
          <Label>Type</Label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
          >
            {ROOM_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Capacity</Label>
          <Input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />
        </div>
        <div className="flex items-end">
          <Button onClick={addRoom} disabled={busy || !name.trim()} className="w-full">
            Add room
          </Button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={isAvailable}
          onChange={(e) => setIsAvailable(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Available for scheduling
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-auto rounded-lg border dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Capacity</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {(rooms ?? []).map((room) => (
              <tr key={room.id} className="border-t dark:border-slate-700">
                <td className="px-3 py-2 font-medium">{room.name}</td>
                <td className="px-3 py-2">{room.room_type}</td>
                <td className="px-3 py-2">{room.capacity}</td>
                <td className="px-3 py-2">
                  <Badge color={room.is_available ? "green" : "slate"}>
                    {room.is_available ? "Available" : "Unavailable"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button variant="danger" className="px-3 py-1.5" onClick={() => deleteRoom(room.id)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
            {rooms?.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={5}>
                  No rooms yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SubjectsCard({
  sid,
  subjects,
  mutateSubjects,
}: {
  sid: number;
  subjects?: Subject[];
  mutateSubjects: KeyedMutator<Subject[]>;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [requiresRoomType, setRequiresRoomType] = useState("CLASSROOM");
  const [color, setColor] = useState("#6366f1");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addSubject() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.createSubject(sid, {
        name: name.trim(),
        code: code.trim() || null,
        requires_room_type: requiresRoomType,
        color,
      });
      setName("");
      setCode("");
      await mutateSubjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add subject");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSubject(id: number) {
    if (!confirm("Delete this subject? Existing assignments may depend on it.")) return;
    setError(null);
    try {
      await api.deleteSubject(sid, id);
      await mutateSubjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete subject");
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Subject master list</h2>
        <Badge color="slate">{subjects?.length ?? 0}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <Label>Subject name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Physics" />
        </div>
        <div>
          <Label>Code</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PHY" />
        </div>
        <div>
          <Label>Room</Label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            value={requiresRoomType}
            onChange={(e) => setRequiresRoomType(e.target.value)}
          >
            {ROOM_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Color</Label>
          <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button onClick={addSubject} disabled={busy || !name.trim()} className="w-full">
            Add subject
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {(subjects ?? []).map((subject) => (
          <SubjectRow
            key={subject.id}
            sid={sid}
            subject={subject}
            onDelete={deleteSubject}
            mutateSubjects={mutateSubjects}
          />
        ))}
        {subjects?.length === 0 && (
          <p className="rounded-lg border px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-700">
            No subjects yet.
          </p>
        )}
      </div>
    </Card>
  );
}

function SubjectRow({
  sid,
  subject,
  onDelete,
  mutateSubjects,
}: {
  sid: number;
  subject: Subject;
  onDelete: (id: number) => Promise<void>;
  mutateSubjects: KeyedMutator<Subject[]>;
}) {
  const [name, setName] = useState(subject.name);
  const [color, setColor] = useState(subject.color);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.updateSubject(sid, subject.id, { name, color });
      await mutateSubjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subject edit endpoint is not available yet");
    } finally {
      setSaving(false);
    }
  }

  const changed = name !== subject.name || color !== subject.color;

  return (
    <div className="rounded-lg border p-3 dark:border-slate-700">
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto_auto_auto] sm:items-center">
        <span
          className="h-8 w-8 rounded border dark:border-slate-700"
          style={{ backgroundColor: color }}
          aria-label={`${subject.name} color`}
        />
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <Button variant="ghost" onClick={save} disabled={!changed || saving || !name.trim()}>
          Save
        </Button>
        <Button variant="danger" onClick={() => onDelete(subject.id)}>
          Delete
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
        {subject.code && <span>{subject.code}</span>}
        <span>{subject.requires_room_type}</span>
        <span>{subject.color}</span>
      </div>
      {error && <p className="mt-2 text-sm text-amber-600">{error}</p>}
    </div>
  );
}

function FixedSlotsCard({
  sid,
  school,
  standards,
  subjects,
  fixedSlots,
  fixedSlotsError,
  mutateFixedSlots,
}: {
  sid: number;
  school: School;
  standards?: Standard[];
  subjects?: Subject[];
  fixedSlots?: FixedSlot[];
  fixedSlotsError?: unknown;
  mutateFixedSlots: KeyedMutator<FixedSlot[]>;
}) {
  const sections = (standards ?? []).flatMap((std) =>
    std.sections.map((section) => ({ ...section, std: std.name }))
  );
  const days = school.working_days;
  const [sectionId, setSectionId] = useState<number | "">("");
  const [dayIndex, setDayIndex] = useState(0);
  const [periodIndex, setPeriodIndex] = useState(0);
  const [label, setLabel] = useState("Assembly");
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activeSectionId = sectionId || sections[0]?.id || "";

  async function addFixedSlot() {
    if (!activeSectionId || !label.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.createFixedSlot(sid, {
        section_id: Number(activeSectionId),
        subject_id: subjectId === "" ? null : Number(subjectId),
        label: label.trim(),
        day_index: dayIndex,
        period_index: periodIndex,
      });
      setLabel("Assembly");
      setSubjectId("");
      await mutateFixedSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to lock fixed slot");
    } finally {
      setBusy(false);
    }
  }

  async function deleteFixedSlot(id: number) {
    setError(null);
    try {
      await api.deleteFixedSlot(sid, id);
      await mutateFixedSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete fixed slot");
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Fixed slots</h2>
        <Badge color={fixedSlotsError ? "red" : "slate"}>{fixedSlots?.length ?? 0}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-6">
        <div>
          <Label>Section</Label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            value={activeSectionId}
            onChange={(e) => setSectionId(Number(e.target.value))}
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.std} {section.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Day</Label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            value={dayIndex}
            onChange={(e) => setDayIndex(Number(e.target.value))}
          >
            {days.map((day, index) => (
              <option key={day.id ?? day.day_name} value={index}>
                {day.day_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Period</Label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            value={periodIndex}
            onChange={(e) => setPeriodIndex(Number(e.target.value))}
          >
            {Array.from({ length: school.periods_per_day }, (_, p) => (
              <option key={p} value={p}>P{p + 1}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <Label>Subject</Label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">None</option>
            {(subjects ?? []).map((subject) => (
              <option key={subject.id} value={subject.id}>{subject.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={addFixedSlot} disabled={busy || !activeSectionId || !label.trim()} className="w-full">
            Lock slot
          </Button>
        </div>
      </div>

      {Boolean(fixedSlotsError) && <p className="text-sm text-red-600">Could not load fixed slots.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-auto rounded-lg border dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Section</th>
              <th className="px-3 py-2">Day</th>
              <th className="px-3 py-2">Period</th>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {(fixedSlots ?? []).map((slot) => (
              <tr key={slot.id} className="border-t dark:border-slate-700">
                <td className="px-3 py-2 font-medium">{slot.label}</td>
                <td className="px-3 py-2">{sectionLabel(slot.section_id, sections)}</td>
                <td className="px-3 py-2">{days[slot.day_index]?.day_name ?? `Day ${slot.day_index + 1}`}</td>
                <td className="px-3 py-2">P{slot.period_index + 1}</td>
                <td className="px-3 py-2">
                  {subjects?.find((subject) => subject.id === slot.subject_id)?.name ?? "None"}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button variant="danger" className="px-3 py-1.5" onClick={() => deleteFixedSlot(slot.id)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
            {!fixedSlotsError && fixedSlots?.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={6}>
                  No fixed slots yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function sectionLabel(
  sectionId: number,
  sections: { id: number; name: string; std: string }[]
) {
  const section = sections.find((x) => x.id === sectionId);
  return section ? `${section.std} ${section.name}` : `#${sectionId}`;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="text-center">
      <div className="text-2xl font-bold text-brand-600">{value}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
    </Card>
  );
}

