import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import FoodExplorerClient from "./FoodExplorerClient";

export const metadata: Metadata = {
  title: "Food Explorer — Nutrition-First Whole Food Catalog | Nutriverse",
  description:
    "Explore groceries organized by macro and micronutrients. Filter by protein-rich, complex carbs, healthy fats, dietary fiber, bioavailable iron, and vitamins.",
};

export default function ExplorePage() {
  return (
    <AppShell activeTabOverride="explorer">
      <FoodExplorerClient />
    </AppShell>
  );
}
