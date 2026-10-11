import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import CartPageClient from "./CartPageClient";

export const metadata: Metadata = {
  title: "Your Nutrition Bag — Nutriverse",
  description: "Review and manage items in your Nutriverse shopping bag before checkout.",
};

export default function CartPage() {
  return (
    <AppShell activeTabOverride="storefront">
      <CartPageClient />
    </AppShell>
  );
}
