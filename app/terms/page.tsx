import React from "react";
import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const metadata = {
  title: "Terms of Concept (Draft) • Nutriverse",
  description: "Nutriverse terms and conditions governing prototype evaluation and grocery services.",
};

export default function TermsPage() {
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#6B7A45] hover:text-[#3E4A26] mb-6 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Storefront</span>
        </Link>

        {/* Status Banner */}
        <div className="p-3.5 bg-[#F6F1E4] border border-[#DDD3B8] rounded-2xl mb-8 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-[#3E4A26] shrink-0" />
          <div>
            <p className="text-xs font-bold text-[#232A16]">
              Draft Notice — Pending Client &amp; Legal Review
            </p>
            <p className="text-[11px] text-[#6B7A45]">
              These terms govern the Nutriverse demonstration web application and client evaluation release.
            </p>
          </div>
        </div>

        <article className="bg-white border border-[#DDD3B8]/60 rounded-3xl p-6 sm:p-10 space-y-8 text-[#232A16]">
          <header className="space-y-2 border-b border-[#DDD3B8]/40 pb-6">
            <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-[#232A16]">
              Terms of Concept &amp; Service
            </h1>
            <p className="text-xs text-[#6B7A45]">
              Last updated: October 11, 2026 • Version 1.0 (Demo MVP Draft)
            </p>
          </header>

          <section className="space-y-3 text-xs leading-relaxed text-[#3E4A26]">
            <h2 className="font-heading text-base font-bold text-[#232A16]">1. Demonstration Release Scope</h2>
            <p>
              The Nutriverse application represents a production-grade quick-commerce grocery and nutrition evaluation prototype. All checkout workflows are strictly demonstration orders (&quot;Demo checkout — no payment will be taken and no real delivery is booked&quot;). No commercial payments are accepted and no courier dispatches occur during this evaluation phase.
            </p>
          </section>

          <section className="space-y-3 text-xs leading-relaxed text-[#3E4A26]">
            <h2 className="font-heading text-base font-bold text-[#232A16]">2. Nutrition Information &amp; Medical Disclaimer</h2>
            <p>
              <strong>Nutritional estimates are for dietary guidance and awareness only, not medical advice, diagnosis, or clinical prescription.</strong> All food nutrient records are sourced from empirical references (Indian Food Composition Tables IFCT 2017 and ICMR-NIN RDA 2020). Fields without empirical citation are explicitly marked as &quot;Not verified&quot;. Individuals with diagnosed clinical conditions, severe allergies, or special medical needs must consult qualified healthcare practitioners.
            </p>
          </section>

          <section className="space-y-3 text-xs leading-relaxed text-[#3E4A26]">
            <h2 className="font-heading text-base font-bold text-[#232A16]">3. Calin Packs &amp; Customization Rules</h2>
            <p>
              Calin Pack bundles represent nutritional food baskets designed to satisfy macronutrient and micronutrient baselines. Tier prices are indicative ranges based on current market availability. Ingredient substitutions recalculate nutrient parity dynamically. Any nutritionist suggestions are advisory proposals requiring explicit customer confirmation.
            </p>
          </section>

          <section className="space-y-3 text-xs leading-relaxed text-[#3E4A26]">
            <h2 className="font-heading text-base font-bold text-[#232A16]">4. Replacement &amp; Quality Policy</h2>
            <p>
              In production operations, Nutriverse honors a 48-hour doorstep replacement policy for any damaged, compromised, or sub-standard grocery items. During this demo release, order cancellation is supported directly via the Order Details interface.
            </p>
          </section>

          <section className="space-y-3 text-xs leading-relaxed text-[#3E4A26]">
            <h2 className="font-heading text-base font-bold text-[#232A16]">5. Questions</h2>
            <p>
              For questions regarding these terms, please contact the Nutriverse team via our{" "}
              <Link href="/contact" className="underline font-bold text-[#3E4A26]">Contact Page</Link>.
            </p>
          </section>
        </article>
      </div>
    </AppShell>
  );
}
