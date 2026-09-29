import { cn } from "cn";
import { MapPin } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { shiftRange } from "@/lib/schedule";
import type { MyShift } from "@/hooks/use-portal";

const toUtc = (date: string) => new Date(`${date}T00:00:00Z`);

/** A shift as staff see it: date tile, time, role and location. */
export function ShiftRow({
  shift,
  muted,
  action,
}: {
  shift: MyShift;
  muted?: boolean;
  action?: React.ReactNode;
}) {
  const date = toUtc(shift.date);
  return (
    <div className={cn("flex items-center gap-4 px-4 py-3", muted && "opacity-55")}>
      <div
        className="grid w-12 shrink-0 place-items-center rounded-lg border py-1.5 text-center"
        style={{ borderColor: `${shift.position.color}66` }}
      >
        <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          {date.toLocaleDateString("en-CA", { timeZone: "UTC", weekday: "short" })}
        </span>
        <span className="text-lg leading-tight font-semibold tabular-nums">
          {date.getUTCDate()}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium tabular-nums">{shiftRange(shift)}</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: shift.position.color }}
            />
            {shift.position.name}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" />
            {shift.location.name}
          </span>
          {shift.notes && <span className="truncate">“{shift.notes}”</span>}
        </div>
      </div>
      <div className="text-right text-sm">
        <div className="font-medium tabular-nums">{shift.paidHours}h</div>
        <div className="text-muted-foreground tabular-nums">{formatMoney(shift.cost)}</div>
      </div>
      {action}
    </div>
  );
}
