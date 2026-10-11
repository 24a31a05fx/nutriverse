import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import OrdersPageClient from "./OrdersPageClient";

export const metadata: Metadata = {
  title: "Order History & Real-Time Tracking | Nutriverse",
  description: "View your past grocery orders, delivery receipts, and current preparation status.",
};

export default function OrdersPage() {
  return (
    <AppShell activeTabOverride="dashboard">
      <OrdersPageClient />
    </AppShell>
  );
}
