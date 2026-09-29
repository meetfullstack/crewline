import type { Metadata } from "next";
import { MyShifts } from "@/components/portal/my-shifts";

export const metadata: Metadata = { title: "My shifts" };

export default function MyShiftsPage() {
  return <MyShifts />;
}
