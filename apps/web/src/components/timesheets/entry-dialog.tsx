"use client";

import { Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type TimeEntry, useCreateEntry, useEditEntry } from "@/hooks/use-attendance";
import { ApiError } from "@/lib/api";
import { formatDay } from "@/lib/schedule";

type Person = { id: string; firstName: string; lastName: string };

export type EntryDialogTarget =
  | { mode: "create"; date: string; employee: Person }
  | { mode: "edit"; entry: TimeEntry; employee: Person };

const BREAKS = [0, 15, 30, 45, 60];
const toClock = (m: number) =>
  `${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fromClock = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};

export function EntryDialog({
  target,
  locationId,
  days,
  onClose,
}: {
  target: EntryDialogTarget | null;
  locationId: string;
  days: string[];
  onClose: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {target && (
          <EntryForm
            key={target.mode === "edit" ? target.entry.id : `${target.employee.id}-${target.date}`}
            target={target}
            locationId={locationId}
            days={days}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EntryForm({
  target,
  locationId,
  days,
  onClose,
}: {
  target: EntryDialogTarget;
  locationId: string;
  days: string[];
  onClose: () => void;
}) {
  const create = useCreateEntry();
  const edit = useEditEntry();
  const entry = target.mode === "edit" ? target.entry : null;
  const [date, setDate] = useState(entry?.date ?? (target.mode === "create" ? target.date : days[0]));
  const [clockIn, setClockIn] = useState(toClock(entry?.clockInMinute ?? 17 * 60));
  const [clockOut, setClockOut] = useState(toClock(entry?.clockOutMinute ?? 23 * 60));
  const [breakMinutes, setBreakMinutes] = useState(
    // Round recorded breaks to the nearest option.
    BREAKS.reduce((best, b) => (Math.abs(b - (entry?.breakMinutes ?? 30)) < Math.abs(best - (entry?.breakMinutes ?? 30)) ? b : best)),
  );
  const [reason, setReason] = useState("");
  const saving = create.isPending || edit.isPending;

  const inMinute = fromClock(clockIn);
  let outMinute = fromClock(clockOut);
  const overnight = outMinute <= inMinute;
  if (overnight) outMinute += 1440;
  const worked = outMinute - inMinute - breakMinutes;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const input = {
      date,
      clockInMinute: inMinute,
      clockOutMinute: outMinute,
      breakMinutes,
      reason: reason.trim(),
    };
    try {
      if (entry) await edit.mutateAsync({ id: entry.id, ...input });
      else await create.mutateAsync({ ...input, employeeId: target.employee.id, locationId });
      toast.success(entry ? "Time entry updated" : "Time entry added");
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save");
    }
  };

  return (
    <form onSubmit={save} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{entry ? "Edit time entry" : "Add time entry"}</DialogTitle>
        <DialogDescription>
          {target.employee.firstName} {target.employee.lastName}. Changes are recorded with your name and reason.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-1.5">
        <Label htmlFor="entry-day">Day</Label>
        <Select value={date} onValueChange={setDate}>
          <SelectTrigger id="entry-day" className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {days.map((d) => (
              <SelectItem key={d} value={d}>
                {formatDay(d, "long")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="entry-in">Clock in</Label>
          <Input id="entry-in" type="time" step={60} required value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="entry-out">Clock out</Label>
          <Input id="entry-out" type="time" step={60} required value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="entry-break">Break</Label>
          <Select value={String(breakMinutes)} onValueChange={(v) => setBreakMinutes(Number(v))}>
            <SelectTrigger id="entry-break" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BREAKS.map((b) => (
                <SelectItem key={b} value={String(b)}>
                  {b ? `${b} min` : "None"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        {overnight && "Clock-out is the next day. "}
        {worked > 0 ? `${(worked / 60).toFixed(2)} paid hours` : "Clock-out must be after clock-in"}
      </p>

      <div className="grid gap-1.5">
        <Label htmlFor="entry-reason">Reason for the change</Label>
        <Textarea
          id="entry-reason"
          rows={2}
          required
          maxLength={300}
          placeholder="e.g. Forgot to clock out — confirmed with the closing manager"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!reason.trim() || worked <= 0 || saving}>
          {saving && <Loader2 className="animate-spin" />}
          {entry ? "Save changes" : "Add entry"}
        </Button>
      </DialogFooter>
    </form>
  );
}
