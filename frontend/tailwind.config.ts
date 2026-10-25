import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        studio: {
          950: "#08090c",
          900: "#0f1117",
          850: "#141720",
          800: "#1a1e2a",
          750: "#222736",
          700: "#2c3245",
          600: "#3d455d",
          500: "#525c7a",
          400: "#7480a3",
          300: "#9da9cb",
          200: "#cbd5e8",
          100: "#e9edf5",
        },
        neon: {
          cyan: "#00f0ff",
          purple: "#a855f7",
          pink: "#ec4899",
          amber: "#f59e0b",
          green: "#10b981",
          crimson: "#ef4444",
        }
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      animation: {
        "pulse-glow": "pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "vu-bounce": "vuBounce 0.6s ease-in-out infinite alternate",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "1", filter: "drop-shadow(0 0 12px rgba(0, 240, 255, 0.5))" },
          "50%": { opacity: "0.6", filter: "drop-shadow(0 0 4px rgba(0, 240, 255, 0.2))" },
        },
        vuBounce: {
          "0%": { height: "15%" },
          "100%": { height: "95%" }
        }
      }
    },
  },
  plugins: [],
};

export default config;
