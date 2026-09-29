"use client";

import { cn } from "cn";
import {
  AlertTriangle,
  Check,
  Inbox,
  Loader2,
  Plane,
  X,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/hooks/use-me";
import {
  useCancelTimeOff,
  useMyTimeOff,
  useRequestTimeOff,
  useReviewTimeOff,
  useTimeOffQueue,
} from "@/hooks/use-portal";
import { ApiError } from "@/lib/api";
import { formatDateOnly, formatTimestampDay } from "@/lib/format";
import {
  isManager,
  type RequestStatus,
  type TimeOffRequest,
  type TimeOffType,
} from "@/lib/types";

const TYPE_LABEL: Record<TimeOffType, string> = {
  VACATION: "Vacation",
  SICK: "Sick",
  PERSONAL: "Personal",
  UNPAID: "Unpaid leave",
};

const STATUS_STYLE: Record<RequestStatus, string> = {
  PENDING: "bg-warning/15 text-amber-700 dark:text-warning ring-warning/30",
  APPROVED: "bg-success/12 text-success ring-success/25",
  DENIED: "bg-destructive/10 text-destructive ring-destructive/25",
  CANCELLED: "bg-muted text-muted-foreground ring-border",
};

const STATUS_LABEL: Record<RequestStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  DENIED: "Denied",
  CANCELLED: "Cancelled",
};

function dateRange(r: Pick<TimeOffRequest, "startDate" | "endDate">) {
  return r.startDate === r.endDate
    ? formatDateOnly(r.startDate)
    : `${formatDateOnly(r.startDate)} – ${formatDateOnly(r.endDate)}`;
}

export function TimeOffView() {
  const { data: me } = useMe();
  const manager = isManager(me?.role);
  const queue = useTimeOffQueue("PENDING", Boolean(me) && manager);

  if (!me) return <Skeleton className="mx-auto h-96 max-w-4xl" />;

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Time off</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {manager
            ? "Review your team's requests. Approved time off shows on the schedule and is checked when you book shifts."
            : "Request days off and follow their status."}
        </p>
      </div>

      {manager ? (
        <Tabs defaultValue="review">
          <TabsList>
            <TabsTrigger value="review">
              To review
              {queue.data && queue.data.length > 0 && (
                <span className="ml-1 rounded-full bg-brand px-1.5 text-[11px] text-brand-foreground">
                  {queue.data.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="mine">My time off</TabsTrigger>
          </TabsList>
          <TabsContent value="review" className="mt-4">
            <ReviewQueue />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <History />
          </TabsContent>
          <TabsContent value="mine" className="mt-4">
            <MyTimeOff />
          </TabsContent>
        </Tabs>
      ) : (
        <MyTimeOff />
      )}
    </div>
  );
}

// ─── Staff ───────────────────────────────────────────────────────────────

function MyTimeOff() {
  const { data: requests, isPending } = useMyTimeOff();
  const cancel = useCancelTimeOff();

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <RequestForm />
      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 font-medium">Your requests</h2>
        {isPending ? (
          <div className="grid gap-2 p-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : requests?.length ? (
          <ul className="divide-y">
            {requests.map((r) => (
              <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{dateRange(r)}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {TYPE_LABEL[r.type]} · {r.days} day{r.days > 1 ? "s" : ""}
                    {r.reason && ` · ${r.reason}`}
                  </p>
                  {r.reviewedBy && (
                    <p className="mt-1 text-sm">
                      {r.status === "APPROVED" ? "Approved" : "Reviewed"} by{" "}
                      {r.reviewedBy.firstName}
                      {r.reviewNote && `: “${r.reviewNote}”`}
                    </p>
                  )}
                </div>
                {r.status === "PENDING" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={cancel.isPending}
                    onClick={() =>
                      cancel.mutate(r.id, {
                        onSuccess: () => toast.success("Request cancelled"),
                        onError: (e) =>
                          toast.error(e instanceof ApiError ? e.message : "Couldn't cancel"),
                      })
                    }
                  >
                    Cancel
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid place-items-center gap-2 px-4 py-12 text-center">
            <Plane className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No requests yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function RequestForm() {
  const request = useRequestTimeOff();
  const [today] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [type, setType] = useState<TimeOffType>("VACATION");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await request.mutateAsync({
        type,
        startDate,
        endDate: endDate || startDate,
        reason: reason.trim() || undefined,
      });
      toast.success("Request sent to your manager");
      setStartDate("");
      setEndDate("");
      setReason("");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't send request");
    }
  };

  return (
    <form onSubmit={submit} className="grid h-fit gap-4 rounded-xl border bg-card p-4">
      <h2 className="font-medium">Request time off</h2>
      <div className="grid gap-1.5">
        <Label htmlFor="to-type">Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as TimeOffType)}>
          <SelectTrigger id="to-type" className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="to-start">First day</Label>
          <Input
            id="to-start"
            type="date"
            required
            min={today}
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (endDate && endDate < e.target.value) setEndDate("");
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to-end">Last day</Label>
          <Input
            id="to-end"
            type="date"
            min={startDate || today}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="to-reason">
          Reason <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="to-reason"
          rows={2}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={!startDate || request.isPending}>
        {request.isPending && <Loader2 className="animate-spin" />}
        Send request
      </Button>
    </form>
  );
}

// ─── Managers ────────────────────────────────────────────────────────────

function ReviewQueue() {
  const { data: requests, isPending } = useTimeOffQueue("PENDING");

  if (isPending) return <Skeleton className="h-48" />;
  if (!requests?.length) {
    return (
      <div className="grid place-items-center gap-2 rounded-xl border border-dashed py-14 text-center">
        <Inbox className="size-8 text-muted-foreground" />
        <p className="font-medium">You&apos;re all caught up</p>
        <p className="text-sm text-muted-foreground">No requests waiting for review.</p>
      </div>
    );
  }
  return (
    <ul className="grid gap-3">
      {requests.map((r) => (
        <ReviewCard key={r.id} request={r} />
      ))}
    </ul>
  );
}

function ReviewCard({ request: r }: { request: TimeOffRequest }) {
  const review = useReviewTimeOff();
  const { data: me } = useMe();
  const [note, setNote] = useState("");
  const own = me?.employee?.id === r.employee.id;

  const decide = (status: "APPROVED" | "DENIED") =>
    review.mutate(
      { id: r.id, status, note: note.trim() || undefined },
      {
        onSuccess: () =>
          toast.success(
            `${status === "APPROVED" ? "Approved" : "Denied"} ${r.employee.firstName}'s request`,
          ),
        onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't save"),
      },
    );

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {r.employee.firstName} {r.employee.lastName}
            {r.employee.position && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {r.employee.position.name}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-lg font-semibold tracking-tight">{dateRange(r)}</p>
          <p className="text-sm text-muted-foreground">
            {TYPE_LABEL[r.type]} · {r.days} day{r.days > 1 ? "s" : ""} · requested{" "}
            {formatTimestampDay(r.createdAt)}
          </p>
          {r.reason && <p className="mt-2 text-sm">“{r.reason}”</p>}
        </div>
        <StatusBadge status={r.status} />
      </div>

      {r.scheduledShifts > 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm text-amber-800 dark:text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          {r.employee.firstName} is already scheduled for {r.scheduledShifts} shift
          {r.scheduledShifts > 1 ? "s" : ""} in this period. Approving will flag them on the
          schedule so you can reassign.
        </p>
      )}

      {own ? (
        <p className="mt-3 text-sm text-muted-foreground">
          This is your own request — another manager or the owner needs to review it.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label={`Note to ${r.employee.firstName} (optional)`}
            placeholder="Add a note (optional)"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            className="h-9 flex-1"
          />
          <div className="flex gap-2">
            <Button variant="outline" disabled={review.isPending} onClick={() => decide("DENIED")}>
              <X /> Deny
            </Button>
            <Button disabled={review.isPending} onClick={() => decide("APPROVED")}>
              {review.isPending ? <Loader2 className="animate-spin" /> : <Check />}
              Approve
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function History() {
  const { data: requests, isPending } = useTimeOffQueue("ALL");
  const handled = requests?.filter((r) => r.status !== "PENDING") ?? [];

  if (isPending) return <Skeleton className="h-48" />;
  if (!handled.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No past requests.</p>;
  }
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {handled.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {r.employee.firstName} {r.employee.lastName}
              <span className="ml-2 font-normal text-muted-foreground">{dateRange(r)}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {TYPE_LABEL[r.type]}
              {r.reviewedBy && ` · by ${r.reviewedBy.firstName}`}
              {r.reviewNote && ` · “${r.reviewNote}”`}
            </p>
          </div>
          <StatusBadge status={r.status} />
        </li>
      ))}
    </ul>
  );
}

function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        STATUS_STYLE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
