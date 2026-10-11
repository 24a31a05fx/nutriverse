import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  errorCode?: string;
  className?: string;
}

/**
 * ErrorState
 * Restrained error notification card with retry action.
 * Follows 1px border, 8-10px radius, 12-14px text.
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  errorCode,
  className = "",
}) => {
  return (
    <div
      role="alert"
      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-[10px] border border-[#C1872B]/40 bg-[#C1872B]/5 text-[#232A16] ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-[#C1872B] shrink-0 mt-0.5" />
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-[#232A16]">{title}</h4>
            {errorCode && (
              <span className="font-mono text-[10px] text-[#6B7A45] bg-[#F6F1E4] px-1.5 py-0.5 rounded-[4px]">
                {errorCode}
              </span>
            )}
          </div>
          <p className="text-xs text-[#6B7A45] mt-0.5 leading-relaxed">
            {message}
          </p>
        </div>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[8px] border border-[#DDD3B8] bg-white text-[#232A16] hover:bg-[#F6F1E4] hover:border-[#6B7A45] transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-[#3E4A26]/30"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#3E4A26]" />
          <span>{retryLabel}</span>
        </button>
      )}
    </div>
  );
};
