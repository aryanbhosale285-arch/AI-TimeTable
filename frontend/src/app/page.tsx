"use client";

import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { School } from "@/lib/types";
import { Card, Button, Badge } from "@/components/ui";

export default function Dashboard() {
  const { data: schools, error, isLoading } = useSWR<School[]>("/schools", fetcher);

  return (
    <div className="space-y-10">
      {/* Section header */}
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            § 01 — Dashboard
          </div>
          <h1 className="mt-3 font-display text-5xl leading-tight">Your schools</h1>
          <p className="mt-3 max-w-lg text-muted-foreground">
            Set up a school once, then generate conflict-free timetables in one pass.
          </p>
        </div>
        <Link href="/setup">
          <Button>
            + New School <span aria-hidden className="ml-1">→</span>
          </Button>
        </Link>
      </div>

      {isLoading && (
        <p className="font-mono text-sm text-muted-foreground">Loading…</p>
      )}

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <p className="text-sm text-destructive">
            Couldn&apos;t reach the API. Is the backend running on port 8000?
          </p>
        </Card>
      )}

      {schools && schools.length === 0 && (
        <Card className="text-center py-16">
          <p className="font-display text-3xl">No schools yet.</p>
          <p className="mt-3 text-muted-foreground">
            <Link href="/setup" className="text-accent hover:underline">
              Create your first school
            </Link>{" "}
            to get started.
          </p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {schools?.map((s) => (
          <Link key={s.id} href={`/school/${s.id}`}>
            <Card className="group transition hover:border-ink/30 hover:shadow-[0_8px_30px_-12px_rgba(20,20,40,0.12)]">
              <div className="flex items-start justify-between">
                <h2 className="font-display text-2xl">{s.name}</h2>
                <Badge color="indigo">{s.board}</Badge>
              </div>
              <dl className="mt-4 space-y-1 font-mono text-xs text-muted-foreground">
                <div>{s.academic_year}</div>
                <div>
                  {s.working_days.length} days · {s.periods_per_day} periods/day
                </div>
              </dl>
              <div className="mt-4 text-sm text-accent opacity-0 transition group-hover:opacity-100">
                Open →
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
