"use client";

import { EmployeeHome } from "@/components/portal/employee-home";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/use-me";
import { DashboardGreeting } from "./dashboard-greeting";

/** Staff get their personal week; managers get the operations dashboard. */
export function DashboardView() {
  const { data: me, isPending } = useMe();

  if (isPending) {
    return (
      <div className="mx-auto grid max-w-4xl gap-6">
        <Skeleton className="h-14 w-72" />
        <Skeleton className="h-36" />
      </div>
    );
  }
  if (me?.role === "EMPLOYEE") return <EmployeeHome />;

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <DashboardGreeting />
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Today&apos;s staffing, labour cost and warnings will live here — that&apos;s
        the next milestone.
      </div>
    </div>
  );
}
