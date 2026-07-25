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

const selectClass =
  "w-full rounded-sm border border-border bg-paper px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent focus:ring-1 focus:ring-accent";

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
  const [genStage, setGenStage] = useState<string | null>(null);

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

  // Generation runs as a background job on the server; we poll its status so
  // long solves survive proxy timeouts and free-tier cold starts.
  async function generate() {
    setBusy(true);
    setGenError(null);
    setGenStage("starting");
    try {
      const job = await api.generateAsync(sid, {
        name: `Timetable ${new Date().toLocaleString()}`,
      });
      const deadline = Date.now() + 5 * 60_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        let j;
        try {
          j = await api.getJob(sid, job.id);
        } catch {
          continue; // transient network blip — keep polling
        }
        setGenStage(j.status === "RUNNING" ? j.stage || "working" : j.status.toLowerCase());
        if (j.status === "SUCCEEDED" && j.timetable_id) {
          await mutateTT();
          window.location.href = `/school/${sid}/timetable/${j.timetable_id}`;
          return;
        }
        if (j.status === "FAILED") {
          setGenError(j.errors.length ? j.errors : ["Generation failed"]);
          return;
        }
      }
      setGenError(["Generation is taking unusually long. Refresh in a minute — the timetable may still appear."]);
    } catch (err) {
      if (err instanceof ApiError && err.detail && typeof err.detail === "object") {
        const d = err.detail as { errors?: string[]; message?: string; log?: string[] };
        setGenError(d.errors || d.log || [d.message || "Generation failed"]);
      } else {
        setGenError([String((err as Error).message)]);
      }
    } finally {
      setBusy(false);
      setGenStage(null);
    }
  }

  if (!school) return <p className="font-mono text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-8">
      {/* School header */}
      <div className="flex items-end justify-between gap-6">
        <div>
          <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition">
            ← All schools
          </Link>
          <h1 className="mt-2 font-display text-5xl leading-tight">{school.name}</h1>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
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
      <Card className="space-y-4">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          § 01 — Import
        </div>
        <h2 className="font-display text-3xl">Import teacher assignments</h2>
        <p className="text-sm text-muted-foreground">
          Upload a CSV/Excel with columns: Teacher Name, Subject, Standard, Section,
          Lectures/Week, Preferred Time, Special Room.{" "}
          <a href="/template.csv" download className="text-accent hover:underline">Download template</a>
        </p>
        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleUpload}
          className="block text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-ink file:px-4 file:py-2.5 file:text-cream file:font-medium file:cursor-pointer" />
        {uploadMsg && <p className="font-mono text-xs text-muted-foreground">{uploadMsg}</p>}
      </Card>

      {/* Assignments preview */}
      {assignments && assignments.length > 0 && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-3xl">Assignments</h2>
            <Badge color="slate">{assignments.length}</Badge>
          </div>
          <div className="max-h-64 overflow-auto rounded-sm border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-border bg-muted text-left">
                <tr>
                  <th className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Teacher</th>
                  <th className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Subject</th>
                  <th className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Section</th>
                  <th className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Lectures/wk</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => {
                  const t = teachers?.find((x) => x.id === a.teacher_id);
                  const sub = subjects?.find((x) => x.id === a.subject_id);
                  return (
                    <tr key={a.id} className="border-t border-border transition hover:bg-paper">
                      <td className="px-3 py-2.5">{t?.name ?? a.teacher_id}</td>
                      <td className="px-3 py-2.5">{sub?.name ?? a.subject_id}</td>
                      <td className="px-3 py-2.5">#{a.section_id}</td>
                      <td className="px-3 py-2.5">
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
      <Card className="space-y-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          § 02 — Generate
        </div>
        <h2 className="font-display text-3xl">Check feasibility &amp; generate</h2>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={runPreflight} disabled={busy}>
            Run pre-flight check
          </Button>
          <Button onClick={generate} disabled={busy || !assignments?.length}>
            {busy ? "Working…" : "Generate timetable"}
          </Button>
        </div>

        {busy && genStage && (
          <div className="flex items-center gap-3 rounded-sm border border-accent/30 bg-accent/5 p-4">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-sm text-foreground">
              {genStage === "preflight" && "Checking feasibility…"}
              {genStage === "solving" && "Solving — placing every lecture without clashes…"}
              {genStage === "saving" && "Saving the timetable…"}
              {!["preflight", "solving", "saving"].includes(genStage) && "Starting generation…"}
            </p>
          </div>
        )}

        {preflight && (
          <div className={`rounded-sm border p-4 ${preflight.feasible ? "border-accent/30 bg-accent/5" : "border-destructive/30 bg-destructive/5"}`}>
            <p className="font-display text-xl">
              {preflight.feasible ? "✓ Feasible" : "✗ Not feasible — fix these first:"}
            </p>
            {preflight.errors.map((er, i) => (
              <p key={i} className="mt-1 text-sm text-destructive">• {er}</p>
            ))}
            {preflight.warnings.slice(0, 5).map((w, i) => (
              <p key={i} className="mt-1 text-sm text-accent">⚠ {w}</p>
            ))}
          </div>
        )}

        {genError && (
          <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-4">
            <p className="font-display text-xl text-destructive">Generation failed:</p>
            {genError.map((er, i) => (
              <p key={i} className="mt-1 text-sm text-destructive">• {er}</p>
            ))}
          </div>
        )}
      </Card>

      {/* Timetables */}
      {timetables && timetables.length > 0 && (
        <Card>
          <h2 className="mb-4 font-display text-3xl">Generated timetables</h2>
          <ul className="divide-y divide-border">
            {timetables.map((tt) => (
              <li key={tt.id} className="flex items-center justify-between py-4">
                <div>
                  <Link href={`/school/${sid}/timetable/${tt.id}`} className="font-display text-xl text-accent hover:underline">
                    {tt.name}
                  </Link>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
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
    <Card className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-3xl">Rooms</h2>
        <Badge color="slate">{rooms?.length ?? 0}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <div className="sm:col-span-2">
          <Label>Room name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lab 1" />
        </div>
        <div>
          <Label>Type</Label>
          <select className={selectClass} value={roomType} onChange={(e) => setRoomType(e.target.value)}>
            {ROOM_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Capacity</Label>
          <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
        </div>
        <div className="flex items-end">
          <Button onClick={addRoom} disabled={busy || !name.trim()} className="w-full">
            Add room
          </Button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={isAvailable}
          onChange={(e) => setIsAvailable(e.target.checked)}
          className="h-4 w-4 rounded-sm border-border accent-accent"
        />
        Available for scheduling
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-auto rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted text-left">
            <tr>
              <th className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Name</th>
              <th className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Type</th>
              <th className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Capacity</th>
              <th className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Status</th>
              <th className="px-3 py-2.5 text-right font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {(rooms ?? []).map((room) => (
              <tr key={room.id} className="border-t border-border transition hover:bg-paper">
                <td className="px-3 py-2.5 font-medium">{room.name}</td>
                <td className="px-3 py-2.5">{room.room_type}</td>
                <td className="px-3 py-2.5">{room.capacity}</td>
                <td className="px-3 py-2.5">
                  <Badge color={room.is_available ? "green" : "slate"}>
                    {room.is_available ? "Available" : "Unavailable"}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Button variant="danger" className="px-3 py-1.5" onClick={() => deleteRoom(room.id)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
            {rooms?.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={5}>
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
    <Card className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-3xl">Subject master list</h2>
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
          <select className={selectClass} value={requiresRoomType} onChange={(e) => setRequiresRoomType(e.target.value)}>
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

      {error && <p className="text-sm text-destructive">{error}</p>}

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
          <p className="rounded-sm border border-border px-3 py-6 text-center text-sm text-muted-foreground">
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
    <div className="rounded-sm border border-border p-3">
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto_auto_auto] sm:items-center">
        <span
          className="h-8 w-8 rounded-sm border border-border"
          style={{ backgroundColor: color }}
          aria-label={`${subject.name} color`}
        />
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <Button variant="ghost" onClick={save} disabled={!changed || saving || !name.trim()}>
          Save
        </Button>
        <Button variant="danger" onClick={() => onDelete(subject.id)}>
          Delete
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {subject.code && <span>{subject.code}</span>}
        <span>{subject.requires_room_type}</span>
        <span>{subject.color}</span>
      </div>
      {error && <p className="mt-2 text-sm text-accent">{error}</p>}
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
    <Card className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-3xl">Fixed slots</h2>
        <Badge color={fixedSlotsError ? "red" : "slate"}>{fixedSlots?.length ?? 0}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-6">
        <div>
          <Label>Section</Label>
          <select className={selectClass} value={activeSectionId} onChange={(e) => setSectionId(Number(e.target.value))}>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.std} {section.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Day</Label>
          <select className={selectClass} value={dayIndex} onChange={(e) => setDayIndex(Number(e.target.value))}>
            {days.map((day, index) => (
              <option key={day.id ?? day.day_name} value={index}>
                {day.day_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Period</Label>
          <select className={selectClass} value={periodIndex} onChange={(e) => setPeriodIndex(Number(e.target.value))}>
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
          <select className={selectClass} value={subjectId} onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : "")}>
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

      {Boolean(fixedSlotsError) && <p className="text-sm text-destructive">Could not load fixed slots.</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-auto rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted text-left">
            <tr>
              <th className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Label</th>
              <th className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Section</th>
              <th className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Day</th>
              <th className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Period</th>
              <th className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Subject</th>
              <th className="px-3 py-2.5 text-right font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {(fixedSlots ?? []).map((slot) => (
              <tr key={slot.id} className="border-t border-border transition hover:bg-paper">
                <td className="px-3 py-2.5 font-medium">{slot.label}</td>
                <td className="px-3 py-2.5">{sectionLabel(slot.section_id, sections)}</td>
                <td className="px-3 py-2.5">{days[slot.day_index]?.day_name ?? `Day ${slot.day_index + 1}`}</td>
                <td className="px-3 py-2.5">P{slot.period_index + 1}</td>
                <td className="px-3 py-2.5">
                  {subjects?.find((subject) => subject.id === slot.subject_id)?.name ?? "None"}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Button variant="danger" className="px-3 py-1.5" onClick={() => deleteFixedSlot(slot.id)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
            {!fixedSlotsError && fixedSlots?.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={6}>
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
    <Card className="text-center py-5">
      <div className="font-display text-4xl text-accent">{value}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </Card>
  );
}
