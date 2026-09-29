"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { type MyShift, useMyShifts } from "@/hooks/use-portal";
import { formatMoney } from "@/lib/format";
import { addDays, dayOfWeek, formatWeekRange } from "@/lib/schedule";
import { ShiftRow } from "./shift-row";

/** Monday of the week a local date falls in. */
const mondayOf = (date: string) => addDays(date, -((dayOfWeek(date) + 6) % 7));

export function MyShifts() {
  const { data: shifts, isPending, isError } = useMyShifts();
  const [now] = useState(() => Date.now());

  const weeks = new Map<string, MyShift[]>();
  for (const shift of shifts ?? []) {
    const key = mondayOf(shift.date);
    weeks.set(key, [...(weeks.get(key) ?? []), shift]);
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My shifts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your published shifts for the next four weeks.
        </p>
      </div>

      {isPending && <Skeleton className="h-64" />}
      {isError && (
        <p className="text-sm text-destructive">Couldn&apos;t load your shifts.</p>
      )}
      {shifts?.length === 0 && (
        <div className="grid place-items-center gap-2 rounded-xl border border-dashed py-14 text-center">
          <CalendarDays className="size-8 text-muted-foreground" />
          <p className="font-medium">No shifts yet</p>
          <p className="text-sm text-muted-foreground">
            They&apos;ll show up here as soon as a schedule is published.
          </p>
        </div>
      )}

      {[...weeks].map(([monday, weekShifts]) => {
        const hours = weekShifts.reduce((sum, s) => sum + s.paidHours, 0);
        const pay = weekShifts.reduce((sum, s) => sum + s.cost, 0);
        return (
          <section key={monday} className="rounded-xl border bg-card">
            <header className="flex items-baseline justify-between border-b px-4 py-3">
              <h2 className="font-medium">
                {formatWeekRange(Array.from({ length: 7 }, (_, i) => addDays(monday, i)))}
              </h2>
              <p className="text-sm text-muted-foreground tabular-nums">
                {+hours.toFixed(1)}h · {formatMoney(pay)}
              </p>
            </header>
            <div className="divide-y">
              {weekShifts.map((s) => (
                <ShiftRow
                  key={s.id}
                  shift={s}
                  muted={new Date(s.endsAt).getTime() < now}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
