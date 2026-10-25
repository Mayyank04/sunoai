import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "neon";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "secondary", size = "md", isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-neon-cyan/40 disabled:opacity-50 disabled:pointer-events-none select-none";

    const variants = {
      primary: "bg-neon-cyan text-studio-950 font-bold hover:brightness-110 shadow-lg shadow-neon-cyan/20",
      neon: "bg-gradient-to-r from-neon-cyan to-neon-purple text-studio-950 font-bold hover:opacity-95 shadow-lg shadow-neon-cyan/25",
      secondary: "bg-studio-850 hover:bg-studio-800 text-studio-100 border border-studio-700/60 shadow-sm",
      outline: "border border-studio-700 hover:border-studio-500 text-studio-200 hover:bg-studio-850/60",
      ghost: "text-studio-400 hover:text-studio-100 hover:bg-studio-850/50",
      danger: "bg-neon-crimson/15 text-neon-crimson border border-neon-crimson/30 hover:bg-neon-crimson/25",
    };

    const sizes = {
      sm: "text-xs px-3 py-1.5 gap-1.5",
      md: "text-xs px-4 py-2.5 gap-2",
      lg: "text-sm px-6 py-3.5 gap-2.5",
      icon: "w-9 h-9 p-0",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-current" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
