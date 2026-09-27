"use client";

import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/use-me";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardGreeting() {
  const { data: me } = useMe();

  // `me` only resolves in the browser, so the local clock is read client-side
  // and never mismatches the server render.
  if (!me) {
    return (
      <div className="grid gap-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-8 w-64" />
      </div>
    );
  }

  const now = new Date();
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {format(now, "EEEE, MMMM d")}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {greeting(now.getHours())}, {me.employee?.firstName ?? "there"}
      </h1>
    </div>
  );
}
