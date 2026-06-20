"use client";

import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { School } from "@/lib/types";
import { Card, Button, Badge } from "@/components/ui";

export default function Dashboard() {
  const { data: schools, error, isLoading } = useSWR<School[]>("/schools", fetcher);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schools</h1>
          <p className="text-sm text-slate-500">
            Set up a school once, then generate conflict-free timetables in one pass.
          </p>
        </div>
        <Link href="/setup">
          <Button>+ New School</Button>
        </Link>
      </div>

      {isLoading && <p className="text-slate-500">Loading…</p>}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm text-red-700">
            Couldn&apos;t reach the API. Is the backend running on port 8000?
          </p>
        </Card>
      )}

      {schools && schools.length === 0 && (
        <Card>
          <p className="text-slate-600">
            No schools yet.{" "}
            <Link href="/setup" className="font-medium text-brand-600">
              Create your first school
            </Link>{" "}
            to get started.
          </p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {schools?.map((s) => (
          <Link key={s.id} href={`/school/${s.id}`}>
            <Card className="transition hover:border-brand-500 hover:shadow-md">
              <div className="flex items-start justify-between">
                <h2 className="font-semibold">{s.name}</h2>
                <Badge color="indigo">{s.board}</Badge>
              </div>
              <dl className="mt-3 space-y-1 text-sm text-slate-500">
                <div>{s.academic_year}</div>
                <div>
                  {s.working_days.length} days · {s.periods_per_day} periods/day
                </div>
              </dl>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
