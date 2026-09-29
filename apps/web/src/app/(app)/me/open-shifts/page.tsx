import type { Metadata } from "next";
import { OpenShifts } from "@/components/portal/open-shifts";

export const metadata: Metadata = { title: "Open shifts" };

export default function OpenShiftsPage() {
  return <OpenShifts />;
}
