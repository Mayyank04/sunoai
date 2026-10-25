import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "cyan" | "purple" | "emerald" | "amber" | "crimson" | "outline";
}

export const Badge: React.FC<BadgeProps> = ({
  className = "",
  variant = "default",
  children,
  ...props
}) => {
  const base =
    "inline-flex items-center gap-1 font-mono font-semibold text-[10px] px-2 py-0.5 rounded-md border tracking-wider uppercase select-none";

  const variants = {
    default: "bg-studio-800 text-studio-300 border-studio-700",
    cyan: "bg-neon-cyan/15 text-neon-cyan border-neon-cyan/30",
    purple: "bg-neon-purple/15 text-neon-purple border-neon-purple/30",
    emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    crimson: "bg-neon-crimson/15 text-neon-crimson border-neon-crimson/30",
    outline: "bg-transparent text-studio-400 border-studio-700",
  };

  return (
    <span className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
};
