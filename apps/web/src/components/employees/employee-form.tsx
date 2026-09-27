"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "cn";
import { Check, Loader2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePositions } from "@/hooks/use-employees";
import { EMPLOYMENT_TYPE_LABEL, STATUS_LABEL, toDateInput } from "@/lib/format";
import type { EmployeeDetail, EmployeeInput } from "@/lib/types";

// Number inputs arrive as strings; blank means "not set".
const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    schema.nullable(),
  );

const schema = z.object({
  firstName: z.string().trim().min(1, "Required").max(60),
  lastName: z.string().trim().min(1, "Required").max(60),
  email: z.union([z.literal(""), z.email("Enter a valid email")]),
  phone: z.string().trim().max(30),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CASUAL"]),
  status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]),
  hourlyRate: optionalNumber(
    z.number("Enter a rate").min(0, "Can't be negative").max(1000),
  ),
  maxWeeklyHours: optionalNumber(
    z.number().int("Whole hours only").min(1, "At least 1").max(80, "80 max"),
  ),
  hireDate: z.string(),
  notes: z.string().max(2000),
  positionIds: z.array(z.string()),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export function toEmployeeInput(values: FormOutput): EmployeeInput {
  return {
    ...values,
    email: values.email || undefined,
    phone: values.phone || undefined,
    hourlyRate: values.hourlyRate ?? 0,
    hireDate: values.hireDate || null,
    notes: values.notes || null,
  };
}

function defaults(employee?: EmployeeDetail): FormInput {
  return {
    firstName: employee?.firstName ?? "",
    lastName: employee?.lastName ?? "",
    email: employee?.email ?? "",
    phone: employee?.phone ?? "",
    employmentType: employee?.employmentType ?? "PART_TIME",
    status: employee?.status ?? "ACTIVE",
    hourlyRate: employee ? String(employee.hourlyRate) : "",
    maxWeeklyHours: employee?.maxWeeklyHours?.toString() ?? "",
    hireDate: toDateInput(employee?.hireDate),
    notes: employee?.notes ?? "",
    positionIds: employee?.positions.map((p) => p.id) ?? [],
  };
}

interface EmployeeFormProps {
  employee?: EmployeeDetail;
  submitLabel: string;
  onSubmit: (input: EmployeeInput) => Promise<unknown>;
  onCancel?: () => void;
}

export function EmployeeForm({
  employee,
  submitLabel,
  onSubmit,
  onCancel,
}: EmployeeFormProps) {
  const { data: positions } = usePositions();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: defaults(employee),
  });

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(toEmployeeInput(values)))}
      noValidate
      className="grid gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="firstName"
          label="First name"
          autoComplete="off"
          error={errors.firstName}
          {...register("firstName")}
        />
        <FormField
          id="lastName"
          label="Last name"
          autoComplete="off"
          error={errors.lastName}
          {...register("lastName")}
        />
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="off"
          error={errors.email}
          {...register("email")}
        />
        <FormField
          id="phone"
          label="Phone"
          type="tel"
          autoComplete="off"
          error={errors.phone}
          {...register("phone")}
        />
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Positions</legend>
        <p className="-mt-1 mb-1 text-xs text-muted-foreground">
          The first one selected is their primary position.
        </p>
        <Controller
          control={control}
          name="positionIds"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {positions?.map((position) => {
                const index = field.value.indexOf(position.id);
                const selected = index >= 0;
                return (
                  <button
                    key={position.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      field.onChange(
                        selected
                          ? field.value.filter((id) => id !== position.id)
                          : [...field.value, position.id],
                      )
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                      selected
                        ? "border-foreground/30 bg-accent font-medium"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {selected ? (
                      <Check className="size-3.5" />
                    ) : (
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{ backgroundColor: position.color }}
                      />
                    )}
                    {position.name}
                    {index === 0 && (
                      <span className="text-xs text-muted-foreground">
                        · primary
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="employmentType">Employment type</Label>
          <Controller
            control={control}
            name="employmentType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="employmentType" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EMPLOYMENT_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="status">Status</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="status" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <FormField
          id="hourlyRate"
          label="Hourly rate (CAD)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="17.60"
          error={errors.hourlyRate}
          {...register("hourlyRate")}
        />
        <FormField
          id="maxWeeklyHours"
          label="Max hours per week"
          type="number"
          inputMode="numeric"
          min="1"
          max="80"
          placeholder="No limit"
          error={errors.maxWeeklyHours}
          {...register("maxWeeklyHours")}
        />
        <FormField
          id="hireDate"
          label="Hire date"
          type="date"
          error={errors.hireDate}
          {...register("hireDate")}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={3}
          placeholder="Only visible to managers"
          {...register("notes")}
        />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || (Boolean(employee) && !isDirty)}
        >
          {isSubmitting && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
