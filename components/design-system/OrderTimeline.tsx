import React from "react";
import { CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";

export type DemoOrderStatus =
  | "placed_demo"
  | "preparing_demo"
  | "completed_demo"
  | "cancelled_demo";

export interface OrderTimelineProps {
  status: DemoOrderStatus | string;
  createdAt: string;
  orderId: string;
  cancelledAt?: string;
  className?: string;
}

const DEMO_STEPS: Array<{ id: DemoOrderStatus; label: string }> = [
  { id: "placed_demo", label: "Demo Order Placed" },
  { id: "preparing_demo", label: "Preparing Demo Items" },
  { id: "completed_demo", label: "Completed Demo" },
];

/**
 * OrderTimeline
 * Order status timeline restricted to client-demo MVP:
 * - Statuses: placed_demo, preparing_demo, completed_demo, cancelled_demo
 * - Explicit label: "Demo order only"
 * - No invented ETA, real delivery tracking or delivery promises
 */
export const OrderTimeline: React.FC<OrderTimelineProps> = ({
  status,
  createdAt,
  orderId,
  cancelledAt,
  className = "",
}) => {
  const isCancelled = status === "cancelled_demo" || status === "cancelled";

  // Map legacy/simple statuses to demo statuses if needed
  let normalizedStatus: DemoOrderStatus = "placed_demo";
  if (status === "cancelled_demo" || status === "cancelled") {
    normalizedStatus = "cancelled_demo";
  } else if (status === "completed_demo" || status === "delivered") {
    normalizedStatus = "completed_demo";
  } else if (status === "preparing_demo" || status === "preparing" || status === "out_for_delivery") {
    normalizedStatus = "preparing_demo";
  } else {
    normalizedStatus = "placed_demo";
  }

  const currentStepIndex = DEMO_STEPS.findIndex((s) => s.id === normalizedStatus);

  return (
    <div
      className={`rounded-[10px] border border-[#DDD3B8] bg-white p-4 space-y-4 ${className}`}
    >
      {/* Top Banner: Mandatory Demo Order Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DDD3B8]">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-heading text-sm font-bold text-[#232A16]">
              Order #{orderId.slice(0, 8)}
            </h4>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-[4px] bg-[#C1872B]/10 text-[#C1872B] border border-[#C1872B]/30">
              Demo order only
            </span>
          </div>
          <span className="text-xs text-[#6B7A45] block mt-0.5">
            Placed on {new Date(createdAt).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>

        {isCancelled ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-[6px] bg-red-50 text-red-700 border border-red-200 self-start sm:self-auto">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            <span>Cancelled</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-[6px] bg-[#3E4A26]/10 text-[#3E4A26] border border-[#3E4A26]/20 self-start sm:self-auto">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#3E4A26]" />
            <span className="capitalize">{normalizedStatus.replace("_demo", "").replace("_", " ")}</span>
          </span>
        )}
      </div>

      {/* Timeline Steps or Cancelled Alert */}
      {isCancelled ? (
        <div className="p-3 rounded-[8px] bg-red-50/50 border border-red-200 text-xs text-red-800 space-y-1">
          <p className="font-semibold">Demo Order Cancelled</p>
          <p className="text-[11px] text-red-700">
            This demo order was cancelled {cancelledAt ? `at ${cancelledAt}` : ""}. Reserved demo stock has been restored.
          </p>
        </div>
      ) : (
        <div className="py-2">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-[#6B7A45] mb-3">
            Fulfillment Timeline (Demo Order)
          </h5>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_STEPS.map((step, idx) => {
              const isPast = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              const isUpcoming = idx > currentStepIndex;

              return (
                <div key={step.id} className="flex flex-col items-center text-center space-y-1.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                      isPast
                        ? "bg-[#3E4A26] text-[#F6F1E4] border-[#3E4A26]"
                        : isCurrent
                        ? "bg-[#3E4A26] text-[#F6F1E4] border-[#3E4A26] ring-2 ring-[#3E4A26]/30"
                        : "bg-white text-[#6B7A45] border-[#DDD3B8]"
                    }`}
                  >
                    {isPast ? (
                      <CheckCircle2 className="w-4 h-4 text-[#F6F1E4]" />
                    ) : isCurrent ? (
                      <Clock className="w-4 h-4 text-[#F6F1E4]" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-semibold leading-tight ${
                      isCurrent || isPast ? "text-[#232A16]" : "text-[#6B7A45]"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Disclaimer */}
      <div className="pt-2 text-[11px] text-[#6B7A45] bg-[#F6F1E4]/50 p-2.5 rounded-[8px] border border-[#DDD3B8]/60 flex items-start gap-2">
        <AlertCircle className="w-3.5 h-3.5 text-[#3E4A26] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Demo fulfillment lifecycle. No physical delivery is booked or in transit.
        </p>
      </div>
    </div>
  );
};
