import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import AdminPageClient from "./AdminPageClient";

export const metadata: Metadata = {
  title: "Operations & Admin Console — Nutriverse",
  description: "Manage inventory stock, live quick-commerce orders, customer subscriptions, and nutritionist queues.",
};

export default function AdminPage() {
  return (
    <AppShell activeTabOverride="admin">
      <AdminPageClient />
    </AppShell>
  );
}
