"use client";

import { useDraggable } from "@dnd-kit/core";
import { cn } from "cn";
import { AlertTriangle, CircleAlert } from "lucide-react";
import type { ComponentProps } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Shift, shiftRange, worstSeverity } from "@/lib/schedule";
import type { Position } from "@/lib/types";

interface ShiftCardProps extends Omit<ComponentProps<"button">, "children"> {
  shift: Shift;
  position?: Pick<Position, "name" | "color">;
  /** Show the position name (open shifts, or not the person's main role). */
  showPosition?: boolean;
  overlay?: boolean;
}

export function ShiftCard({
  shift,
  position,
  showPosition,
  overlay,
  className,
  ...props
}: ShiftCardProps) {
  const severity = worstSeverity(shift.conflicts);
  const color = position?.color ?? "#a3a3a3";

  return (
    <button
      type="button"
      className={cn(
        "group/shift relative w-full overflow-hidden rounded-md border py-1 pr-1.5 pl-2.5 text-left text-xs transition-shadow",
        "bg-card hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        severity === "error" && "border-destructive/60 bg-destructive/5",
        severity === "warning" && "border-warning/70",
        overlay && "rotate-1 shadow-xl ring-2 ring-brand/40",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(90deg, ${color}1f, transparent 70%)`,
      }}
      {...props}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: color }}
      />
      <span className="flex items-center justify-between gap-1">
        <span className="font-semibold whitespace-nowrap tabular-nums">
          {shiftRange(shift)}
        </span>
        {severity && <ConflictIcon shift={shift} severity={severity} />}
      </span>
      {(showPosition || shift.notes) && (
        <span className="block truncate text-[11px] text-muted-foreground">
          {showPosition ? position?.name : shift.notes}
        </span>
      )}
    </button>
  );
}

function ConflictIcon({
  shift,
  severity,
}: {
  shift: Shift;
  severity: "error" | "warning";
}) {
  const Icon = severity === "error" ? CircleAlert : AlertTriangle;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={shift.conflicts.map((c) => c.message).join(". ")}
          className={cn(
            "shrink-0",
            severity === "error"
              ? "text-destructive"
              : "text-amber-600 dark:text-warning",
          )}
        >
          <Icon className="size-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        <ul className="grid gap-0.5">
          {shift.conflicts.map((c) => (
            <li key={c.code}>{c.message}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

/** A shift card the manager can drag to another person or day. */
export function DraggableShift(props: Omit<ShiftCardProps, "overlay">) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.shift.id,
    data: { shift: props.shift },
  });
  return (
    <ShiftCard
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      {...props}
      aria-roledescription="Draggable shift"
      className={cn(isDragging && "opacity-30", props.className)}
    />
  );
}
