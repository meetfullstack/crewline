"use client";

import { cn } from "cn";
import { Coffee, Loader2, LogIn, LogOut, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useClock, useClockAction } from "@/hooks/use-attendance";
import { ApiError } from "@/lib/api";
import { shiftRange } from "@/lib/schedule";

/** hh:mm:ss since `from`, ticking once a second. */
function useElapsed(from: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!from) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [from]);
  return from ? Math.max(0, now - new Date(from).getTime()) : 0;
}

const hms = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
};

const hm = (minutes: number) =>
  `${Math.floor(minutes / 60)}h ${String(Math.round(minutes % 60)).padStart(2, "0")}m`;

/**
 * The time clock on the staff home screen. Worked time is computed on the
 * server (break-aware); the ticking display is purely cosmetic.
 */
export function ClockCard() {
  const { data: clock, isPending } = useClock();
  const action = useClockAction();
  const entry = clock?.entry ?? null;
  const onBreak = entry?.onBreak ?? false;
  // While working, tick from clock-in minus breaks; on break, tick the break.
  const sinceWorking = useElapsed(entry && !onBreak ? entry.clockInAt : null);
  const sinceBreak = useElapsed(onBreak ? entry?.breakStartedAt ?? null : null);

  if (isPending || !clock) return <Skeleton className="h-36" />;

  const run = (
    kind: "in" | "out" | "break/start" | "break/end",
    success: (s: NonNullable<typeof clock>) => string,
  ) =>
    action.mutate(kind, {
      onSuccess: (state) => toast.success(success(state)),
      onError: (e) => toast.error(e instanceof ApiError ? e.message : "Something went wrong"),
    });

  const workedMs = entry ? Math.max(0, sinceWorking - entry.breakMinutes * 60_000) : 0;
  const busy = action.isPending;
  const shift = clock.shift;

  return (
    <section
      aria-label="Time clock"
      className={cn(
        "rounded-2xl border p-5 transition-colors",
        entry ? (onBreak ? "border-warning/50 bg-warning/5" : "border-success/40 bg-success/5") : "bg-card",
      )}
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">
            {entry ? (onBreak ? "On break" : "Clocked in") : "Not clocked in"}
          </p>
          <p className="mt-0.5 text-3xl font-semibold tracking-tight tabular-nums" aria-live="off">
            {entry ? (onBreak ? hms(sinceBreak) : hms(workedMs)) : "--:--:--"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {entry
              ? entry.unscheduled
                ? "Unscheduled — your manager will see this on the timesheet"
                : shift
                  ? `${shift.position.name} · ${shiftRange(shift)} · ${shift.location.name}`
                  : "Working"
              : shift
                ? `${clock.clockInMatchesShift ? "Your shift" : "Next shift"}: ${shift.position.name} · ${shiftRange(shift)}`
                : "No shift scheduled soon"}
          </p>
        </div>

        <div className="flex gap-2">
          {!entry && (
            <Button
              size="lg"
              className="h-11 px-5"
              disabled={busy}
              onClick={() => {
                if (!clock.clockInMatchesShift && !window.confirm("You don't have a shift starting now. Clock in anyway?")) return;
                run("in", () => "Clocked in — have a good shift");
              }}
            >
              {busy ? <Loader2 className="animate-spin" /> : <LogIn />} Clock in
            </Button>
          )}
          {entry && !onBreak && (
            <>
              <Button variant="outline" size="lg" className="h-11" disabled={busy} onClick={() => run("break/start", () => "Break started")}>
                <Coffee /> Break
              </Button>
              <Button size="lg" className="h-11" disabled={busy} onClick={() => run("out", (s) => `Clocked out — ${hm(s.lastWorkedMinutes ?? 0)} worked`)}>
                {busy ? <Loader2 className="animate-spin" /> : <LogOut />} Clock out
              </Button>
            </>
          )}
          {entry && onBreak && (
            <Button size="lg" className="h-11 px-5" disabled={busy} onClick={() => run("break/end", () => "Welcome back")}>
              {busy ? <Loader2 className="animate-spin" /> : <Play />} End break
            </Button>
          )}
        </div>
      </div>
      {entry && (
        <p className="mt-3 text-xs text-muted-foreground">
          In at {new Date(entry.clockInAt).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
          {entry.breakMinutes > 0 && ` · ${Math.round(entry.breakMinutes)} min on break`}
        </p>
      )}
    </section>
  );
}
