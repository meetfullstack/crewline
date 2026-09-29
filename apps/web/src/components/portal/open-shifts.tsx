"use client";

import { AlertTriangle, CircleAlert, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useClaimShift, useMyOpenShifts } from "@/hooks/use-portal";
import { ApiError } from "@/lib/api";
import { asSecondPerson, formatDay, shiftRange } from "@/lib/schedule";
import { ShiftRow } from "./shift-row";

export function OpenShifts() {
  const { data: shifts, isPending, isError } = useMyOpenShifts();
  const claim = useClaimShift();

  const pickUp = (id: string, label: string) =>
    claim.mutate(id, {
      onSuccess: () => toast.success(`It's yours — ${label} is on your schedule`),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Couldn't pick up shift"),
    });

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Open shifts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Extra shifts you&apos;re trained for. First to pick one up gets it.
        </p>
      </div>

      {isPending && <Skeleton className="h-48" />}
      {isError && (
        <p className="text-sm text-destructive">Couldn&apos;t load open shifts.</p>
      )}
      {shifts?.length === 0 && (
        <div className="grid place-items-center gap-2 rounded-xl border border-dashed py-14 text-center">
          <Sparkles className="size-8 text-muted-foreground" />
          <p className="font-medium">All shifts are covered</p>
          <p className="text-sm text-muted-foreground">
            Check back later — managers post extra shifts here.
          </p>
        </div>
      )}

      {shifts && shifts.length > 0 && (
        <section className="divide-y rounded-xl border bg-card">
          {shifts.map((shift) => {
            const label = `${formatDay(shift.date)} ${shiftRange(shift)}`;
            const pending = claim.isPending && claim.variables === shift.id;
            return (
              <div key={shift.id}>
                <ShiftRow
                  shift={shift}
                  action={
                    <Button
                      size="sm"
                      disabled={!shift.canClaim || claim.isPending}
                      onClick={() => pickUp(shift.id, label)}
                      aria-label={`Pick up ${label}`}
                    >
                      {pending && <Loader2 className="animate-spin" />}
                      Pick up
                    </Button>
                  }
                />
                {shift.conflicts.length > 0 && (
                  <ul className="grid gap-1 px-4 pb-3 pl-20">
                    {shift.conflicts.map((c) => (
                      <li
                        key={c.code}
                        className={
                          c.severity === "error"
                            ? "flex items-center gap-1.5 text-xs text-destructive"
                            : "flex items-center gap-1.5 text-xs text-amber-700 dark:text-warning"
                        }
                      >
                        {c.severity === "error" ? (
                          <CircleAlert className="size-3.5" />
                        ) : (
                          <AlertTriangle className="size-3.5" />
                        )}
                        {asSecondPerson(c.message)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

