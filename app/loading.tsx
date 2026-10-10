import React from "react";
import { Sparkles } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-3xl bg-emerald-950 flex items-center justify-center shadow-xl animate-pulse">
          <span className="text-2xl font-black text-emerald-400">N</span>
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center shadow-md animate-bounce">
          <Sparkles className="w-3.5 h-3.5 text-emerald-950" />
        </div>
      </div>
      <h3 className="text-lg font-bold text-emerald-950 tracking-tight">
        Loading Nutrition Intelligence
      </h3>
      <p className="text-xs text-gray-500 mt-1 max-w-xs">
        Preparing verified whole-food nutrient profiles and bioactive food combinations...
      </p>
    </div>
  );
}
