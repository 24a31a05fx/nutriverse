import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import PacksClient from "./PacksClient";

export const metadata: Metadata = {
  title: "Calin Packs — Bioactive Nutrition Bundles | Nutriverse",
  description:
    "Tailored grocery packages designed around your daily calorie and micronutrient target. Choose from Basic (₹699), Minimal Plus (₹1,099), or Premium (₹1,699).",
};

export default function PacksPage() {
  return (
    <AppShell activeTabOverride="packs">
      <PacksClient />
    </AppShell>
  );
}
