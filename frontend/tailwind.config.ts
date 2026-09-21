import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Quantum Research Brand
        "brand-primary": "#2D3C8F",
        "brand-primary-light": "#3447A8",
        "brand-primary-dark": "#1E2A6E",
        "cta": "#ED1B24",
        "cta-alt": "#FF3B30",

        // Neutral surfaces
        "neutral": "#F4F5F7",
        "card-bg": "#FFFFFF",
        "card-border": "#E4E7EE",
        "heading-light": "#FFFFFF",
        "body-light": "#E2E4ED",
        "heading-dark": "#1A1D24",
        "body-dark": "#333A46",
        "text-muted": "#6B7280",
        "cream": "#FAF6EE",
        "cream-dark": "#F3EDE0",

        // Legacy aliases
        ink: "#1A1D24",
        panel: "#F4F5F7",
        brand: "#2D3C8F",

        // Semantic palette (real colors, not brand remaps)
        green: {
          50: "#ECFDF5",
          100: "#D1FAE5",
          200: "#A7F3D0",
          400: "#34D399",
          500: "#10B981",
          600: "#059669",
          700: "#047857",
          800: "#065F46"
        },
        red: {
          50: "#FEF2F2",
          100: "#FEE2E2",
          200: "#FECACA",
          400: "#F87171",
          500: "#EF4444",
          600: "#DC2626",
          700: "#B91C1C",
          800: "#991B1B"
        },
        amber: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          400: "#FBBF24",
          500: "#F59E0B",
          700: "#B45309",
          800: "#92400E"
        },
        blue: {
          50: "#EFF3FF",
          100: "#DBE4FF",
          200: "#B9CBFF",
          400: "#6A8DFF",
          600: "#3447A8",
          800: "#2D3C8F"
        },
        gray: {
          100: "#F4F5F7",
          200: "#E4E7EE",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#4B5563",
          700: "#333A46",
          800: "#1A1D24",
          900: "#111827"
        },
        slate: {
          100: "#F4F5F7",
          200: "#E4E7EE",
          300: "#D1D5DB",
          500: "#6B7280",
          600: "#4B5563"
        },
        teal: {
          500: "#14B8A6",
          700: "#0F766E",
          800: "#115E59"
        }
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"]
      },
      borderRadius: {
        card: "16px",
        btn: "10px",
        input: "10px",
        modal: "18px"
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
        "card-hover": "0 4px 12px rgba(16, 24, 40, 0.08)",
        modal: "0 12px 32px rgba(16, 24, 40, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
