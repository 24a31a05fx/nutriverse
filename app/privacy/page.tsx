import React from "react";
import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const metadata = {
  title: "Privacy Policy (Draft) • Nutriverse",
  description: "Nutriverse data privacy policies and commitment to personal data protection.",
};

export default function PrivacyPage() {
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
              This policy documents the Nutriverse data collection and privacy framework in alignment with the Digital Personal Data Protection (DPDP) Act 2023.
            </p>
          </div>
        </div>

        <article className="bg-white border border-[#DDD3B8]/60 rounded-3xl p-6 sm:p-10 space-y-8 text-[#232A16]">
          <header className="space-y-2 border-b border-[#DDD3B8]/40 pb-6">
            <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-[#232A16]">
              Privacy Policy
            </h1>
            <p className="text-xs text-[#6B7A45]">
              Last updated: October 11, 2026 • Version 1.0 (Demo MVP Draft)
            </p>
          </header>

          <section className="space-y-3 text-xs leading-relaxed text-[#3E4A26]">
            <h2 className="font-heading text-base font-bold text-[#232A16]">1. Purpose &amp; Overview</h2>
            <p>
              Nutriverse Technologies (&quot;Nutriverse&quot;, &quot;we&quot;, &quot;our&quot;) is committed to transparent and responsible handling of personal information. This Privacy Policy details the categories of personal data collected, processing rationales, and customer privacy rights when using our nutrition-first grocery store and Calin Pack customization tools.
            </p>
          </section>

          <section className="space-y-3 text-xs leading-relaxed text-[#3E4A26]">
            <h2 className="font-heading text-base font-bold text-[#232A16]">2. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Account Credentials:</strong> Name, verified email address, and encrypted password credentials.</li>
              <li><strong>Physical &amp; Nutrition Metrics:</strong> Voluntary physical attributes (age, sex, height, weight, activity level) utilized strictly for Mifflin–St Jeor BMR/TDEE calculations and Calin Pack generation.</li>
              <li><strong>Dietary Preferences &amp; Declared Allergens:</strong> Customer-declared food exclusions applied as hard filtering constraints during pack building.</li>
              <li><strong>Transactional Records:</strong> Order item snapshots, delivery addresses, and fulfillment logs. No real credit card or bank account information is ever processed or stored during the Demo MVP.</li>
            </ul>
          </section>

          <section className="space-y-3 text-xs leading-relaxed text-[#3E4A26]">
            <h2 className="font-heading text-base font-bold text-[#232A16]">3. Voluntary Consent &amp; Revocation</h2>
            <p>
              Providing physical health metrics is strictly optional. Health data processing requires explicit customer opt-in consent. Customers may revoke health data consent at any time via their Account settings, upon which health attributes are purged from active calculation engines.
            </p>
          </section>

          <section className="space-y-3 text-xs leading-relaxed text-[#3E4A26]">
            <h2 className="font-heading text-base font-bold text-[#232A16]">4. Nutritionist Consultation Privacy</h2>
            <p>
              When requesting certified nutritionist review for a Calin Pack, consultation remarks and proposed substitutions remain strictly segregated. Customer context is shared with the assigned nutritionist only upon explicit request, and suggested pack modifications require customer confirmation before taking effect.
            </p>
          </section>

          <section className="space-y-3 text-xs leading-relaxed text-[#3E4A26]">
            <h2 className="font-heading text-base font-bold text-[#232A16]">5. Contact Us</h2>
            <p>
              For privacy inquiries, data access requests, or consent updates, please submit an inquiry via our{" "}
              <Link href="/contact" className="underline font-bold text-[#3E4A26]">Contact Page</Link>.
            </p>
          </section>
        </article>
      </div>
    </AppShell>
  );
}
