import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ─── Surfaces ─────────────────────────────
        void: "#09090b",
        surface: {
          DEFAULT: "#111114",
          raised: "#1a1a1f",
          overlay: "#222228",
        },

        // ─── Lavender (Primary Accent) ────────────
        lavender: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
        },

        // ─── Gold (GM / Secondary Accent) ─────────
        gold: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },

        // ─── Border ───────────────────────────────
        border: {
          DEFAULT: "#27272a",
          subtle: "#1e1e22",
          strong: "#3f3f46",
        },
      },

      fontFamily: {
        heading: ["var(--font-cinzel)", "serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },

      letterSpacing: {
        gothic: "0.05em",
        "gothic-wide": "0.08em",
      },

      boxShadow: {
        "glow-lavender": "0 0 20px rgba(167, 139, 250, 0.15)",
        "glow-gold": "0 0 20px rgba(251, 191, 36, 0.1)",
      },
    },
  },
  plugins: [],
};
export default config;
