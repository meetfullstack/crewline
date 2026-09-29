"use client";

import { cn } from "cn";
import {
  ArrowRight,
  BadgeAlert,
  CalendarRange,
  CheckCircle2,
  CircleAlert,
  Plane,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { DashboardGreeting } from "@/components/app/dashboard-greeting";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type Dashboard, useDashboard, type WeekStatus } from "@/hooks/use-dashboard";
import { formatDateOnly, formatMoney } from "@/lib/format";
import { addDays, formatWeekRange, shiftRange, shortTime } from "@/lib/schedule";
import { LaborChart } from "./labor-chart";

export function ManagerDashboard() {
  const { data, isPending, isError } = useDashboard();

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <DashboardGreeting />
        <Button variant="outline" asChild>
          <Link href="/schedule">
            <CalendarRange /> Open schedule
          </Link>
        </Button>
      </div>

      {isError && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load the dashboard. Refresh to try again.
        </p>
      )}
      {isPending && <DashboardSkeleton />}
      {data && <DashboardBody data={data} />}
    </div>
  );
}

function DashboardBody({ data }: { data: Dashboard }) {
  const { staffing, labor } = data;
  const change = labor.lastWeek.cost
    ? ((labor.week.cost - labor.lastWeek.cost) / labor.lastWeek.cost) * 100
    : null;

  return (
    <>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="On shift now"
          value={`${staffing.onNow}`}
          detail={`of ${staffing.scheduled} scheduled today`}
        />
        <Tile
          label="Today's labour"
          value={formatMoney(staffing.cost)}
          detail={`${+staffing.hours.toFixed(1)} scheduled hours`}
        />
        <BudgetTile cost={labor.week.cost} budget={labor.weeklyBudget} />
        <Tile
          label="vs last week"
          value={change === null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`}
          detail={`${formatMoney(labor.lastWeek.cost)} last week`}
        />
      </dl>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <TodayTimeline data={data} />
        <Attention data={data} />
      </div>

      <section className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-medium">Labour cost by day</h2>
            <p className="text-sm text-muted-foreground">
              {formatWeekRange(labor.week.byDay.map((d) => d.date))} · scheduled wages
            </p>
          </div>
          <p className="text-sm tabular-nums">
            <span className="font-semibold">{formatMoney(labor.week.cost)}</span>
            <span className="text-muted-foreground"> · {+labor.week.hours.toFixed(1)}h</span>
          </p>
        </div>
        <LaborChart
          week={labor.week.byDay}
          lastWeek={labor.lastWeek.byDay}
          today={data.date}
        />
      </section>
    </>
  );
}

function Tile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
      <dd className="text-xs text-muted-foreground">{detail}</dd>
    </div>
  );
}

/** Weekly spend against budget. Status colour always comes with a word. */
function BudgetTile({ cost, budget }: { cost: number; budget: number | null }) {
  if (budget === null) {
    return <Tile label="This week" value={formatMoney(cost)} detail="No labour budget set" />;
  }
  const ratio = cost / budget;
  const [status, tone, bar] =
    ratio > 1
      ? ["Over budget", "text-destructive", "bg-destructive"]
      : ratio > 0.9
        ? ["Near budget", "text-amber-700 dark:text-warning", "bg-warning"]
        : ["On budget", "text-success", "bg-success"];

  return (
    <div className="rounded-xl border bg-card p-4">
      <dt className="flex items-center justify-between text-sm text-muted-foreground">
        This week
        <span className={cn("text-xs font-medium", tone)}>{status}</span>
      </dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {formatMoney(cost)}
      </dd>
      <dd className="mt-1.5">
        <div
          role="meter"
          aria-label="Labour budget used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio * 100)}
          aria-valuetext={`${Math.round(ratio * 100)}% of ${formatMoney(budget)} — ${status}`}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {Math.round(ratio * 100)}% of {formatMoney(budget)}
        </p>
      </dd>
    </div>
  );
}

// ─── Today ─────────────────────────────────────────────────────────────

const STATE_LABEL = { on: "On now", upcoming: "Coming in", done: "Finished" } as const;

function nowMinutes(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

function TodayTimeline({ data }: { data: Dashboard }) {
  const shifts = [...data.staffing.shifts].sort(
    (a, b) =>
      ["on", "upcoming", "done"].indexOf(a.state) - ["on", "upcoming", "done"].indexOf(b.state) ||
      a.startMinute - b.startMinute,
  );

  if (shifts.length === 0) {
    return (
      <section className="grid place-items-center rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Nobody is scheduled today.
      </section>
    );
  }

  // The visible day runs from the first start to the last finish, on the hour.
  const from = Math.floor(Math.min(...shifts.map((s) => s.startMinute)) / 60) * 60;
  const to = Math.ceil(Math.max(...shifts.map((s) => s.endMinute)) / 60) * 60;
  const span = to - from;
  const pct = (m: number) => `${((m - from) / span) * 100}%`;
  const now = nowMinutes(data.generatedAt, data.location.timezone);
  const hours = Array.from({ length: span / 60 + 1 }, (_, i) => from + i * 60).filter(
    (_, i, all) => i % Math.ceil(all.length / 7) === 0,
  );

  return (
    <section className="rounded-xl border bg-card">
      <header className="flex items-baseline justify-between border-b px-4 py-3">
        <h2 className="font-medium">Today on the floor</h2>
        <p className="text-sm text-muted-foreground">
          {data.staffing.scheduled} staff · {data.location.name}
        </p>
      </header>

      <div className="grid grid-cols-[9rem_1fr] gap-x-3 px-4 pt-3 text-[11px] text-muted-foreground">
        <span />
        <div className="relative h-4">
          {hours.map((m) => (
            <span key={m} className="absolute -translate-x-1/2" style={{ left: pct(m) }}>
              {shortTime(m)}
            </span>
          ))}
        </div>
      </div>

      <ul className="grid gap-1 px-4 pt-1 pb-4">
        {shifts.map((s) => (
          <li key={s.id} className="grid grid-cols-[9rem_1fr] items-center gap-x-3">
            <div className="min-w-0">
              <p className={cn("truncate text-sm font-medium", s.state === "done" && "text-muted-foreground")}>
                {s.employee ? `${s.employee.firstName} ${s.employee.lastName[0]}.` : "Open shift"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {s.position?.name} · {STATE_LABEL[s.state]}
              </p>
            </div>
            <div className="relative h-7 rounded-md bg-muted/50">
              {now > from && now < to && (
                <span
                  aria-hidden
                  className="absolute inset-y-[-2px] z-10 w-0.5 rounded-full bg-foreground/70"
                  style={{ left: pct(now) }}
                />
              )}
              <span
                className={cn(
                  "absolute inset-y-1 flex items-center overflow-hidden rounded px-2 text-[11px] font-medium whitespace-nowrap",
                  s.state === "done" && "opacity-45",
                  !s.employee && "border border-dashed border-brand/60",
                )}
                style={{
                  left: pct(s.startMinute),
                  width: pct(from + (s.endMinute - s.startMinute)),
                  backgroundColor: `${s.position?.color ?? "#a3a3a3"}33`,
                  boxShadow: `inset 3px 0 0 ${s.position?.color ?? "#a3a3a3"}`,
                }}
                title={`${shiftRange(s)} · ${s.paidHours}h`}
              >
                {shiftRange(s)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Needs attention ───────────────────────────────────────────────────

interface Item {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "error" | "warning" | "info";
  title: string;
  detail?: string;
  href: string;
}

function weekItems(week: WeekStatus, label: string): Item[] {
  const items: Item[] = [];
  const range = formatWeekRange(Array.from({ length: 7 }, (_, i) => addDays(week.weekStart, i)));
  const href = `/schedule?week=${week.weekStart}`;
  if (week.errors) {
    items.push({
      key: `${week.weekStart}-errors`,
      icon: CircleAlert,
      tone: "error",
      title: `${week.errors} scheduling conflict${week.errors > 1 ? "s" : ""} ${label}`,
      detail: "Must be fixed before publishing",
      href,
    });
  }
  if (!week.status) {
    items.push({ key: `${week.weekStart}-none`, icon: CalendarRange, tone: "warning", title: `${label[0].toUpperCase()}${label.slice(1)}'s schedule isn't started`, detail: range, href });
  } else if (week.status === "DRAFT") {
    items.push({ key: `${week.weekStart}-draft`, icon: CalendarRange, tone: "warning", title: `Publish ${label}'s schedule`, detail: `${range} · draft · ${week.warnings} warning${week.warnings === 1 ? "" : "s"}`, href });
  } else if (week.hasUnpublishedChanges) {
    items.push({ key: `${week.weekStart}-changes`, icon: CalendarRange, tone: "warning", title: `Republish ${label}'s schedule`, detail: "Staff can't see your latest changes", href });
  }
  return items;
}

function Attention({ data }: { data: Dashboard }) {
  const [thisWeek, nextWeek] = data.weeks;
  const items: Item[] = [
    ...weekItems(thisWeek, "this week"),
    ...weekItems(nextWeek, "next week"),
  ];

  if (data.pendingTimeOff.count) {
    const first = data.pendingTimeOff.next[0];
    items.push({
      key: "time-off",
      icon: Plane,
      tone: "info",
      title: `${data.pendingTimeOff.count} time-off request${data.pendingTimeOff.count > 1 ? "s" : ""} to review`,
      detail: first && `Next: ${first.employee.firstName}, ${formatDateOnly(first.startDate)}`,
      href: "/time-off",
    });
  }
  if (data.openShiftsNext7Days) {
    items.push({
      key: "open",
      icon: UserPlus,
      tone: "info",
      title: `${data.openShiftsNext7Days} open shift${data.openShiftsNext7Days > 1 ? "s" : ""} in the next 7 days`,
      detail: "Staff can pick these up once published",
      href: "/schedule",
    });
  }
  for (const cert of data.certifications) {
    items.push({
      key: cert.id,
      icon: BadgeAlert,
      tone: cert.expired ? "error" : "warning",
      title: `${cert.employee.firstName}'s ${cert.name} ${cert.expired ? "has expired" : "expires soon"}`,
      detail: `${cert.expired ? "Expired" : "Expires"} ${formatDateOnly(cert.expiresAt)}`,
      href: `/employees/${cert.employee.id}`,
    });
  }

  const order = { error: 0, warning: 1, info: 2 };
  items.sort((a, b) => order[a.tone] - order[b.tone]);

  return (
    <section className="h-fit rounded-xl border bg-card">
      <header className="flex items-baseline justify-between border-b px-4 py-3">
        <h2 className="font-medium">Needs attention</h2>
        <span className="text-sm text-muted-foreground">{items.length}</span>
      </header>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-8 text-sm text-success">
          <CheckCircle2 className="size-4" /> All clear — nothing needs you right now.
        </p>
      ) : (
        <ul className="divide-y">
          {items.map(({ key, icon: Icon, tone, title, detail, href }) => (
            <li key={key}>
              <Link
                href={href}
                className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <Icon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    tone === "error"
                      ? "text-destructive"
                      : tone === "warning"
                        ? "text-amber-600 dark:text-warning"
                        : "text-muted-foreground",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{title}</span>
                  {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
                </span>
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
