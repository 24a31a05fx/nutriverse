"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CustomerDashboardView } from "@/components/CustomerDashboardView";
import { useNutriverse } from "@/components/NutriverseProvider";

export default function AccountPageClient() {
  const router = useRouter();
  const {
    currentUser,
    sessionReady,
    profile,
    setOnboardingOpen,
    setAuthModalOpen,
  } = useNutriverse();

  useEffect(() => {
    if (sessionReady && !currentUser) {
      setAuthModalOpen(true);
      router.replace("/");
    }
  }, [currentUser, router, sessionReady, setAuthModalOpen]);

  if (!sessionReady || !currentUser) {
    return (
      <div className="px-4 py-16 text-center text-sm text-gray-500" role="status">
        {sessionReady ? "Redirecting to sign in…" : "Checking your session…"}
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
