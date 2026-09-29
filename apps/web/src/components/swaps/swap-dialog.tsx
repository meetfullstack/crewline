"use client";

import { cn } from "cn";
import { AlertTriangle, CircleAlert, Loader2, Repeat, UserCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { type MyShift, useRequestSwap, useSwapCandidates } from "@/hooks/use-portal";
import { ApiError } from "@/lib/api";
import { asSecondPerson, formatDay, shiftRange } from "@/lib/schedule";

/** Ask a coworker to cover one of my shifts, or trade it for one of theirs. */
export function SwapDialog({
  shift,
  onClose,
}: {
  shift: MyShift | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={shift !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {shift && <SwapForm key={shift.id} shift={shift} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function SwapForm({ shift, onClose }: { shift: MyShift; onClose: () => void }) {
  const { data: candidates, isPending } = useSwapCandidates(shift.id);
  const request = useRequestSwap();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [tradeShiftId, setTradeShiftId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const target = candidates?.find((c) => c.id === targetId);

  const send = async () => {
    if (!target) return;
    try {
      await request.mutateAsync({
        shiftId: shift.id,
        targetEmployeeId: target.id,
        targetShiftId: tradeShiftId ?? undefined,
        message: message.trim() || undefined,
      });
      toast.success(`Request sent to ${target.firstName}`);
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't send request");
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Swap a shift</DialogTitle>
        <DialogDescription>
          {formatDay(shift.date, "long")} · {shiftRange(shift)} · {shift.position.name}
        </DialogDescription>
      </DialogHeader>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Who should take it?</legend>
        {isPending && <Skeleton className="h-32" />}
        {candidates?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nobody else at this location is trained as {shift.position.name}.
          </p>
        )}
        {candidates?.map((c) => {
          const selected = c.id === targetId;
          const blocked = !c.canCover && c.tradeShifts.length === 0;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={selected}
              disabled={blocked}
              onClick={() => {
                setTargetId(c.id);
                setTradeShiftId(null);
              }}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                selected ? "border-foreground/40 bg-accent" : "hover:bg-muted/50",
                blocked && "cursor-not-allowed opacity-50",
              )}
            >
              <UserCheck className={cn("mt-0.5 size-4", c.canCover ? "text-success" : "text-muted-foreground")} />
              <span className="flex-1">
                <span className="block text-sm font-medium">
                  {c.firstName} {c.lastName}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {c.canCover
                    ? "Free to cover"
                    : c.tradeShifts.length
                      ? "Busy then — but could trade"
                      : "Not available"}
                  {c.tradeShifts.length > 0 && ` · ${c.tradeShifts.length} shift${c.tradeShifts.length > 1 ? "s" : ""} to trade`}
                </span>
                {c.coverConflicts.length > 0 && (
                  <span className="mt-1 block text-xs text-amber-700 dark:text-warning">
                    {c.coverConflicts[0].message}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </fieldset>

      {target && (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">What kind of swap?</legend>
          <label
            className={cn(
              "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
              !target.canCover && "opacity-50",
            )}
          >
            <input
              type="radio"
              name="swap-kind"
              checked={tradeShiftId === null}
              disabled={!target.canCover}
              onChange={() => setTradeShiftId(null)}
            />
            <span>
              <span className="font-medium">{target.firstName} covers my shift</span>
              <span className="block text-xs text-muted-foreground">You give it away</span>
            </span>
          </label>
          {target.tradeShifts.map((s) => (
            <label key={s.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
              <input
                type="radio"
                name="swap-kind"
                checked={tradeShiftId === s.id}
                onChange={() => setTradeShiftId(s.id)}
              />
              <span className="flex items-center gap-2">
                <Repeat className="size-4 text-muted-foreground" />
                <span>
                  <span className="font-medium">Trade for {formatDay(s.date)} {shiftRange(s)}</span>
                  <span className="block text-xs text-muted-foreground">{s.position.name}</span>
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {target && (
        <div className="grid gap-1.5">
          <Label htmlFor="swap-message">
            Message <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="swap-message"
            rows={2}
            maxLength={300}
            placeholder={`Hi ${target.firstName}, could you…`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {target.firstName} accepts first, then a manager approves. The schedule
            only changes once it&apos;s approved.
          </p>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!target || (tradeShiftId === null && !target.canCover) || request.isPending}
          onClick={send}
        >
          {request.isPending && <Loader2 className="animate-spin" />}
          Send request
        </Button>
      </DialogFooter>
    </>
  );
}

/** Conflict list used on swap cards (manager impact, coworker preview). */
export function ConflictLines({
  conflicts,
  perspective = "third",
}: {
  conflicts: { code: string; severity: "error" | "warning"; message: string }[];
  perspective?: "second" | "third";
}) {
  if (!conflicts.length) return null;
  return (
    <ul className="grid gap-1">
      {conflicts.map((c) => (
        <li
          key={c.code}
          className={cn(
            "flex items-center gap-1.5 text-xs",
            c.severity === "error" ? "text-destructive" : "text-amber-700 dark:text-warning",
          )}
        >
          {c.severity === "error" ? <CircleAlert className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
          {perspective === "second" ? asSecondPerson(c.message) : c.message}
        </li>
      ))}
    </ul>
  );
}
