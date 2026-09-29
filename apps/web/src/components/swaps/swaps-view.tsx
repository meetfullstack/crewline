"use client";

import { cn } from "cn";
import { ArrowRight, Check, Inbox, Loader2, Repeat, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMe } from "@/hooks/use-me";
import {
  type Swap,
  type SwapStatus,
  useCancelSwap,
  useMySwaps,
  useRespondSwap,
  useReviewSwap,
  useSwapQueue,
} from "@/hooks/use-portal";
import { ApiError } from "@/lib/api";
import { formatDay, shiftRange } from "@/lib/schedule";
import { isManager } from "@/lib/types";
import { ConflictLines } from "./swap-dialog";

const STATUS: Record<SwapStatus, [string, string]> = {
  PENDING_COWORKER: ["Waiting for coworker", "bg-warning/15 text-amber-700 dark:text-warning ring-warning/30"],
  PENDING_MANAGER: ["Waiting for manager", "bg-warning/15 text-amber-700 dark:text-warning ring-warning/30"],
  APPROVED: ["Approved", "bg-success/12 text-success ring-success/25"],
  DECLINED: ["Declined", "bg-muted text-muted-foreground ring-border"],
  DENIED: ["Denied", "bg-destructive/10 text-destructive ring-destructive/25"],
  CANCELLED: ["Cancelled", "bg-muted text-muted-foreground ring-border"],
};

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export function SwapsView() {
  const { data: me } = useMe();
  const manager = isManager(me?.role);
  const queue = useSwapQueue("PENDING_MANAGER");

  if (!me) return <Skeleton className="mx-auto h-96 max-w-4xl" />;

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shift swaps</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {manager
            ? "Approve trades and covers your team has agreed on. Crewline checks both people before the schedule changes."
            : "Ask a coworker to cover a shift or trade with you. Start a swap from My shifts."}
        </p>
      </div>
      {manager ? (
        <Tabs defaultValue="review">
          <TabsList>
            <TabsTrigger value="review">
              To approve
              {queue.data && queue.data.length > 0 && (
                <span className="ml-1 rounded-full bg-brand px-1.5 text-[11px] text-brand-foreground">
                  {queue.data.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="mine">My swaps</TabsTrigger>
          </TabsList>
          <TabsContent value="review" className="mt-4">
            <ManagerQueue />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <History />
          </TabsContent>
          <TabsContent value="mine" className="mt-4">
            <MySwaps />
          </TabsContent>
        </Tabs>
      ) : (
        <MySwaps />
      )}
    </div>
  );
}

// ─── Staff ─────────────────────────────────────────────────────────────

function MySwaps() {
  const { data: me } = useMe();
  const { data: swaps, isPending } = useMySwaps();
  const myId = me?.employee?.id;

  if (isPending) return <Skeleton className="h-48" />;
  const incoming = swaps?.filter((s) => s.targetEmployee.id === myId && s.status === "PENDING_COWORKER") ?? [];
  const rest = swaps?.filter((s) => !incoming.includes(s)) ?? [];

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <h2 className="font-medium">Asked of you</h2>
        {incoming.length ? (
          incoming.map((s) => <SwapCard key={s.id} swap={s} viewerId={myId} actions={<RespondActions swap={s} />} />)
        ) : (
          <Empty text="No one has asked you to swap." />
        )}
      </section>
      <section className="grid gap-3">
        <h2 className="font-medium">Your swaps</h2>
        {rest.length ? (
          rest.map((s) => (
            <SwapCard
              key={s.id}
              swap={s}
              viewerId={myId}
              actions={
                s.requester.id === myId && s.status.startsWith("PENDING") ? <CancelAction swap={s} /> : null
              }
            />
          ))
        ) : (
          <Empty text="No swaps yet. Open My shifts and press Swap on an upcoming shift." />
        )}
      </section>
    </div>
  );
}

function RespondActions({ swap }: { swap: Swap }) {
  const respond = useRespondSwap();
  const act = (accept: boolean) =>
    respond.mutate(
      { id: swap.id, accept },
      {
        onSuccess: () =>
          toast.success(accept ? "Accepted — a manager will confirm it" : "Declined"),
        onError: (e) => toast.error(errorText(e, "Couldn't respond")),
      },
    );
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" disabled={respond.isPending} onClick={() => act(false)}>
        <X /> Decline
      </Button>
      <Button size="sm" disabled={respond.isPending} onClick={() => act(true)}>
        {respond.isPending ? <Loader2 className="animate-spin" /> : <Check />} Accept
      </Button>
    </div>
  );
}

function CancelAction({ swap }: { swap: Swap }) {
  const cancel = useCancelSwap();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={cancel.isPending}
      onClick={() =>
        cancel.mutate(swap.id, {
          onSuccess: () => toast.success("Swap cancelled"),
          onError: (e) => toast.error(errorText(e, "Couldn't cancel")),
        })
      }
    >
      Cancel request
    </Button>
  );
}

// ─── Managers ──────────────────────────────────────────────────────────

function ManagerQueue() {
  const { data: swaps, isPending } = useSwapQueue("PENDING_MANAGER");
  if (isPending) return <Skeleton className="h-48" />;
  if (!swaps?.length) {
    return (
      <div className="grid place-items-center gap-2 rounded-xl border border-dashed py-14 text-center">
        <Inbox className="size-8 text-muted-foreground" />
        <p className="font-medium">Nothing to approve</p>
        <p className="text-sm text-muted-foreground">Swaps appear here once the coworker accepts.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      {swaps.map((s) => (
        <ReviewCard key={s.id} swap={s} />
      ))}
    </div>
  );
}

function ReviewCard({ swap }: { swap: Swap }) {
  const review = useReviewSwap();
  const { data: me } = useMe();
  const [note, setNote] = useState("");
  const involved = [swap.requester.id, swap.targetEmployee.id].includes(me?.employee?.id ?? "");

  const decide = (status: "APPROVED" | "DENIED") =>
    review.mutate(
      { id: swap.id, status, note: note.trim() || undefined },
      {
        onSuccess: () =>
          toast.success(status === "APPROVED" ? "Swap approved — the schedule is updated" : "Swap denied"),
        onError: (e) => toast.error(errorText(e, "Couldn't save")),
      },
    );

  const impact = swap.impact;
  return (
    <SwapCard
      swap={swap}
      extra={
        impact && (
          <div className="grid gap-1 rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">If approved</p>
            {impact.target.length + impact.requester.length === 0 ? (
              <p className="text-xs text-success">No conflicts for either person</p>
            ) : (
              <>
                <ConflictLines conflicts={impact.target} />
                <ConflictLines conflicts={impact.requester} />
              </>
            )}
          </div>
        )
      }
      actions={
        involved ? (
          <p className="text-sm text-muted-foreground">You&apos;re part of this swap — another manager needs to approve it.</p>
        ) : (
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Input
              aria-label="Note (optional)"
              placeholder="Add a note (optional)"
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              className="h-9 flex-1"
            />
            <div className="flex gap-2">
              <Button variant="outline" disabled={review.isPending} onClick={() => decide("DENIED")}>
                <X /> Deny
              </Button>
              <Button disabled={review.isPending || swap.canApprove === false} onClick={() => decide("APPROVED")}>
                {review.isPending ? <Loader2 className="animate-spin" /> : <Check />} Approve
              </Button>
            </div>
          </div>
        )
      }
    />
  );
}

function History() {
  const { data: swaps, isPending } = useSwapQueue("ALL");
  const done = swaps?.filter((s) => s.status !== "PENDING_MANAGER") ?? [];
  if (isPending) return <Skeleton className="h-48" />;
  if (!done.length) return <Empty text="No past swaps." />;
  return (
    <div className="grid gap-3">
      {done.map((s) => (
        <SwapCard key={s.id} swap={s} />
      ))}
    </div>
  );
}

// ─── Shared ────────────────────────────────────────────────────────────

function SwapCard({
  swap,
  viewerId,
  extra,
  actions,
}: {
  swap: Swap;
  viewerId?: string;
  extra?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const [label, tone] = STATUS[swap.status];
  const name = (p: Swap["requester"]) => (p.id === viewerId ? "You" : `${p.firstName} ${p.lastName[0]}.`);

  return (
    <article className="grid gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex items-center gap-2 font-medium">
          {name(swap.requester)}
          {swap.kind === "TRADE" ? (
            <Repeat className="size-4 text-muted-foreground" aria-label="trade with" />
          ) : (
            <ArrowRight className="size-4 text-muted-foreground" aria-label="asks" />
          )}
          {name(swap.targetEmployee)}
          <span className="text-sm font-normal text-muted-foreground">
            · {swap.kind === "TRADE" ? "Trade" : "Cover"}
          </span>
        </p>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", tone)}>{label}</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <ShiftBox
          label={swap.kind === "TRADE" ? `${name(swap.requester)} gives` : `${name(swap.targetEmployee)} would work`}
          shift={swap.shift}
        />
        {swap.targetShift && <ShiftBox label={`${name(swap.targetEmployee)} gives`} shift={swap.targetShift} />}
      </div>

      {swap.message && <p className="text-sm">“{swap.message}”</p>}
      {swap.reviewedBy && (
        <p className="text-sm text-muted-foreground">
          {swap.status === "APPROVED" ? "Approved" : "Reviewed"} by {swap.reviewedBy.firstName}
          {swap.reviewNote && `: “${swap.reviewNote}”`}
        </p>
      )}
      {extra}
      {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
    </article>
  );
}

function ShiftBox({ label, shift }: { label: string; shift: Swap["shift"] }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      {shift ? (
        <p className="flex items-center gap-2 text-sm font-medium">
          <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: shift.position.color }} />
          {formatDay(shift.date)} · {shiftRange(shift)} · {shift.position.name}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Shift no longer exists</p>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{text}</p>;
}
