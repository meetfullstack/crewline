import type { Metadata } from "next";
import { Suspense } from "react";
import { ScheduleBuilder } from "@/components/schedule/schedule-builder";

export const metadata: Metadata = { title: "Schedule" };

export default function SchedulePage() {
  // The builder reads ?week= from the URL, which needs a Suspense boundary.
  return (
    <Suspense>
      <ScheduleBuilder />
    </Suspense>
  );
}
