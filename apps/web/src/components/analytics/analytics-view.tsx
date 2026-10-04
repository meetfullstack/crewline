"use client";

import { cn } from "cn";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { type Analytics, useAnalytics } from "@/hooks/use-analytics";
import { formatMoney } from "@/lib/format";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const money0 = (n: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
const weekLabel = (start: string) =>
  new Date(`${start}T00:00:00Z`).toLocaleDateString("en-CA", { timeZone: "UTC", month: "short", day: "numeric" });

// Shared chart chrome: hairline solid grid, muted axes, text in text tokens.
const axisTick = { fontSize: 12, fill: "var(--muted-foreground)" };

export function AnalyticsView() {
  const [weeks, setWeeks] = useState(8);
  const { data, isPending, isPlaceholderData } = useAnalytics(weeks);

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Labour analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What you scheduled, what was actually worked and paid, and how attendance went.
          </p>
        </div>
        <Select value={String(weeks)} onValueChange={(v) => setWeeks(Number(v))}>
          <SelectTrigger className="h-9 w-40" aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="4">Last 4 weeks</SelectItem>
            <SelectItem value="8">Last 8 weeks</SelectItem>
            <SelectItem value="12">Last 12 weeks</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isPending || !data ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : (
        <div className={cn("grid gap-6 transition-opacity", isPlaceholderData && "opacity-60")}>
          <Kpis data={data} />
          <WeeklyLabor data={data} />
          <div className="grid gap-6 lg:grid-cols-2">
            <ByWeekday data={data} />
            <ByPosition data={data} />
          </div>
          <TeamTable data={data} />
        </div>
      )}
    </div>
  );
}

function Kpis({ data }: { data: Analytics }) {
  const { totals, attendance, weeklyBudget } = data;
  const coverage = totals.scheduledHours ? (totals.workedHours / totals.scheduledHours) * 100 : 0;
  const tiles: { label: string; value: string; detail: string; tone?: "warn" | "bad" | "good" }[] = [
    {
      label: "Average weekly wages",
      value: money0(totals.averageWeeklyWages),
      detail:
        weeklyBudget === null
          ? "No budget set"
          : `${totals.weeksOverBudget} of ${data.weeks.filter((w) => !w.inProgress).length} weeks over ${money0(weeklyBudget)}`,
      tone: weeklyBudget !== null && totals.averageWeeklyWages > weeklyBudget ? "bad" : undefined,
    },
    {
      label: "Worked vs scheduled",
      value: `${coverage.toFixed(1)}%`,
      detail: `${totals.workedHours.toLocaleString()}h of ${totals.scheduledHours.toLocaleString()}h`,
    },
    {
      label: "Overtime",
      value: `${totals.overtimeHours}h`,
      detail: "Hours past 44 per person per week",
      tone: totals.overtimeHours > 0 ? "warn" : "good",
    },
    {
      label: "Late arrivals",
      value: `${attendance.lateRate}%`,
      detail: `${attendance.late} of ${attendance.shifts} shifts · ${attendance.averageLateMinutes} min on average`,
      tone: attendance.lateRate >= 10 ? "bad" : attendance.lateRate >= 5 ? "warn" : undefined,
    },
    {
      label: "No-shows",
      value: `${attendance.noShowRate}%`,
      detail: `${attendance.noShows} shifts missed`,
      tone: attendance.noShowRate >= 3 ? "bad" : attendance.noShowRate > 0 ? "warn" : "good",
    },
    {
      label: "Left early",
      value: String(attendance.leftEarly),
      detail: "Shifts ended 5+ minutes early",
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border bg-card p-4">
          <dt className="text-sm text-muted-foreground">{t.label}</dt>
          <dd
            className={cn(
              "mt-1 text-2xl font-semibold tracking-tight tabular-nums",
              t.tone === "bad" && "text-destructive",
              t.tone === "warn" && "text-amber-700 dark:text-warning",
              t.tone === "good" && "text-success",
            )}
          >
            {t.value}
          </dd>
          <dd className="text-xs text-muted-foreground">{t.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="font-medium">{title}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{subtitle}</p>
      {children}
    </section>
  );
}

function TooltipBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-foreground shadow-md">{children}</div>;
}

function WeeklyLabor({ data }: { data: Analytics }) {
  const rows = data.weeks.map((w) => ({ ...w, label: weekLabel(w.weekStart) }));
  return (
    <ChartCard
      title="Wages by week"
      subtitle={`Actual wages from clocked time${data.weeklyBudget !== null ? `, against the ${money0(data.weeklyBudget)} weekly budget` : ""}. The current week is still in progress.`}
    >
      <div className="h-64" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
            <YAxis width={56} tickLine={false} axisLine={false} tick={axisTick} tickFormatter={(v: number) => money0(v)} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload }) => {
                const w = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                if (!active || !w) return null;
                return (
                  <TooltipBox>
                    <p className="mb-1 font-medium">
                      Week of {w.label}
                      {w.inProgress && " (in progress)"}
                    </p>
                    <p>Actual {formatMoney(w.actualWages)} · {w.workedHours}h</p>
                    <p className="text-muted-foreground">Scheduled {formatMoney(w.scheduledCost)} · {w.scheduledHours}h</p>
                    {(w.late > 0 || w.noShows > 0) && (
                      <p className="text-muted-foreground">{w.late} late · {w.noShows} no-show</p>
                    )}
                  </TooltipBox>
                );
              }}
            />
            {data.weeklyBudget !== null && (
              <ReferenceLine
                y={data.weeklyBudget}
                stroke="var(--muted-foreground)"
                strokeWidth={1}
                label={{ value: `Budget ${money0(data.weeklyBudget)}`, position: "insideTopRight", fontSize: 11, fill: "var(--muted-foreground)" }}
              />
            )}
            <Bar dataKey="actualWages" radius={[4, 4, 0, 0]} maxBarSize={24}>
              {rows.map((w) => (
                <Cell key={w.weekStart} fill="var(--chart-1)" fillOpacity={w.inProgress ? 0.45 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Wages by week</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col">Actual wages</th>
            <th scope="col">Scheduled cost</th>
            <th scope="col">Worked hours</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w) => (
            <tr key={w.weekStart}>
              <th scope="row">{w.label}{w.inProgress ? " (in progress)" : ""}</th>
              <td>{formatMoney(w.actualWages)}</td>
              <td>{formatMoney(w.scheduledCost)}</td>
              <td>{w.workedHours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ChartCard>
  );
}

function ByWeekday({ data }: { data: Analytics }) {
  const rows = data.byWeekday.map((d) => ({ ...d, label: DAY[d.dayOfWeek] }));
  const busiest = rows.reduce((a, b) => (b.averageCost > a.averageCost ? b : a));
  return (
    <ChartCard title="Average labour by weekday" subtitle={`Scheduled wages per day. ${DAY[busiest.dayOfWeek]} is the costliest.`}>
      <div className="h-56" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 16, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
            <YAxis width={52} tickLine={false} axisLine={false} tick={axisTick} tickFormatter={(v: number) => money0(v)} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                if (!active || !d) return null;
                return (
                  <TooltipBox>
                    <p className="font-medium">{d.label}</p>
                    <p>{formatMoney(d.averageCost)} · {d.averageHours}h on average</p>
                  </TooltipBox>
                );
              }}
            />
            <Bar dataKey="averageCost" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Average scheduled labour by weekday</caption>
        <tbody>
          {rows.map((d) => (
            <tr key={d.dayOfWeek}>
              <th scope="row">{d.label}</th>
              <td>{formatMoney(d.averageCost)}</td>
              <td>{d.averageHours} hours</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ChartCard>
  );
}

function ByPosition({ data }: { data: Analytics }) {
  const total = data.byPosition.reduce((s, p) => s + p.hours, 0) || 1;
  return (
    <ChartCard title="Hours by position" subtitle="Scheduled hours over the period, with each role's share.">
      <div style={{ height: Math.max(160, data.byPosition.length * 34) }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.byPosition} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={88} tickLine={false} axisLine={false} tick={axisTick} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as Analytics["byPosition"][number] | undefined;
                if (!active || !p) return null;
                return (
                  <TooltipBox>
                    <p className="font-medium">{p.name}</p>
                    <p>{p.hours}h · {formatMoney(p.cost)}</p>
                  </TooltipBox>
                );
              }}
            />
            <Bar dataKey="hours" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={20}>
              <LabelList
                dataKey="hours"
                position="right"
                fontSize={12}
                fill="var(--foreground)"
                formatter={(v: unknown) => `${Math.round((Number(v) / total) * 100)}%`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Scheduled hours by position</caption>
        <tbody>
          {data.byPosition.map((p) => (
            <tr key={p.name}>
              <th scope="row">{p.name}</th>
              <td>{p.hours} hours ({Math.round((p.hours / total) * 100)}%)</td>
              <td>{formatMoney(p.cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ChartCard>
  );
}

function TeamTable({ data }: { data: Analytics }) {
  return (
    <section className="overflow-x-auto rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 font-medium">Team</h2>
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">Employee</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Hours worked</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Per week</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Overtime</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Late</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">No-shows</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.team.map((t) => (
            <tr key={t.name}>
              <th scope="row" className="px-4 py-2 text-left font-medium">{t.name}</th>
              <td className="px-3 py-2 text-right tabular-nums">{t.hours}h</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{t.avgWeeklyHours}h</td>
              <td className={cn("px-3 py-2 text-right tabular-nums", t.overtimeHours > 0 && "text-amber-700 dark:text-warning")}>
                {t.overtimeHours ? `${t.overtimeHours}h` : "—"}
              </td>
              <td className={cn("px-3 py-2 text-right tabular-nums", t.late >= 3 && "text-amber-700 dark:text-warning")}>{t.late || "—"}</td>
              <td className={cn("px-4 py-2 text-right tabular-nums", t.noShows > 0 && "text-destructive")}>{t.noShows || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}