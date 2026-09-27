"use client";

import { cn } from "cn";
import {
  AlertTriangle,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Copy,
  DollarSign,
  Loader2,
  Send,
  UserPlus,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocations } from "@/hooks/use-employees";
import {
  useCopyWeek,
  useMoveShift,
  usePublishWeek,
  useWeek,
} from "@/hooks/use-schedule";
import { ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { addDays, formatWeekRange, type WeekSchedule } from "@/lib/schedule";
import { type ShiftDialogTarget, ShiftDialog } from "./shift-dialog";
import { WeekGrid } from "./week-grid";

export function ScheduleBuilder() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const weekParam = params.get("week") ?? undefined;

  const { data: locations } = useLocations();
  const [chosenLocation, setChosenLocation] = useState<string>();
  const locationId = chosenLocation ?? locations?.[0]?.id;

  const { data: week, isPending, isError, isPlaceholderData } = useWeek(
    locationId,
    weekParam,
  );
  const move = useMoveShift({ locationId, weekStart: weekParam });
  const [dialog, setDialog] = useState<ShiftDialogTarget | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  const goToWeek = (weekStart: string | null) => {
    const next = new URLSearchParams(params);
    if (weekStart) next.set("week", weekStart);
    else next.delete("week");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  if (isError) {
    return (
      <p className="py-20 text-center text-sm text-destructive">
        Couldn&apos;t load the schedule. Refresh to try again.
      </p>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {week ? (
              <>
                {week.location.name}
                <StatusPill week={week} />
              </>
            ) : (
              <Skeleton className="h-5 w-40" />
            )}
          </div>
        </div>

        {locations && locations.length > 1 && (
          <Select value={locationId} onValueChange={setChosenLocation}>
            <SelectTrigger className="h-9 w-44" aria-label="Location">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex items-center rounded-lg border bg-card">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous week"
            disabled={!week}
            onClick={() => week && goToWeek(addDays(week.weekStart, -7))}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-40 px-1 text-center text-sm font-medium tabular-nums">
            {week ? formatWeekRange(week.days) : "…"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next week"
            disabled={!week}
            onClick={() => week && goToWeek(addDays(week.weekStart, 7))}
          >
            <ChevronRight />
          </Button>
        </div>
        <Button variant="outline" onClick={() => goToWeek(null)} disabled={!weekParam}>
          Today
        </Button>
        <Button variant="outline" onClick={() => setCopyOpen(true)} disabled={!week}>
          <Copy /> Copy last week
        </Button>
        {week && <PublishButton week={week} />}
      </div>

      {week ? (
        <>
          <SummaryCards week={week} />
          <div className={cn("transition-opacity", isPlaceholderData && "opacity-60")}>
            <WeekGrid
              week={week}
              today={today(week)}
              onOpenShift={(shift) => setDialog({ mode: "edit", shift })}
              onAddShift={(employeeId, date) =>
                setDialog({ mode: "create", employeeId, date })
              }
              onMove={(shift, employeeId, date) =>
                move.mutate(
                  { id: shift.id, employeeId, date },
                  {
                    onSuccess: (moved) => {
                      const errors = moved.conflicts.filter((c) => c.severity === "error");
                      if (errors.length) toast.warning(errors[0].message);
                    },
                    onError: (error) =>
                      toast.error(
                        error instanceof ApiError ? error.message : "Couldn't move shift",
                      ),
                  },
                )
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Drag a shift to reassign or move it. Click a shift to edit, or hover
            an empty cell and press + to add one.
          </p>
          <ShiftDialog week={week} target={dialog} onClose={() => setDialog(null)} />
          <CopyWeekDialog week={week} open={copyOpen} onOpenChange={setCopyOpen} />
        </>
      ) : (
        isPending && (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-[32rem]" />
          </div>
        )
      )}
    </div>
  );
}

/** Today's date in the location's zone, so "today" matches the restaurant. */
function today(week: WeekSchedule) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: week.location.timezone,
  }).format(new Date());
}

function StatusPill({ week }: { week: WeekSchedule }) {
  const s = week.schedule;
  const [label, tone] = !s
    ? ["Not started", "bg-muted text-muted-foreground"]
    : s.status === "DRAFT"
      ? ["Draft", "bg-muted text-foreground"]
      : s.hasUnpublishedChanges
        ? ["Published · unpublished changes", "bg-warning/15 text-amber-700 dark:text-warning"]
        : ["Published", "bg-success/12 text-success"];
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tone)}>
      {label}
    </span>
  );
}

function PublishButton({ week }: { week: WeekSchedule }) {
  const publish = usePublishWeek();
  const s = week.schedule;
  const upToDate = s?.status === "PUBLISHED" && !s.hasUnpublishedChanges;
  const blocked = week.summary.errors > 0;
  const empty = week.shifts.length === 0;

  const button = (
    <Button
      disabled={upToDate || blocked || empty || publish.isPending}
      onClick={() =>
        publish.mutate(
          { locationId: week.location.id, weekStart: week.weekStart },
          {
            onSuccess: (r) =>
              toast.success(`Published ${r.shifts} shifts — your team can see them now`),
            onError: (error) =>
              toast.error(error instanceof ApiError ? error.message : "Couldn't publish"),
          },
        )
      }
    >
      {publish.isPending ? <Loader2 className="animate-spin" /> : upToDate ? <CalendarCheck2 /> : <Send />}
      {upToDate ? "Published" : s?.status === "PUBLISHED" ? "Republish" : "Publish"}
    </Button>
  );

  if (!blocked) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>{button}</span>
      </TooltipTrigger>
      <TooltipContent>
        Resolve {week.summary.errors} conflict{week.summary.errors > 1 ? "s" : ""} before publishing
      </TooltipContent>
    </Tooltip>
  );
}

function SummaryCards({ week }: { week: WeekSchedule }) {
  const { summary } = week;
  const cards = [
    {
      label: "Scheduled hours",
      value: `${+summary.totalHours.toFixed(1)}h`,
      detail: `${week.shifts.length} shifts`,
      icon: Clock,
    },
    {
      label: "Labour cost",
      value: formatMoney(summary.laborCost),
      detail: summary.totalHours
        ? `${formatMoney(summary.laborCost / summary.totalHours)}/hr average`
        : "No shifts yet",
      icon: DollarSign,
    },
    {
      label: "Open shifts",
      value: String(summary.openShifts),
      detail: summary.openShifts ? "Waiting to be picked up" : "Everything's covered",
      icon: UserPlus,
      tone: summary.openShifts ? "text-brand" : undefined,
    },
    {
      label: "Conflicts",
      value: String(summary.errors + summary.warnings),
      detail: summary.errors
        ? `${summary.errors} must be fixed to publish`
        : summary.warnings
          ? `${summary.warnings} to review`
          : "All clear",
      icon: summary.errors ? CircleAlert : AlertTriangle,
      tone: summary.errors
        ? "text-destructive"
        : summary.warnings
          ? "text-amber-600 dark:text-warning"
          : "text-success",
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ label, value, detail, icon: Icon, tone }) => (
        <div key={label} className="rounded-xl border bg-card p-4">
          <dt className="flex items-center justify-between text-sm text-muted-foreground">
            {label}
            <Icon className={cn("size-4", tone)} />
          </dt>
          <dd className={cn("mt-1 text-2xl font-semibold tracking-tight tabular-nums", tone)}>
            {value}
          </dd>
          <dd className="text-xs text-muted-foreground">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}

function CopyWeekDialog({
  week,
  open,
  onOpenChange,
}: {
  week: WeekSchedule;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const copy = useCopyWeek();
  const hasShifts = week.shifts.length > 0;
  const run = (mode: "replace" | "append") =>
    copy.mutate(
      {
        locationId: week.location.id,
        fromWeekStart: addDays(week.weekStart, -7),
        toWeekStart: week.weekStart,
        mode,
      },
      {
        onSuccess: ({ copied, reassignedToOpen }) => {
          toast.success(
            `Copied ${copied} shifts${reassignedToOpen ? ` (${reassignedToOpen} now open — those staff are inactive)` : ""}`,
          );
          onOpenChange(false);
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : "Couldn't copy"),
      },
    );

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Copy last week&apos;s schedule?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasShifts
              ? `This week already has ${week.shifts.length} shifts. Replace them with last week's, or add last week's on top?`
              : "Every shift from last week will be copied into this week as a draft. Staff who are no longer active become open shifts."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={copy.isPending}>Cancel</AlertDialogCancel>
          {hasShifts && (
            <Button variant="outline" onClick={() => run("append")} disabled={copy.isPending}>
              Add to this week
            </Button>
          )}
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              run("replace");
            }}
            disabled={copy.isPending}
          >
            {copy.isPending && <Loader2 className="animate-spin" />}
            {hasShifts ? "Replace" : "Copy shifts"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
