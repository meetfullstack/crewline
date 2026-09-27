"use client";

import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateEmployee } from "@/hooks/use-employees";
import { ApiError } from "@/lib/api";
import { fullName } from "@/lib/format";
import type { EmployeeDetail } from "@/lib/types";
import { EmployeeForm } from "./employee-form";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (employee: EmployeeDetail) => void;
}

export function EmployeeFormDialog({ open, onOpenChange, onSaved }: Props) {
  const create = useCreateEmployee();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>
            You can set their availability and certifications next.
          </DialogDescription>
        </DialogHeader>
        {/* Remount on open so the form always starts empty. */}
        {open && (
          <EmployeeForm
            submitLabel="Add employee"
            onCancel={() => onOpenChange(false)}
            onSubmit={async (input) => {
              try {
                const employee = await create.mutateAsync(input);
                toast.success(`${fullName(employee)} added to the team`);
                onOpenChange(false);
                onSaved?.(employee);
              } catch (error) {
                toast.error(
                  error instanceof ApiError
                    ? error.message
                    : "Couldn't add employee",
                );
              }
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
