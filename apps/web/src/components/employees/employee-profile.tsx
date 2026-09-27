"use client";

import {
  ArrowLeft,
  CalendarDays,
  Mail,
  MoreHorizontal,
  Phone,
  Trash2,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useDeleteEmployee,
  useEmployee,
  useUpdateEmployee,
} from "@/hooks/use-employees";
import { ApiError } from "@/lib/api";
import {
  EMPLOYMENT_TYPE_LABEL,
  formatDateOnly,
  formatMoney,
  fullName,
} from "@/lib/format";
import { AvailabilityEditor } from "./availability-editor";
import { EmployeeAvatar, PositionBadge, StatusBadge } from "./badges";
import { CertificationsPanel } from "./certifications-panel";
import { EmployeeForm } from "./employee-form";

export function EmployeeProfile({ id }: { id: string }) {
  const router = useRouter();
  const { data: employee, isPending, isError, error } = useEmployee(id);
  const update = useUpdateEmployee(id);
  const remove = useDeleteEmployee();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Bumped after a save so the details form resets to the saved values.
  const [formVersion, setFormVersion] = useState(0);

  if (isPending) {
    return (
      <div className="mx-auto grid max-w-4xl gap-6">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-20" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isError || !employee) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <div className="mx-auto grid max-w-md place-items-center gap-3 py-20 text-center">
        <p className="font-medium">
          {missing ? "This employee doesn't exist" : "Couldn't load employee"}
        </p>
        <Button variant="outline" asChild>
          <Link href="/employees">Back to employees</Link>
        </Button>
      </div>
    );
  }

  const terminate = async () => {
    await update.mutateAsync({ status: "TERMINATED" });
    toast.success(`${fullName(employee)} marked as terminated`);
  };

  const hardDelete = async () => {
    try {
      await remove.mutateAsync(id);
      toast.success(`${fullName(employee)} deleted`);
      router.replace("/employees");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't delete");
    } finally {
      setConfirmDelete(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <Link
        href="/employees"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Employees
      </Link>

      <header className="flex flex-wrap items-start gap-4">
        <EmployeeAvatar employee={employee} className="size-14 text-base" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {fullName(employee)}
            </h1>
            <StatusBadge status={employee.status} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {employee.positions.map((p) => (
              <PositionBadge key={p.id} position={p} />
            ))}
          </div>
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {employee.email && (
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Email</dt>
                <Mail className="size-3.5" />
                <dd>
                  <a href={`mailto:${employee.email}`} className="hover:underline">
                    {employee.email}
                  </a>
                </dd>
              </div>
            )}
            {employee.phone && (
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Phone</dt>
                <Phone className="size-3.5" />
                <dd>
                  <a href={`tel:${employee.phone}`} className="hover:underline">
                    {employee.phone}
                  </a>
                </dd>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Hired</dt>
              <CalendarDays className="size-3.5" />
              <dd>Hired {formatDateOnly(employee.hireDate)}</dd>
            </div>
            <div>
              <dt className="sr-only">Pay</dt>
              <dd>
                {EMPLOYMENT_TYPE_LABEL[employee.employmentType]} ·{" "}
                {formatMoney(employee.hourlyRate)}/hr
              </dd>
            </div>
          </dl>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="More actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {employee.status !== "TERMINATED" && (
              <DropdownMenuItem onSelect={terminate}>
                <UserX /> Mark as terminated
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setConfirmDelete(true)}
            >
              <Trash2 /> Delete permanently
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="certifications">
            Certifications
            {employee.certifications.length > 0 && (
              <span className="ml-1 text-muted-foreground">
                {employee.certifications.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <section className="rounded-xl border bg-card p-5">
            <EmployeeForm
              key={formVersion}
              employee={employee}
              submitLabel="Save changes"
              onSubmit={async (input) => {
                try {
                  await update.mutateAsync(input);
                  setFormVersion((v) => v + 1);
                  toast.success("Changes saved");
                } catch (err) {
                  toast.error(
                    err instanceof ApiError ? err.message : "Couldn't save",
                  );
                }
              }}
            />
          </section>
        </TabsContent>

        <TabsContent value="availability" className="mt-4">
          <AvailabilityEditor employee={employee} />
        </TabsContent>

        <TabsContent value="certifications" className="mt-4">
          <CertificationsPanel employee={employee} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {fullName(employee)}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes their profile for good. Staff with shift history or
              a login can&apos;t be deleted — mark them as terminated instead so
              past schedules and payroll stay accurate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                void hardDelete();
              }}
              disabled={remove.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
