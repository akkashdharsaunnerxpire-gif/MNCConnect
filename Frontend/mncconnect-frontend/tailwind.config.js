import colors from "tailwindcss/colors";

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const channels = (hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");

// colour = theme variable when the fresher theme is active, otherwise the normal Tailwind colour
// (so the mentor side keeps its original colours)
const pal = (name, token) =>
  Object.fromEntries(
    SHADES.map((s) => [
      s,
      `rgb(var(--t-${token}-${s}, ${channels(colors[name][s])}) / <alpha-value>)`,
    ]),
  );

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: pal("slate", "n"),
        gray: pal("gray", "n"),
        zinc: pal("zinc", "n"),
        neutral: pal("neutral", "n"),
        stone: pal("stone", "n"),
        blue: pal("blue", "a"),
        indigo: pal("indigo", "a"),
        sky: pal("sky", "a"),
        cyan: pal("cyan", "a"),
        violet: pal("violet", "a"),
        purple: pal("purple", "a"),
        teal: pal("teal", "a"),
        emerald: pal("emerald", "emerald"),
        green: pal("green", "green"),
        red: pal("red", "red"),
        amber: pal("amber", "amber"),
        yellow: pal("yellow", "yellow"),
        orange: pal("orange", "orange"),
        rose: pal("rose", "rose"),
      },
      animation: {
        fadeIn: "fadeIn 0.3s ease-in-out",
        slideIn: "slideIn 0.3s ease-in-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(100px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};