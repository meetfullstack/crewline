import type { ComponentProps } from "react";
import type { FieldError } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormFieldProps extends ComponentProps<typeof Input> {
  id: string;
  label: string;
  error?: FieldError;
  hint?: string;
}

/** Labelled input with an accessible error message. */
export function FormField({ id, label, error, hint, ...input }: FormFieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="h-10"
        {...input}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error.message}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
