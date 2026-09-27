"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Loader2,
  Trash2,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  checkShift,
  useCreateShift,
  useDeleteShift,
  useUpdateShift,
} from "@/hooks/use-schedule";
import { ApiError } from "@/lib/api";
import {
  formatDay,
  type LocalDate,
  type Shift,
  type ShiftInput,
  shortTime,
  type WeekSchedule,
} from "@/lib/schedule";

const OPEN = "open";
const STEP = 15;
const MAX_LENGTH = 16 * 60;
const BREAKS = [0, 15, 30, 45, 60];

export type ShiftDialogTarget =
  | { mode: "create"; employeeId: string | null; date: LocalDate }
  | { mode: "edit"; shift: Shift };

interface Props {
  week: WeekSchedule;
  target: ShiftDialogTarget | null;
  onClose: () => void;
}

export function ShiftDialog({ week, target, onClose }: Props) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {/* Keyed so each opening starts from that shift's values. */}
        {target && (
          <ShiftForm
            key={target.mode === "edit" ? target.shift.id : `${target.employeeId}-${target.date}`}
            week={week}
            target={target}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function initialValues(week: WeekSchedule, target: ShiftDialogTarget): ShiftInput {
  if (target.mode === "edit") {
    const { shift } = target;
    return {
      locationId: shift.locationId,
      positionId: shift.positionId,
      employeeId: shift.employeeId,
      date: shift.date,
      startMinute: shift.startMinute,
      endMinute: shift.endMinute,
      breakMinutes: shift.breakMinutes,
      notes: shift.notes,
    };
  }
  const employee = week.employees.find((e) => e.id === target.employeeId);
  const positionId =
    employee?.positions.find((p) => p.isPrimary)?.id ??
    employee?.positions[0]?.id ??
    week.positions[0]?.id ??
    "";
  return {
    locationId: week.location.id,
    positionId,
    employeeId: target.employeeId,
    date: target.date,
    startMinute: 17 * 60,
    endMinute: 23 * 60,
    breakMinutes: 30,
    notes: null,
  };
}

function ShiftForm({
  week,
  target,
  onClose,
}: {
  week: WeekSchedule;
  target: ShiftDialogTarget;
  onClose: () => void;
}) {
  const [values, setValues] = useState(() => initialValues(week, target));
  const create = useCreateShift();
  const update = useUpdateShift();
  const remove = useDeleteShift();
  const editing = target.mode === "edit" ? target.shift : null;
  const saving = create.isPending || update.isPending;

  const set = (change: Partial<ShiftInput>) =>
    setValues((v) => ({ ...v, ...change }));

  // Ask the rules engine about the shift as it's being edited.
  const checkInput = useDebouncedValue(values, 300);
  const check = useQuery({
    queryKey: ["shift-check", editing?.id, checkInput],
    queryFn: () => checkShift({ ...checkInput, shiftId: editing?.id }),
    enabled: Boolean(checkInput.employeeId && checkInput.positionId),
    staleTime: 0,
  });
  const conflicts = values.employeeId ? (check.data ?? []) : [];
  const checking = values.employeeId !== null && (check.isFetching || checkInput !== values);

  const employeeName = (id: string | null) => {
    const e = week.employees.find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : "Open shift";
  };
  const qualified = (employeeId: string | null) =>
    employeeId === null ||
    Boolean(
      week.employees
        .find((e) => e.id === employeeId)
        ?.positions.some((p) => p.id === values.positionId),
    );

  const onEmployeeChange = (value: string) => {
    const employeeId = value === OPEN ? null : value;
    const employee = week.employees.find((e) => e.id === employeeId);
    // Switch to their main position if they can't work the current one.
    const keepsPosition = employee?.positions.some((p) => p.id === values.positionId);
    set({
      employeeId,
      positionId:
        employee && !keepsPosition
          ? (employee.positions.find((p) => p.isPrimary) ?? employee.positions[0])?.id ?? values.positionId
          : values.positionId,
    });
  };

  const onStartChange = (startMinute: number) => {
    const length = values.endMinute - values.startMinute;
    set({ startMinute, endMinute: startMinute + length });
  };

  const paid = (values.endMinute - values.startMinute - values.breakMinutes) / 60;
  const rate = week.employees.find((e) => e.id === values.employeeId)?.hourlyRate ?? 0;

  const save = async () => {
    try {
      const saved = editing
        ? await update.mutateAsync({ id: editing.id, ...values })
        : await create.mutateAsync(values);
      const errors = saved.conflicts.filter((c) => c.severity === "error").length;
      if (errors) toast.warning("Shift saved with a conflict to resolve");
      else toast.success(editing ? "Shift updated" : "Shift added");
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save shift");
    }
  };

  const onDelete = async () => {
    if (!editing) return;
    try {
      await remove.mutateAsync(editing.id);
      toast.success("Shift deleted");
      onClose();
    } catch {
      toast.error("Couldn't delete shift");
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit shift" : "Add shift"}</DialogTitle>
        <DialogDescription>
          {employeeName(values.employeeId)} · {formatDay(values.date, "long")}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Employee" id="shift-employee">
            <Select value={values.employeeId ?? OPEN} onValueChange={onEmployeeChange}>
              <SelectTrigger id="shift-employee" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value={OPEN}>Open shift (unassigned)</SelectItem>
                <SelectSeparator />
                {week.employees
                  .filter((e) => e.status !== "TERMINATED")
                  .map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.firstName} {e.lastName}
                      {!qualified(e.id) && (
                        <span className="text-muted-foreground"> · other role</span>
                      )}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Position" id="shift-position">
            <Select value={values.positionId} onValueChange={(positionId) => set({ positionId })}>
              <SelectTrigger id="shift-position" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {week.positions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Day" id="shift-day">
            <Select value={values.date} onValueChange={(date) => set({ date })}>
              <SelectTrigger id="shift-day" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {week.days.map((d) => (
                  <SelectItem key={d} value={d}>
                    {formatDay(d, "long")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Unpaid break" id="shift-break">
            <Select
              value={String(values.breakMinutes)}
              onValueChange={(v) => set({ breakMinutes: Number(v) })}
            >
              <SelectTrigger id="shift-break" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BREAKS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m === 0 ? "No break" : `${m} min`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Starts" id="shift-start">
            <Select
              value={String(values.startMinute)}
              onValueChange={(v) => onStartChange(Number(v))}
            >
              <SelectTrigger id="shift-start" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {Array.from({ length: 1440 / STEP }, (_, i) => i * STEP).map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {clock(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Ends" id="shift-end">
            <Select
              value={String(values.endMinute)}
              onValueChange={(v) => set({ endMinute: Number(v) })}
            >
              <SelectTrigger id="shift-end" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {Array.from(
                  { length: MAX_LENGTH / STEP },
                  (_, i) => values.startMinute + (i + 1) * STEP,
                ).map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {clock(m)}
                    <span className="text-muted-foreground">
                      {" "}
                      ({duration(m - values.startMinute)}
                      {m >= 1440 ? ", next day" : ""})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Notes" id="shift-notes">
          <Textarea
            id="shift-notes"
            rows={2}
            maxLength={500}
            placeholder="e.g. Patio section, training Leo"
            value={values.notes ?? ""}
            onChange={(e) => set({ notes: e.target.value || null })}
          />
        </Field>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            {shortTime(values.startMinute)} – {shortTime(values.endMinute)} ·{" "}
            {+paid.toFixed(2)} paid hours
          </span>
          {values.employeeId && (
            <span className="font-medium tabular-nums">
              {new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(paid * rate)}
            </span>
          )}
        </div>

        <ConflictList
          employeeSelected={values.employeeId !== null}
          checking={checking}
          conflicts={conflicts}
        />
      </div>

      <DialogFooter className="sm:justify-between">
        {editing ? (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={remove.isPending}
          >
            <Trash2 /> Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !values.positionId}>
            {saving && <Loader2 className="animate-spin" />}
            {editing ? "Save shift" : "Add shift"}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

function ConflictList({
  employeeSelected,
  checking,
  conflicts,
}: {
  employeeSelected: boolean;
  checking: boolean;
  conflicts: { code: string; severity: "error" | "warning"; message: string }[];
}) {
  if (!employeeSelected) {
    return (
      <p className="text-sm text-muted-foreground">
        Open shifts show up for qualified staff to pick up once the week is
        published.
      </p>
    );
  }
  if (checking && conflicts.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Checking availability…
      </p>
    );
  }
  if (conflicts.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-success">
        <CheckCircle2 className="size-4" /> No conflicts
      </p>
    );
  }
  return (
    <ul aria-live="polite" className={cn("grid gap-1.5", checking && "opacity-60")}>
      {conflicts.map((c) => (
        <li
          key={c.code}
          className={cn(
            "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
            c.severity === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-warning/15 text-amber-800 dark:text-warning",
          )}
        >
          {c.severity === "error" ? (
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          )}
          {c.message}
        </li>
      ))}
    </ul>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function clock(minutes: number) {
  const m = minutes % 1440;
  const h24 = Math.floor(m / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m % 60).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

function duration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}
