"use client";

import { cn } from "cn";
import { Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReplaceAvailability } from "@/hooks/use-employees";
import { ApiError } from "@/lib/api";
import { availabilityProblem, WEEK_ORDER } from "@/lib/availability";
import { DAY_NAMES, formatMinutes } from "@/lib/format";
import type {
  AvailabilityBlock,
  AvailabilityKind,
  EmployeeDetail,
} from "@/lib/types";

type Draft = AvailabilityBlock & { key: string };

const KIND: Record<
  Exclude<AvailabilityKind, "AVAILABLE">,
  { label: string; bar: string; dot: string }
> = {
  PREFERRED: {
    label: "Prefers to work",
    bar: "bg-success/70",
    dot: "bg-success",
  },
  UNAVAILABLE: {
    label: "Unavailable",
    bar: "bg-destructive/60 bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgb(255_255_255/0.25)_4px_8px)]",
    dot: "bg-destructive",
  },
};

// Every half hour, plus 1440 for "end of day".
const TIMES = Array.from({ length: 49 }, (_, i) => i * 30);
const timeLabel = (m: number) =>
  m === 1440 ? "12:00 AM (end of day)" : formatMinutes(m);

/** Order-insensitive fingerprint used to detect unsaved edits. */
const signature = (blocks: AvailabilityBlock[]) =>
  blocks
    .map((b) => `${b.dayOfWeek}:${b.startMinute}-${b.endMinute}:${b.kind}`)
    .sort()
    .join("|");

let nextKey = 0;
const withKey = (block: AvailabilityBlock): Draft => ({
  ...block,
  key: `b${nextKey++}`,
});

export function AvailabilityEditor({ employee }: { employee: EmployeeDetail }) {
  const save = useReplaceAvailability(employee.id);
  const [saved, setSaved] = useState(employee.availability);
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    employee.availability.map(withKey),
  );

  // Pick up server changes (e.g. after a save) without clobbering edits.
  if (saved !== employee.availability) {
    setSaved(employee.availability);
    setDrafts(employee.availability.map(withKey));
  }

  const problem = availabilityProblem(drafts);
  const dirty = signature(drafts) !== signature(saved);

  const patch = (key: string, change: Partial<AvailabilityBlock>) =>
    setDrafts((all) => all.map((d) => (d.key === key ? { ...d, ...change } : d)));

  const addBlock = (dayOfWeek: number) => {
    const last = drafts
      .filter((d) => d.dayOfWeek === dayOfWeek)
      .reduce((max, d) => Math.max(max, d.endMinute), 0);
    const start = Math.min(last, 1380);
    setDrafts((all) => [
      ...all,
      withKey({
        dayOfWeek,
        startMinute: start,
        endMinute: Math.min(start + 240, 1440),
        kind: "UNAVAILABLE",
      }),
    ]);
  };

  const onSave = async () => {
    try {
      await save.mutateAsync(drafts);
      toast.success("Availability saved");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save");
    }
  };

  return (
    <section className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="font-medium">Weekly availability</h2>
          <p className="text-sm text-muted-foreground">
            Anything not marked is treated as available. The schedule builder
            warns before booking over these times.
          </p>
        </div>
        <ul className="flex gap-4 text-xs text-muted-foreground">
          {Object.values(KIND).map((k) => (
            <li key={k.label} className="flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-full", k.dot)} />
              {k.label}
            </li>
          ))}
        </ul>
      </div>

      <ol className="divide-y">
        {WEEK_ORDER.map((day) => {
          const blocks = drafts
            .filter((d) => d.dayOfWeek === day)
            .sort((a, b) => a.startMinute - b.startMinute);
          return (
            <li
              key={day}
              className="grid gap-3 px-5 py-3 md:grid-cols-[7rem_1fr]"
            >
              <div className="flex items-center justify-between md:block">
                <span className="text-sm font-medium">{DAY_NAMES[day]}</span>
                <DayBar blocks={blocks} className="mt-2 hidden md:flex" />
              </div>

              <div className="grid gap-2">
                <DayBar blocks={blocks} className="md:hidden" />
                {blocks.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Available all day
                  </p>
                )}
                {blocks.map((block) => (
                  <div
                    key={block.key}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <Select
                      value={block.kind}
                      onValueChange={(kind) =>
                        patch(block.key, { kind: kind as AvailabilityKind })
                      }
                    >
                      <SelectTrigger
                        className="h-8 w-40"
                        aria-label={`${DAY_NAMES[day]} type`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UNAVAILABLE">Unavailable</SelectItem>
                        <SelectItem value="PREFERRED">Prefers to work</SelectItem>
                      </SelectContent>
                    </Select>
                    <TimeSelect
                      label={`${DAY_NAMES[day]} from`}
                      value={block.startMinute}
                      options={TIMES.slice(0, -1)}
                      onChange={(startMinute) => patch(block.key, { startMinute })}
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <TimeSelect
                      label={`${DAY_NAMES[day]} to`}
                      value={block.endMinute}
                      options={TIMES.slice(1)}
                      onChange={(endMinute) => patch(block.key, { endMinute })}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove time range"
                      onClick={() =>
                        setDrafts((all) => all.filter((d) => d.key !== block.key))
                      }
                    >
                      <X />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-fit text-muted-foreground"
                  onClick={() => addBlock(day)}
                >
                  <Plus /> Add time range
                </Button>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t px-5 py-3">
        {problem && (
          <p role="alert" className="mr-auto text-sm text-destructive">
            {problem}
          </p>
        )}
        <Button
          variant="outline"
          disabled={!dirty || save.isPending}
          onClick={() => setDrafts(saved.map(withKey))}
        >
          Reset
        </Button>
        <Button
          disabled={!dirty || Boolean(problem) || save.isPending}
          onClick={onSave}
        >
          {save.isPending && <Loader2 className="animate-spin" />}
          Save availability
        </Button>
      </div>
    </section>
  );
}

function TimeSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (minutes: number) => void;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="h-8 w-32" aria-label={label}>
        <SelectValue>{formatMinutes(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((m) => (
          <SelectItem key={m} value={String(m)}>
            {timeLabel(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A 24-hour strip showing the day's blocks at a glance. */
function DayBar({
  blocks,
  className,
}: {
  blocks: AvailabilityBlock[];
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative h-2 w-24 overflow-hidden rounded-full bg-muted md:w-full",
        className,
      )}
    >
      {blocks.map((b, i) =>
        b.kind === "AVAILABLE" ? null : (
          <span
            key={i}
            className={cn("absolute inset-y-0", KIND[b.kind].bar)}
            style={{
              left: `${(b.startMinute / 1440) * 100}%`,
              width: `${(Math.max(b.endMinute - b.startMinute, 0) / 1440) * 100}%`,
            }}
          />
        ),
      )}
    </div>
  );
}
