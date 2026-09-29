import type { Metadata } from "next";
import { MyAvailability } from "@/components/portal/my-availability";

export const metadata: Metadata = { title: "Availability" };

export default function MyAvailabilityPage() {
  return <MyAvailability />;
}
