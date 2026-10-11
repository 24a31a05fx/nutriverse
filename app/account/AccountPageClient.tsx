"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { CustomerDashboardView } from "@/components/CustomerDashboardView";
import { useNutriverse } from "@/components/NutriverseProvider";
import { Lock } from "lucide-react";

export default function AccountPageClient() {
  const router = useRouter();
  const { currentUser, profile, setOnboardingOpen, setAuthModalOpen } = useNutriverse();

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-5 animate-in fade-in">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Member Hub Access</h1>
          <p className="text-xs text-gray-500 mt-1">
            Please sign in to view your saved Mifflin-St Jeor nutrition goals, past orders, and subscriptions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="w-full py-3 rounded-full bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-900 transition shadow-md"
        >
          Sign In / Create Account
        </button>
      </div>
    );
  }

  return (
    <CustomerDashboardView
      user={currentUser}
      profile={profile}
      onOpenOnboarding={() => setOnboardingOpen(true)}
      onNavigateTab={(tab) => {
        if (tab === "orders") router.push("/orders");
        else if (tab === "packs") router.push("/packs");
        else router.push("/");
      }}
    />
  );
}
