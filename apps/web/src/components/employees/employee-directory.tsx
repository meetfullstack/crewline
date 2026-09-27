"use client";

import { Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  type EmployeeFilters,
  useEmployees,
  usePositions,
} from "@/hooks/use-employees";
import {
  EMPLOYMENT_TYPE_LABEL,
  formatMoney,
  fullName,
} from "@/lib/format";
import {
  CertificationAlert,
  EmployeeAvatar,
  PositionBadge,
  StatusBadge,
} from "./badges";
import { EmployeeFormDialog } from "./employee-form-dialog";

// Select values: "current" = everyone except terminated (the API default).
const ANY_POSITION = "any";
const CURRENT = "current";

export function EmployeeDirectory() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(CURRENT);
  const [positionId, setPositionId] = useState<string>(ANY_POSITION);
  const [creating, setCreating] = useState(false);

  const filters: EmployeeFilters = {
    q: useDebouncedValue(search.trim()) || undefined,
    status: status === CURRENT ? undefined : (status as EmployeeFilters["status"]),
    positionId: positionId === ANY_POSITION ? undefined : positionId,
  };
  const { data: employees, isPending, isError, isFetching } =
    useEmployees(filters);
  const { data: positions } = usePositions();
  const filtered = Boolean(filters.q || filters.status || filters.positionId);

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {employees
              ? `${employees.length} ${filtered ? "matching" : "active"} team member${employees.length === 1 ? "" : "s"}`
              : "Your team, their roles and availability."}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus /> Add employee
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or phone"
            aria-label="Search employees"
            className="h-9 pl-9"
          />
        </div>
        <Select value={positionId} onValueChange={setPositionId}>
          <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Position">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_POSITION}>All positions</SelectItem>
            {positions?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-full sm:w-40" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CURRENT}>Current staff</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="ON_LEAVE">On leave</SelectItem>
            <SelectItem value="TERMINATED">Terminated</SelectItem>
            <SelectItem value="ALL">Everyone</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div
        className="overflow-hidden rounded-xl border bg-card transition-opacity data-[fetching=true]:opacity-70"
        data-fetching={isFetching && !isPending}
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Positions</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead className="hidden text-right sm:table-cell">
                Rate
              </TableHead>
              <TableHead className="hidden text-right lg:table-cell">
                Max hrs/wk
              </TableHead>
              <TableHead className="pr-4">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending &&
              Array.from({ length: 6 }, (_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6} className="px-4">
                    <Skeleton className="h-8" />
                  </TableCell>
                </TableRow>
              ))}

            {employees?.map((employee) => (
              <TableRow
                key={employee.id}
                className="cursor-pointer"
                onClick={() => router.push(`/employees/${employee.id}`)}
              >
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar employee={employee} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {/* Real link keeps rows keyboard- and middle-click-friendly. */}
                        <Link
                          href={`/employees/${employee.id}`}
                          className="truncate font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {fullName(employee)}
                        </Link>
                        <CertificationAlert
                          alerts={employee.certificationAlerts}
                        />
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {employee.email ?? employee.phone ?? "No contact info"}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {employee.positions.length === 0 && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                    {employee.positions.map((p) => (
                      <PositionBadge key={p.id} position={p} />
                    ))}
                  </div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {EMPLOYMENT_TYPE_LABEL[employee.employmentType]}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {formatMoney(employee.hourlyRate)}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums text-muted-foreground lg:table-cell">
                  {employee.maxWeeklyHours ?? "—"}
                </TableCell>
                <TableCell className="pr-4">
                  <StatusBadge status={employee.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {employees?.length === 0 && (
          <div className="grid place-items-center gap-2 px-4 py-14 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="font-medium">
              {filtered ? "No one matches those filters" : "No employees yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {filtered
                ? "Try a different search or clear the filters."
                : "Add your first team member to start scheduling."}
            </p>
          </div>
        )}
        {isError && (
          <p className="px-4 py-10 text-center text-sm text-destructive">
            Couldn&apos;t load employees. Refresh to try again.
          </p>
        )}
      </div>

      <EmployeeFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(employee) => router.push(`/employees/${employee.id}`)}
      />
    </div>
  );
}
