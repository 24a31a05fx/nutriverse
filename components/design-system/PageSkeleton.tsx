import React from "react";

export interface PageSkeletonProps {
  variant?: "card" | "rail" | "list" | "detail";
  count?: number;
  className?: string;
}

/**
 * PageSkeleton
 * Restrained loading placeholders with 1px border and 8-10px radius.
 */
export const PageSkeleton: React.FC<PageSkeletonProps> = ({
  variant = "card",
  count = 1,
  className = "",
}) => {
  const items = Array.from({ length: count });

  if (variant === "card") {
    return (
      <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 ${className}`}>
        {items.map((_, i) => (
          <div
            key={i}
            className="rounded-[10px] border border-[#DDD3B8] bg-white p-3 space-y-3 animate-pulse"
          >
            <div className="w-full h-32 rounded-[8px] bg-[#DDD3B8]/40" />
            <div className="space-y-1.5">
              <div className="w-3/4 h-3 rounded bg-[#DDD3B8]/50" />
              <div className="w-1/2 h-2.5 rounded bg-[#DDD3B8]/30" />
            </div>
            <div className="pt-2 border-t border-[#DDD3B8]/40 flex justify-between items-center">
              <div className="w-16 h-4 rounded bg-[#DDD3B8]/50" />
              <div className="w-14 h-6 rounded-[8px] bg-[#DDD3B8]/40" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "rail") {
    return (
      <div className={`flex gap-4 overflow-hidden py-2 ${className}`}>
        {items.map((_, i) => (
          <div
            key={i}
            className="w-48 shrink-0 rounded-[10px] border border-[#DDD3B8] bg-white p-3 space-y-3 animate-pulse"
          >
            <div className="w-full h-28 rounded-[8px] bg-[#DDD3B8]/40" />
            <div className="w-3/4 h-3 rounded bg-[#DDD3B8]/50" />
            <div className="w-1/2 h-2.5 rounded bg-[#DDD3B8]/30" />
            <div className="flex justify-between items-center pt-2">
              <div className="w-12 h-3.5 rounded bg-[#DDD3B8]/50" />
              <div className="w-12 h-6 rounded-[8px] bg-[#DDD3B8]/40" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className={`divide-y divide-[#DDD3B8] border border-[#DDD3B8] rounded-[10px] bg-white ${className}`}>
        {items.map((_, i) => (
          <div key={i} className="p-3.5 flex items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[8px] bg-[#DDD3B8]/40 shrink-0" />
              <div className="space-y-1">
                <div className="w-36 h-3 rounded bg-[#DDD3B8]/50" />
                <div className="w-24 h-2.5 rounded bg-[#DDD3B8]/30" />
              </div>
            </div>
            <div className="w-16 h-4 rounded bg-[#DDD3B8]/50" />
          </div>
        ))}
      </div>
    );
  }

  // detail variant
  return (
    <div className={`rounded-[10px] border border-[#DDD3B8] bg-white p-6 space-y-6 animate-pulse ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="w-full h-64 rounded-[8px] bg-[#DDD3B8]/40" />
        <div className="space-y-4">
          <div className="w-3/4 h-6 rounded bg-[#DDD3B8]/50" />
          <div className="w-1/2 h-3.5 rounded bg-[#DDD3B8]/30" />
          <div className="w-1/3 h-5 rounded bg-[#DDD3B8]/60" />
          <div className="space-y-2 pt-4">
            <div className="w-full h-2.5 rounded bg-[#DDD3B8]/30" />
            <div className="w-full h-2.5 rounded bg-[#DDD3B8]/30" />
            <div className="w-4/5 h-2.5 rounded bg-[#DDD3B8]/30" />
          </div>
        </div>
      </div>
    </div>
  );
};
