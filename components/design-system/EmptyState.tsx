import React from "react";
import { PackageOpen } from "lucide-react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * EmptyState
 * Clean, restrained empty state container with 1px border and 8-10px radius.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-[10px] border border-[#DDD3B8] bg-white ${className}`}
    >
      <div className="w-12 h-12 mb-3 rounded-[8px] bg-[#F6F1E4] border border-[#DDD3B8] flex items-center justify-center text-[#3E4A26]">
        {icon || <PackageOpen className="w-6 h-6" />}
      </div>
      <h3 className="font-heading text-base font-bold text-[#232A16] mb-1">
        {title}
      </h3>
      <p className="text-xs text-[#6B7A45] max-w-sm mb-4 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-[8px] bg-[#3E4A26] text-[#F6F1E4] hover:bg-[#232A16] transition-colors focus:outline-none focus:ring-2 focus:ring-[#3E4A26]/30"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
