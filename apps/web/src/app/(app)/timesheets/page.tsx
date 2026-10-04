import type { Metadata } from "next";
import { Suspense } from "react";
import { TimesheetsView } from "@/components/timesheets/timesheets-view";

export const metadata: Metadata = { title: "Timesheets" };

export default function TimesheetsPage() {
  // Reads ?week= from the URL, which needs a Suspense boundary.
  return (
    <Suspense>
      <TimesheetsView />
    </Suspense>
  );
}
