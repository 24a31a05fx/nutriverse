import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import AccountPageClient from "./AccountPageClient";

export const metadata: Metadata = {
  title: "Member Hub & Nutrition Dashboard | Nutriverse",
  description: "View your personalized Mifflin-St Jeor daily calorie target, active Calin Pack subscriptions, and order history.",
};

export default function AccountPage() {
  return (
    <AppShell activeTabOverride="dashboard">
      <AccountPageClient />
    </AppShell>
  );
}
