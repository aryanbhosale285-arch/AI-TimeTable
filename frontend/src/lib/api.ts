import type {
  School, Subject, Standard, Room, Teacher, Assignment,
  Timetable, PreflightResult, RuleConfig, CustomRule, FixedSlot,
} from "./types";

// Locally, requests go through Next's /api rewrite to the FastAPI backend.
const BASE = "/api";
const DIRECT_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  (typeof window !== "undefined" ? "http://localhost:8000/api" : BASE);

// In the browser on a deployed site, call the backend DIRECTLY
// (NEXT_PUBLIC_BACKEND_URL) instead of bouncing through Vercel's proxy — the
// proxy has a short timeout that fails while a free-tier backend cold-starts.
// Locally NEXT_PUBLIC_BACKEND_URL is unset, so it falls back to the /api rewrite.
function apiBase(): string {
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL;
  }
  return BASE;
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    // Read the body ONCE as text, then try to parse JSON from it. Reading the
    // stream twice (res.json() then res.text()) throws "body stream already read".
    const body = await res.text();
    let detail: unknown = body;
    try {
      detail = JSON.parse(body).detail ?? body;
    } catch {
      /* not JSON — keep the raw text */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
    this.status = status;
    this.detail = detail;
  }
}

export const fetcher = <T>(path: string) => req<T>(path);

export const api = {
  // Schools
  listSchools: () => req<School[]>("/schools"),
  getSchool: (id: number) => req<School>(`/schools/${id}`),
  createSchool: (body: unknown) =>
    req<School>("/schools", { method: "POST", body: JSON.stringify(body) }),

  // Academic
  listSubjects: (sid: number) => req<Subject[]>(`/schools/${sid}/subjects`),
  createSubject: (sid: number, body: unknown) =>
    req<Subject>(`/schools/${sid}/subjects`, { method: "POST", body: JSON.stringify(body) }),
  updateSubject: (sid: number, id: number, body: Partial<Subject>) =>
    req<Subject>(`/schools/${sid}/subjects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSubject: (sid: number, id: number) =>
    req<void>(`/schools/${sid}/subjects/${id}`, { method: "DELETE" }),
  listStandards: (sid: number) => req<Standard[]>(`/schools/${sid}/standards`),
  createStandard: (sid: number, body: unknown) =>
    req<Standard>(`/schools/${sid}/standards`, { method: "POST", body: JSON.stringify(body) }),
  listRooms: (sid: number) => req<Room[]>(`/schools/${sid}/rooms`),
  createRoom: (sid: number, body: unknown) =>
    req<Room>(`/schools/${sid}/rooms`, { method: "POST", body: JSON.stringify(body) }),
  updateRoom: (sid: number, id: number, body: Partial<Room>) =>
    req<Room>(`/schools/${sid}/rooms/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteRoom: (sid: number, id: number) =>
    req<void>(`/schools/${sid}/rooms/${id}`, { method: "DELETE" }),

  // Fixed slots
  listFixedSlots: (sid: number) => req<FixedSlot[]>(`/schools/${sid}/fixed-slots`),
  createFixedSlot: (sid: number, body: unknown) =>
    req<FixedSlot>(`/schools/${sid}/fixed-slots`, { method: "POST", body: JSON.stringify(body) }),
  deleteFixedSlot: (sid: number, id: number) =>
    req<void>(`/schools/${sid}/fixed-slots/${id}`, { method: "DELETE" }),

  // Teachers
  listTeachers: (sid: number) => req<Teacher[]>(`/schools/${sid}/teachers`),
  listAssignments: (sid: number) => req<Assignment[]>(`/schools/${sid}/assignments`),
  createAssignment: (sid: number, body: unknown) =>
    req<Assignment>(`/schools/${sid}/assignments`, { method: "POST", body: JSON.stringify(body) }),

  // CSV import (multipart — bypass JSON content-type)
  importCsv: async (sid: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${apiBase()}/schools/${sid}/import`, { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.text();
      let detail: unknown = body;
      try {
        detail = JSON.parse(body).detail ?? body;
      } catch {
        /* keep raw text */
      }
      throw new ApiError(res.status, detail);
    }
    return res.json() as Promise<{ imported: number; warnings: string[] }>;
  },

  // Timetables
  preflight: (sid: number) =>
    req<PreflightResult>(`/schools/${sid}/timetables/preflight`, { method: "POST" }),
  generate: async (sid: number, body: unknown) => {
    // Generation can run longer than Next's proxy comfortably allows. Call the
    // FastAPI backend directly from the browser so a successful solve does not
    // get shown as a proxy-side 500.
    const res = await fetch(`${DIRECT_BASE}/schools/${sid}/timetables/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const responseBody = await res.text();
      let detail: unknown = responseBody;
      try {
        detail = JSON.parse(responseBody).detail ?? responseBody;
      } catch {
        /* keep raw text */
      }
      throw new ApiError(res.status, detail);
    }
    return res.json() as Promise<Timetable>;
  },
  listTimetables: (sid: number) => req<Timetable[]>(`/schools/${sid}/timetables`),
  getTimetable: (sid: number, tid: number) =>
    req<Timetable>(`/schools/${sid}/timetables/${tid}`),
  publish: (sid: number, tid: number) =>
    req<Timetable>(`/schools/${sid}/timetables/${tid}/publish`, { method: "POST" }),
  revoke: (sid: number, tid: number) =>
    req<void>(`/schools/${sid}/timetables/${tid}`, { method: "DELETE" }),

  // Rules
  getRules: () => req<RuleConfig>("/rules"),
  updateRules: (body: Partial<RuleConfig>) =>
    req<RuleConfig>("/rules", { method: "PUT", body: JSON.stringify(body) }),

  // AI key + natural-language rules (provider is auto-detected from the key)
  setAiKey: (ai_api_key: string) =>
    req<RuleConfig>("/rules", { method: "PUT", body: JSON.stringify({ ai_api_key }) }),
  parseRule: (text: string) =>
    req<CustomRule>("/rules/custom/parse", { method: "POST", body: JSON.stringify({ text }) }),

  // Custom rules
  listCustomRules: () => req<CustomRule[]>("/rules/custom"),
  createCustomRule: (body: Partial<CustomRule>) =>
    req<CustomRule>("/rules/custom", { method: "POST", body: JSON.stringify(body) }),
  toggleCustomRule: (id: number, enabled: boolean) =>
    req<CustomRule>(`/rules/custom/${id}`, { method: "PATCH", body: JSON.stringify({ enabled }) }),
  deleteCustomRule: (id: number) =>
    req<void>(`/rules/custom/${id}`, { method: "DELETE" }),
};
