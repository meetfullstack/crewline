"use client";

import { ArrowRight, CalendarDays, Clock, HandCoins, Plane, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DashboardGreeting } from "@/components/app/dashboard-greeting";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyOpenShifts, useMyShifts, useMyTimeOff } from "@/hooks/use-portal";
import { formatMoney } from "@/lib/format";
import { formatDay, shiftRange } from "@/lib/schedule";
import { ClockCard } from "./clock-card";
import { ShiftRow } from "./shift-row";

const DAY_MS = 24 * 60 * 60 * 1000;

function relativeStart(startsAt: string, now: number) {
  const ms = new Date(startsAt).getTime() - now;
  if (ms <= 0) return "Happening now";
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 24) return `Starts in ${hours || 1} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(ms / DAY_MS);
  return `In ${days} day${days === 1 ? "" : "s"}`;
}

export function EmployeeHome() {
  const shifts = useMyShifts();
  const openShifts = useMyOpenShifts();
  const timeOff = useMyTimeOff();

  // Read the clock once per visit; render stays pure.
  const [now] = useState(() => Date.now());
  const upcoming = (shifts.data ?? []).filter((s) => new Date(s.endsAt).getTime() > now);
  const next = upcoming[0];
  const nextSeven = upcoming.filter(
    (s) => new Date(s.startsAt).getTime() < now + 7 * DAY_MS,
  );
  const hours = nextSeven.reduce((sum, s) => sum + s.paidHours, 0);
  const earnings = nextSeven.reduce((sum, s) => sum + s.cost, 0);
  const pending = (timeOff.data ?? []).filter((r) => r.status === "PENDING").length;
  const claimable = (openShifts.data ?? []).filter((s) => s.canClaim).length;

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <DashboardGreeting />
      <ClockCard />

      {shifts.isPending ? (
        <Skeleton className="h-36" />
      ) : next ? (
        <section
          aria-label="Next shift"
          className="relative overflow-hidden rounded-2xl border bg-card p-6"
        >
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 w-1.5"
            style={{ backgroundColor: next.position.color }}
          />
          <p className="text-sm font-medium text-brand">{relativeStart(next.startsAt, now)}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            {formatDay(next.date, "long")}
          </h2>
          <p className="mt-1 text-lg text-muted-foreground tabular-nums">
            {shiftRange(next)} · {next.position.name} · {next.location.name}
          </p>
          {next.notes && <p className="mt-3 text-sm">Note from your manager: “{next.notes}”</p>}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed p-6 text-center">
          <p className="font-medium">No upcoming shifts</p>
          <p className="text-sm text-muted-foreground">
            New shifts appear here once your manager publishes the schedule.
          </p>
        </section>
      )}

      <dl className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Clock} label="Next 7 days" value={`${+hours.toFixed(1)}h`} detail={`${nextSeven.length} shift${nextSeven.length === 1 ? "" : "s"}`} />
        <Stat icon={HandCoins} label="Estimated pay" value={formatMoney(earnings)} detail="Before tax and tips" />
        <Stat
          icon={UserPlus}
          label="Open shifts"
          value={String(claimable)}
          detail={claimable ? "You can pick these up" : "Nothing open right now"}
          href="/me/open-shifts"
        />
      </dl>

      <section className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-medium">Coming up</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/me/shifts">
              All shifts <ArrowRight />
            </Link>
          </Button>
        </div>
        {shifts.isPending ? (
          <div className="grid gap-2 p-4">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : nextSeven.length ? (
          <div className="divide-y">
            {nextSeven.map((s) => (
              <ShiftRow key={s.id} shift={s} />
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
            <CalendarDays className="size-4" /> Nothing scheduled in the next week.
          </p>
        )}
      </section>

      <Link
        href="/time-off"
        className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm transition-colors hover:bg-muted/50"
      >
        <Plane className="size-4 text-muted-foreground" />
        <span className="flex-1">
          {pending
            ? `${pending} time-off request${pending > 1 ? "s" : ""} waiting for approval`
            : "Need a day off? Request time off"}
        </span>
        <ArrowRight className="size-4 text-muted-foreground" />
      </Link>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  detail,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  href?: string;
}) {
  const body = (
    <>
      <dt className="flex items-center justify-between text-sm text-muted-foreground">
        {label}
        <Icon className="size-4" />
      </dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
      <dd className="text-xs text-muted-foreground">{detail}</dd>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50">
      {body}
    </Link>
  ) : (
    <div className="rounded-xl border bg-card p-4">{body}</div>
  );
}
