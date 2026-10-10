import type { Config } from "tailwindcss";

const v = (n: string) => `rgb(var(--${n}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        surface2: v("surface-2"),
        line: v("line"),
        ink: v("ink"),
        muted: v("muted"),
        accent: v("accent"),
        accentStrong: v("accent-strong"),
        onAccent: v("on-accent"),
        danger: v("danger"),
        ok: v("ok"),
        warn: v("warn"),
        lav: v("lav"),
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        serif: ['"IBM Plex Serif"', "Georgia", "serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: { card: "0 1px 0 rgb(255 255 255 / 0.03) inset, 0 8px 24px rgb(0 0 0 / 0.25)" },
    },
  },
  plugins: [],
} satisfies Config;
