import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import CheckoutPageClient from "./CheckoutPageClient";

export const metadata: Metadata = {
  title: "Secure Checkout — Nutriverse Quick-Commerce",
  description: "Complete your nutrition-first grocery order with express delivery in Vijayawada.",
};

export default function CheckoutPage() {
  return (
    <AppShell activeTabOverride="storefront">
      <CheckoutPageClient />
    </AppShell>
  );
}
