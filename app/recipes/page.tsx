import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import RecipesClient from "./RecipesClient";

export const metadata: Metadata = {
  title: "Bio-Recipes & Nutrient-Preserving Prep Methods | Nutriverse",
  description:
    "Discover whole-food recipes designed to retain enzymes and micronutrients. Steam, soak, and combine foods for maximum bioavailability.",
};

export default function RecipesPage() {
  return (
    <AppShell activeTabOverride="recipes">
      <RecipesClient />
    </AppShell>
  );
}
