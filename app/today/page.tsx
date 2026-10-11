import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import TodayClient from "./TodayClient";

export const metadata: Metadata = {
  title: "Today's Targets — Personalized Nutrition & Calorie Plan | Nutriverse",
  description:
    "View your daily metabolic energy expenditure, Mifflin–St Jeor calorie and macro targets, active Calin Pack status, and whole food intake guidelines.",
};

export default function TodayPage() {
  return (
    <AppShell activeTabOverride="dashboard">
      <TodayClient />
    </AppShell>
  );
}
