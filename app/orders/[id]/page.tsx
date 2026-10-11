import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import OrderDetailClient from "./OrderDetailClient";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  return {
    title: `Order #${params.id.slice(0, 8)} Tracking — Nutriverse`,
    description: `Track real-time fulfillment and dispatch status for order #${params.id}.`,
  };
}

export default function OrderTrackingPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <AppShell activeTabOverride="dashboard">
      <OrderDetailClient orderId={params.id} />
    </AppShell>
  );
}
