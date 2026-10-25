import React from "react";
import { LucideIcon, Sparkles } from "lucide-react";
import { Button } from "./button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Sparkles,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}) => {
  return (
    <div className="bg-studio-900/50 border border-dashed border-studio-800 rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-studio-850 border border-studio-750 flex items-center justify-center mx-auto text-neon-cyan shadow-lg">
        <Icon className="w-6 h-6" />
      </div>
      <div className="space-y-1.5">
        <h3 className="font-bold text-base text-studio-100">{title}</h3>
        <p className="text-xs text-studio-400 leading-relaxed max-w-sm mx-auto">{description}</p>
      </div>
      {(actionLabel && (actionHref || onAction)) && (
        <div className="pt-2">
          {actionHref ? (
            <a href={actionHref}>
              <Button variant="neon">{actionLabel}</Button>
            </a>
          ) : (
            <Button variant="neon" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
