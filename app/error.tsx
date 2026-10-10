"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-3xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shadow-lg mb-6">
        <AlertCircle className="w-8 h-8" />
      </div>

      <span className="text-[11px] font-bold uppercase tracking-wider text-red-700 bg-red-100/60 px-3 py-1 rounded-full">
        Application Notice
      </span>

      <h1 className="text-2xl font-bold text-gray-900 mt-3">
        Something unexpected happened
      </h1>

      <p className="text-xs text-gray-600 mt-2 leading-relaxed">
        {error?.message ||
          "We encountered an issue while loading this section of the nutrition platform. Your cart and profile remain preserved."}
      </p>

      <div className="flex items-center gap-3 mt-6">
        <button
          type="button"
          onClick={() => reset()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-md transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Try Again
        </button>

        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold border border-gray-200 shadow-sm transition"
        >
          <Home className="w-3.5 h-3.5" /> Return to Storefront
        </Link>
      </div>
    </div>
  );
}
