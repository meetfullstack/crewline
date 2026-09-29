"use client";

import { cn } from "cn";
import { Check, Loader2, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import { type FormEvent, useState } from "react";
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
import { useLocations, usePositions } from "@/hooks/use-employees";
import { useMe } from "@/hooks/use-me";
import {
  useCreateLocation,
  useCreatePosition,
  useDeletePosition,
  useOrganization,
  useRenameOrganization,
  useUpdateLocation,
  useUpdatePosition,
} from "@/hooks/use-settings";
import { ApiError } from "@/lib/api";
import { DAY_NAMES } from "@/lib/format";
import type { Location, Position } from "@/lib/types";

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

export function SettingsView() {
  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your business, locations and the roles you schedule.
        </p>
      </div>
      <Tabs defaultValue="locations">
        <TabsList>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
        </TabsList>
        <TabsContent value="locations" className="mt-4">
          <LocationsSettings />
        </TabsContent>
        <TabsContent value="positions" className="mt-4">
          <PositionsSettings />
        </TabsContent>
        <TabsContent value="business" className="mt-4">
          <BusinessSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Business ──────────────────────────────────────────────────────────

function BusinessSettings() {
  const { data: org } = useOrganization();
  const { data: me } = useMe();
  const rename = useRenameOrganization();
  const [name, setName] = useState<string>();
  const isOwner = me?.role === "OWNER";

  if (!org) return <Skeleton className="h-40" />;
  const value = name ?? org.name;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await rename.mutateAsync(value.trim());
      setName(undefined);
      toast.success("Business name updated");
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't save"));
    }
  };

  return (
    <form onSubmit={save} className="grid gap-4 rounded-xl border bg-card p-5">
      <div className="grid gap-1.5 sm:max-w-md">
        <Label htmlFor="org-name">Business name</Label>
        <Input
          id="org-name"
          value={value}
          maxLength={120}
          disabled={!isOwner}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {isOwner
            ? "Shown to your team across Crewline."
            : "Only the owner can change the business name."}
        </p>
      </div>
      {isOwner && (
        <Button
          type="submit"
          className="w-fit"
          disabled={!value.trim() || value.trim() === org.name || rename.isPending}
        >
          {rename.isPending && <Loader2 className="animate-spin" />}
          Save
        </Button>
      )}
    </form>
  );
}

// ─── Locations ─────────────────────────────────────────────────────────

function LocationsSettings() {
  const { data: locations } = useLocations();
  const { data: me } = useMe();
  const [adding, setAdding] = useState(false);

  if (!locations) return <Skeleton className="h-72" />;

  return (
    <div className="grid gap-4">
      {locations.map((location) => (
        <LocationForm key={location.id} location={location} />
      ))}
      {me?.role === "OWNER" &&
        (adding ? (
          <LocationForm onDone={() => setAdding(false)} />
        ) : (
          <Button variant="outline" className="w-fit" onClick={() => setAdding(true)}>
            <Plus /> Add a location
          </Button>
        ))}
    </div>
  );
}

function timeZones() {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["America/Toronto", "America/Vancouver", "America/New_York", "Europe/London"];
  }
}

function LocationForm({
  location,
  onDone,
}: {
  location?: Location;
  onDone?: () => void;
}) {
  const update = useUpdateLocation();
  const create = useCreateLocation();
  const [zones] = useState(timeZones);
  const [name, setName] = useState(location?.name ?? "");
  const [address, setAddress] = useState(location?.address ?? "");
  const [timezone, setTimezone] = useState(
    location?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [weekStartsOn, setWeekStartsOn] = useState(location?.weekStartsOn ?? 1);
  const [budget, setBudget] = useState(location?.weeklyLaborBudget?.toString() ?? "");
  const locked = location?.scheduleLocked ?? false;
  const saving = update.isPending || create.isPending;

  const budgetValue = budget.trim() === "" ? null : Number(budget);
  const budgetInvalid = budgetValue !== null && (Number.isNaN(budgetValue) || budgetValue < 0);
  const dirty =
    !location ||
    name.trim() !== location.name ||
    (address.trim() || null) !== location.address ||
    timezone !== location.timezone ||
    weekStartsOn !== location.weekStartsOn ||
    budgetValue !== location.weeklyLaborBudget;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const input = {
      name: name.trim(),
      address: address.trim() || null,
      weeklyLaborBudget: budgetValue,
      ...(locked ? {} : { timezone, weekStartsOn }),
    };
    try {
      if (location) {
        await update.mutateAsync({ id: location.id, ...input });
        toast.success(`${input.name} saved`);
      } else {
        await create.mutateAsync(input);
        toast.success(`${input.name} added`);
        onDone?.();
      }
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't save location"));
    }
  };

  return (
    <form onSubmit={save} className="grid gap-4 rounded-xl border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-medium">{location ? location.name : "New location"}</h2>
        {location && (
          <span className="text-sm text-muted-foreground">
            {location.staffCount} staff
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${location?.id ?? "new"}-name`} label="Name">
          <Input
            id={`${location?.id ?? "new"}-name`}
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field id={`${location?.id ?? "new"}-address`} label="Address">
          <Input
            id={`${location?.id ?? "new"}-address`}
            maxLength={200}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </Field>
        <Field
          id={`${location?.id ?? "new"}-budget`}
          label="Weekly labour budget (CAD)"
          hint={
            budgetInvalid
              ? "Enter a positive amount, or leave blank"
              : "Scheduled wages are tracked against this on the dashboard. Leave blank for none."
          }
          error={budgetInvalid}
        >
          <Input
            id={`${location?.id ?? "new"}-budget`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="No budget"
            value={budget}
            aria-invalid={budgetInvalid || undefined}
            onChange={(e) => setBudget(e.target.value)}
          />
        </Field>
        <div />
        <Field
          id={`${location?.id ?? "new"}-tz`}
          label="Time zone"
          hint={locked ? "Fixed once schedules exist — shifts are saved in this zone." : undefined}
          locked={locked}
        >
          <Select value={timezone} onValueChange={setTimezone} disabled={locked}>
            <SelectTrigger id={`${location?.id ?? "new"}-tz`} className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {zones.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone.replaceAll("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          id={`${location?.id ?? "new"}-week`}
          label="Schedule week starts on"
          hint={locked ? "Fixed once schedules exist." : undefined}
          locked={locked}
        >
          <Select
            value={String(weekStartsOn)}
            onValueChange={(v) => setWeekStartsOn(Number(v))}
            disabled={locked}
          >
            <SelectTrigger id={`${location?.id ?? "new"}-week`} className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_NAMES.map((day, i) => (
                <SelectItem key={day} value={String(i)}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={!name.trim() || budgetInvalid || !dirty || saving}>
          {saving && <Loader2 className="animate-spin" />}
          {location ? "Save changes" : "Add location"}
        </Button>
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  locked,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: boolean;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="flex items-center gap-1.5">
        {label}
        {locked && <Lock className="size-3 text-muted-foreground" aria-label="Locked" />}
      </Label>
      {children}
      {hint && (
        <p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
          {hint}
        </p>
      )}
    </div>
  );
}

// ─── Positions ─────────────────────────────────────────────────────────

const SWATCH_NAMES: Record<string, string> = {
  "#f97316": "Orange",
  "#ef4444": "Red",
  "#ec4899": "Pink",
  "#8b5cf6": "Violet",
  "#6366f1": "Indigo",
  "#0ea5e9": "Sky blue",
  "#06b6d4": "Cyan",
  "#10b981": "Emerald",
  "#84cc16": "Lime",
  "#eab308": "Yellow",
  "#a3a3a3": "Grey",
  "#64748b": "Slate",
};
const SWATCHES = Object.keys(SWATCH_NAMES);

function PositionsSettings() {
  const { data: positions } = usePositions();
  const create = useCreatePosition();
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await create.mutateAsync({ name: name.trim(), color });
      toast.success(`${name.trim()} added`);
      setName("");
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't add position"));
    }
  };

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border bg-card">
        <header className="border-b px-5 py-3">
          <h2 className="font-medium">Positions</h2>
          <p className="text-sm text-muted-foreground">
            The roles you schedule. Colours are used on the schedule and badges.
          </p>
        </header>
        {!positions ? (
          <div className="p-5">
            <Skeleton className="h-40" />
          </div>
        ) : (
          <ul className="divide-y">
            {positions.map((p) => (
              <PositionRow key={p.id} position={p} />
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={add} className="grid gap-3 rounded-xl border bg-card p-5">
        <h2 className="font-medium">Add a position</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="new-position">Name</Label>
            <Input
              id="new-position"
              placeholder="e.g. Sommelier"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            Add
          </Button>
        </div>
        <ColorPicker value={color} onChange={setColor} />
      </form>
    </div>
  );
}

function PositionRow({ position }: { position: Position }) {
  const update = useUpdatePosition();
  const remove = useDeletePosition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(position.name);
  const [color, setColor] = useState(position.color);
  const [confirming, setConfirming] = useState(false);
  const staff = position._count?.employees ?? 0;

  const save = async () => {
    try {
      await update.mutateAsync({ id: position.id, name: name.trim(), color });
      toast.success("Position updated");
      setEditing(false);
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't save"));
    }
  };

  const onDelete = async () => {
    try {
      await remove.mutateAsync(position.id);
      toast.success(`${position.name} deleted`);
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't delete"));
    } finally {
      setConfirming(false);
    }
  };

  if (editing) {
    return (
      <li className="grid gap-3 px-5 py-4">
        <div className="flex gap-2">
          <Input
            aria-label="Position name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            className="h-9"
            autoFocus
          />
          <Button
            size="icon"
            aria-label="Save position"
            disabled={!name.trim() || update.isPending}
            onClick={save}
          >
            {update.isPending ? <Loader2 className="animate-spin" /> : <Check />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Cancel editing"
            onClick={() => {
              setName(position.name);
              setColor(position.color);
              setEditing(false);
            }}
          >
            <X />
          </Button>
        </div>
        <ColorPicker value={color} onChange={setColor} />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span
        aria-hidden
        className="size-3 rounded-full"
        style={{ backgroundColor: position.color }}
      />
      <span className="flex-1 font-medium">{position.name}</span>
      <span className="text-sm text-muted-foreground">
        {staff} staff
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${position.name}`}
        onClick={() => setEditing(true)}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${position.name}`}
        onClick={() => setConfirming(true)}
      >
        <Trash2 />
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {position.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {staff
                ? `${staff} staff member${staff > 1 ? "s" : ""} will lose this position. `
                : ""}
              Positions used by scheduled shifts can&apos;t be deleted — rename it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                void onDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Colour</legend>
      <div className="flex flex-wrap items-center gap-2">
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={SWATCH_NAMES[swatch]}
            aria-pressed={value === swatch}
            onClick={() => onChange(swatch)}
            className={cn(
              "size-7 rounded-full ring-offset-2 ring-offset-card transition-shadow",
              value === swatch && "ring-2 ring-foreground",
            )}
            style={{ backgroundColor: swatch }}
          />
        ))}
        <label className="relative size-7 cursor-pointer overflow-hidden rounded-full border border-dashed">
          <span className="sr-only">Custom colour</span>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
          <Plus className="absolute inset-0 m-auto size-3.5 text-muted-foreground" />
        </label>
      </div>
    </fieldset>
  );
}
