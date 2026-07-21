/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // "The Ledger" — a warm paper-and-ink meeting notebook.
        paper: "#FBFAF6", // app background
        surface: "#FFFFFF", // writing surface / cards
        panel: "#F2F0E8", // sidebar
        ink: {
          DEFAULT: "#191A17", // primary text
          soft: "#42443D", // secondary text
        },
        muted: "#7C7F74", // captions, mono labels
        line: {
          DEFAULT: "#E7E4DA", // hairline rules
          strong: "#D6D2C5",
        },
        // The single reserved accent: a highlighter marker.
        marker: "#FFD24D", // translucent wash for selection
        accent: {
          DEFAULT: "#B4530C", // deep amber for links, focus, active text
          soft: "#E0920F",
        },
        danger: "#A63328",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        // Reading pane: a system serif for reviewing a written record.
        serif: [
          "Iowan Old Style",
          "Palatino Linotype",
          "Palatino",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "serif",
        ],
        // Data face: timestamps, save-state, structural markers.
        mono: [
          "ui-monospace",
          "SF Mono",
          "JetBrains Mono",
          "Menlo",
          "Cascadia Code",
          "Consolas",
          "monospace",
        ],
      },
      letterSpacing: {
        eyebrow: "0.14em",
      },
    },
  },
  plugins: [],
};
