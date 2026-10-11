import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import PackTierClient from "./PackTierClient";

const tierTitles: Record<string, string> = {
  basic: "Calin Basic Pack (Essential Whole-Food Staples)",
  minimal_plus: "Calin Minimal Plus Pack (Balanced Macronutrient Diversity)",
  premium: "Calin Premium Pack (Deep Micronutrient Density & Healthy Fats)",
};

export async function generateStaticParams() {
  return [
    { tier: "basic" },
    { tier: "minimal_plus" },
    { tier: "premium" },
  ];
}

export async function generateMetadata({
  params,
}: {
  params: { tier: string };
}): Promise<Metadata> {
  const title = tierTitles[params.tier];
  if (!title) {
    return { title: "Calin Pack — Nutriverse" };
  }
  return {
    title: `${title} — Nutriverse`,
    description: `Personalized whole-food nutrition package tailored to your daily nutritional requirement. Customizable with up to 5 whole-food swaps.`,
  };
}

export default function PackTierPage({
  params,
}: {
  params: { tier: string };
}) {
  const validTiers = ["basic", "minimal_plus", "premium"];
  if (!validTiers.includes(params.tier)) {
    notFound();
  }

  return (
    <AppShell activeTabOverride="packs">
      <PackTierClient initialTier={params.tier} />
    </AppShell>
  );
}
