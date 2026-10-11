import React from "react";
import { formatInrPaise } from "./PriceTag";
import { ShieldCheck, ArrowRight } from "lucide-react";

export interface CartSummaryProps {
  subtotalPaise: number;
  deliveryFeePaise: number;
  discountPaise?: number;
  taxPaise?: number;
  totalPaise: number;
  onCheckout?: () => void;
  checkoutLabel?: string;
  checkoutDisabled?: boolean;
  className?: string;
}

/**
 * CartSummary
 * Authoritative financial breakdown for cart drawer and checkout review.
 * Follows dense layout: 1px border, 8-10px radius, Figtree UI.
 */
export const CartSummary: React.FC<CartSummaryProps> = ({
  subtotalPaise,
  deliveryFeePaise,
  discountPaise = 0,
  taxPaise = 0,
  totalPaise,
  onCheckout,
  checkoutLabel = "Proceed to Checkout",
  checkoutDisabled = false,
  className = "",
}) => {
  return (
    <div
      className={`rounded-[10px] border border-[#DDD3B8] bg-white p-4 space-y-3 ${className}`}
    >
      <h3 className="font-heading text-sm font-bold text-[#232A16] pb-2 border-b border-[#DDD3B8]">
        Order Summary
      </h3>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between text-[#6B7A45]">
          <span>Bag Subtotal</span>
          <span className="font-mono font-semibold text-[#232A16]">
            {formatInrPaise(subtotalPaise)}
          </span>
        </div>

        {discountPaise > 0 && (
          <div className="flex justify-between text-[#C1872B]">
            <span>Catalog Savings</span>
            <span className="font-mono font-semibold">
              -{formatInrPaise(discountPaise)}
            </span>
          </div>
        )}

        <div className="flex justify-between text-[#6B7A45]">
          <span>Delivery</span>
          <span className="font-mono font-semibold text-[#232A16]">
            {deliveryFeePaise === 0 ? "FREE" : formatInrPaise(deliveryFeePaise)}
          </span>
        </div>

        {taxPaise > 0 && (
          <div className="flex justify-between text-[#6B7A45]">
            <span>GST (Included)</span>
            <span className="font-mono font-semibold text-[#232A16]">
              {formatInrPaise(taxPaise)}
            </span>
          </div>
        )}

        <div className="pt-2 border-t border-[#DDD3B8] flex justify-between items-baseline text-sm font-bold text-[#232A16]">
          <span>Total Amount</span>
          <span className="font-mono text-base font-black text-[#3E4A26]">
            {formatInrPaise(totalPaise)}
          </span>
        </div>
      </div>

      {onCheckout && (
        <div className="pt-2">
          <button
            type="button"
            disabled={checkoutDisabled}
            onClick={onCheckout}
            className={`w-full py-2.5 px-4 text-xs font-bold rounded-[8px] bg-[#3E4A26] text-[#F6F1E4] hover:bg-[#232A16] transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#3E4A26]/30 ${
              checkoutDisabled ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <span>{checkoutLabel}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="pt-2 text-[10px] text-[#6B7A45] flex items-center gap-1.5 justify-center">
        <ShieldCheck className="w-3.5 h-3.5 text-[#3E4A26]" />
        <span>Authoritative server-computed pricing quote</span>
      </div>
    </div>
  );
};
