import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import TargetsClient from "./TargetsClient";

export const metadata: Metadata = {
  title: "Personalized Nutrition Targets — Scientific Energy & Macro Estimation | Nutriverse",
  description:
    "Calculate your evidence-based daily energy expenditure and macronutrient distribution targets using the Mifflin-St Jeor (1990) and ICMR-NIN (2020) predictive equations.",
};

export default function TargetsPage() {
  return (
    <AppShell activeTabOverride="dashboard">
      <TargetsClient />
    </AppShell>
  );
}
