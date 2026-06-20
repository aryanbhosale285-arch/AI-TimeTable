"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { RuleConfig, CustomRule } from "@/lib/types";
import { Card, Button, Input, Label, Badge } from "@/components/ui";

type ToggleKey =
  | "keep_key_periods_filled"
  | "teacher_rest_after_two"
  | "avoid_back_to_back_free"
  | "spread_subjects"
  | "morning_hard_subjects";

const TOGGLES: { key: ToggleKey; title: string; desc: string }[] = [
  {
    key: "keep_key_periods_filled",
    title: "Key periods never free",
    desc: "The 1st, 2nd, before/after-break, and last period of each day stay filled.",
  },
  {
    key: "teacher_rest_after_two",
    title: "Teacher rest after 2 in a row",
    desc: "A teacher never takes 3 lectures back-to-back — they get a free period after two.",
  },
  {
    key: "avoid_back_to_back_free",
    title: "Avoid back-to-back free periods",
    desc: "Two empty periods in a row for a class are discouraged.",
  },
  {
    key: "spread_subjects",
    title: "Spread subjects across the week",
    desc: "Prefer one lecture of a subject per day; allow a few doubles (see below).",
  },
  {
    key: "morning_hard_subjects",
    title: "Hard subjects in the morning",
    desc: "Subjects marked 'Morning' (e.g. Maths, Science) are scheduled earlier in the day.",
  },
];

export default function RulesPage() {
  const [rules, setRules] = useState<RuleConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getRules().then(setRules);
  }, []);

  function setField<K extends keyof RuleConfig>(key: K, value: RuleConfig[K]) {
    setRules((r) => (r ? { ...r, [key]: value } : r));
    setSaved(false);
  }

  async function save() {
    if (!rules) return;
    setBusy(true);
    const updated = await api.updateRules(rules);
    setRules(updated);
    setBusy(false);
    setSaved(true);
  }

  if (!rules) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scheduling Rules</h1>
        <p className="text-sm text-slate-500">
          Turn preferences on or off and tune them. These apply the next time you
          generate a timetable. (Core safety rules — no double-booking, room capacity,
          teacher availability — are always enforced and can&apos;t be turned off.)
        </p>
      </div>

      <Card className="divide-y dark:divide-slate-800">
        {TOGGLES.map(({ key, title, desc }) => (
          <div key={key} className="flex items-start justify-between gap-4 py-3 first:pt-0">
            <div>
              <div className="font-medium">{title}</div>
              <div className="text-sm text-slate-500">{desc}</div>
            </div>
            <Switch checked={rules[key]} onChange={(v) => setField(key, v)} />
          </div>
        ))}
      </Card>

      <Card className="grid grid-cols-2 gap-4">
        <div>
          <Label>Max double periods / week</Label>
          <Input
            type="number"
            min={0}
            max={10}
            value={rules.max_doubles_per_week}
            onChange={(e) => setField("max_doubles_per_week", Number(e.target.value))}
          />
          <p className="mt-1 text-xs text-slate-500">
            How many back-to-back same-subject pairs a class may have per week.
          </p>
        </div>
        <div>
          <Label>Solver time limit (seconds)</Label>
          <Input
            type="number"
            min={5}
            max={120}
            value={rules.solve_time_limit}
            onChange={(e) => setField("solve_time_limit", Number(e.target.value))}
          />
          <p className="mt-1 text-xs text-slate-500">
            More time = better-quality timetables, slower generation.
          </p>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-green-600">Saved ✓</span>}
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save rules"}
        </Button>
      </div>

      <CustomRules config={rules} onConfigChange={() => api.getRules().then(setRules)} />
    </div>
  );
}

const RULE_TYPES = [
  { value: "subject_time", label: "Subject must be in…", needs: "time" },
  { value: "subject_max_per_day", label: "Subject max per day…", needs: "int" },
  { value: "subject_position", label: "Subject must avoid…", needs: "pos" },
] as const;

function describe(r: CustomRule): string {
  if (r.rule_type === "subject_time")
    return `${r.subject_name} should be in the ${r.param_text}`;
  if (r.rule_type === "subject_max_per_day")
    return `${r.subject_name}: at most ${r.param_int} period(s) per day`;
  if (r.rule_type === "subject_position")
    return `${r.subject_name} should avoid the ${r.param_text} period`;
  return r.rule_type;
}

function CustomRules({
  config,
  onConfigChange,
}: {
  config: RuleConfig;
  onConfigChange: () => void;
}) {
  const [rules, setRules] = useState<CustomRule[]>([]);
  const [type, setType] = useState<string>("subject_time");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("morning");
  const [num, setNum] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needs = RULE_TYPES.find((t) => t.value === type)?.needs;

  function reload() {
    api.listCustomRules().then(setRules);
  }
  useEffect(reload, []);

  async function add() {
    if (!subject.trim()) {
      setError("Enter a subject name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: Partial<CustomRule> = { rule_type: type, subject_name: subject.trim() };
      if (needs === "time") body.param_text = text; // morning/afternoon
      if (needs === "pos") body.param_text = text; // first/last
      if (needs === "int") body.param_int = num;
      await api.createCustomRule(body);
      setSubject("");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add rule");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(r: CustomRule) {
    await api.toggleCustomRule(r.id, !r.enabled);
    reload();
  }
  async function remove(r: CustomRule) {
    await api.deleteCustomRule(r.id);
    reload();
  }

  // Default param_text sensibly when the rule type changes.
  function onTypeChange(v: string) {
    setType(v);
    const n = RULE_TYPES.find((t) => t.value === v)?.needs;
    if (n === "time") setText("morning");
    if (n === "pos") setText("first");
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-semibold">Custom rules</h2>
        <p className="text-sm text-slate-500">
          Add your own rules. They apply to any subject with a matching name across all schools.
        </p>
      </div>

      <AiAssistant config={config} onConfigChange={onConfigChange} onAdded={reload} />

      {rules.length > 0 && (
        <ul className="divide-y dark:divide-slate-800">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm">
                {describe(r)}{" "}
                {!r.enabled && <Badge color="slate">off</Badge>}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => toggle(r)}>
                  {r.enabled ? "Disable" : "Enable"}
                </Button>
                <Button variant="danger" onClick={() => remove(r)}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add new rule */}
      <div className="rounded-lg border p-3 dark:border-slate-700">
        <Label>Add a new rule</Label>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            value={type}
            onChange={(e) => onTypeChange(e.target.value)}
          >
            {RULE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <Input
            placeholder="Subject name (e.g. Maths)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          {needs === "time" && (
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              value={text}
              onChange={(e) => setText(e.target.value)}
            >
              <option value="morning">the morning</option>
              <option value="afternoon">the afternoon</option>
            </select>
          )}
          {needs === "pos" && (
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              value={text}
              onChange={(e) => setText(e.target.value)}
            >
              <option value="first">the first period</option>
              <option value="last">the last period</option>
            </select>
          )}
          {needs === "int" && (
            <Input
              type="number"
              min={1}
              max={8}
              value={num}
              onChange={(e) => setNum(Number(e.target.value))}
            />
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-3 flex justify-end">
          <Button onClick={add} disabled={busy}>{busy ? "Adding…" : "Add rule"}</Button>
        </div>
      </div>
    </Card>
  );
}

function AiAssistant({
  config,
  onConfigChange,
  onAdded,
}: {
  config: RuleConfig;
  onConfigChange: () => void;
  onAdded: () => void;
}) {
  const [key, setKey] = useState("");
  const [editingKey, setEditingKey] = useState(false);
  const [nl, setNl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function saveKey() {
    if (!key.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await api.setAiKey(key.trim());
      setKey("");
      setEditingKey(false);
      onConfigChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save key");
    } finally {
      setBusy(false);
    }
  }

  async function addWithAi() {
    if (!nl.trim()) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await api.parseRule(nl.trim());
      setNl("");
      setMsg("Rule added ✓");
      onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't understand that rule");
    } finally {
      setBusy(false);
    }
  }

  const showKeyForm = !config.has_ai_key || editingKey;

  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="flex items-center justify-between">
        <Label>✨ Describe a rule in plain English</Label>
        {config.has_ai_key && !editingKey && (
          <span className="text-xs text-slate-500">
            {config.ai_provider} connected ·{" "}
            <button className="text-brand-600" onClick={() => setEditingKey(true)}>change key</button>
          </span>
        )}
      </div>

      {showKeyForm ? (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-slate-500">
            Paste your AI API key once. It&apos;s stored only on your server and never shown again.
          </p>
          <Input
            type="password"
            placeholder="Paste your API key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            {editingKey && (
              <Button variant="ghost" onClick={() => setEditingKey(false)}>Cancel</Button>
            )}
            <Button onClick={saveKey} disabled={busy || !key.trim()}>
              {busy ? "Saving…" : "Save key"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            rows={2}
            placeholder='e.g. "Keep Maths in the morning" or "Library should never be the last period"'
            value={nl}
            onChange={(e) => setNl(e.target.value)}
          />
          <div className="flex items-center justify-end gap-3">
            {msg && <span className="text-sm text-green-600">{msg}</span>}
            <Button onClick={addWithAi} disabled={busy || !nl.trim()}>
              {busy ? "Thinking…" : "Add with AI"}
            </Button>
          </div>
        </div>
      )}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        checked ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-600"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
