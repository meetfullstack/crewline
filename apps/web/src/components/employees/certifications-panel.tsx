"use client";

import { cn } from "cn";
import { BadgeCheck, Loader2, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCertificationMutations } from "@/hooks/use-employees";
import { ApiError } from "@/lib/api";
import { formatDateOnly } from "@/lib/format";
import type { Certification, EmployeeDetail } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function expiryState(cert: Certification, now: number) {
  if (!cert.expiresAt) return { label: "No expiry", tone: "muted" } as const;
  const expires = new Date(cert.expiresAt).getTime();
  if (expires < now) return { label: "Expired", tone: "bad" } as const;
  const days = Math.ceil((expires - now) / DAY_MS);
  if (days <= 30) {
    return { label: `Expires in ${days} day${days === 1 ? "" : "s"}`, tone: "warn" } as const;
  }
  return { label: "Valid", tone: "good" } as const;
}

const TONE = {
  muted: "bg-muted text-muted-foreground ring-border",
  good: "bg-success/12 text-success ring-success/25",
  warn: "bg-warning/15 text-amber-700 dark:text-warning ring-warning/30",
  bad: "bg-destructive/10 text-destructive ring-destructive/25",
};

const SUGGESTIONS = ["Smart Serve", "Food Handler", "First Aid & CPR", "WHMIS"];

export function CertificationsPanel({ employee }: { employee: EmployeeDetail }) {
  const { add, remove } = useCertificationMutations(employee.id);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [now] = useState(() => Date.now());

  const reset = () => {
    setAdding(false);
    setName("");
    setIssuedAt("");
    setExpiresAt("");
  };

  const onAdd = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await add.mutateAsync({
        name: name.trim(),
        issuedAt: issuedAt || null,
        expiresAt: expiresAt || null,
      });
      toast.success(`${name.trim()} added`);
      reset();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't add");
    }
  };

  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="font-medium">Certifications</h2>
          <p className="text-sm text-muted-foreground">
            Alcohol service, food safety and other required training.
          </p>
        </div>
        {!adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add
          </Button>
        )}
      </div>

      {adding && (
        <form
          onSubmit={onAdd}
          className="grid gap-3 border-b bg-muted/30 px-5 py-4 sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="cert-name">Name</Label>
            <Input
              id="cert-name"
              list="cert-suggestions"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <datalist id="cert-suggestions">
              {SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cert-issued">Issued</Label>
            <Input
              id="cert-issued"
              type="date"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cert-expires">Expires</Label>
            <Input
              id="cert-expires"
              type="date"
              min={issuedAt || undefined}
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={reset}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || add.isPending}>
              {add.isPending && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      )}

      {employee.certifications.length === 0 && !adding ? (
        <div className="grid place-items-center gap-2 px-5 py-12 text-center">
          <BadgeCheck className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No certifications on file.
          </p>
        </div>
      ) : (
        <ul className="divide-y">
          {employee.certifications.map((cert) => {
            const state = expiryState(cert, now);
            return (
              <li key={cert.id} className="flex items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{cert.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Issued {formatDateOnly(cert.issuedAt)} · Expires{" "}
                    {formatDateOnly(cert.expiresAt)}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                    TONE[state.tone],
                  )}
                >
                  {state.label}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${cert.name}`}
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(cert.id, {
                      onSuccess: () => toast.success(`${cert.name} removed`),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
