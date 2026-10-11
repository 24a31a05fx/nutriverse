import React from "react";
import Link from "next/link";
import { Compass, Sparkles, Package, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
      <div className="w-20 h-20 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center shadow-lg mb-6">
        <Compass className="w-10 h-10 text-emerald-700 animate-spin-slow" />
      </div>

      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-3 py-1 rounded-full">
        404 — Page Not Found
      </span>

      <h1 className="text-2xl font-black text-emerald-950 mt-3">
        Looking for a Nutrient We Don&apos;t Have?
      </h1>

      <p className="text-xs text-gray-600 mt-2 leading-relaxed">
        The page or barcode you searched could not be located. Explore our whole-food catalog or discover curated Calin Packs.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-md transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Storefront
        </Link>
        <Link
          href="/explore"
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold border border-emerald-200 transition"
        >
          <Sparkles className="w-3.5 h-3.5" /> Food Explorer
        </Link>
        <Link
          href="/packs"
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold border border-gray-200 shadow-sm transition"
        >
          <Package className="w-3.5 h-3.5" /> Calin Packs
        </Link>
      </div>
    </div>
  );
}
