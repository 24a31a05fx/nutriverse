import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import NutritionistPageClient from "./NutritionistPageClient";

export const metadata: Metadata = {
  title: "Nutritionist Review Queue | Nutriverse",
  description: "Review customer dietary requirements, allergies, and deliver expert nutritionist guidance notes.",
};

export default function NutritionistPage() {
  return (
    <AppShell activeTabOverride="admin">
      <NutritionistPageClient />
    </AppShell>
  );
}
