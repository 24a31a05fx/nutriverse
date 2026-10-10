"use client";

import React from "react";
import Link from "next/link";
import { AdminPortalView } from "@/components/AdminPortalView";
import { useNutriverse } from "@/components/NutriverseProvider";
import { ShieldAlert, LogIn, ArrowLeft } from "lucide-react";

export default function AdminPageClient() {
  const { currentUser, setAuthModalOpen } = useNutriverse();

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-5 animate-in fade-in">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-50 text-amber-700 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin Authentication Required</h1>
          <p className="text-xs text-gray-500 mt-1">
            Access to inventory operations, stock thresholds, and live dispatch logs requires an Administrator session.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="w-full py-3 rounded-full bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-900 transition shadow-md"
        >
          Sign In to Access Console
        </button>
      </div>
    );
  }

  if (currentUser.role !== "admin") {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-5 animate-in fade-in">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-red-50 text-red-600 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Access Denied (Role: {currentUser.role})</h1>
          <p className="text-xs text-gray-500 mt-1">
            Your account does not hold Administrator privileges.
          </p>
        </div>
        <div className="flex justify-center gap-3">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-full bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200"
          >
            Return to Store
          </Link>
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="px-5 py-2.5 rounded-full bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-900"
          >
            Switch Account
          </button>
        </div>
      </div>
    );
  }

  return <AdminPortalView user={currentUser} />;
}
