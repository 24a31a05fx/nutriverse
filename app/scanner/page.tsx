import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import ScannerClient from "./ScannerClient";

export const metadata: Metadata = {
  title: "Barcode Scanner & Physical QR Reader | Nutriverse",
  description:
    "Scan any food package or physical Nutriverse QR code to instantly inspect macro and micronutrient density, cooking instructions, and food pairings.",
};

export default function ScannerPage() {
  return (
    <AppShell activeTabOverride="scanner">
      <ScannerClient />
    </AppShell>
  );
}
