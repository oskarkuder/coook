import type { Config } from "tailwindcss";

/**
 * Deliberately tiny design system: white background, near-black text, one grey
 * border colour, one accent. Everything else is spacing and type scale.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111111",
        muted: "#6B7280",
        line: "#E5E7EB",
        surface: "#FAFAFA",
        danger: "#B42318",
        ok: "#067647",
        // The one accent. Reserved for the actions that matter: make a recipe,
        // subscribe, sign up. Black text on it passes contrast comfortably.
        accent: "#FFC400",
        "accent-hover": "#F0B800",
        "accent-soft": "#FFF7DB",
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },
      maxWidth: {
        content: "44rem",
        wide: "64rem",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
