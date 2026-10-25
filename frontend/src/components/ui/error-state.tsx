import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "./button";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  message,
  onRetry,
}) => {
  return (
    <div className="bg-neon-crimson/10 border border-neon-crimson/25 rounded-2xl p-6 max-w-lg mx-auto text-center space-y-3">
      <div className="w-10 h-10 rounded-xl bg-neon-crimson/20 border border-neon-crimson/30 flex items-center justify-center mx-auto text-neon-crimson">
        <AlertCircle className="w-5 h-5" />
      </div>
      <div>
        <h4 className="font-bold text-sm text-studio-100">{title}</h4>
        <p className="text-xs text-neon-crimson/90 mt-1">{message}</p>
      </div>
      {onRetry && (
        <div className="pt-2">
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </Button>
        </div>
      )}
    </div>
  );
};
