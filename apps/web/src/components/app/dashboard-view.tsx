"use client";

import { EmployeeHome } from "@/components/portal/employee-home";
import { Skeleton } from "@/components/ui/skeleton";
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard";
import { useMe } from "@/hooks/use-me";

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
  return me?.role === "EMPLOYEE" ? <EmployeeHome /> : <ManagerDashboard />;
}
