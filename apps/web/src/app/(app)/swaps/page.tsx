import type { Metadata } from "next";
import { SwapsView } from "@/components/swaps/swaps-view";

export const metadata: Metadata = { title: "Shift swaps" };

export default function SwapsPage() {
  return <SwapsView />;
}
