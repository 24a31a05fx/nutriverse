import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import CombinationsClient from "./CombinationsClient";

export const metadata: Metadata = {
  title: "Food Combinations & Plate Synergy Calculator | Nutriverse",
  description:
    "Combine whole foods on your plate to calculate combined protein, fiber, calories, and micronutrient synergies in real time.",
};

export default function CombinationsPage() {
  return (
    <AppShell activeTabOverride="combinations">
      <CombinationsClient />
    </AppShell>
  );
}
