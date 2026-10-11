import React from "react";
import Link from "next/link";
import { Mail, MapPin, Phone, ShieldCheck, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const metadata = {
  title: "Contact & Support (Draft) • Nutriverse",
  description: "Connect with the Nutriverse product and nutrition team.",
};

export default function ContactPage() {
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
              Draft Notice — Pending Client/Legal Review
            </p>
            <p className="text-[11px] text-[#6B7A45]">
              Contact details shown below reflect operational channels for the Nutriverse evaluation pilot.
            </p>
          </div>
        </div>

        <div className="bg-white border border-[#DDD3B8]/60 rounded-3xl p-6 sm:p-10 space-y-8 text-[#232A16]">
          <header className="space-y-2 border-b border-[#DDD3B8]/40 pb-6">
            <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-[#232A16]">
              Contact Nutriverse
            </h1>
            <p className="text-xs text-[#6B7A45]">
              We welcome questions on grocery sourcing, Calin Pack formulation, and pilot partnerships.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-[#F6F1E4]/50 border border-[#DDD3B8]/60 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-[#3E4A26] text-[#F6F1E4] flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </div>
              <h3 className="font-heading text-xs font-bold text-[#232A16]">Email Inquiries</h3>
              <p className="text-[11px] text-[#6B7A45]">
                support@nutriverse.local
              </p>
              <p className="text-[10px] text-gray-500">
                Responses within 24 operational hours.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#F6F1E4]/50 border border-[#DDD3B8]/60 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-[#3E4A26] text-[#F6F1E4] flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <h3 className="font-heading text-xs font-bold text-[#232A16]">Pilot Fulfillment Hub</h3>
              <p className="text-[11px] text-[#6B7A45]">
                Vijayawada Pilot Zone, Andhra Pradesh, India
              </p>
              <p className="text-[10px] text-gray-500">
                Micro-fulfillment &amp; cold-chain testing center.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#F6F1E4]/50 border border-[#DDD3B8]/60 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-[#3E4A26] text-[#F6F1E4] flex items-center justify-center">
                <Phone className="w-4 h-4" />
              </div>
              <h3 className="font-heading text-xs font-bold text-[#232A16]">Customer Care</h3>
              <p className="text-[11px] text-[#6B7A45]">
                +91 (0866) 245-0000 (Demo Support)
              </p>
              <p className="text-[10px] text-gray-500">
                Monday – Saturday, 8:00 AM – 8:00 PM IST
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-[#DDD3B8]/40 flex flex-wrap gap-4 text-xs text-[#6B7A45]">
            <Link href="/privacy" className="hover:text-[#3E4A26] underline font-medium">
              Privacy Policy (Draft)
            </Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-[#3E4A26] underline font-medium">
              Terms of Concept (Draft)
            </Link>
            <span>•</span>
            <Link href="/explore" className="hover:text-[#3E4A26] underline font-medium">
              Browse Grocery Catalog
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
