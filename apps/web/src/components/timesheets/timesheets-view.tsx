"use client";

import { cn } from "cn";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type Attendance,
  type TimeEntry,
  type TimesheetRow,
  useTimesheet,
} from "@/hooks/use-attendance";
import { useLocations } from "@/hooks/use-employees";
import { formatMoney } from "@/lib/format";
import { addDays, formatDay, formatWeekRange, shiftRange, shortTime } from "@/lib/schedule";
import { EntryDialog, type EntryDialogTarget } from "./entry-dialog";

const hours = (n: number) => `${n.toFixed(1)}h`;
const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}h`;

export function TimesheetsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const week = params.get("week") ?? undefined;
  const { data: locations } = useLocations();
  const locationId = locations?.[0]?.id;
  const { data, isPending, isPlaceholderData } = useTimesheet(locationId, week);
  const [open, setOpen] = useState<string | null>(null);
  const [dialog, setDialog] = useState<EntryDialogTarget | null>(null);

  const go = (weekStart: string | null) => {
    const next = new URLSearchParams(params);
    if (weekStart) next.set("week", weekStart);
    else next.delete("week");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold tracking-tight">Timesheets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clocked hours against the published schedule. Edits are logged with a reason.
          </p>
        </div>
        <div className="flex items-center rounded-lg border bg-card">
          <Button variant="ghost" size="icon" aria-label="Previous week" disabled={!data} onClick={() => data && go(addDays(data.weekStart, -7))}>
            <ChevronLeft />
          </Button>
          <span className="min-w-40 px-1 text-center text-sm font-medium tabular-nums">
            {data ? formatWeekRange(data.days) : "…"}
          </span>
          <Button variant="ghost" size="icon" aria-label="Next week" disabled={!data} onClick={() => data && go(addDays(data.weekStart, 7))}>
            <ChevronRight />
          </Button>
        </div>
        <Button variant="outline" onClick={() => go(null)} disabled={!week}>
          This week
        </Button>
      </div>

      {isPending || !data ? (
        <div className="grid gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <div className={cn("grid gap-5 transition-opacity", isPlaceholderData && "opacity-60")}>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Worked" value={hours(data.totals.workedHours)} detail={`of ${hours(data.totals.scheduledHours)} scheduled`} />
            <Tile
              label="Variance"
              value={signed(data.totals.varianceHours)}
              detail="Finished shifts vs schedule"
              tone={Math.abs(data.totals.varianceHours) >= 1 ? (data.totals.varianceHours > 0 ? "warn" : "muted") : undefined}
            />
            <Tile label="Wages from clocked time" value={formatMoney(data.totals.wages)} detail="Before tax and tips" />
            <Tile
              label="Attendance issues"
              value={String(data.totals.late + data.totals.noShows + data.totals.missingClockOuts)}
              detail={`${data.totals.late} late · ${data.totals.noShows} no-show · ${data.totals.missingClockOuts} no clock-out`}
              tone={data.totals.noShows || data.totals.missingClockOuts ? "bad" : data.totals.late ? "warn" : undefined}
            />
          </dl>

          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Employee</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Scheduled</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Worked</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Variance</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Flags</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Wages</th>
                  <th scope="col" className="w-10 px-3 py-2.5"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.rows.map((row) => {
                  const expanded = open === row.employee.id;
                  return (
                    <Fragment key={row.employee.id}>
                      <tr className="hover:bg-muted/30">
                        <th scope="row" className="px-4 py-2.5 text-left font-medium">
                          {row.employee.firstName} {row.employee.lastName}
                        </th>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{hours(row.totals.scheduledHours)}</td>
                        <td className="px-3 py-2.5 text-right font-medium tabular-nums">{hours(row.totals.workedHours)}</td>
                        <td className={cn("px-3 py-2.5 text-right tabular-nums", row.totals.varianceHours <= -1 && "text-destructive", row.totals.varianceHours >= 1 && "text-amber-700 dark:text-warning")}>
                          {signed(row.totals.varianceHours)}
                        </td>
                        <td className="px-3 py-2.5">
                          <Flags totals={row.totals} />
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(row.totals.wages)}</td>
                        <td className="px-3 py-2.5">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-expanded={expanded}
                            aria-label={`${expanded ? "Hide" : "Show"} ${row.employee.firstName}'s days`}
                            onClick={() => setOpen(expanded ? null : row.employee.id)}
                          >
                            <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} />
                          </Button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={7} className="bg-muted/20 px-4 py-3">
                            <DayDetail
                              row={row}
                              days={data.days}
                              onEdit={(entry) => setDialog({ mode: "edit", entry, employee: row.employee })}
                              onAdd={(date) => setDialog({ mode: "create", date, employee: row.employee })}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {data.rows.length === 0 && (
              <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                No published shifts or clocked time this week.
              </p>
            )}
          </div>
        </div>
      )}

      {data && (
        <EntryDialog
          target={dialog}
          locationId={data.location.id}
          days={data.days}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function Tile({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: "warn" | "bad" | "muted" }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 text-2xl font-semibold tracking-tight tabular-nums",
          tone === "bad" && "text-destructive",
          tone === "warn" && "text-amber-700 dark:text-warning",
        )}
      >
        {value}
      </dd>
      <dd className="text-xs text-muted-foreground">{detail}</dd>
    </div>
  );
}

function Flags({ totals }: { totals: TimesheetRow["totals"] }) {
  const flags: [string, "bad" | "warn" | "info"][] = [];
  if (totals.noShows) flags.push([`${totals.noShows} no-show`, "bad"]);
  if (totals.missingClockOuts) flags.push([`${totals.missingClockOuts} no clock-out`, "bad"]);
  if (totals.late) flags.push([`${totals.late} late`, "warn"]);
  if (totals.leftEarly) flags.push([`${totals.leftEarly} left early`, "warn"]);
  if (totals.unscheduled) flags.push([`${totals.unscheduled} unscheduled`, "info"]);
  if (!flags.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map(([label, tone]) => (
        <span
          key={label}
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
            tone === "bad" && "bg-destructive/10 text-destructive ring-destructive/25",
            tone === "warn" && "bg-warning/15 text-amber-700 ring-warning/30 dark:text-warning",
            tone === "info" && "bg-muted text-muted-foreground ring-border",
          )}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

const STATUS_TEXT: Record<Attendance["status"], string> = {
  UPCOMING: "Upcoming",
  NOT_IN: "Not clocked in",
  WORKING: "Working now",
  COMPLETED: "Completed",
  MISSING_CLOCK_OUT: "No clock-out",
  NO_SHOW: "No-show",
};

function DayDetail({
  row,
  days,
  onEdit,
  onAdd,
}: {
  row: TimesheetRow;
  days: string[];
  onEdit: (entry: TimeEntry) => void;
  onAdd: (date: string) => void;
}) {
  const [today] = useState(() => new Date().toLocaleDateString("en-CA"));
  return (
    <ul className="grid gap-2">
      {days.map((date) => {
        const shifts = row.shifts.filter((s) => s.date === date);
        const entries = row.entries.filter((e) => e.date === date);
        if (!shifts.length && !entries.length) return null;
        return (
          <li key={date} className="grid gap-1.5 rounded-lg border bg-card px-3 py-2 sm:grid-cols-[7rem_1fr_auto] sm:items-start">
            <span className="text-sm font-medium">{formatDay(date)}</span>
            <div className="grid gap-1 text-sm">
              {shifts.map((s) => (
                <p key={s.id} className="flex flex-wrap items-center gap-x-2">
                  <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: s.position.color }} />
                  <span className="text-muted-foreground">Scheduled {shiftRange(s)}</span>
                  <AttendanceChip attendance={s.attendance} />
                </p>
              ))}
              {entries.map((e) => (
                <p key={e.id} className="flex flex-wrap items-center gap-x-2">
                  <Clock className="size-3.5 text-muted-foreground" />
                  <span className="tabular-nums">
                    {shortTime(e.clockInMinute)} – {e.clockOutMinute === null ? "still in" : shortTime(e.clockOutMinute)}
                  </span>
                  <span className="text-muted-foreground">
                    · {(e.workedMinutes / 60).toFixed(2)}h{e.breakMinutes ? ` · ${e.breakMinutes}m break` : ""}
                    {!e.shiftId && " · unscheduled"}
                  </span>
                  {e.edited && (
                    <span className="text-xs text-muted-foreground" title={e.edited.reason ?? undefined}>
                      · edited{e.edited.by ? ` by ${e.edited.by}` : ""}: “{e.edited.reason}”
                    </span>
                  )}
                  <Button variant="ghost" size="icon-xs" aria-label="Edit time entry" onClick={() => onEdit(e)}>
                    <Pencil />
                  </Button>
                </p>
              ))}
            </div>
            {date <= today && (
              <Button variant="ghost" size="sm" className="justify-self-start text-muted-foreground" onClick={() => onAdd(date)}>
                <Plus /> Add time
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AttendanceChip({ attendance: a }: { attendance: Attendance }) {
  const parts = [STATUS_TEXT[a.status]];
  if (a.lateMinutes) parts.push(`${a.lateMinutes}m late`);
  if (a.leftEarlyMinutes) parts.push(`left ${a.leftEarlyMinutes}m early`);
  const tone =
    a.status === "NO_SHOW" || a.status === "MISSING_CLOCK_OUT" || a.status === "NOT_IN"
      ? "bad"
      : a.lateMinutes || a.leftEarlyMinutes
        ? "warn"
        : a.status === "COMPLETED" || a.status === "WORKING"
          ? "good"
          : "info";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tone === "bad" && "bg-destructive/10 text-destructive ring-destructive/25",
        tone === "warn" && "bg-warning/15 text-amber-700 ring-warning/30 dark:text-warning",
        tone === "good" && "bg-success/12 text-success ring-success/25",
        tone === "info" && "bg-muted text-muted-foreground ring-border",
      )}
    >
      {parts.join(" · ")}
    </span>
  );
}
