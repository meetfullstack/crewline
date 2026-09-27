import type { Metadata } from "next";
import { DashboardGreeting } from "@/components/app/dashboard-greeting";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <DashboardGreeting />
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Staffing, labour cost and open shifts will live here once scheduling
        is in place.
      </div>
    </div>
  );
}
