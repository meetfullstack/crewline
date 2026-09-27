import { cn } from "cn";
import { AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { initials, STATUS_LABEL } from "@/lib/format";
import type { EmployeeSummary, EmploymentStatus, Position } from "@/lib/types";

export function PositionBadge({
  position,
  className,
}: {
  position: Pick<Position, "name" | "color">;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border bg-background px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ backgroundColor: position.color }}
      />
      {position.name}
    </span>
  );
}

const STATUS_STYLE: Record<EmploymentStatus, string> = {
  ACTIVE: "bg-success/12 text-success ring-success/25",
  ON_LEAVE: "bg-warning/15 text-amber-700 dark:text-warning ring-warning/30",
  TERMINATED: "bg-muted text-muted-foreground ring-border",
};

export function StatusBadge({ status }: { status: EmploymentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        STATUS_STYLE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function EmployeeAvatar({
  employee,
  className,
}: {
  employee: Pick<EmployeeSummary, "firstName" | "lastName" | "positions">;
  className?: string;
}) {
  const color = employee.positions[0]?.color;
  return (
    <Avatar className={cn("size-8", className)}>
      <AvatarFallback
        className="text-xs font-semibold"
        style={
          color
            ? { backgroundColor: `${color}22`, color: "var(--foreground)" }
            : undefined
        }
      >
        {initials(employee)}
      </AvatarFallback>
    </Avatar>
  );
}

export function CertificationAlert({
  alerts,
}: {
  alerts: EmployeeSummary["certificationAlerts"];
}) {
  if (!alerts.expired && !alerts.expiringSoon) return null;
  const expired = alerts.expired > 0;
  const label = expired
    ? `${alerts.expired} expired certification${alerts.expired > 1 ? "s" : ""}`
    : `${alerts.expiringSoon} certification${alerts.expiringSoon > 1 ? "s" : ""} expiring within 30 days`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={label}
          className={cn(
            "inline-flex",
            expired ? "text-destructive" : "text-amber-600 dark:text-warning",
          )}
        >
          <AlertTriangle className="size-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
