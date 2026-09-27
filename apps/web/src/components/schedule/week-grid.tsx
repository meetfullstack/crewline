"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { cn } from "cn";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { EmployeeAvatar } from "@/components/employees/badges";
import { formatMoney } from "@/lib/format";
import {
  cellId,
  formatDay,
  type LocalDate,
  parseCellId,
  type Shift,
  timeOffOn,
  unavailableOn,
  type WeekEmployee,
  type WeekSchedule,
} from "@/lib/schedule";
import { DraggableShift, ShiftCard } from "./shift-card";

interface WeekGridProps {
  week: WeekSchedule;
  today: LocalDate;
  onMove: (shift: Shift, employeeId: string | null, date: LocalDate) => void;
  onOpenShift: (shift: Shift) => void;
  onAddShift: (employeeId: string | null, date: LocalDate) => void;
}

const COLUMNS = "grid-cols-[13rem_repeat(7,minmax(7.5rem,1fr))_5.5rem]";

export function WeekGrid({
  week,
  today,
  onMove,
  onOpenShift,
  onAddShift,
}: WeekGridProps) {
  const [dragging, setDragging] = useState<Shift | null>(null);
  const sensors = useSensors(
    // A small threshold keeps a plain click free to open the shift.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const positions = useMemo(
    () => new Map(week.positions.map((p) => [p.id, p])),
    [week.positions],
  );

  const { groups, shiftsByCell, hoursByEmployee } = useMemo(() => {
    const shiftsByCell = new Map<string, Shift[]>();
    const hoursByEmployee = new Map<string, number>();
    for (const shift of week.shifts) {
      const key = cellId(shift.employeeId, shift.date);
      shiftsByCell.set(key, [...(shiftsByCell.get(key) ?? []), shift]);
      if (shift.employeeId) {
        hoursByEmployee.set(
          shift.employeeId,
          (hoursByEmployee.get(shift.employeeId) ?? 0) + shift.paidHours,
        );
      }
    }
    // Group staff by their primary position, in position order.
    const groups = week.positions
      .map((position) => ({
        position,
        employees: week.employees.filter(
          (e) =>
            (e.positions.find((p) => p.isPrimary) ?? e.positions[0])?.id ===
            position.id,
        ),
      }))
      .filter((g) => g.employees.length > 0);
    const grouped = new Set(groups.flatMap((g) => g.employees.map((e) => e.id)));
    const unassigned = week.employees.filter((e) => !grouped.has(e.id));
    if (unassigned.length) {
      groups.push({
        position: { id: "none", name: "No position", color: "#a3a3a3" },
        employees: unassigned,
      });
    }
    return { groups, shiftsByCell, hoursByEmployee };
  }, [week]);

  const onDragStart = (event: DragStartEvent) =>
    setDragging((event.active.data.current?.shift as Shift) ?? null);

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const shift = event.active.data.current?.shift as Shift | undefined;
    if (!shift || !event.over) return;
    const target = parseCellId(String(event.over.id));
    if (target.employeeId === shift.employeeId && target.date === shift.date) return;
    onMove(shift, target.employeeId, target.date);
  };

  const renderCell = (employee: WeekEmployee | null, date: LocalDate) => {
    const shifts = shiftsByCell.get(cellId(employee?.id ?? null, date)) ?? [];
    const primary = employee?.positions.find((p) => p.isPrimary)?.id;
    return (
      <DayCell
        key={date}
        id={cellId(employee?.id ?? null, date)}
        employee={employee}
        date={date}
        isToday={date === today}
        onAdd={() => onAddShift(employee?.id ?? null, date)}
      >
        {shifts.map((shift) => (
          <DraggableShift
            key={shift.id}
            shift={shift}
            position={positions.get(shift.positionId)}
            showPosition={!employee || shift.positionId !== primary}
            onClick={() => onOpenShift(shift)}
          />
        ))}
      </DayCell>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="overflow-x-auto rounded-xl border bg-card">
        <div role="table" aria-label="Weekly schedule" className="min-w-[68rem]">
          {/* Header */}
          <div
            role="row"
            className={cn(
              "sticky top-0 z-10 grid border-b bg-muted/60 text-xs backdrop-blur",
              COLUMNS,
            )}
          >
            <div role="columnheader" className="px-3 py-2.5 font-medium text-muted-foreground">
              Team
            </div>
            {week.days.map((date) => (
              <div
                key={date}
                role="columnheader"
                className={cn(
                  "border-l px-2 py-2.5 text-center font-medium",
                  date === today && "text-brand",
                )}
              >
                {formatDay(date)}
              </div>
            ))}
            <div role="columnheader" className="border-l px-2 py-2.5 text-right font-medium text-muted-foreground">
              Hours
            </div>
          </div>

          {/* Open shifts */}
          <div role="row" className={cn("grid border-b bg-brand-soft/40", COLUMNS)}>
            <div role="rowheader" className="flex items-center gap-2 px-3 py-2">
              <span className="grid size-8 place-items-center rounded-full border border-dashed border-brand/50 text-brand">
                <Plus className="size-4" />
              </span>
              <div>
                <div className="text-sm font-medium">Open shifts</div>
                <div className="text-xs text-muted-foreground">
                  {week.summary.openShifts} unassigned
                </div>
              </div>
            </div>
            {week.days.map((date) => renderCell(null, date))}
            <div role="cell" className="border-l" />
          </div>

          {groups.map(({ position, employees }) => (
            <div key={position.id} role="rowgroup">
              <div
                role="row"
                className="border-b bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground"
              >
                <span role="rowheader" className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ backgroundColor: position.color }}
                />
                {position.name}
                <span className="font-normal">· {employees.length}</span>
                </span>
              </div>
              {employees.map((employee) => {
                const hours = hoursByEmployee.get(employee.id) ?? 0;
                const max = employee.maxWeeklyHours;
                const over = max !== null && hours > max;
                return (
                  <div
                    key={employee.id}
                    role="row"
                    className={cn("grid border-b last:border-b-0", COLUMNS)}
                  >
                    <div role="rowheader" className="flex min-w-0 items-center gap-2 px-3 py-2">
                      <EmployeeAvatar
                        employee={{
                          ...employee,
                          positions: [{ ...position, isPrimary: true }],
                        }}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {employee.firstName} {employee.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatMoney(employee.hourlyRate)}/hr
                          {employee.status !== "ACTIVE" && (
                            <span className="ml-1 text-amber-600">
                              · {employee.status === "ON_LEAVE" ? "On leave" : "Terminated"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {week.days.map((date) => renderCell(employee, date))}
                    <div role="cell" className="grid content-center gap-1 border-l px-2 text-right">
                      <span
                        className={cn(
                          "text-sm font-medium tabular-nums",
                          over && "text-destructive",
                        )}
                      >
                        {hours ? `${+hours.toFixed(1)}h` : "—"}
                      </span>
                      {max !== null && (
                        <HoursBar hours={hours} max={max} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Daily totals */}
          <div
            role="row"
            className={cn("grid border-t bg-muted/40 text-xs", COLUMNS)}
          >
            <div role="rowheader" className="px-3 py-2.5 font-medium text-muted-foreground">
              Daily labour
            </div>
            {week.summary.byDay.map((day) => (
              <div key={day.date} role="cell" className="border-l px-2 py-2.5 text-center tabular-nums">
                <div className="font-medium">{+day.hours.toFixed(1)}h</div>
                <div className="text-muted-foreground">{formatMoney(day.cost)}</div>
              </div>
            ))}
            <div role="cell" className="border-l px-2 py-2.5 text-right font-medium tabular-nums">
              {+week.summary.totalHours.toFixed(1)}h
            </div>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <ShiftCard
            shift={dragging}
            position={positions.get(dragging.positionId)}
            overlay
            className="w-32"
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function DayCell({
  id,
  employee,
  date,
  isToday,
  onAdd,
  children,
}: {
  id: string;
  employee: WeekEmployee | null;
  date: LocalDate;
  isToday: boolean;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const timeOff = employee ? timeOffOn(employee, date) : undefined;
  const blocks = employee ? unavailableOn(employee, date) : [];
  const allDay = blocks.some((b) => b.startMinute === 0 && b.endMinute >= 1440);
  const label = employee
    ? `${employee.firstName}, ${formatDay(date, "long")}`
    : `Open shifts, ${formatDay(date, "long")}`;

  return (
    <div
      ref={setNodeRef}
      role="cell"
      aria-label={label}
      className={cn(
        "group/cell relative flex min-h-16 flex-col gap-1 border-l p-1.5 transition-colors",
        isToday && "bg-brand-soft/25",
        (allDay || timeOff?.status === "APPROVED") &&
          "bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--muted)_6px_12px)]",
        isOver && "bg-brand-soft ring-2 ring-brand/50 ring-inset",
      )}
    >
      {timeOff && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
            timeOff.status === "APPROVED"
              ? "bg-destructive/10 text-destructive"
              : "border border-dashed border-warning text-amber-700 dark:text-warning",
          )}
        >
          {timeOff.status === "APPROVED" ? "Time off" : "Off requested"}
        </span>
      )}
      {!timeOff && blocks.length > 0 && (
        <span className="text-[10px] text-muted-foreground">
          {allDay ? "Unavailable" : "Partly unavailable"}
        </span>
      )}
      {children}
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Add shift: ${label}`}
        className="mt-auto flex h-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover/cell:opacity-100 hover:bg-muted focus-visible:opacity-100"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function HoursBar({ hours, max }: { hours: number; max: number }) {
  const pct = Math.min(hours / max, 1) * 100;
  return (
    <div
      className="ml-auto h-1 w-12 overflow-hidden rounded-full bg-muted"
      title={`${+hours.toFixed(1)} of ${max}h`}
    >
      <div
        className={cn(
          "h-full rounded-full",
          hours > max ? "bg-destructive" : pct > 90 ? "bg-warning" : "bg-success",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
